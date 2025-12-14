// Migration script to standardize entryType values in RevenueLedgerEntry documents
// Maps old values to new standardized values from LedgerEntryType enum

import * as admin from "firebase-admin";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Mapping from old values to new standardized values
const ENTRY_TYPE_MAPPING: Record<string, string> = {
  // Old values that might exist
  "revenue_recognition": "revenue",
  "deferral": "deferred_revenue",
  "adjustment": "contract_asset", // Default mapping, may need manual review
  "reversal": "contract_liability", // Default mapping, may need manual review
  // Keep existing correct values
  "revenue": "revenue",
  "deferred_revenue": "deferred_revenue",
  "contract_asset": "contract_asset",
  "contract_liability": "contract_liability",
  "receivable": "receivable",
  "cash": "cash",
  "financing_income": "financing_income",
  "commission_expense": "commission_expense",
};

async function migrateEntryTypes(tenantId?: string) {
  console.log("Starting entryType migration...");
  
  try {
    let tenants: string[] = [];
    
    if (tenantId) {
      tenants = [tenantId];
    } else {
      // Get all tenants
      const tenantsSnapshot = await db.collection("tenants").get();
      tenants = tenantsSnapshot.docs.map(doc => doc.id);
      console.log(`Found ${tenants.length} tenant(s) to migrate`);
    }

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
      console.log(`\nProcessing tenant: ${tenant}`);
      
      const entriesSnapshot = await db
        .collection(`tenants/${tenant}/revenueLedgerEntries`)
        .get();

      const batch = db.batch();
      let batchCount = 0;
      const BATCH_SIZE = 500;

      for (const doc of entriesSnapshot.docs) {
        const data = doc.data();
        const currentType = data.entryType;
        
        if (!currentType) {
          console.warn(`Entry ${doc.id} has no entryType, skipping`);
          totalSkipped++;
          continue;
        }

        const newType = ENTRY_TYPE_MAPPING[currentType];
        
        if (!newType) {
          console.warn(`Unknown entryType "${currentType}" in entry ${doc.id}, skipping`);
          totalSkipped++;
          continue;
        }

        if (currentType !== newType) {
          console.log(`  Migrating entry ${doc.id}: "${currentType}" -> "${newType}"`);
          batch.update(doc.ref, { entryType: newType });
          batchCount++;
          totalMigrated++;

          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`  Committed batch of ${batchCount} updates`);
            batchCount = 0;
          }
        } else {
          totalSkipped++;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`  Committed final batch of ${batchCount} updates`);
      }

      console.log(`Tenant ${tenant}: ${totalMigrated} migrated, ${totalSkipped} skipped`);
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`Total migrated: ${totalMigrated}`);
    console.log(`Total skipped: ${totalSkipped}`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
const tenantId = process.argv[2]; // Optional tenant ID as argument
migrateEntryTypes(tenantId)
  .then(() => {
    console.log("Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
