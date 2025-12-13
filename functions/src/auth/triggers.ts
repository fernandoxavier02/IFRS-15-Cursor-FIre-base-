import * as functions from "firebase-functions";
import { auth, db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

// Trigger when a new user is created in Firebase Auth
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  console.log("New user created:", user.uid, user.email);

  // Create user document in Firestore
  // Note: This is a basic profile, tenant assignment happens during registration
  try {
    await db.collection(COLLECTIONS.USERS).doc(user.uid).set({
      id: user.uid,
      email: user.email || "",
      fullName: user.displayName || "",
      createdAt: Timestamp.now(),
      isActive: false,
      mustChangePassword: true,
      role: "readonly",
    });

    console.log("User document created for:", user.uid);
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

  const { email, password, fullName, tenantId, role } = data;

  if (!email || !password || !fullName || !tenantId || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  // If not system admin, verify caller belongs to the target tenant
  if (!callerClaims.systemAdmin && callerClaims.tenantId !== tenantId) {
    throw new functions.https.HttpsError("permission-denied", "Cannot create user in different tenant");
  }

  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: fullName,
    });

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId,
      role,
      systemAdmin: false,
    });

    const now = Timestamp.now();
    const userData = {
      id: userRecord.uid,
      email,
      fullName,
      username: email.split("@")[0],
      tenantId,
      role,
      isActive: false,
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

    return {
      success: true,
      userId: userRecord.uid,
    };
  } catch (error: any) {
    console.error("Error creating user:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create user");
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
