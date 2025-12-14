/**
 * Migration Validation Script
 * 
 * Compares data counts between PostgreSQL and Firestore to ensure
 * migration was successful.
 * 
 * Usage:
 * 1. Set environment variables:
 *    - DATABASE_URL: PostgreSQL connection string
 *    - GOOGLE_APPLICATION_CREDENTIALS: Path to Firebase service account JSON
 * 
 * 2. Run: npx tsx scripts/validate-migration.ts
 */

import * as admin from "firebase-admin";
import pg from "pg";

// Initialize Firebase Admin
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  admin.initializeApp();
}

const firestore = admin.firestore();

// PostgreSQL connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface ValidationResult {
  table: string;
  postgresCount: number;
  firestoreCount: number;
  match: boolean;
  notes?: string;
}

async function countPostgres(table: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
  return parseInt(result.rows[0].count, 10);
}

async function countFirestore(collectionPath: string): Promise<number> {
  const snapshot = await firestore.collection(collectionPath).count().get();
  return snapshot.data().count;
}

async function countFirestoreNested(
  parentCollection: string,
  childCollection: string
): Promise<number> {
  let total = 0;
  const parents = await firestore.collection(parentCollection).get();
  
  for (const parent of parents.docs) {
    const childSnapshot = await firestore
      .collection(`${parentCollection}/${parent.id}/${childCollection}`)
      .count()
      .get();
    total += childSnapshot.data().count;
  }
  
  return total;
}

async function countFirestoreDeeplyNested(
  parentCollection: string,
  midCollection: string,
  childCollection: string
): Promise<number> {
  let total = 0;
  const parents = await firestore.collection(parentCollection).get();
  
  for (const parent of parents.docs) {
    const mids = await firestore
      .collection(`${parentCollection}/${parent.id}/${midCollection}`)
      .get();
    
    for (const mid of mids.docs) {
      const childSnapshot = await firestore
        .collection(`${parentCollection}/${parent.id}/${midCollection}/${mid.id}/${childCollection}`)
        .count()
        .get();
      total += childSnapshot.data().count;
    }
  }
  
  return total;
}

async function validateTenants(): Promise<ValidationResult> {
  const pgCount = await countPostgres("tenants");
  const fsCount = await countFirestore("tenants");
  
  return {
    table: "tenants",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
  };
}

async function validateUsers(): Promise<ValidationResult> {
  const pgCount = await countPostgres("users");
  const fsCount = await countFirestore("users");
  
  return {
    table: "users",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
    notes: fsCount >= pgCount ? "Users in Firestore (may include duplicates from tenant subcollections)" : undefined,
  };
}

async function validateCustomers(): Promise<ValidationResult> {
  const pgCount = await countPostgres("customers");
  const fsCount = await countFirestoreNested("tenants", "customers");
  
  return {
    table: "customers",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
  };
}

async function validateContracts(): Promise<ValidationResult> {
  const pgCount = await countPostgres("contracts");
  const fsCount = await countFirestoreNested("tenants", "contracts");
  
  return {
    table: "contracts",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
  };
}

async function validateContractVersions(): Promise<ValidationResult> {
  const pgCount = await countPostgres("contract_versions");
  let fsCount = 0;
  
  // Count versions across all tenants and contracts
  const tenants = await firestore.collection("tenants").get();
  for (const tenant of tenants.docs) {
    const contracts = await firestore
      .collection(`tenants/${tenant.id}/contracts`)
      .get();
    
    for (const contract of contracts.docs) {
      const versions = await firestore
        .collection(`tenants/${tenant.id}/contracts/${contract.id}/versions`)
        .count()
        .get();
      fsCount += versions.data().count;
    }
  }
  
  return {
    table: "contract_versions",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
  };
}

async function validateLicenses(): Promise<ValidationResult> {
  const pgCount = await countPostgres("licenses");
  const fsCount = await countFirestoreNested("tenants", "licenses");
  
  return {
    table: "licenses",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
  };
}

async function validateSubscriptionPlans(): Promise<ValidationResult> {
  const pgCount = await countPostgres("subscription_plans");
  const fsCount = await countFirestore("subscriptionPlans");
  
  return {
    table: "subscription_plans",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
  };
}

async function validateBillingSchedules(): Promise<ValidationResult> {
  const pgCount = await countPostgres("billing_schedules");
  const fsCount = await countFirestoreNested("tenants", "billingSchedules");
  
  return {
    table: "billing_schedules",
    postgresCount: pgCount,
    firestoreCount: fsCount,
    match: pgCount === fsCount,
  };
}

// Main validation function
async function validate() {
  console.log("=".repeat(60));
  console.log("Migration Validation Report");
  console.log("=".repeat(60));
  console.log("");

  const results: ValidationResult[] = [];

  try {
    // Validate each entity
    console.log("Validating entities...\n");
    
    results.push(await validateTenants());
    results.push(await validateUsers());
    results.push(await validateCustomers());
    results.push(await validateContracts());
    results.push(await validateContractVersions());
    results.push(await validateLicenses());
    results.push(await validateSubscriptionPlans());
    results.push(await validateBillingSchedules());

    // Print results table
    console.log("\n" + "=".repeat(60));
    console.log("Results Summary");
    console.log("=".repeat(60));
    console.log("");
    
    console.log("| Entity                | PostgreSQL | Firestore | Match |");
    console.log("|----------------------|------------|-----------|-------|");
    
    let allMatch = true;
    for (const result of results) {
      const matchSymbol = result.match ? "✓" : "✗";
      if (!result.match) allMatch = false;
      
      console.log(
        `| ${result.table.padEnd(20)} | ${String(result.postgresCount).padEnd(10)} | ${String(result.firestoreCount).padEnd(9)} | ${matchSymbol.padEnd(5)} |`
      );
      
      if (result.notes) {
        console.log(`|   Note: ${result.notes}`);
      }
    }
    
    console.log("");
    console.log("=".repeat(60));
    
    if (allMatch) {
      console.log("✓ All entity counts match! Migration validated successfully.");
    } else {
      console.log("✗ Some entity counts do not match. Review the results above.");
    }
    
    console.log("=".repeat(60));

  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run validation
validate();
