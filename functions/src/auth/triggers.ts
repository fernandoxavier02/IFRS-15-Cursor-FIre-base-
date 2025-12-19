import * as functions from "firebase-functions";
import { auth, db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

// Trigger when a new user is created in Firebase Auth
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  console.log("New user created:", user.uid, user.email);

  // Check if user document already exists (may have been created by registerCompany)
  // This prevents race condition where registerCompany creates user with full data
  // and this trigger overwrites it with minimal data
  try {
    const userDocRef = db.collection(COLLECTIONS.USERS).doc(user.uid);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      // User document already exists with complete data (from registerCompany)
      // Only update missing fields if any, using merge
      const existingData = userDoc.data();
      const updateData: any = {};

      // Only set defaults if field doesn't exist
      if (!existingData?.email && user.email) updateData.email = user.email;
      if (!existingData?.fullName && user.displayName) updateData.fullName = user.displayName;
      if (!existingData?.createdAt) updateData.createdAt = Timestamp.now();

      if (Object.keys(updateData).length > 0) {
        await userDocRef.update(updateData);
        console.log("User document updated with missing fields:", user.uid);
      } else {
        console.log("User document already exists with complete data, skipping:", user.uid);
      }
    } else {
      // User document doesn't exist, create basic profile
      // This handles users created outside of registerCompany flow
      await userDocRef.set({
        id: user.uid,
        email: user.email || "",
        fullName: user.displayName || "",
        createdAt: Timestamp.now(),
        isActive: false,
        mustChangePassword: true,
        role: "readonly",
      });

      console.log("User document created for:", user.uid);
    }
  } catch (error) {
    console.error("Error creating user document:", error);
  }
});

// Trigger when a user is deleted from Firebase Auth
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  console.log("User deleted:", user.uid);

  try {
    // Delete user document from root users collection
    await db.collection(COLLECTIONS.USERS).doc(user.uid).delete();

    // Find and delete user from tenant subcollection
    const userCustomClaims = user.customClaims as { tenantId?: string } | undefined;
    if (userCustomClaims?.tenantId) {
      const tenantUsersRef = db.collection(
        tenantCollection(userCustomClaims.tenantId, COLLECTIONS.USERS)
      );
      const userDoc = await tenantUsersRef.doc(user.uid).get();
      if (userDoc.exists) {
        await userDoc.ref.delete();
      }
    }

    console.log("User documents deleted for:", user.uid);
  } catch (error) {
    console.error("Error deleting user documents:", error);
  }
});

