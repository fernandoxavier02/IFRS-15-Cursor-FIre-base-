/**
 * Script para inicializar o sistema com usuário admin
 * Execute com: npx ts-node scripts/init-admin.ts
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS or default credentials)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "ifrs15-revenue-manager",
  });
}

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAIL = "fernandocostaxavier@gmail.com";
const ADMIN_PASSWORD = "Admin@123!"; // Temporary password - must change on first login
const TENANT_ID = "default";

async function initializeSystem() {
  console.log("🚀 Initializing IFRS 15 Revenue Manager...\n");

  try {
    // 1. Create tenant
    console.log("1. Creating tenant...");
    const tenantRef = db.collection("tenants").doc(TENANT_ID);
    await tenantRef.set({
      id: TENANT_ID,
      name: "Default Organization",
      slug: "default",
      plan: "enterprise",
      status: "active",
      settings: {
        defaultCurrency: "BRL",
        fiscalYearEnd: "12-31",
        timezone: "America/Sao_Paulo",
      },
      createdAt: admin.firestore.Timestamp.now(),
    });
    console.log("   ✅ Tenant created: default\n");

    // 2. Create or get admin user in Firebase Auth
    console.log("2. Creating admin user in Firebase Auth...");
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
      console.log("   ℹ️  User already exists, updating...");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        userRecord = await auth.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          displayName: "Fernando Costa Xavier",
          emailVerified: true,
        });
        console.log("   ✅ User created in Firebase Auth");
      } else {
        throw error;
      }
    }

    // 3. Set admin custom claims
    console.log("3. Setting custom claims...");
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: TENANT_ID,
      role: "admin",
      systemAdmin: true,
    });
    console.log("   ✅ Custom claims set (admin, systemAdmin)\n");

    // 4. Create user document in Firestore
    console.log("4. Creating user document in Firestore...");
    const userData = {
      id: userRecord.uid,
      email: ADMIN_EMAIL,
      fullName: "Fernando Costa Xavier",
      username: "fernando",
      tenantId: TENANT_ID,
      role: "admin",
      isActive: true,
      mustChangePassword: true,
      createdAt: admin.firestore.Timestamp.now(),
    };

    // Root users collection
    await db.collection("users").doc(userRecord.uid).set(userData);

    // Tenant users subcollection
    await db
      .collection(`tenants/${TENANT_ID}/users`)
      .doc(userRecord.uid)
      .set(userData);
    console.log("   ✅ User document created\n");

    // 5. Create license for admin
    console.log("5. Creating admin license...");
    const licenseKey = `LIC-ADMIN-${Date.now()}`;
    await db.collection(`tenants/${TENANT_ID}/licenses`).add({
      tenantId: TENANT_ID,
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

    // Update user with license
    await db.collection("users").doc(userRecord.uid).update({
      licenseKey,
      licenseActivatedAt: admin.firestore.Timestamp.now(),
    });
    console.log(`   ✅ License created: ${licenseKey}\n`);

    // 6. Create subscription plans
    console.log("6. Creating subscription plans...");
    const plans = [
      {
        id: "starter",
        name: "Starter",
        price: 299,
        currency: "BRL",
        interval: "month",
        maxContracts: 10,
        maxUsers: 1,
        features: ["basic_reports", "email_support"],
        isActive: true,
      },
      {
        id: "professional",
        name: "Professional",
        price: 699,
        currency: "BRL",
        interval: "month",
        maxContracts: 30,
        maxUsers: 3,
        features: ["full_ifrs15", "priority_support", "api_access"],
        isActive: true,
        popular: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: 1499,
        currency: "BRL",
        interval: "month",
        maxContracts: -1, // unlimited
        maxUsers: -1, // unlimited
        features: ["full_ifrs15", "audit_trail", "dedicated_manager", "custom_integrations"],
        isActive: true,
      },
    ];

    for (const plan of plans) {
      await db.collection("subscriptionPlans").doc(plan.id).set({
        ...plan,
        createdAt: admin.firestore.Timestamp.now(),
      });
    }
    console.log("   ✅ Subscription plans created\n");

    // Summary
    console.log("═".repeat(50));
    console.log("✅ INITIALIZATION COMPLETE!\n");
    console.log("Admin User:");
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Role: admin (systemAdmin)`);
    console.log(`   Tenant: ${TENANT_ID}`);
    console.log("\n⚠️  IMPORTANT: Change the password on first login!");
    console.log("═".repeat(50));

  } catch (error) {
    console.error("❌ Error during initialization:", error);
    process.exit(1);
  }

  process.exit(0);
}

initializeSystem();
