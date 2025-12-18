/**
 * Billing Schedules Automation Triggers
 * 
 * Automatically generates billing schedules when contracts are created or activated
 */

import type { BillingFrequency } from "@shared/firestore-types";
import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

/**
 * Determine billing frequency from payment terms
 */
function determineBillingFrequency(paymentTerms?: string): BillingFrequency {
  if (!paymentTerms) return "monthly"; // Default

  const terms = paymentTerms.toLowerCase();

  // Detect frequency based on common terms
  if (terms.includes("monthly") || terms.includes("mensal")) return "monthly";
  if (terms.includes("quarterly") || terms.includes("trimestral")) return "quarterly";
  if (terms.includes("semi-annual") || terms.includes("semestral")) return "semi_annual";
  if (terms.includes("annual") || terms.includes("anual")) return "annual";
  if (terms.includes("one-time") || terms.includes("único")) return "one_time";

  // Default: monthly
  return "monthly";
}

/**
 * Get number of months per period based on frequency
 */
function getPeriodMonths(frequency: BillingFrequency): number {
  switch (frequency) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semi_annual":
      return 6;
    case "annual":
      return 12;
    case "one_time":
      return 0; // Special: only one period
    default:
      return 1;
  }
}

/**
 * Extract payment days from payment terms
 */
function extractPaymentDays(paymentTerms?: string): number | null {
  if (!paymentTerms) return null;

  // Look for patterns like "30 days", "net 30", "30 dias", etc.
  const patterns = [
    /(\d+)\s*days?/i,
    /net\s*(\d+)/i,
    /(\d+)\s*dias?/i,
    /pagamento\s*em\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = paymentTerms.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null; // Use default of 30 days if not found
}

/**
 * Calculate months between two dates
 */
function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const total = years * 12 + months;
  return total <= 0 ? 1 : total;
}

/**
 * Generate billing schedules for a contract
 * Exported for use in IFRS 15 Engine
 */
export async function generateBillingSchedulesForContract(
  tenantId: string,
  contractId: string,
  contract: any
): Promise<void> {
  // Convert and validate dates
  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  // Determine frequency based on paymentTerms or default
  const frequency = determineBillingFrequency(contract.paymentTerms);

  // Calculate dates
  const contractStartDate = toDate(contract.startDate);
  const contractEndDate =
    toDate(contract.endDate) ||
    (contractStartDate
      ? new Date(
          contractStartDate.getFullYear() + 1,
          contractStartDate.getMonth(),
          contractStartDate.getDate()
        )
      : null);

  if (!contractStartDate) {
    console.warn(`Skipping billing generation for ${contractId}: invalid startDate`);
    return;
  }
  if (!contractEndDate) {
    console.warn(`Skipping billing generation for ${contractId}: invalid endDate`);
    return;
  }

  // Calculate number of periods
  const periodMonths = getPeriodMonths(frequency);
  const totalMonths = monthsBetween(contractStartDate, contractEndDate);
  const numberOfPeriods = periodMonths === 0 ? 1 : Math.max(1, Math.ceil(totalMonths / periodMonths));
  const amountPerPeriod = Math.round((contract.totalValue / numberOfPeriods) * 100) / 100;

  // Check if billing schedules already exist (prevent duplicates)
  const existingSchedules = await db
    .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
    .where("contractId", "==", contractId)
    .get();

  if (!existingSchedules.empty) {
    console.log(`Billing schedules already exist for contract ${contractId}`);
    return;
  }

  // Create billing schedules
  let currentDate = new Date(contractStartDate);
  let remainingAmount = contract.totalValue;
  const now = Timestamp.now();

  for (let i = 0; i < numberOfPeriods; i++) {
    const billingDate = new Date(currentDate);
    const dueDate = new Date(currentDate);

    // Determine payment terms based on paymentTerms field
    const paymentDays = extractPaymentDays(contract.paymentTerms) || 30;
    dueDate.setDate(dueDate.getDate() + paymentDays);

    const isLastPeriod = i === numberOfPeriods - 1;
    const amount = isLastPeriod ? remainingAmount : amountPerPeriod;

    await db.collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES)).add({
      tenantId,
      contractId,
      billingDate: Timestamp.fromDate(billingDate),
      dueDate: Timestamp.fromDate(dueDate),
      amount,
      currency: contract.currency || "BRL",
      frequency,
      status: "scheduled",
      notes: `Billing ${i + 1} of ${numberOfPeriods} - Auto-generated`,
      createdAt: now,
    });

    remainingAmount -= amountPerPeriod;
    if (periodMonths > 0) {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + periodMonths, currentDate.getDate());
    } else {
      // One-time: break after first iteration
      break;
    }
  }

  console.log(`✅ Generated ${numberOfPeriods} billing schedules for contract ${contractId}`);
}

/**
 * Trigger: When contract is created
 */
export const onContractCreated = functions.firestore
  .document("tenants/{tenantId}/contracts/{contractId}")
  .onCreate(async (snapshot, context) => {
    const contract = snapshot.data();
    const tenantId = context.params.tenantId;
    const contractId = context.params.contractId;

    // Only generate billing schedules if contract is active
    if (contract.status === "active") {
      await generateBillingSchedulesForContract(tenantId, contractId, contract);
    }
  });

/**
 * Trigger: When contract is updated (especially when status changes to active)
 */
export const onContractUpdated = functions.firestore
  .document("tenants/{tenantId}/contracts/{contractId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tenantId = context.params.tenantId;
    const contractId = context.params.contractId;

    // Only generate billing schedules if status changed to "active"
    if (before.status !== "active" && after.status === "active") {
      // Check if billing schedules already exist
      const existingSchedules = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
        .where("contractId", "==", contractId)
        .limit(1)
        .get();

      if (existingSchedules.empty) {
        await generateBillingSchedulesForContract(tenantId, contractId, after);
      }
    }
  });
