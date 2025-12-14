// Firebase Cloud Functions Entry Point
// IFRS 15 Revenue Manager

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize Firebase Admin
admin.initializeApp();

// ==================== AUTH TRIGGERS ====================
export {
  activateUserLicense, createUserWithTenant, onUserCreated,
  onUserDeleted,
  setUserClaims
} from "./auth/triggers";

// ==================== STRIPE ====================
export {
  cancelSubscription, createCheckoutSession,
  createPortalSession, getStripePublishableKey, getSubscriptionPlans, resumeSubscription
} from "./stripe/checkout";
export { stripeWebhook } from "./stripe/webhooks";

// ==================== AI ====================
export {
  approveReviewAndCreateContract, processIngestionJob
} from "./ai/contract-extraction";

// ==================== REST APIs ====================
export { contractsApi } from "./api/contracts";
export { customersApi } from "./api/customers";
export { dashboardApi } from "./api/dashboard";

// ==================== IFRS 15 ENGINE ====================
export {
  createContractVersion,
  generateBillingSchedule, runIFRS15Engine
} from "./ifrs15/engine";

// ==================== REPORTS ====================
export {
  generateContractBalancesReport, generateDisaggregatedRevenueReport, generateRemainingObligationsReport
} from "./reports/index";

// ==================== SCHEDULED FUNCTIONS ====================

// Clean up expired checkout sessions (runs daily)
export const cleanupExpiredCheckouts = functions.pubsub
  .schedule("0 2 * * *") // 2 AM daily
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore();
    const oneDayAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const expiredSessions = await db
      .collection("checkoutSessions")
      .where("status", "==", "pending")
      .where("createdAt", "<", oneDayAgo)
      .get();

    const batch = db.batch();
    expiredSessions.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "expired" });
    });

    await batch.commit();
    console.log(`Marked ${expiredSessions.size} checkout sessions as expired`);
  });

// Check for overdue billings (runs daily)
export const checkOverdueBillings = functions.pubsub
  .schedule("0 8 * * *") // 8 AM daily
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Get all tenants
    const tenantsSnapshot = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;

      // Find scheduled billings that are past due
      const overdueBillings = await db
        .collection(`tenants/${tenantId}/billingSchedules`)
        .where("status", "==", "scheduled")
        .where("dueDate", "<", now)
        .get();

      const batch = db.batch();
      overdueBillings.docs.forEach((doc) => {
        batch.update(doc.ref, { status: "overdue" });
      });

      if (overdueBillings.size > 0) {
        await batch.commit();
        console.log(`Marked ${overdueBillings.size} billings as overdue for tenant ${tenantId}`);
      }
    }
  });

// Release expired license locks (runs every 10 minutes)
export const releaseLicenseLocks = functions.pubsub
  .schedule("*/10 * * * *") // Every 10 minutes
  .onRun(async () => {
    const db = admin.firestore();
    const tenMinutesAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 10 * 60 * 1000)
    );

    // Get all tenants
    const tenantsSnapshot = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;

      // Find licenses with stale locks
      const staleLicenses = await db
        .collection(`tenants/${tenantId}/licenses`)
        .where("lastSeenAt", "<", tenMinutesAgo)
        .get();

      for (const licenseDoc of staleLicenses.docs) {
        const licenseData = licenseDoc.data();
        if (licenseData.currentIp) {
          await licenseDoc.ref.update({
            currentIp: null,
            currentUserId: null,
            lockedAt: null,
          });

          // End license session
          const sessionsSnapshot = await db
            .collection(`${licenseDoc.ref.path}/sessions`)
            .where("endedAt", "==", null)
            .get();

          for (const sessionDoc of sessionsSnapshot.docs) {
            await sessionDoc.ref.update({
              endedAt: admin.firestore.Timestamp.now(),
              endedReason: "timeout",
            });
          }

          console.log(`Released lock for license ${licenseDoc.id}`);
        }
      }
    }
  });

