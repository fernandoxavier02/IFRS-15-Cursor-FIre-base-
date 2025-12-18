/**
 * Revenue Ledger Automation Triggers
 * 
 * Automatically generates revenue ledger entries based on system events:
 * - Billing paid: Generates cash entry
 * - Billing invoiced: Generates receivable entry
 * - PO satisfied: Generates revenue entry for point-in-time POs
 * - Monthly cron: Generates progressive revenue entries for over-time POs
 */

import type { LedgerEntryType } from "@shared/firestore-types";
import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";
import { generateRevenueLedgerV2ForContract } from "./ledger-v2";

/**
 * Check if a ledger entry already exists to prevent duplicates
 */
async function checkExistingEntry(
  tenantId: string,
  contractId: string,
  entryType: LedgerEntryType,
  referenceNumber: string,
  periodStart: Date,
  periodEnd: Date
): Promise<boolean> {
  const periodStartTimestamp = Timestamp.fromDate(periodStart);
  const periodEndTimestamp = Timestamp.fromDate(periodEnd);

  const existing = await db
    .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
    .where("contractId", "==", contractId)
    .where("entryType", "==", entryType)
    .where("referenceNumber", "==", referenceNumber)
    .where("periodStart", "==", periodStartTimestamp)
    .where("periodEnd", "==", periodEndTimestamp)
    .limit(1)
    .get();

  return !existing.empty;
}

function buildReference(
  prefix: string,
  key: string,
  periodStart: Date,
  periodEnd: Date
): string {
  return `${prefix}-${key}-${periodStart.getTime()}-${periodEnd.getTime()}`;
}

/**
 * Generate cash entry when billing is paid
 */
async function generateCashEntry(
  tenantId: string,
  contractId: string,
  billingScheduleId: string,
  amount: number,
  currency: string,
  paidAt: Date
): Promise<void> {
  const entryDate = Timestamp.fromDate(paidAt);
  const periodStart = Timestamp.fromDate(paidAt);
  const periodEnd = Timestamp.fromDate(paidAt);
  const referenceNumber = buildReference("CASH-AUTO", billingScheduleId, paidAt, paidAt);

  // Check for duplicates
  const exists = await checkExistingEntry(
    tenantId,
    contractId,
    "cash",
    referenceNumber,
    paidAt,
    paidAt
  );

  if (exists) {
    console.log(`Cash entry already exists for billing ${billingScheduleId}`);
    return;
  }

  await db.collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)).add({
    tenantId,
    contractId,
    billingScheduleId,
    entryDate,
    periodStart,
    periodEnd,
    entryType: "cash",
    debitAccount: "1000 - Cash",
    creditAccount: "1200 - Accounts Receivable (AR)",
    amount,
    currency,
    exchangeRate: 1,
    description: `Cash received for billing ${billingScheduleId}`,
    referenceNumber,
    isPosted: false,
    isReversed: false,
    createdAt: entryDate,
  });

  console.log(`✅ Generated cash entry for billing ${billingScheduleId}`);
}

/**
 * Generate receivable entry when billing is invoiced
 * For point-in-time: débito AR, crédito Receita/Deferred
 * For over-time: débito AR, crédito Deferred (revenue será reconhecida progressivamente)
 */
