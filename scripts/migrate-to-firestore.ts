/**
 * Migration Script: PostgreSQL to Firestore
 * 
 * This script exports data from PostgreSQL and imports it into Firestore.
 * 
 * Usage:
 * 1. Set environment variables:
 *    - DATABASE_URL: PostgreSQL connection string
 *    - GOOGLE_APPLICATION_CREDENTIALS: Path to Firebase service account JSON
 * 
 * 2. Run: npx tsx scripts/migrate-to-firestore.ts
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
const auth = admin.auth();

// PostgreSQL connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper to convert PostgreSQL timestamp to Firestore timestamp
function toFirestoreTimestamp(date: Date | string | null): admin.firestore.Timestamp | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return admin.firestore.Timestamp.fromDate(d);
}

// Helper to parse decimal values
function parseDecimal(value: string | number | null): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

// Helper to batch write documents
async function batchWrite(
  collectionPath: string,
  documents: Array<{ id?: string; data: Record<string, any> }>
): Promise<void> {
  const batches: admin.firestore.WriteBatch[] = [];
  let currentBatch = firestore.batch();
  let operationCount = 0;

  for (const doc of documents) {
    const ref = doc.id
      ? firestore.collection(collectionPath).doc(doc.id)
      : firestore.collection(collectionPath).doc();

    currentBatch.set(ref, doc.data);
    operationCount++;

    if (operationCount === 500) {
      batches.push(currentBatch);
      currentBatch = firestore.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  for (const batch of batches) {
    await batch.commit();
  }
}

// Migration functions for each entity
async function migrateTenants(): Promise<Map<string, string>> {
  console.log("Migrating tenants...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM tenants ORDER BY created_at");
  
  for (const row of result.rows) {
    const data = {
      name: row.name,
      country: row.country,
      currency: row.currency || "BRL",
      taxId: row.tax_id,
      planType: row.plan_type || "starter",
      maxContracts: row.max_contracts || 10,
      maxLicenses: row.max_licenses || 1,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      subscriptionStatus: row.subscription_status,
      currentPeriodStart: toFirestoreTimestamp(row.current_period_start),
      currentPeriodEnd: toFirestoreTimestamp(row.current_period_end),
      cancelAtPeriodEnd: row.cancel_at_period_end || false,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    const docRef = await firestore.collection("tenants").add(data);
    idMap.set(row.id, docRef.id);
    console.log(`  Migrated tenant: ${row.name} (${row.id} -> ${docRef.id})`);
  }

  console.log(`  Total: ${result.rows.length} tenants`);
  return idMap;
}

async function migrateUsers(tenantIdMap: Map<string, string>): Promise<Map<string, string>> {
  console.log("Migrating users...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM users ORDER BY created_at");

  for (const row of result.rows) {
    const newTenantId = row.tenant_id ? tenantIdMap.get(row.tenant_id) : null;

    try {
      // Create user in Firebase Auth
      let authUser;
      try {
        authUser = await auth.createUser({
          email: row.email,
          displayName: row.full_name,
          // Note: We can't migrate the password hash directly
          // Users will need to reset their passwords
          password: "TempPassword123!", // Temporary password
        });
      } catch (authError: any) {
        if (authError.code === "auth/email-already-exists") {
          authUser = await auth.getUserByEmail(row.email);
        } else {
          throw authError;
        }
      }

      // Set custom claims
      if (newTenantId) {
        await auth.setCustomUserClaims(authUser.uid, {
          tenantId: newTenantId,
          role: row.role || "readonly",
          systemAdmin: row.email === "fernandocostaxavier@gmail.com",
        });
      }

      // Create user document in Firestore
      const userData = {
        tenantId: newTenantId,
        username: row.username,
        email: row.email,
        fullName: row.full_name,
        role: row.role || "readonly",
        mustChangePassword: true, // Force password change after migration
        isActive: row.is_active || false,
        licenseKey: row.license_key,
        licenseActivatedAt: toFirestoreTimestamp(row.license_activated_at),
        lastLoginAt: toFirestoreTimestamp(row.last_login_at),
        lastLoginIp: row.last_login_ip,
        createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
      };

      // Save to root users collection
      await firestore.collection("users").doc(authUser.uid).set(userData);

      // Also save to tenant subcollection if tenant exists
      if (newTenantId) {
        await firestore
          .collection(`tenants/${newTenantId}/users`)
          .doc(authUser.uid)
          .set(userData);
      }

      idMap.set(row.id, authUser.uid);
      console.log(`  Migrated user: ${row.email} (${row.id} -> ${authUser.uid})`);
    } catch (error) {
      console.error(`  Error migrating user ${row.email}:`, error);
    }
  }

  console.log(`  Total: ${result.rows.length} users`);
  return idMap;
}

async function migrateCustomers(tenantIdMap: Map<string, string>): Promise<Map<string, string>> {
  console.log("Migrating customers...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM customers ORDER BY created_at");

  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    if (!newTenantId) {
      console.log(`  Skipping customer ${row.name}: tenant not found`);
      continue;
    }

    const data = {
      tenantId: newTenantId,
      name: row.name,
      country: row.country || "BR",
      currency: row.currency || "BRL",
      taxId: row.tax_id,
      creditRating: row.credit_rating,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      billingAddress: row.billing_address,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    const docRef = await firestore
      .collection(`tenants/${newTenantId}/customers`)
      .add(data);
    idMap.set(row.id, docRef.id);
  }

  console.log(`  Total: ${result.rows.length} customers`);
  return idMap;
}

async function migrateContracts(
  tenantIdMap: Map<string, string>,
  customerIdMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log("Migrating contracts...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM contracts ORDER BY created_at");

  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    const newCustomerId = customerIdMap.get(row.customer_id);

    if (!newTenantId) {
      console.log(`  Skipping contract ${row.contract_number}: tenant not found`);
      continue;
    }

    const data = {
      tenantId: newTenantId,
      customerId: newCustomerId || row.customer_id,
      contractNumber: row.contract_number,
      title: row.title,
      status: row.status || "draft",
      startDate: toFirestoreTimestamp(row.start_date),
      endDate: toFirestoreTimestamp(row.end_date),
      totalValue: parseDecimal(row.total_value),
      currency: row.currency || "BRL",
      paymentTerms: row.payment_terms,
      currentVersionId: null, // Will be updated after versions are migrated
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
      updatedAt: toFirestoreTimestamp(row.updated_at) || admin.firestore.Timestamp.now(),
    };

    const docRef = await firestore
      .collection(`tenants/${newTenantId}/contracts`)
      .add(data);
    idMap.set(row.id, docRef.id);
  }

  console.log(`  Total: ${result.rows.length} contracts`);
  return idMap;
}

// Helper to get tenant ID from contract
async function getContractTenantMap(): Promise<Map<string, string>> {
  const contractTenantMap = new Map<string, string>();
  const contractsResult = await pool.query("SELECT id, tenant_id FROM contracts");
  for (const row of contractsResult.rows) {
    contractTenantMap.set(row.id, row.tenant_id);
  }
  return contractTenantMap;
}

async function migrateContractVersions(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>,
  userIdMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log("Migrating contract versions...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM contract_versions ORDER BY created_at");
  const contractTenantMap = await getContractTenantMap();

  for (const row of result.rows) {
    const originalTenantId = contractTenantMap.get(row.contract_id);
    const newTenantId = originalTenantId ? tenantIdMap.get(originalTenantId) : null;
    const newContractId = contractIdMap.get(row.contract_id);

    if (!newTenantId || !newContractId) {
      console.log(`  Skipping version: contract not found`);
      continue;
    }

    const data = {
      contractId: newContractId,
      versionNumber: row.version_number,
      effectiveDate: toFirestoreTimestamp(row.effective_date),
      description: row.description,
      totalValue: parseDecimal(row.total_value),
      modificationReason: row.modification_reason,
      isProspective: row.is_prospective ?? true,
      createdBy: row.created_by ? userIdMap.get(row.created_by) : null,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    const docRef = await firestore
      .collection(`tenants/${newTenantId}/contracts/${newContractId}/versions`)
      .add(data);
    idMap.set(row.id, docRef.id);
  }

  console.log(`  Total: ${result.rows.length} contract versions`);
  return idMap;
}

// Helper to get version mapping info
async function getVersionTenantContractMap(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>
): Promise<Map<string, { tenantId: string; contractId: string }>> {
  const versionMap = new Map<string, { tenantId: string; contractId: string }>();
  const result = await pool.query(`
    SELECT cv.id, c.tenant_id, c.id as contract_id 
    FROM contract_versions cv 
    JOIN contracts c ON cv.contract_id = c.id
  `);
  
  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    const newContractId = contractIdMap.get(row.contract_id);
    if (newTenantId && newContractId) {
      versionMap.set(row.id, { tenantId: newTenantId, contractId: newContractId });
    }
  }
  return versionMap;
}

async function migrateContractLineItems(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>,
  versionIdMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log("Migrating contract line items...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM contract_line_items ORDER BY created_at");
  const versionTenantContractMap = await getVersionTenantContractMap(tenantIdMap, contractIdMap);

  for (const row of result.rows) {
    const versionInfo = versionTenantContractMap.get(row.contract_version_id);
    const newVersionId = versionIdMap.get(row.contract_version_id);

    if (!versionInfo || !newVersionId) {
      console.log(`  Skipping line item: version not found`);
      continue;
    }

    const data = {
      contractVersionId: newVersionId,
      description: row.description,
      quantity: parseDecimal(row.quantity),
      unitPrice: parseDecimal(row.unit_price),
      totalPrice: parseDecimal(row.total_price),
      standaloneSelllingPrice: row.standalone_selling_price ? parseDecimal(row.standalone_selling_price) : null,
      isDistinct: row.is_distinct ?? true,
      distinctWithinContext: row.distinct_within_context ?? true,
      recognitionMethod: row.recognition_method,
      measurementMethod: row.measurement_method,
      deliveryStartDate: toFirestoreTimestamp(row.delivery_start_date),
      deliveryEndDate: toFirestoreTimestamp(row.delivery_end_date),
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    const docRef = await firestore
      .collection(`tenants/${versionInfo.tenantId}/contracts/${versionInfo.contractId}/versions/${newVersionId}/lineItems`)
      .add(data);
    idMap.set(row.id, docRef.id);
  }

  console.log(`  Total: ${result.rows.length} line items`);
  return idMap;
}

async function migratePerformanceObligations(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>,
  versionIdMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log("Migrating performance obligations...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM performance_obligations ORDER BY created_at");
  const versionTenantContractMap = await getVersionTenantContractMap(tenantIdMap, contractIdMap);

  for (const row of result.rows) {
    const versionInfo = versionTenantContractMap.get(row.contract_version_id);
    const newVersionId = versionIdMap.get(row.contract_version_id);

    if (!versionInfo || !newVersionId) {
      console.log(`  Skipping PO: version not found`);
      continue;
    }

    const data = {
      contractVersionId: newVersionId,
      description: row.description,
      lineItemIds: row.line_item_ids || [],
      allocatedPrice: parseDecimal(row.allocated_price),
      recognitionMethod: row.recognition_method,
      measurementMethod: row.measurement_method,
      percentComplete: parseDecimal(row.percent_complete),
      recognizedAmount: parseDecimal(row.recognized_amount),
      deferredAmount: parseDecimal(row.deferred_amount),
      isSatisfied: row.is_satisfied || false,
      satisfiedDate: toFirestoreTimestamp(row.satisfied_date),
      justification: row.justification,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    const docRef = await firestore
      .collection(`tenants/${versionInfo.tenantId}/contracts/${versionInfo.contractId}/versions/${newVersionId}/performanceObligations`)
      .add(data);
    idMap.set(row.id, docRef.id);
  }

  console.log(`  Total: ${result.rows.length} performance obligations`);
  return idMap;
}

// Helper to get PO mapping info
async function getPOTenantContractVersionMap(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>,
  versionIdMap: Map<string, string>
): Promise<Map<string, { tenantId: string; contractId: string; versionId: string }>> {
  const poMap = new Map<string, { tenantId: string; contractId: string; versionId: string }>();
  const result = await pool.query(`
    SELECT po.id, c.tenant_id, c.id as contract_id, cv.id as version_id
    FROM performance_obligations po 
    JOIN contract_versions cv ON po.contract_version_id = cv.id
    JOIN contracts c ON cv.contract_id = c.id
  `);
  
  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    const newContractId = contractIdMap.get(row.contract_id);
    const newVersionId = versionIdMap.get(row.version_id);
    if (newTenantId && newContractId && newVersionId) {
      poMap.set(row.id, { tenantId: newTenantId, contractId: newContractId, versionId: newVersionId });
    }
  }
  return poMap;
}

async function migrateRevenueSchedules(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>,
  versionIdMap: Map<string, string>,
  poIdMap: Map<string, string>
): Promise<void> {
  console.log("Migrating revenue schedules...");

  const result = await pool.query("SELECT * FROM revenue_schedules ORDER BY created_at");
  const poTenantContractVersionMap = await getPOTenantContractVersionMap(tenantIdMap, contractIdMap, versionIdMap);

  let count = 0;
  for (const row of result.rows) {
    const poInfo = poTenantContractVersionMap.get(row.performance_obligation_id);
    const newPOId = poIdMap.get(row.performance_obligation_id);

    if (!poInfo || !newPOId) {
      continue;
    }

    const data = {
      performanceObligationId: newPOId,
      periodStart: toFirestoreTimestamp(row.period_start),
      periodEnd: toFirestoreTimestamp(row.period_end),
      scheduledAmount: parseDecimal(row.scheduled_amount),
      recognizedAmount: parseDecimal(row.recognized_amount),
      isRecognized: row.is_recognized || false,
      recognizedDate: toFirestoreTimestamp(row.recognized_date),
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore
      .collection(`tenants/${poInfo.tenantId}/contracts/${poInfo.contractId}/versions/${poInfo.versionId}/performanceObligations/${newPOId}/revenueSchedules`)
      .add(data);
    count++;
  }

  console.log(`  Total: ${count} revenue schedules`);
}

async function migrateBillingSchedules(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>,
  poIdMap: Map<string, string>
): Promise<void> {
  console.log("Migrating billing schedules...");

  const result = await pool.query("SELECT * FROM billing_schedules ORDER BY created_at");

  let count = 0;
  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    const newContractId = contractIdMap.get(row.contract_id);
    const newPOId = row.performance_obligation_id ? poIdMap.get(row.performance_obligation_id) : null;

    if (!newTenantId) {
      continue;
    }

    const data = {
      tenantId: newTenantId,
      contractId: newContractId,
      performanceObligationId: newPOId,
      billingDate: toFirestoreTimestamp(row.billing_date),
      dueDate: toFirestoreTimestamp(row.due_date),
      amount: parseDecimal(row.amount),
      currency: row.currency || "BRL",
      frequency: row.frequency,
      status: row.status || "scheduled",
      invoiceNumber: row.invoice_number,
      invoicedAt: toFirestoreTimestamp(row.invoiced_at),
      paidAt: toFirestoreTimestamp(row.paid_at),
      paidAmount: row.paid_amount ? parseDecimal(row.paid_amount) : null,
      notes: row.notes,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore
      .collection(`tenants/${newTenantId}/billingSchedules`)
      .add(data);
    count++;
  }

  console.log(`  Total: ${count} billing schedules`);
}

async function migrateRevenueLedgerEntries(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>,
  poIdMap: Map<string, string>,
  userIdMap: Map<string, string>
): Promise<void> {
  console.log("Migrating revenue ledger entries...");

  const result = await pool.query("SELECT * FROM revenue_ledger_entries ORDER BY created_at");

  let count = 0;
  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    const newContractId = contractIdMap.get(row.contract_id);
    const newPOId = row.performance_obligation_id ? poIdMap.get(row.performance_obligation_id) : null;

    if (!newTenantId) {
      continue;
    }

    const data = {
      tenantId: newTenantId,
      contractId: newContractId,
      performanceObligationId: newPOId,
      billingScheduleId: row.billing_schedule_id, // Note: would need to map if necessary
      entryDate: toFirestoreTimestamp(row.entry_date),
      periodStart: toFirestoreTimestamp(row.period_start),
      periodEnd: toFirestoreTimestamp(row.period_end),
      entryType: row.entry_type,
      debitAccount: row.debit_account,
      creditAccount: row.credit_account,
      amount: parseDecimal(row.amount),
      currency: row.currency || "BRL",
      exchangeRate: parseDecimal(row.exchange_rate) || 1,
      functionalAmount: row.functional_amount ? parseDecimal(row.functional_amount) : null,
      description: row.description,
      referenceNumber: row.reference_number,
      isPosted: row.is_posted || false,
      postedAt: toFirestoreTimestamp(row.posted_at),
      postedBy: row.posted_by ? userIdMap.get(row.posted_by) : null,
      isReversed: row.is_reversed || false,
      reversedEntryId: row.reversed_entry_id,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore
      .collection(`tenants/${newTenantId}/revenueLedgerEntries`)
      .add(data);
    count++;
  }

  console.log(`  Total: ${count} revenue ledger entries`);
}

async function migrateContractBalances(
  tenantIdMap: Map<string, string>,
  contractIdMap: Map<string, string>
): Promise<void> {
  console.log("Migrating contract balances...");

  const result = await pool.query("SELECT * FROM contract_balances ORDER BY created_at");
  const contractTenantMap = await getContractTenantMap();

  let count = 0;
  for (const row of result.rows) {
    const originalTenantId = contractTenantMap.get(row.contract_id);
    const newTenantId = originalTenantId ? tenantIdMap.get(originalTenantId) : null;
    const newContractId = contractIdMap.get(row.contract_id);

    if (!newTenantId || !newContractId) {
      continue;
    }

    const data = {
      contractId: newContractId,
      periodDate: toFirestoreTimestamp(row.period_date),
      contractAsset: parseDecimal(row.contract_asset),
      contractLiability: parseDecimal(row.contract_liability),
      receivable: parseDecimal(row.receivable),
      revenueRecognized: parseDecimal(row.revenue_recognized),
      cashReceived: parseDecimal(row.cash_received),
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore
      .collection(`tenants/${newTenantId}/contracts/${newContractId}/balances`)
      .add(data);
    count++;
  }

  console.log(`  Total: ${count} contract balances`);
}

async function migrateConsolidatedBalances(tenantIdMap: Map<string, string>): Promise<void> {
  console.log("Migrating consolidated balances...");

  const result = await pool.query("SELECT * FROM consolidated_balances ORDER BY created_at");

  let count = 0;
  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    if (!newTenantId) {
      continue;
    }

    const data = {
      tenantId: newTenantId,
      periodDate: toFirestoreTimestamp(row.period_date),
      periodType: row.period_type || "monthly",
      totalContractAssets: parseDecimal(row.total_contract_assets),
      totalContractLiabilities: parseDecimal(row.total_contract_liabilities),
      totalReceivables: parseDecimal(row.total_receivables),
      totalDeferredRevenue: parseDecimal(row.total_deferred_revenue),
      totalRecognizedRevenue: parseDecimal(row.total_recognized_revenue),
      totalBilledAmount: parseDecimal(row.total_billed_amount),
      totalCashReceived: parseDecimal(row.total_cash_received),
      totalRemainingObligations: parseDecimal(row.total_remaining_obligations),
      contractCount: row.contract_count || 0,
      currency: row.currency || "BRL",
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore
      .collection(`tenants/${newTenantId}/consolidatedBalances`)
      .add(data);
    count++;
  }

  console.log(`  Total: ${count} consolidated balances`);
}

async function migrateLicenses(tenantIdMap: Map<string, string>, userIdMap: Map<string, string>): Promise<void> {
  console.log("Migrating licenses...");

  const result = await pool.query("SELECT * FROM licenses ORDER BY created_at");

  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    if (!newTenantId) {
      console.log(`  Skipping license: tenant not found`);
      continue;
    }

    const data = {
      tenantId: newTenantId,
      licenseKey: row.license_key,
      status: row.status || "active",
      seatCount: row.seat_count || 1,
      currentIp: row.current_ip,
      currentUserId: row.current_user_id ? userIdMap.get(row.current_user_id) : null,
      lockedAt: toFirestoreTimestamp(row.locked_at),
      lastSeenAt: toFirestoreTimestamp(row.last_seen_at),
      graceUntil: toFirestoreTimestamp(row.grace_until),
      activatedAt: toFirestoreTimestamp(row.activated_at),
      activatedByUserId: row.activated_by_user_id ? userIdMap.get(row.activated_by_user_id) : null,
      activationIp: row.activation_ip,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore.collection(`tenants/${newTenantId}/licenses`).add(data);
  }

  console.log(`  Total: ${result.rows.length} licenses`);
}

async function migrateSubscriptionPlans(): Promise<void> {
  console.log("Migrating subscription plans...");

  const result = await pool.query("SELECT * FROM subscription_plans ORDER BY created_at");

  for (const row of result.rows) {
    const data = {
      name: row.name,
      description: row.description,
      priceMonthly: parseDecimal(row.price_monthly),
      priceYearly: row.price_yearly ? parseDecimal(row.price_yearly) : null,
      stripePriceIdMonthly: row.stripe_price_id_monthly,
      stripePriceIdYearly: row.stripe_price_id_yearly,
      features: row.features || [],
      maxUsers: row.max_users || 1,
      isActive: row.is_active ?? true,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore.collection("subscriptionPlans").add(data);
  }

  console.log(`  Total: ${result.rows.length} subscription plans`);
}

async function migrateAuditLogs(
  tenantIdMap: Map<string, string>,
  userIdMap: Map<string, string>
): Promise<void> {
  console.log("Migrating audit logs (last 1000)...");

  const result = await pool.query(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000"
  );

  for (const row of result.rows) {
    const newTenantId = row.tenant_id ? tenantIdMap.get(row.tenant_id) : null;
    if (!newTenantId) continue;

    const data = {
      tenantId: newTenantId,
      userId: row.user_id ? userIdMap.get(row.user_id) : null,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      previousValue: row.previous_value,
      newValue: row.new_value,
      justification: row.justification,
      ipAddress: row.ip_address,
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
    };

    await firestore.collection(`tenants/${newTenantId}/auditLogs`).add(data);
  }

  console.log(`  Total: ${result.rows.length} audit logs`);
}

async function migrateAiProviderConfigs(tenantIdMap: Map<string, string>): Promise<Map<string, string>> {
  console.log("Migrating AI provider configs...");
  const idMap = new Map<string, string>();

  const result = await pool.query("SELECT * FROM ai_provider_configs ORDER BY created_at");

  for (const row of result.rows) {
    const newTenantId = tenantIdMap.get(row.tenant_id);
    if (!newTenantId) continue;

    const data = {
      tenantId: newTenantId,
      provider: row.provider,
      name: row.name,
      apiKey: row.api_key, // Note: Should be encrypted in production
      model: row.model,
      baseUrl: row.base_url,
      isDefault: row.is_default || false,
      isActive: row.is_active ?? true,
      lastUsedAt: toFirestoreTimestamp(row.last_used_at),
      createdAt: toFirestoreTimestamp(row.created_at) || admin.firestore.Timestamp.now(),
      updatedAt: toFirestoreTimestamp(row.updated_at) || admin.firestore.Timestamp.now(),
    };

    const docRef = await firestore.collection(`tenants/${newTenantId}/aiProviderConfigs`).add(data);
    idMap.set(row.id, docRef.id);
  }

  console.log(`  Total: ${result.rows.length} AI provider configs`);
  return idMap;
}

// Main migration function
async function migrate() {
  console.log("=".repeat(60));
  console.log("Starting PostgreSQL to Firestore Migration");
  console.log("=".repeat(60));

  try {
    // Migrate in order of dependencies
    console.log("\n--- Phase 1: Core Entities ---");
    const tenantIdMap = await migrateTenants();
    const userIdMap = await migrateUsers(tenantIdMap);
    const customerIdMap = await migrateCustomers(tenantIdMap);
    
    console.log("\n--- Phase 2: Contracts ---");
    const contractIdMap = await migrateContracts(tenantIdMap, customerIdMap);
    const versionIdMap = await migrateContractVersions(tenantIdMap, contractIdMap, userIdMap);
    const lineItemIdMap = await migrateContractLineItems(tenantIdMap, contractIdMap, versionIdMap);
    const poIdMap = await migratePerformanceObligations(tenantIdMap, contractIdMap, versionIdMap);
    
    console.log("\n--- Phase 3: Schedules and Accounting ---");
    await migrateRevenueSchedules(tenantIdMap, contractIdMap, versionIdMap, poIdMap);
    await migrateBillingSchedules(tenantIdMap, contractIdMap, poIdMap);
    await migrateRevenueLedgerEntries(tenantIdMap, contractIdMap, poIdMap, userIdMap);
    await migrateContractBalances(tenantIdMap, contractIdMap);
    await migrateConsolidatedBalances(tenantIdMap);
    
    console.log("\n--- Phase 4: Auxiliary Data ---");
    await migrateLicenses(tenantIdMap, userIdMap);
    await migrateSubscriptionPlans();
    await migrateAuditLogs(tenantIdMap, userIdMap);
    await migrateAiProviderConfigs(tenantIdMap);

    console.log("\n" + "=".repeat(60));
    console.log("Migration completed successfully!");
    console.log("=".repeat(60));
    console.log("\nIMPORTANT: All users will need to reset their passwords.");
    console.log("Send password reset emails to all migrated users.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run migration
migrate();