// Calculate monthly consolidated balances (runs on 1st of each month)
export const calculateMonthlyBalances = functions.pubsub
  .schedule("0 1 1 * *") // 1 AM on 1st of each month
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const periodDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Previous month

    // Get all tenants
    const tenantsSnapshot = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;

      // Get all contracts for tenant
      const contractsSnapshot = await db
        .collection(`tenants/${tenantId}/contracts`)
        .get();

      let totalContractAssets = 0;
      let totalContractLiabilities = 0;
      let totalReceivables = 0;
      let totalDeferredRevenue = 0;
      let totalRecognizedRevenue = 0;
      let totalBilledAmount = 0;
      let totalCashReceived = 0;

      for (const contractDoc of contractsSnapshot.docs) {
        // Get latest balance
        const balancesSnapshot = await db
          .collection(`${contractDoc.ref.path}/balances`)
          .orderBy("periodDate", "desc")
          .limit(1)
          .get();

        if (!balancesSnapshot.empty) {
          const balance = balancesSnapshot.docs[0].data();
          totalContractAssets += Number(balance.contractAsset || 0);
          totalContractLiabilities += Number(balance.contractLiability || 0);
          totalReceivables += Number(balance.receivable || 0);
          totalRecognizedRevenue += Number(balance.revenueRecognized || 0);
          totalCashReceived += Number(balance.cashReceived || 0);
        }

        // Get total contract value for deferred calculation
        const contract = contractDoc.data();
        totalDeferredRevenue += Number(contract.totalValue || 0) - totalRecognizedRevenue;
      }

      // Get billed amounts
      const billingsSnapshot = await db
        .collection(`tenants/${tenantId}/billingSchedules`)
        .where("status", "in", ["invoiced", "paid"])
        .get();

      for (const billingDoc of billingsSnapshot.docs) {
        totalBilledAmount += Number(billingDoc.data().amount || 0);
      }

      // Create consolidated balance
      await db.collection(`tenants/${tenantId}/consolidatedBalances`).add({
        tenantId,
        periodDate: admin.firestore.Timestamp.fromDate(periodDate),
        periodType: "monthly",
        totalContractAssets,
        totalContractLiabilities,
        totalReceivables,
        totalDeferredRevenue,
        totalRecognizedRevenue,
        totalBilledAmount,
        totalCashReceived,
        totalRemainingObligations: totalDeferredRevenue,
        contractCount: contractsSnapshot.size,
        currency: "BRL",
        createdAt: admin.firestore.Timestamp.now(),
      });

      console.log(`Created consolidated balance for tenant ${tenantId}`);
    }
  });

// Process pending email queue (if not using Trigger Email extension)
export const processEmailQueue = functions.pubsub
  .schedule("*/5 * * * *") // Every 5 minutes
  .onRun(async () => {
    const db = admin.firestore();

    const pendingEmails = await db
      .collection("emailQueue")
      .where("status", "==", "pending")
      .limit(10)
      .get();

    // Note: This is a placeholder. In production, integrate with an email service
    // like SendGrid, Mailgun, or use the Firebase Trigger Email extension
    for (const emailDoc of pendingEmails.docs) {
      const email = emailDoc.data();
      console.log(`Would send email to: ${email.toEmail}, subject: ${email.subject}`);

      // For now, just mark as sent (replace with actual email sending)
      await emailDoc.ref.update({
        status: "sent",
        sentAt: admin.firestore.Timestamp.now(),
      });
    }
  });