async function generateReceivableEntry(
  tenantId: string,
  contractId: string,
  billingScheduleId: string,
  amount: number,
  currency: string,
  invoicedAt: Date,
  performanceObligationId?: string
): Promise<void> {
  const entryDate = Timestamp.fromDate(invoicedAt);
  const periodStart = Timestamp.fromDate(invoicedAt);
  const periodEnd = Timestamp.fromDate(invoicedAt);
  
  // Buscar a PO para determinar o tipo de reconhecimento
  let recognitionMethod: "point_in_time" | "over_time" | null = null;
  if (performanceObligationId) {
    try {
      // Buscar a PO na versão atual do contrato
      const contractRef = db.collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS)).doc(contractId);
      const contractDoc = await contractRef.get();
      if (contractDoc.exists) {
        const contract = contractDoc.data();
        const currentVersionId = contract?.currentVersionId;
        if (currentVersionId) {
          const poRef = db
            .collection(`${contractRef.path}/versions/${currentVersionId}/performanceObligations`)
            .doc(performanceObligationId);
          const poDoc = await poRef.get();
          if (poDoc.exists) {
            recognitionMethod = poDoc.data()?.recognitionMethod || null;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching PO ${performanceObligationId}:`, error);
    }
  }

  // Point-in-time: débito AR, crédito Receita/Deferred
  if (recognitionMethod === "point_in_time") {
    const referenceNumber = buildReference(
      "AR-PIT",
      `${billingScheduleId}-${performanceObligationId || "none"}`,
      invoicedAt,
      invoicedAt
    );
    
    // Check for duplicates
    const exists = await checkExistingEntry(
      tenantId,
      contractId,
      "receivable",
      referenceNumber,
      invoicedAt,
      invoicedAt
    );

    if (exists) {
      console.log(`Receivable entry already exists for billing ${billingScheduleId}`);
      return;
    }

    // Criar entrada de Receivable
    await db.collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)).add({
      tenantId,
      contractId,
      billingScheduleId,
      performanceObligationId,
      entryDate,
      periodStart,
      periodEnd,
      entryType: "receivable",
      debitAccount: "1200 - Accounts Receivable (AR)",
      creditAccount: "4000 - Revenue",
      amount,
      currency,
      exchangeRate: 1,
      description: `Accounts receivable for billing ${billingScheduleId} (point-in-time)`,
      referenceNumber,
      isPosted: false,
      isReversed: false,
      createdAt: entryDate,
    });

    console.log(`✅ Generated receivable entry for point-in-time billing ${billingScheduleId}`);
  } else {
    // Over-time: débito AR, crédito Deferred Revenue
    const referenceNumber = buildReference(
      "AR-OT",
      `${billingScheduleId}-${performanceObligationId || "none"}`,
      invoicedAt,
      invoicedAt
    );
    
    // Check for duplicates
    const exists = await checkExistingEntry(
      tenantId,
      contractId,
      "receivable",
      referenceNumber,
      invoicedAt,
      invoicedAt
    );

    if (exists) {
      console.log(`Receivable entry already exists for billing ${billingScheduleId}`);
      return;
    }

    // Criar entrada de Receivable com crédito em Deferred Revenue
    await db.collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)).add({
      tenantId,
      contractId,
      billingScheduleId,
      performanceObligationId,
      entryDate,
      periodStart,
      periodEnd,
      entryType: "receivable",
      debitAccount: "1200 - Accounts Receivable (AR)",
      creditAccount: "2500 - Deferred Revenue",
      amount,
      currency,
      exchangeRate: 1,
      description: `Accounts receivable for billing ${billingScheduleId} (over-time)`,
      referenceNumber,
      isPosted: false,
      isReversed: false,
      createdAt: entryDate,
    });

    console.log(`✅ Generated receivable entry for over-time billing ${billingScheduleId}`);
  }
}

/**
 * Generate revenue entry for point-in-time PO when satisfied
 */
async function generateRevenueEntryForPO(
  tenantId: string,
  contractId: string,
  performanceObligationId: string,
  amount: number,
  currency: string,
  satisfiedDate: Date
): Promise<void> {
  const entryDate = Timestamp.fromDate(satisfiedDate);
  const periodStart = Timestamp.fromDate(satisfiedDate);
  const periodEnd = Timestamp.fromDate(satisfiedDate);
  const referenceNumber = buildReference("REV-PO", performanceObligationId, satisfiedDate, satisfiedDate);

  // Check for duplicates
  const exists = await checkExistingEntry(
    tenantId,
    contractId,
    "revenue",
    referenceNumber,
    satisfiedDate,
    satisfiedDate
  );

  if (exists) {
    console.log(`Revenue entry already exists for PO ${performanceObligationId}`);
    return;
  }

  await db.collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)).add({
    tenantId,
    contractId,
    performanceObligationId,
    entryDate,
    periodStart,
    periodEnd,
    entryType: "revenue",
    debitAccount: "1300 - Contract Asset",
    creditAccount: "4000 - Revenue",
    amount,
    currency,
    exchangeRate: 1,
    description: `Revenue recognized for PO ${performanceObligationId} (point-in-time)`,
    referenceNumber,
    isPosted: false,
    isReversed: false,
    createdAt: entryDate,
  });

  console.log(`✅ Generated revenue entry for PO ${performanceObligationId}`);
}

// Legacy posting helpers kept for reference (Ledger v2 supersedes them).
void generateCashEntry;
void generateReceivableEntry;
void generateRevenueEntryForPO;

/**
 * Trigger: When billing is marked as paid
 */
export const onBillingPaid = functions.firestore
  .document("tenants/{tenantId}/billingSchedules/{billingId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tenantId = context.params.tenantId;
    const billingId = context.params.billingId;

    // Only process if status changed to "paid"
    if (before.status !== "paid" && after.status === "paid") {
      const contractId = after.contractId;

      if (contractId) {
        try {
          await generateRevenueLedgerV2ForContract({ tenantId, contractId, upTo: new Date() });
        } catch (error) {
          console.error("[onBillingPaid] Failed to generate ledger v2", {
            tenantId,
            contractId,
            billingId,
            error,
          });
        }
      }
    }
  });

/**
 * Trigger: When billing is marked as invoiced
 */
export const onBillingInvoiced = functions.firestore
  .document("tenants/{tenantId}/billingSchedules/{billingId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tenantId = context.params.tenantId;
    const billingId = context.params.billingId;

    // Only process if status changed to "invoiced"
    if (before.status !== "invoiced" && after.status === "invoiced") {
      const contractId = after.contractId;

      if (contractId) {
        try {
          await generateRevenueLedgerV2ForContract({ tenantId, contractId, upTo: new Date() });
        } catch (error) {
          console.error("[onBillingInvoiced] Failed to generate ledger v2", {
            tenantId,
            contractId,
            billingId,
            error,
          });
        }
      }
    }
  });

/**
 * Trigger: When PO is satisfied (point-in-time recognition)
 */
export const onPOSatisfied = functions.firestore
  .document("tenants/{tenantId}/contracts/{contractId}/versions/{versionId}/performanceObligations/{poId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tenantId = context.params.tenantId;
    const contractId = context.params.contractId;
    const poId = context.params.poId;

    // Only process if PO became satisfied and is point-in-time
    if (
      !before.isSatisfied &&
      after.isSatisfied &&
      after.recognitionMethod === "point_in_time"
    ) {
      try {
        await generateRevenueLedgerV2ForContract({ tenantId, contractId, upTo: new Date() });
      } catch (error) {
        console.error("[onPOSatisfied] Failed to generate ledger v2", {
          tenantId,
          contractId,
          poId,
          error,
        });
      }
    }
  });

/**
 * Scheduled function: Monthly revenue recognition for over-time POs
 * Runs on the 1st of each month at 2 AM
 */
export const monthlyRevenueRecognition = functions.pubsub
  .schedule("0 2 1 * *") // 2 AM on 1st of each month
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const now = new Date();

    // Ledger v2: generate IFRS 15-aligned entries (double-entry) for all contracts.
    // This supersedes the legacy "monthly recognition" postings.
    const tenantsSnapshotV2 = await db.collection("tenants").get();
    for (const tenantDoc of tenantsSnapshotV2.docs) {
      const tenantId = tenantDoc.id;

      const contractsSnapshot = await db
        .collection(`tenants/${tenantId}/contracts`)
        .where("status", "in", ["active", "modified"])
        .get();

      for (const contractDoc of contractsSnapshot.docs) {
        const contractId = contractDoc.id;
        try {
          await generateRevenueLedgerV2ForContract({ tenantId, contractId, upTo: now });
        } catch (error) {
          console.error("[monthlyRevenueRecognition] Failed to generate ledger v2", {
            tenantId,
            contractId,
            error,
          });
        }
      }
    }

    console.log("[monthlyRevenueRecognition] Ledger v2 generation completed");
    return;

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all tenants
    const tenantsSnapshot = await db.collection("tenants").get();

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;

      // Get all active contracts
      const contractsSnapshot = await db
        .collection(`tenants/${tenantId}/contracts`)
        .where("status", "==", "active")
        .get();

      for (const contractDoc of contractsSnapshot.docs) {
        const contractId = contractDoc.id;
        const contract = contractDoc.data();
        const currentVersionId = contract.currentVersionId;

        if (!currentVersionId) continue;

        // Get version and POs
        const versionRef = contractDoc.ref.collection("versions").doc(currentVersionId);
        const versionDoc = await versionRef.get();
        if (!versionDoc.exists) continue;

        const posSnapshot = await versionRef.collection("performanceObligations").get();

        for (const poDoc of posSnapshot.docs) {
          const po = poDoc.data();

          // Only process over-time POs
          if (po.recognitionMethod !== "over_time") continue;

          // Get revenue schedules for last month
          const schedulesSnapshot = await poDoc.ref
            .collection("revenueSchedules")
            .where("periodStart", "<=", Timestamp.fromDate(lastMonthEnd))
            .where("periodEnd", ">=", Timestamp.fromDate(lastMonth))
            .where("isRecognized", "==", false)
            .get();

          for (const scheduleDoc of schedulesSnapshot.docs) {
            const schedule = scheduleDoc.data();
            const periodStart = schedule.periodStart.toDate();
            const periodEnd = schedule.periodEnd.toDate();

            // Check if period is in the past
            if (periodEnd < now) {
              const amount = Number(schedule.scheduledAmount || 0);
              const currency = contract.currency || "BRL";
              const referenceNumber = `REV-MONTHLY-${contractId}-${poDoc.id}-${periodStart.getTime()}`;

              // Check for duplicates
              const exists = await checkExistingEntry(
                tenantId,
                contractId,
                "revenue",
                referenceNumber,
                periodStart,
                periodEnd
              );

              if (!exists && amount > 0) {
                // Over-time: débito Deferred Revenue, crédito Revenue
                await db
                  .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
                  .add({
                    tenantId,
                    contractId,
                    performanceObligationId: poDoc.id,
                    entryDate: Timestamp.fromDate(now),
                    periodStart: Timestamp.fromDate(periodStart),
                    periodEnd: Timestamp.fromDate(periodEnd),
                    entryType: "revenue",
                    debitAccount: "2500 - Deferred Revenue",
                    creditAccount: "4000 - Revenue",
                    amount,
                    currency,
                    exchangeRate: 1,
                    description: `Monthly revenue recognition for PO ${poDoc.id} (over-time)`,
                    referenceNumber,
                    isPosted: false,
                    isReversed: false,
                    createdAt: Timestamp.fromDate(now),
                  });

                // Mark schedule as recognized
                await scheduleDoc.ref.update({
                  isRecognized: true,
                  recognizedDate: Timestamp.fromDate(now),
                });

                console.log(
                  `✅ Generated monthly revenue entry for contract ${contractId}, PO ${poDoc.id}`
                );
              }
            }
          }
        }
      }
    }

    console.log("✅ Monthly revenue recognition completed");
  });
