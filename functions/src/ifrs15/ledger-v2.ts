import type { LedgerEntryType } from "@shared/firestore-types";
import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

const LEDGER_VERSION = 2;

const ACCOUNTS = {
  cash: "1000 - Cash",
  ar: "1200 - Accounts Receivable (AR)",
  contractAsset: "1300 - Contract Asset",
  contractLiability: "2600 - Contract Liability",
  revenue: "4000 - Revenue",
} as const;

type EventKind = "invoice" | "cash" | "revenue";

type LedgerEvent = {
  kind: EventKind;
  date: Date;
  amount: number;
  currency: string;
  billingScheduleId?: string;
  performanceObligationId?: string;
  periodStart?: Date;
  periodEnd?: Date;
};

function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    const d = (value as any).toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  return null;
}

function toNumberSafe(value: any): number {
  const num = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(num) ? num : 0;
}

function sortEvents(a: LedgerEvent, b: LedgerEvent): number {
  const ta = a.date.getTime();
  const tb = b.date.getTime();
  if (ta !== tb) return ta - tb;
  const order: Record<EventKind, number> = { invoice: 0, cash: 1, revenue: 2 };
  const oa = order[a.kind];
  const ob = order[b.kind];
  if (oa !== ob) return oa - ob;
  // Stable-ish tiebreaker
  return (a.billingScheduleId || a.performanceObligationId || "").localeCompare(
    b.billingScheduleId || b.performanceObligationId || ""
  );
}

function refId(parts: string[]): string {
  // Firestore doc IDs cannot contain "/". Keep this deterministic and short.
  return parts.join("-");
}

async function createLedgerEntry(params: {
  tenantId: string;
  contractId: string;
  entryType: LedgerEntryType;
  entryDate: Date;
  periodStart: Date;
  periodEnd: Date;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  billingScheduleId?: string;
  performanceObligationId?: string;
  referenceNumber: string;
  description: string;
}): Promise<"created" | "exists"> {
  const collectionPath = tenantCollection(params.tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES);
  const docRef = db.collection(collectionPath).doc(params.referenceNumber);

  const entryDateTs = Timestamp.fromDate(params.entryDate);
  const periodStartTs = Timestamp.fromDate(params.periodStart);
  const periodEndTs = Timestamp.fromDate(params.periodEnd);

  try {
    const entryData: any = {
      tenantId: params.tenantId,
      contractId: params.contractId,
      ledgerVersion: LEDGER_VERSION,
      source: "ifrs15-ledger-v2",
      entryDate: entryDateTs,
      periodStart: periodStartTs,
      periodEnd: periodEndTs,
      entryType: params.entryType,
      debitAccount: params.debitAccount,
      creditAccount: params.creditAccount,
      amount: params.amount,
      currency: params.currency,
      exchangeRate: 1,
      description: params.description,
      referenceNumber: params.referenceNumber,
      isPosted: false,
      isReversed: false,
      createdAt: entryDateTs,
    };
    
    // Adicionar campos opcionais apenas se definidos
    if (params.billingScheduleId !== undefined) {
      entryData.billingScheduleId = params.billingScheduleId;
    }
    if (params.performanceObligationId !== undefined) {
      entryData.performanceObligationId = params.performanceObligationId;
    }
    
    await docRef.create(entryData);
    return "created";
  } catch (error: any) {
    // Firestore "already exists" is gRPC status code 6
    if (error?.code === 6 || error?.message?.includes("Already exists")) {
      return "exists";
    }
    throw error;
  }
}

async function loadBillingEvents(
  tenantId: string,
  contractId: string,
  upTo: Date
): Promise<LedgerEvent[]> {
  const billingsSnap = await db
    .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
    .where("contractId", "==", contractId)
    .where("status", "in", ["invoiced", "paid"])
    .get();

  const invoiceEvents: LedgerEvent[] = [];
  const cashEvents: LedgerEvent[] = [];

  for (const doc of billingsSnap.docs) {
    const billing = doc.data() as any;
    const amount = toNumberSafe(billing.amount);
    if (amount <= 0) continue;

    const currency = billing.currency || "BRL";
    const invoicedAt =
      toDateSafe(billing.invoicedAt) ||
      toDateSafe(billing.billingDate) ||
      toDateSafe(billing.createdAt);
    if (invoicedAt && invoicedAt <= upTo) {
      invoiceEvents.push({
        kind: "invoice",
        date: invoicedAt,
        amount,
        currency,
        billingScheduleId: doc.id,
      });
    }

    if (billing.status === "paid") {
      const paidAmount = toNumberSafe(billing.paidAmount) || amount;
      const paidAt =
        toDateSafe(billing.paidAt) ||
        toDateSafe(billing.invoicedAt) ||
        toDateSafe(billing.dueDate) ||
        toDateSafe(billing.updatedAt);

      if (paidAt && paidAt <= upTo && paidAmount > 0) {
        cashEvents.push({
          kind: "cash",
          date: paidAt,
          amount: paidAmount,
          currency,
          billingScheduleId: doc.id,
        });
      }
    }
  }

  return [...invoiceEvents, ...cashEvents];
}