// Initialize system with admin user (run once via Firebase Console or CLI)
// Security: Uses environment variables, no hardcoded credentials
// To run: firebase functions:config:set init.secret="your-secret" init.admin_email="email@example.com"
// Or use .env file with INIT_SECRET and INIT_ADMIN_EMAIL
export const initializeSystem = functions.https.onRequest(async (req, res) => {
  // Security: Check for secret key from environment or config
  const secretKey = req.query.key || req.body?.key;
  const expectedSecret = process.env.INIT_SECRET || functions.config().init?.secret;
  
  if (!expectedSecret) {
    res.status(500).json({ error: "INIT_SECRET not configured. Set via environment or Firebase config." });
    return;
  }
  
  if (secretKey !== expectedSecret) {
    res.status(403).json({ error: "Invalid key" });
    return;
  }

  const db = admin.firestore();
  const auth = admin.auth();

  // Get admin email from request, environment, or config
  const adminEmail = req.body?.email || process.env.INIT_ADMIN_EMAIL || functions.config().init?.admin_email;
  const adminName = req.body?.name || "System Administrator";
  const tenantName = req.body?.tenantName || "Default Organization";
  const tenantId = req.body?.tenantId || "default";
  
  if (!adminEmail) {
    res.status(400).json({ error: "Admin email required. Pass in request body or set INIT_ADMIN_EMAIL." });
    return;
  }

  // Generate secure random password
  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  try {
    // 1. Create tenant
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantExists = (await tenantRef.get()).exists;
    
    if (!tenantExists) {
      await tenantRef.set({
        id: tenantId,
        name: tenantName,
        slug: tenantId,
        plan: "enterprise",
        status: "active",
        settings: {
          defaultCurrency: "BRL",
          fiscalYearEnd: "12-31",
          timezone: "America/Sao_Paulo",
        },
        createdAt: admin.firestore.Timestamp.now(),
      });
    }

    // 2. Create or get admin user in Firebase Auth
    let userRecord;
    let passwordGenerated = false;
    let tempPassword = "";
    
    try {
      userRecord = await auth.getUserByEmail(adminEmail);
      console.log(`User ${adminEmail} already exists`);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        tempPassword = generatePassword();
        passwordGenerated = true;
        userRecord = await auth.createUser({
          email: adminEmail,
          password: tempPassword,
          displayName: adminName,
          emailVerified: false, // User should verify their email
        });
      } else {
        throw error;
      }
    }

    // 3. Set admin custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: tenantId,
      role: "admin",
      systemAdmin: true,
    });

    // 4. Create user document
    const userData = {
      id: userRecord.uid,
      email: adminEmail,
      fullName: adminName,
      username: adminEmail.split("@")[0],
      tenantId: tenantId,
      role: "admin",
      isActive: true,
      mustChangePassword: passwordGenerated, // Force password change for new users
      createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection("users").doc(userRecord.uid).set(userData, { merge: true });
    await db.collection(`tenants/${tenantId}/users`).doc(userRecord.uid).set(userData, { merge: true });

    // 5. Create license
    const licenseKey = `LIC-${tenantId.toUpperCase()}-${Date.now()}`;
    await db.collection(`tenants/${tenantId}/licenses`).add({
      tenantId: tenantId,
      licenseKey,
      status: "active",
      plan: "enterprise",
      maxUsers: 999,
      activatedAt: admin.firestore.Timestamp.now(),
      activatedByUserId: userRecord.uid,
      currentUserId: userRecord.uid,
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
    });

    await db.collection("users").doc(userRecord.uid).update({
      licenseKey,
      licenseActivatedAt: admin.firestore.Timestamp.now(),
    });

    // 6. Create subscription plans (if not exist)
    const plans = [
      { id: "starter", name: "Starter", price: 299, currency: "BRL", interval: "month", maxContracts: 10, maxUsers: 1, features: ["basic_reports", "email_support"], isActive: true },
      { id: "professional", name: "Professional", price: 699, currency: "BRL", interval: "month", maxContracts: 30, maxUsers: 3, features: ["full_ifrs15", "priority_support", "api_access"], isActive: true, popular: true },
      { id: "enterprise", name: "Enterprise", price: 1499, currency: "BRL", interval: "month", maxContracts: -1, maxUsers: -1, features: ["full_ifrs15", "audit_trail", "dedicated_manager", "custom_integrations"], isActive: true },
    ];

    for (const plan of plans) {
      const planRef = db.collection("subscriptionPlans").doc(plan.id);
      const planExists = (await planRef.get()).exists;
      if (!planExists) {
        await planRef.set({
          ...plan,
          createdAt: admin.firestore.Timestamp.now(),
        });
      }
    }

    // Response - NEVER include password in logs or response for existing users
    const response: any = {
      success: true,
      message: passwordGenerated 
        ? "System initialized. New user created with temporary password."
        : "System initialized. User already existed - no password change.",
      admin: {
        email: adminEmail,
        uid: userRecord.uid,
      },
      tenant: tenantId,
    };

    // Only include password for new users, and recommend using password reset
    if (passwordGenerated) {
      response.admin.tempPassword = tempPassword;
      response.admin.note = "IMPORTANT: This password will only be shown once. User must change password on first login or use password reset.";
    }

    // Log without sensitive data
    console.log(`System initialized for tenant ${tenantId}, admin ${adminEmail}`);
    
    res.json(response);
  } catch (error: any) {
    console.error("Initialization error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Heartbeat function to keep user license active
export const licenseHeartbeat = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const userId = context.auth.uid;
  const tenantId = context.auth.token.tenantId;
  const clientIp = context.rawRequest.ip || "unknown";

  if (!tenantId) {
    return { success: false, error: "No tenant" };
  }

  const db = admin.firestore();

  // Find user's active license
  const licensesSnapshot = await db
    .collection(`tenants/${tenantId}/licenses`)
    .where("currentUserId", "==", userId)
    .limit(1)
    .get();

  if (licensesSnapshot.empty) {
    return { success: false, error: "No active license" };
  }

  const licenseDoc = licensesSnapshot.docs[0];

  // Update last seen
  await licenseDoc.ref.update({
    lastSeenAt: admin.firestore.Timestamp.now(),
    currentIp: clientIp,
  });

  return { success: true };
});