// Callable function to set custom claims (admin only)
export const setUserClaims = functions.https.onCall(async (data, context) => {
  // Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  // Verify caller is system admin or tenant admin
  const callerClaims = context.auth.token;
  if (!callerClaims.systemAdmin && callerClaims.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  const { userId, tenantId, role } = data;

  if (!userId || !tenantId || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  const validRoles = ["admin", "finance", "auditor", "operations", "readonly"];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid role");
  }

  try {
    // Set custom claims
    await auth.setCustomUserClaims(userId, {
      tenantId,
      role,
      systemAdmin: false,
    });

    // Update user document
    await db.collection(COLLECTIONS.USERS).doc(userId).update({
      tenantId,
      role,
      updatedAt: Timestamp.now(),
    });

    // Also update/create in tenant subcollection
    const tenantUserRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
      .doc(userId);
    
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    if (userDoc.exists) {
      await tenantUserRef.set({
        ...userDoc.data(),
        tenantId,
        role,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }

    return { success: true };
  } catch (error) {
    console.error("Error setting user claims:", error);
    throw new functions.https.HttpsError("internal", "Failed to set claims");
  }
});

// Callable function to create a new user with tenant
export const createUserWithTenant = functions.https.onCall(async (data, context) => {
  // Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  // Verify caller is system admin or tenant admin
  const callerClaims = context.auth.token;
  if (!callerClaims.systemAdmin && callerClaims.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  const { 
    email, 
    password, 
    fullName, 
    tenantId: providedTenantId, 
    tenantName,
    role,
    planType = "professional",
    seatCount = 1
  } = data;

  if (!email || !fullName) {
    throw new functions.https.HttpsError("invalid-argument", "Email and fullName are required");
  }

  // Generate tenantId from email if not provided
  // STRATEGY: ONE TENANT PER COMPANY (domain-based grouping)
  // - Users from same company (same email domain) share the same tenant
  // - tenantId = email domain (part after @), sanitized for Firestore document ID
  // Example:
  //   - joao@empresa.com.br  → tenant: "empresa-com-br" (sanitized)
  //   - maria@empresa.com.br → tenant: "empresa-com-br" (same tenant, shared data)
  //   - pedro@outra.com      → tenant: "outra-com" (different tenant, isolated)
  const emailParts = email.split("@");
  if (emailParts.length < 2) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid email format");
  }
  
  // Extract domain and sanitize for Firestore document ID
  // Firestore document IDs can contain letters, numbers, underscores, and hyphens
  // Replace dots and special chars with hyphens, keep only alphanumeric and hyphens
  const emailDomain = emailParts[1].toLowerCase();
  const sanitizedTenantId = emailDomain
    .replace(/\./g, "-")                    // Replace dots with hyphens
    .replace(/[^a-z0-9-]/g, "")             // Remove invalid characters
    .replace(/^-+|-+$/g, "")                // Remove leading/trailing hyphens
    .replace(/-+/g, "-");                   // Replace multiple hyphens with single
  
  // Determine tenantId: use provided, or generate from tenantName, or from email domain
  let finalTenantId: string;
  if (providedTenantId) {
    // Use explicitly provided tenantId
    finalTenantId = providedTenantId;
  } else if (tenantName) {
    // Generate tenantId from provided tenantName (sanitize it)
    finalTenantId = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  } else {
    // Fallback: use email domain as tenantId
    finalTenantId = sanitizedTenantId;
  }

  // Tenant name: use provided name, or generate from email domain
  const domainName = emailDomain.split(".")[0];
  const finalTenantName = tenantName || (domainName.charAt(0).toUpperCase() + domainName.slice(1));
  
  // Use finalTenantId for tenant document
  const tenantId = finalTenantId;

  // Generate password if not provided
  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 16; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };
  const finalPassword = password || generatePassword();
  const finalRole = role || "admin";

  // If not system admin, verify caller belongs to the target tenant or allow creating new tenant
  if (!callerClaims.systemAdmin && callerClaims.tenantId && callerClaims.tenantId !== tenantId) {
    throw new functions.https.HttpsError("permission-denied", "Cannot create user in different tenant");
  }

  try {
    // 1. Check if tenant exists, create if not
    const tenantRef = db.collection(COLLECTIONS.TENANTS).doc(tenantId);
    const tenantDoc = await tenantRef.get();
    const tenantExists = tenantDoc.exists;

    if (!tenantExists) {
      console.log(`[createUserWithTenant] Creating new tenant: ${tenantId}`);
      
      // Determine plan limits based on planType
      const planLimits: Record<string, { maxContracts: number; maxUsers: number }> = {
        starter: { maxContracts: 10, maxUsers: 1 },
        professional: { maxContracts: 30, maxUsers: 3 },
        enterprise: { maxContracts: -1, maxUsers: -1 },
      };
      const limits = planLimits[planType] || planLimits.professional;

      await tenantRef.set({
        id: tenantId,
        name: finalTenantName,
        slug: tenantId,
        plan: planType,
        planType: planType,
        maxContracts: limits.maxContracts,
        maxLicenses: limits.maxUsers,
        status: "active",
        settings: {
          defaultCurrency: "BRL",
          fiscalYearEnd: "12-31",
          timezone: "America/Sao_Paulo",
        },
        createdAt: Timestamp.now(),
      });
      console.log(`[createUserWithTenant] Tenant created: ${tenantId}`);
    } else {
      console.log(`[createUserWithTenant] Tenant already exists: ${tenantId}`);
    }

    // 2. Create user in Firebase Auth
    let userRecord;
    let passwordWasGenerated = !password;
    
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`[createUserWithTenant] User already exists: ${email}`);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        userRecord = await auth.createUser({
      email,
          password: finalPassword,
      displayName: fullName,
          emailVerified: false,
    });
        console.log(`[createUserWithTenant] User created in Auth: ${email}`);
      } else {
        throw error;
      }
    }

    // 3. Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId,
      role: finalRole,
      systemAdmin: false,
    });

    const now = Timestamp.now();
    const userData = {
      id: userRecord.uid,
      email,
      fullName,
      username: email.split("@")[0],
      tenantId,
      role: finalRole,
      isActive: true, // Activate user automatically when creating with tenant
      mustChangePassword: passwordWasGenerated,
      createdAt: now,
    };

    // 4. Create user document in root collection
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData, { merge: true });

    // 5. Create user document in tenant subcollection
    await db
      .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
      .doc(userRecord.uid)
      .set(userData, { merge: true });

    // 6. Create license for the user
    const licenseKey = `LIC-${tenantId.toUpperCase()}-${Date.now()}`;
    const licenseRef = await db.collection(tenantCollection(tenantId, COLLECTIONS.LICENSES)).add({
      tenantId,
      licenseKey,
      status: "active",
      plan: planType,
      seatCount: seatCount,
      maxUsers: seatCount,
      activatedAt: now,
      activatedByUserId: userRecord.uid,
      currentUserId: userRecord.uid,
      createdAt: now,
    });

    // 7. Update user with license key
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).update({
      licenseKey,
      licenseActivatedAt: now,
    });

    // 8. Update tenant user document with license
    await db
      .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
      .doc(userRecord.uid)
      .update({
        licenseKey,
        licenseActivatedAt: now,
      });

    // 9. Send email with credentials (if email service is available)
    let emailSent = false;
    try {
      // TODO: Implement email sending here
      // For now, just log that we would send email
      console.log(`[createUserWithTenant] Would send email to: ${email}`);
      emailSent = false; // Set to true when email service is implemented
    } catch (emailError) {
      console.error("[createUserWithTenant] Error sending email:", emailError);
    }

    return {
      success: true,
      userId: userRecord.uid,
      tenantId,
      licenseId: licenseRef.id,
      credentials: {
        email,
        password: passwordWasGenerated ? finalPassword : undefined, // Only return if generated
        licenseKey,
      },
      emailSent,
    };
  } catch (error: any) {
    console.error("[createUserWithTenant] Error:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create user with tenant");
  }
});

