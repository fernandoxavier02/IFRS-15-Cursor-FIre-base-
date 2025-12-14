/**
 * Firebase Integration Test Script
 * 
 * Tests the basic functionality of the Firebase services after migration.
 * 
 * Usage:
 * 1. Start Firebase emulators: npm run firebase:emulators
 * 2. Run: npx tsx scripts/test-firebase-integration.ts
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

admin.initializeApp({
  projectId: "demo-ifrs15",
});

const firestore = admin.firestore();
const auth = admin.auth();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("Firebase Integration Tests");
  console.log("=".repeat(60));
  console.log("");

  // Test 1: Firestore Connection
  await test("Firestore connection", async () => {
    const testDoc = await firestore.collection("_test").doc("connection").get();
    // Just checking we can make a query
  });

  // Test 2: Create Tenant
  await test("Create tenant", async () => {
    const tenantRef = await firestore.collection("tenants").add({
      name: "Test Tenant",
      country: "BR",
      currency: "BRL",
      planType: "starter",
      maxContracts: 10,
      maxLicenses: 1,
      createdAt: admin.firestore.Timestamp.now(),
    });
    
    if (!tenantRef.id) throw new Error("Tenant not created");
    
    // Cleanup
    await tenantRef.delete();
  });

  // Test 3: Create User in Auth
  await test("Create user in Firebase Auth", async () => {
    const email = `test-${Date.now()}@test.com`;
    
    const userRecord = await auth.createUser({
      email,
      password: "TestPassword123!",
      displayName: "Test User",
    });
    
    if (!userRecord.uid) throw new Error("User not created");
    
    // Cleanup
    await auth.deleteUser(userRecord.uid);
  });

  // Test 4: Set Custom Claims
  await test("Set custom claims", async () => {
    const email = `test-${Date.now()}@test.com`;
    
    const userRecord = await auth.createUser({
      email,
      password: "TestPassword123!",
    });
    
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: "test-tenant",
      role: "admin",
    });
    
    const updatedUser = await auth.getUser(userRecord.uid);
    if (updatedUser.customClaims?.tenantId !== "test-tenant") {
      throw new Error("Claims not set correctly");
    }
    
    // Cleanup
    await auth.deleteUser(userRecord.uid);
  });

  // Test 5: Create Contract Structure
  await test("Create contract with nested structure", async () => {
    const tenantRef = await firestore.collection("tenants").add({
      name: "Test Tenant",
      createdAt: admin.firestore.Timestamp.now(),
    });
    
    const contractRef = await firestore
      .collection(`tenants/${tenantRef.id}/contracts`)
      .add({
        contractNumber: "TEST-001",
        title: "Test Contract",
        status: "draft",
        totalValue: 10000,
        currency: "BRL",
        createdAt: admin.firestore.Timestamp.now(),
      });
    
    const versionRef = await firestore
      .collection(`tenants/${tenantRef.id}/contracts/${contractRef.id}/versions`)
      .add({
        versionNumber: 1,
        totalValue: 10000,
        createdAt: admin.firestore.Timestamp.now(),
      });
    
    const poRef = await firestore
      .collection(`tenants/${tenantRef.id}/contracts/${contractRef.id}/versions/${versionRef.id}/performanceObligations`)
      .add({
        description: "Test PO",
        allocatedPrice: 10000,
        recognitionMethod: "over_time",
        percentComplete: 0,
        recognizedAmount: 0,
        deferredAmount: 10000,
        createdAt: admin.firestore.Timestamp.now(),
      });
    
    if (!poRef.id) throw new Error("PO not created");
    
    // Cleanup
    await poRef.delete();
    await versionRef.delete();
    await contractRef.delete();
    await tenantRef.delete();
  });

  // Test 6: Query with multi-tenant isolation
  await test("Multi-tenant query isolation", async () => {
    // Create two tenants
    const tenant1Ref = await firestore.collection("tenants").add({
      name: "Tenant 1",
      createdAt: admin.firestore.Timestamp.now(),
    });
    
    const tenant2Ref = await firestore.collection("tenants").add({
      name: "Tenant 2",
      createdAt: admin.firestore.Timestamp.now(),
    });
    
    // Create a customer in tenant 1
    await firestore.collection(`tenants/${tenant1Ref.id}/customers`).add({
      name: "Customer in Tenant 1",
      createdAt: admin.firestore.Timestamp.now(),
    });
    
    // Query customers in tenant 2 (should be empty)
    const tenant2Customers = await firestore
      .collection(`tenants/${tenant2Ref.id}/customers`)
      .get();
    
    if (tenant2Customers.size !== 0) {
      throw new Error("Multi-tenant isolation failed");
    }
    
    // Cleanup
    const tenant1Customers = await firestore
      .collection(`tenants/${tenant1Ref.id}/customers`)
      .get();
    for (const doc of tenant1Customers.docs) {
      await doc.ref.delete();
    }
    await tenant1Ref.delete();
    await tenant2Ref.delete();
  });

  // Print summary
  console.log("");
  console.log("=".repeat(60));
  console.log("Test Summary");
  console.log("=".repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${results.length}`);
  
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