async function loadRevenueRecognitionEvents(params: {
  tenantId: string;
  contractId: string;
  versionId?: string;
  contractStartDate: Date;
  currency: string;
  upTo: Date;
}): Promise<LedgerEvent[]> {
  const { tenantId, contractId, versionId, contractStartDate, currency, upTo } = params;
  if (!versionId) return [];

  const contractRef = db.collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS)).doc(contractId);
  const versionRef = contractRef.collection(COLLECTIONS.CONTRACT_VERSIONS).doc(versionId);

  const posSnap = await versionRef.collection(COLLECTIONS.PERFORMANCE_OBLIGATIONS).get();
  const events: LedgerEvent[] = [];

  for (const poDoc of posSnap.docs) {
    const po = poDoc.data() as any;
    const recognitionMethod = po.recognitionMethod as string | undefined;
    const allocatedPrice = toNumberSafe(po.allocatedPrice);
    if (!recognitionMethod) continue;

    if (recognitionMethod === "point_in_time") {
      if (!po.isSatisfied) continue;
      const satisfiedAt = toDateSafe(po.satisfiedDate) || toDateSafe(po.updatedAt) || contractStartDate;
      if (!satisfiedAt || satisfiedAt > upTo || allocatedPrice <= 0) continue;
      events.push({
        kind: "revenue",
        date: satisfiedAt,
        amount: allocatedPrice,
        currency,
        performanceObligationId: poDoc.id,
        periodStart: satisfiedAt,
        periodEnd: satisfiedAt,
      });
      continue;
    }

    if (recognitionMethod === "over_time") {
      const schedulesSnap = await poDoc.ref.collection(COLLECTIONS.REVENUE_SCHEDULES).get();
      for (const scheduleDoc of schedulesSnap.docs) {
        const schedule = scheduleDoc.data() as any;
        const periodStart = toDateSafe(schedule.periodStart);
        const periodEnd = toDateSafe(schedule.periodEnd);
        const scheduledAmount = toNumberSafe(schedule.scheduledAmount);

        if (!periodStart || !periodEnd) continue;
        if (scheduledAmount <= 0) continue;
        if (periodEnd > upTo) continue;

        events.push({
          kind: "revenue",
          date: periodEnd,
          amount: scheduledAmount,
          currency,
          performanceObligationId: poDoc.id,
          periodStart,
          periodEnd,
        });
      }
    }
  }

  return events;
}