// Callable function to activate user license
export const activateUserLicense = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const { licenseKey } = data;
  const userId = context.auth.uid;
  const clientIp = context.rawRequest.ip || "unknown";

  if (!licenseKey) {
    throw new functions.https.HttpsError("invalid-argument", "License key required");
  }

  try {
    // Find license by key (search across all tenants)
    const tenantsSnapshot = await db.collection(COLLECTIONS.TENANTS).get();
    let foundLicense: FirebaseFirestore.DocumentSnapshot | null = null;
    let foundTenantId: string | null = null;

    for (const tenant of tenantsSnapshot.docs) {
      const licensesSnapshot = await db
        .collection(tenantCollection(tenant.id, COLLECTIONS.LICENSES))
        .where("licenseKey", "==", licenseKey)
        .limit(1)
        .get();

      if (!licensesSnapshot.empty) {
        foundLicense = licensesSnapshot.docs[0];
        foundTenantId = tenant.id;
        break;
      }
    }

    if (!foundLicense || !foundTenantId) {
      throw new functions.https.HttpsError("not-found", "Invalid license key");
    }

    const licenseData = foundLicense.data();
    
    if (licenseData?.status !== "active") {
      throw new functions.https.HttpsError("failed-precondition", "License is not active");
    }

    if (licenseData?.activatedByUserId && licenseData.activatedByUserId !== userId) {
      throw new functions.https.HttpsError("failed-precondition", "License already activated by another user");
    }

    const now = Timestamp.now();

    // Update license
    await foundLicense.ref.update({
      activatedAt: now,
      activatedByUserId: userId,
      activationIp: clientIp,
      currentUserId: userId,
      currentIp: clientIp,
      lockedAt: now,
      lastSeenAt: now,
    });

    // Update user
    await db.collection(COLLECTIONS.USERS).doc(userId).update({
      isActive: true,
      licenseKey,
      licenseActivatedAt: now,
      tenantId: foundTenantId,
    });

    // Update tenant user document
    await db
      .collection(tenantCollection(foundTenantId, COLLECTIONS.USERS))
      .doc(userId)
      .update({
        isActive: true,
        licenseKey,
        licenseActivatedAt: now,
      });

    // Update custom claims with tenant
    const userRecord = await auth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};
    await auth.setCustomUserClaims(userId, {
      ...currentClaims,
      tenantId: foundTenantId,
    });

    // Create license session
    await db
      .collection(`${foundLicense.ref.path}/sessions`)
      .add({
        licenseId: foundLicense.id,
        ip: clientIp,
        userId,
        startedAt: now,
      });

    return { success: true, tenantId: foundTenantId };
  } catch (error: any) {
    console.error("Error activating license:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to activate license");
  }
});

