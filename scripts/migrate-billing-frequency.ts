// Migration script to normalize billing schedule frequency values and
// fill missing ledger entryType fields to prevent UI crashes.

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const BATCH_SIZE = 450;

const normalizeFrequency = (value: any): { normalized: string; changed: boolean } => {
  const current = typeof value === "string" ? value : "";
  let normalized = "monthly";

  switch (current) {
    case "monthly":
    case "quarterly":
    case "milestone":
    case "one_time":
      normalized = current;
      break;
    case "semi_annual":
    case "semi_annually":
      normalized = "semi_annual";
      break;
    case "annual":
    case "annually":
      normalized = "annual";
      break;
    default:
      normalized = "monthly";
  }

  return { normalized, changed: normalized !== current };
};

async function migrateBillingFrequencies(tenantId?: string) {
  const tenants =
    tenantId && tenantId.trim().length > 0
      ? [tenantId]
      : (await db.collection("tenants").get()).docs.map((doc) => doc.id);

  console.log(`Migrating billing frequencies for ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant}`);

    const schedulesSnap = await db
      .collection(`tenants/${tenant}/billingSchedules`)
      .get();

    let batch = db.batch();
    let batchCount = 0;
    let updated = 0;
    let skipped = 0;

    for (const doc of schedulesSnap.docs) {
      const { normalized, changed } = normalizeFrequency(doc.data().frequency);

      if (changed || !doc.data().frequency) {
        batch.update(doc.ref, { frequency: normalized });
        batchCount++;
        updated++;
      } else {
        skipped++;
      }

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} billing schedule updates`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} billing schedule updates`);
    }

    console.log(
      `Tenant ${tenant}: ${updated} billing schedules updated, ${skipped} unchanged`
    );
  }
}

async function fillMissingEntryTypes(tenantId?: string) {
  const tenants =
    tenantId && tenantId.trim().length > 0
      ? [tenantId]
      : (await db.collection("tenants").get()).docs.map((doc) => doc.id);

  console.log(`\nFilling missing ledger entry types for ${tenants.length} tenant(s)`);

  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant}`);

    const entriesSnap = await db
      .collection(`tenants/${tenant}/revenueLedgerEntries`)
      .get();

    let batch = db.batch();
    let batchCount = 0;
    let updated = 0;
    let skipped = 0;

    for (const doc of entriesSnap.docs) {
      const data = doc.data();
      const entryType = data.entryType;

      if (!entryType) {
        batch.update(doc.ref, { entryType: "revenue" });
        batchCount++;
        updated++;
      } else {
        skipped++;
      }

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} ledger entry updates`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} ledger entry updates`);
    }

    console.log(
      `Tenant ${tenant}: ${updated} ledger entries fixed, ${skipped} unchanged`
    );
  }
}

async function run() {
  const tenantId = process.argv[2]; // Optional tenantId argument

  await migrateBillingFrequencies(tenantId);
  await fillMissingEntryTypes(tenantId);

  console.log("\nMigration finished successfully.");
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