export async function generateRevenueLedgerV2ForContract(params: {
  tenantId: string;
  contractId: string;
  upTo?: Date;
}): Promise<{ created: number; skipped: number }> {
  const { tenantId, contractId } = params;
  const upTo = params.upTo || new Date();

  const contractRef = db.collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS)).doc(contractId);
  const contractDoc = await contractRef.get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Contract not found");
  }

  const contract = contractDoc.data() as any;
  const currency = contract.currency || "BRL";
  const currentVersionId = contract.currentVersionId as string | undefined;

  const contractStartDate =
    toDateSafe(contract.startDate) ||
    toDateSafe(contract.createdAt) ||
    new Date(upTo.getFullYear(), upTo.getMonth(), 1);

  const billingEvents = await loadBillingEvents(tenantId, contractId, upTo);
  const revenueEvents = await loadRevenueRecognitionEvents({
    tenantId,
    contractId,
    versionId: currentVersionId,
    contractStartDate,
    currency,
    upTo,
  });

  const events = [...billingEvents, ...revenueEvents]
    .filter((e) => e.date instanceof Date && !isNaN(e.date.getTime()) && e.amount > 0)
    .sort(sortEvents);

  let billedToDate = 0;
  let cashToDate = 0;
  let recognizedToDate = 0;

  let created = 0;
  let skipped = 0;

  for (const event of events) {
    if (event.kind === "invoice") {
      const contractAssetBefore = Math.max(0, recognizedToDate - billedToDate);
      const creditToCA = Math.min(event.amount, contractAssetBefore);
      const creditToCL = event.amount - creditToCA;

      const entryDate = event.date;
      const periodStart = event.date;
      const periodEnd = event.date;

      const billingId = event.billingScheduleId || "unknown";

      if (creditToCA > 0) {
        const referenceNumber = refId(["V2", "INV", "CA", billingId]);
        const status = await createLedgerEntry({
          tenantId,
          contractId,
          entryType: "receivable",
          entryDate,
          periodStart,
          periodEnd,
          debitAccount: ACCOUNTS.ar,
          creditAccount: ACCOUNTS.contractAsset,
          amount: Math.round(creditToCA * 100) / 100,
          currency: event.currency,
          billingScheduleId: event.billingScheduleId,
          referenceNumber,
          description: "Invoice issued (reclass Contract Asset → AR)",
        });
        if (status === "created") created++;
        else skipped++;
      }

      if (creditToCL > 0) {
        const referenceNumber = refId(["V2", "INV", "CL", billingId]);
        const status = await createLedgerEntry({
          tenantId,
          contractId,
          entryType: "receivable",
          entryDate,
          periodStart,
          periodEnd,
          debitAccount: ACCOUNTS.ar,
          creditAccount: ACCOUNTS.contractLiability,
          amount: Math.round(creditToCL * 100) / 100,
          currency: event.currency,
          billingScheduleId: event.billingScheduleId,
          referenceNumber,
          description: "Invoice issued (creates Contract Liability)",
        });
        if (status === "created") created++;
        else skipped++;
      }

      billedToDate = Math.round((billedToDate + event.amount) * 100) / 100;
      continue;
    }

    if (event.kind === "cash") {
      const arOpen = Math.max(0, billedToDate - cashToDate);
      const creditToAR = Math.min(event.amount, arOpen);
      const creditToCL = event.amount - creditToAR;

      const entryDate = event.date;
      const periodStart = event.date;
      const periodEnd = event.date;
      const billingId = event.billingScheduleId || "unknown";

      if (creditToAR > 0) {
        const referenceNumber = refId(["V2", "CASH", "AR", billingId]);
        const status = await createLedgerEntry({
          tenantId,
          contractId,
          entryType: "cash",
          entryDate,
          periodStart,
          periodEnd,
          debitAccount: ACCOUNTS.cash,
          creditAccount: ACCOUNTS.ar,
          amount: Math.round(creditToAR * 100) / 100,
          currency: event.currency,
          billingScheduleId: event.billingScheduleId,
          referenceNumber,
          description: "Cash received (settles AR)",
        });
        if (status === "created") created++;
        else skipped++;
      }

      if (creditToCL > 0) {
        const referenceNumber = refId(["V2", "CASH", "CL", billingId]);
        const status = await createLedgerEntry({
          tenantId,
          contractId,
          entryType: "cash",
          entryDate,
          periodStart,
          periodEnd,
          debitAccount: ACCOUNTS.cash,
          creditAccount: ACCOUNTS.contractLiability,
          amount: Math.round(creditToCL * 100) / 100,
          currency: event.currency,
          billingScheduleId: event.billingScheduleId,
          referenceNumber,
          description: "Cash received in advance (creates Contract Liability)",
        });
        if (status === "created") created++;
        else skipped++;
      }

      cashToDate = Math.round((cashToDate + event.amount) * 100) / 100;
      continue;
    }

    if (event.kind === "revenue") {
      const contractLiabilityBefore = Math.max(0, billedToDate - recognizedToDate);
      const debitFromCL = Math.min(event.amount, contractLiabilityBefore);
      const debitToCA = event.amount - debitFromCL;

      const entryDate = event.date;
      const periodStart = event.periodStart || event.date;
      const periodEnd = event.periodEnd || event.date;

      const poKey = event.performanceObligationId || "contract";
      const periodKey = periodEnd.toISOString().slice(0, 10);

      if (debitFromCL > 0) {
        const referenceNumber = refId(["V2", "REV", "CL", poKey, periodKey]);
        const status = await createLedgerEntry({
          tenantId,
          contractId,
          entryType: "revenue",
          entryDate,
          periodStart,
          periodEnd,
          debitAccount: ACCOUNTS.contractLiability,
          creditAccount: ACCOUNTS.revenue,
          amount: Math.round(debitFromCL * 100) / 100,
          currency: event.currency,
          performanceObligationId: event.performanceObligationId,
          referenceNumber,
          description: "Revenue recognition (reduces Contract Liability)",
        });
        if (status === "created") created++;
        else skipped++;
      }

      if (debitToCA > 0) {
        const referenceNumber = refId(["V2", "REV", "CA", poKey, periodKey]);
        const status = await createLedgerEntry({
          tenantId,
          contractId,
          entryType: "revenue",
          entryDate,
          periodStart,
          periodEnd,
          debitAccount: ACCOUNTS.contractAsset,
          creditAccount: ACCOUNTS.revenue,
          amount: Math.round(debitToCA * 100) / 100,
          currency: event.currency,
          performanceObligationId: event.performanceObligationId,
          referenceNumber,
          description: "Revenue recognition (creates/increases Contract Asset)",
        });
        if (status === "created") created++;
        else skipped++;
      }

      recognizedToDate = Math.round((recognizedToDate + event.amount) * 100) / 100;
      continue;
    }
  }

  return { created, skipped };
}