// Public function to register a new company and user (called from landing page)
export const registerCompany = functions.https.onCall(async (data, context) => {
  // This is a public function - no authentication required for registration
  
  const {
    companyName,
    email,
    fullName,
    taxId,
    address,
    country = "Brasil",
    phone,
    planId, // Optional - user will choose plan in customer area
  } = data;

  // Validate required fields
  if (!companyName || !email || !fullName) {
    throw new functions.https.HttpsError("invalid-argument", "Company name, email, and full name are required");
  }

  // Validate email format
  const emailParts = email.split("@");
  if (emailParts.length < 2) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid email format");
  }

  try {
    // Generate tenantId from email domain
    const emailDomain = emailParts[1].toLowerCase();
    const sanitizedTenantId = emailDomain
      .replace(/\./g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");

    // Check if tenant already exists
    const tenantRef = db.collection(COLLECTIONS.TENANTS).doc(sanitizedTenantId);
    const tenantDoc = await tenantRef.get();
    
    if (tenantDoc.exists) {
      throw new functions.https.HttpsError("already-exists", "A company with this email domain already exists. Please use a different email or contact support.");
    }

    // Determine plan limits (use default starter plan if no planId provided)
    const planLimits: Record<string, { maxContracts: number; maxUsers: number; price: number }> = {
      starter: { maxContracts: 10, maxUsers: 1, price: 299 },
      professional: { maxContracts: 30, maxUsers: 3, price: 699 },
      enterprise: { maxContracts: -1, maxUsers: -1, price: 999 },
    };
    const defaultPlanId = planId || "starter"; // Default to starter if no plan selected
    const limits = planLimits[defaultPlanId] || planLimits.starter;

    // 1. Create tenant with full company information
    await tenantRef.set({
      id: sanitizedTenantId,
      name: companyName,
      slug: sanitizedTenantId,
      plan: defaultPlanId,
      planType: defaultPlanId,
      maxContracts: limits.maxContracts,
      maxLicenses: limits.maxUsers,
      status: "pending", // Will be activated after payment
      subscriptionStatus: "pending", // Waiting for payment
      cancelAtPeriodEnd: false,
      taxId: taxId || undefined,
      country: country || "Brasil",
      currency: "BRL",
      address: address || undefined,
      phone: phone || undefined,
      settings: {
        defaultCurrency: "BRL",
        fiscalYearEnd: "12-31",
        timezone: "America/Sao_Paulo",
      },
      createdAt: Timestamp.now(),
    });

    console.log(`[registerCompany] Tenant created: ${sanitizedTenantId}`);

    // 2. Generate password
    const generatePassword = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
      let pwd = "";
      for (let i = 0; i < 16; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return pwd;
    };
    const tempPassword = generatePassword();

    // 3. Create user in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      throw new functions.https.HttpsError("already-exists", "A user with this email already exists. Please use a different email or try logging in.");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        userRecord = await auth.createUser({
          email,
          password: tempPassword,
          displayName: fullName,
          emailVerified: false,
        });
        console.log(`[registerCompany] User created in Auth: ${email}`);
      } else if (error instanceof functions.https.HttpsError) {
        throw error;
      } else {
        throw new functions.https.HttpsError("internal", `Failed to create user: ${error.message}`);
      }
    }

    // 4. Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: sanitizedTenantId,
      role: "admin",
      systemAdmin: false,
    });

    const now = Timestamp.now();
    const userData = {
      id: userRecord.uid,
      email,
      fullName,
      username: email.split("@")[0],
      tenantId: sanitizedTenantId,
      role: "admin",
      isActive: false, // Will be activated after payment
      mustChangePassword: true,
      createdAt: now,
    };

    // 5. Create user document in root collection
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData);

    // 6. Create user document in tenant subcollection
    await db
      .collection(tenantCollection(sanitizedTenantId, COLLECTIONS.USERS))
      .doc(userRecord.uid)
      .set(userData);

    // 7. NO CHECKOUT AUTOMATIC - User will choose and pay for plan in customer area
    // Registration is separate from payment - user can register now and pay later

    // 8. Send email with credentials using Trigger Email extension
    const appUrl = process.env.APP_URL || "https://ifrs15-revenue-manager.web.app";
    try {
      await db.collection(COLLECTIONS.MAIL).add({
        to: email,
        message: {
          subject: "Bem-vindo ao IFRS 15 Revenue Manager - Suas Credenciais de Acesso",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">IFRS 15 Revenue Manager</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Sua conta foi criada com sucesso!</p>
              </div>
              
              <div style="background: white; padding: 40px; border: 1px solid #e5e7eb;">
                <h2 style="color: #111827; margin-top: 0;">Olá, ${fullName}!</h2>
                <p>Bem-vindo ao <strong>IFRS 15 Revenue Manager</strong>. Sua empresa <strong>${companyName}</strong> foi registrada com sucesso.</p>
                
                <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 4px;">
                  <h3 style="margin-top: 0; color: #059669;">Suas Credenciais de Acesso:</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; width: 120px;">Email:</td>
                      <td style="padding: 8px 0;"><code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${email}</code></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold;">Senha:</td>
                      <td style="padding: 8px 0;"><code style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #92400e;">${tempPassword}</code></td>
                    </tr>
                  </table>
                </div>

              <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #2563eb;">✨ Próximos Passos:</h3>
                <p style="margin: 0;">Agora você pode:</p>
                <ol style="margin: 10px 0 0 20px; padding-left: 0;">
                  <li>Acessar sua <strong>Área do Cliente</strong> usando as credenciais acima</li>
                  <li>Visualizar todas as funcionalidades disponíveis</li>
                  <li>Quando estiver pronto, escolher e pagar pelo plano desejado</li>
                  <li>Após o pagamento, seu acesso completo será liberado automaticamente</li>
                </ol>
              </div>

                <div style="text-align: center; margin: 40px 0;">
                  <a href="${appUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                    Acessar Área do Cliente
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <strong>Segurança:</strong> Por favor, altere sua senha após o primeiro login. Esta é uma senha temporária.
                </p>
              </div>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  © 2024 IFRS 15 Revenue Manager. Todos os direitos reservados.<br>
                  Se você não solicitou esta conta, ignore este email.
                </p>
              </div>
            </body>
            </html>
          `,
          text: `
Bem-vindo ao IFRS 15 Revenue Manager!

Olá, ${fullName}!

Sua empresa ${companyName} foi registrada com sucesso.

SUAS CREDENCIAIS DE ACESSO:
Email: ${email}
Senha: ${tempPassword}

PRÓXIMOS PASSOS:
1. Acesse sua Área do Cliente usando as credenciais acima
2. Visualize todas as funcionalidades disponíveis
3. Quando estiver pronto, escolha e pague pelo plano desejado
4. Após o pagamento, seu acesso completo será liberado automaticamente

Acesse: ${appUrl}/login

Por favor, altere sua senha após o primeiro login. Esta é uma senha temporária.

© 2024 IFRS 15 Revenue Manager
          `,
        },
      });
      console.log(`[registerCompany] Email sent to: ${email}`);
    } catch (emailError: any) {
      console.error("[registerCompany] Error sending email:", emailError);
      // Don't fail registration if email fails - credentials are returned in response
    }

    return {
      success: true,
      userId: userRecord.uid,
      tenantId: sanitizedTenantId,
      credentials: {
        email,
        password: tempPassword, // Return password in response as backup if email fails
      },
      message: "Company registered successfully. Check your email for credentials. You can login and choose a plan in your customer area.",
    };
  } catch (error: any) {
    console.error("[registerCompany] Error:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to register company");
  }
});

// Temporary function to delete user from Auth (admin only)
// This can be used to clean up test registrations
export const deleteUserFromAuth = functions.https.onCall(async (data, context) => {
  // Only allow system admin to call this
  if (!context.auth || !context.auth.token.systemAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Must be system admin");
  }

  const { userId, email } = data;
  
  if (!userId && !email) {
    throw new functions.https.HttpsError("invalid-argument", "Must provide userId or email");
  }

  try {
    let userRecord;
    if (userId) {
      userRecord = await auth.getUser(userId);
    } else if (email) {
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw new functions.https.HttpsError("invalid-argument", "Must provide userId or email");
    }

    // Delete user from Auth (this will trigger onUserDeleted which cleans up Firestore)
    await auth.deleteUser(userRecord.uid);
    
    console.log(`[deleteUserFromAuth] User deleted: ${userRecord.uid} (${userRecord.email})`);
    
    return { success: true, uid: userRecord.uid, email: userRecord.email };
  } catch (error: any) {
    console.error("[deleteUserFromAuth] Error:", error);
    if (error.code === "auth/user-not-found") {
      throw new functions.https.HttpsError("not-found", "User not found");
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to delete user");
  }
});

// Get tenant users (for company admin)
export const getTenantUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  const role = context.auth.token.role;

  // Only admin users can view tenant users
  if (role !== "admin" && !context.auth.token.systemAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
  }

  try {
    // Get tenant to check if active
    const tenantDoc = await db.collection(COLLECTIONS.TENANTS).doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Tenant not found");
    }

    const tenant = tenantDoc.data();
    
    // Get users from tenant subcollection
    const usersSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
      .get();

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get current active users count
    const activeUsersCount = users.filter((u: any) => u.isActive === true).length;

    return {
      users,
      tenant: {
        id: tenantId,
        name: tenant?.name,
        maxLicenses: tenant?.maxLicenses || 0,
        currentLicenses: activeUsersCount,
        availableLicenses: (tenant?.maxLicenses || 0) === -1 ? -1 : Math.max(0, (tenant?.maxLicenses || 0) - activeUsersCount),
        subscriptionStatus: tenant?.subscriptionStatus,
        status: tenant?.status,
      },
    };
  } catch (error: any) {
    console.error("[getTenantUsers] Error:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to get users");
  }
});

// Add new user to tenant (admin only, requires active subscription)
export const addTenantUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  const role = context.auth.token.role;

  // Only admin users can add users
  if (role !== "admin" && !context.auth.token.systemAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Must be admin");
  }

  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
  }

  const { email, fullName } = data;

  if (!email || !fullName) {
    throw new functions.https.HttpsError("invalid-argument", "Email and fullName are required");
  }

  try {
    // Get tenant
    const tenantDoc = await db.collection(COLLECTIONS.TENANTS).doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Tenant not found");
    }

    const tenant = tenantDoc.data();

    // Check if subscription is active
    if (tenant?.subscriptionStatus !== "active" && tenant?.status !== "active") {
      throw new functions.https.HttpsError("failed-precondition", "Company subscription must be active to add users");
    }

    // Check available licenses/seats
    const usersSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
      .get();

    const activeUsersCount = usersSnapshot.docs.filter(
      doc => doc.data().isActive === true
    ).length;

    const maxLicenses = tenant?.maxLicenses || 0;
    
    // -1 means unlimited (enterprise plan)
    if (maxLicenses !== -1 && activeUsersCount >= maxLicenses) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Maximum number of users (${maxLicenses}) reached. Please upgrade your plan to add more users.`
      );
    }

    // Generate password function
    const generatePassword = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
      let pwd = "";
      for (let i = 0; i < 16; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return pwd;
    };

    // Check if user already exists
    let userRecord;
    let tempPassword: string | undefined;
    try {
      userRecord = await auth.getUserByEmail(email);
      
      // Check if user already belongs to this tenant
      const existingUserDoc = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
        .doc(userRecord.uid)
        .get();

      if (existingUserDoc.exists) {
        throw new functions.https.HttpsError("already-exists", "User already exists in this company");
      }

      // User exists but in different tenant - not allowed
      throw new functions.https.HttpsError("already-exists", "User with this email already exists in another company");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        // User doesn't exist - create new user
        tempPassword = generatePassword();

        userRecord = await auth.createUser({
          email,
          password: tempPassword,
          displayName: fullName,
          emailVerified: false,
        });
        console.log(`[addTenantUser] New user created: ${email}`);
      } else if (error instanceof functions.https.HttpsError) {
        throw error;
      } else {
        throw new functions.https.HttpsError("internal", `Failed to check/create user: ${error.message}`);
      }
    }

    // If user already existed, we can't send password email
    if (!tempPassword) {
      throw new functions.https.HttpsError("failed-precondition", "Cannot add existing user - they already have an account");
    }

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId,
      role: "readonly", // New users start as readonly, admin can change later
      systemAdmin: false,
    });

    const now = Timestamp.now();
    const userData = {
      id: userRecord.uid,
      email,
      fullName,
      username: email.split("@")[0],
      tenantId,
      role: "readonly",
      isActive: true, // Activate immediately since subscription is active
      mustChangePassword: true,
      createdAt: now,
    };

    // Create user document in root collection
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData);

    // Create user document in tenant subcollection
    await db
      .collection(tenantCollection(tenantId, COLLECTIONS.USERS))
      .doc(userRecord.uid)
      .set(userData);

    // Send email with credentials
    const appUrl = process.env.APP_URL || "https://ifrs15-revenue-manager.web.app";
    try {
      await db.collection(COLLECTIONS.MAIL).add({
        to: email,
        message: {
          subject: "Você foi adicionado ao IFRS 15 Revenue Manager",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">IFRS 15 Revenue Manager</h1>
              </div>
              
              <div style="background: white; padding: 40px; border: 1px solid #e5e7eb;">
                <h2 style="color: #111827; margin-top: 0;">Olá, ${fullName}!</h2>
                <p>Você foi adicionado à empresa <strong>${tenant?.name}</strong> no IFRS 15 Revenue Manager.</p>
                
                <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 4px;">
                  <h3 style="margin-top: 0; color: #059669;">Suas Credenciais de Acesso:</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; width: 120px;">Email:</td>
                      <td style="padding: 8px 0;"><code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${email}</code></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold;">Senha:</td>
                      <td style="padding: 8px 0;"><code style="background: #fef3c7; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #92400e;">${tempPassword}</code></td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 40px 0;">
                  <a href="${appUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Acessar Sistema
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <strong>Segurança:</strong> Por favor, altere sua senha após o primeiro login.
                </p>
              </div>
            </body>
            </html>
          `,
        },
      });
      console.log(`[addTenantUser] Email sent to: ${email}`);
    } catch (emailError: any) {
      console.error("[addTenantUser] Error sending email:", emailError);
      // Don't fail user creation if email fails
    }

    return {
      success: true,
      userId: userRecord.uid,
      user: userData,
      message: "User added successfully. Credentials sent via email.",
    };
  } catch (error: any) {
    console.error("[addTenantUser] Error:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message || "Failed to add user");
  }
});
