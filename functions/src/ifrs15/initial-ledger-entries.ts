/**
 * Gerador de lançamentos contábeis iniciais
 * Cria entries de receita diferida/contract liability quando o contrato é criado
 * INDEPENDENTE de billing ou payment status
 */

import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";
import type { IFRS15Result } from "./engine";

interface InitialEntriesParams {
  tenantId: string;
  contractId: string;
  ifrs15Result: IFRS15Result;
  contractStartDate: Date;
  contractEndDate: Date;
  currency: string;
}

/**
 * Gera lançamentos contábeis iniciais baseados no resultado do Engine IFRS 15
 *
 * Lógica:
 * - Se transactionPrice > 0, cria entry de Deferred Revenue (receita diferida)
 * - Isso representa o valor total do contrato que será reconhecido ao longo do tempo
 * - Entry inicial: Dr Contract Asset / Cr Deferred Revenue
 */
export async function generateInitialDeferredRevenueEntries(
  params: InitialEntriesParams
): Promise<{ created: number; skipped: boolean; reason?: string }> {
  const { tenantId, contractId, ifrs15Result, contractStartDate, contractEndDate, currency } = params;

  console.log(`[generateInitialDeferredRevenueEntries] 🎬 Iniciando para contrato ${contractId}`);
  console.log(`[generateInitialDeferredRevenueEntries] Transaction Price: ${ifrs15Result.transactionPrice}`);

  // 1. Verificar se há valor para criar entries
  if (!ifrs15Result.transactionPrice || ifrs15Result.transactionPrice <= 0) {
    console.log(`[generateInitialDeferredRevenueEntries] ⏭️ Sem transaction price, pulando`);
    return { created: 0, skipped: true, reason: "No transaction price" };
  }

  const ledgerPath = tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES);
  const now = Timestamp.now();
  const referenceNumber = `V2-INITIAL-DEF-${contractId}-${Date.now()}`;

  // 2. Verificar se já existe entry inicial para evitar duplicação
  const existingCheck = await db
    .collection(ledgerPath)
    .where("contractId", "==", contractId)
    .where("referenceNumber", "==", referenceNumber)
    .limit(1)
    .get();

  if (!existingCheck.empty) {
    console.log(`[generateInitialDeferredRevenueEntries] ⏭️ Entry inicial já existe, pulando`);
    return { created: 0, skipped: true, reason: "Entry already exists" };
  }

  // 3. Criar entry de Deferred Revenue
  // Representa o valor total do contrato que será reconhecido
  const deferredRevenueEntry = {
    tenantId,
    contractId,
    ledgerVersion: 2,
    source: "ifrs15-initial-deferred",
    entryDate: now,
    periodStart: Timestamp.fromDate(contractStartDate),
    periodEnd: Timestamp.fromDate(contractEndDate),
    entryType: "deferred_revenue",
    debitAccount: "1300 - Contract Asset",
    creditAccount: "2500 - Deferred Revenue",
    amount: ifrs15Result.transactionPrice,
    currency,
    exchangeRate: 1,
    description: `Initial deferred revenue from contract (Transaction Price: ${ifrs15Result.transactionPrice})`,
    referenceNumber,
    isPosted: false,
    isReversed: false,
    createdAt: now,
  };

  try {
    const docRef = await db.collection(ledgerPath).add(deferredRevenueEntry);
    console.log(`[generateInitialDeferredRevenueEntries] ✅ Entry criado: ${docRef.id}`);
    console.log(`[generateInitialDeferredRevenueEntries] Valor: ${ifrs15Result.transactionPrice} ${currency}`);

    return { created: 1, skipped: false };
  } catch (error: any) {
    console.error(`[generateInitialDeferredRevenueEntries] ❌ Erro ao criar entry:`, error);
    throw error;
  }
}

/**
 * Gera lançamentos baseados em Performance Obligations reconhecidas
 * Chamado quando há revenue schedules calculados
 */
export async function generateRevenueRecognitionEntries(
  params: InitialEntriesParams & {
    performanceObligationId: string;
    recognizedAmount: number;
    periodStart: Date;
    periodEnd: Date;
  }
): Promise<{ created: number }> {
  const {
    tenantId,
    contractId,
    performanceObligationId,
    recognizedAmount,
    periodStart,
    periodEnd,
    currency,
  } = params;

  if (recognizedAmount <= 0) {
    console.log(`[generateRevenueRecognitionEntries] Sem valor reconhecido, pulando`);
    return { created: 0 };
  }

  const ledgerPath = tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES);
  const now = Timestamp.now();
  const referenceNumber = `V2-REV-REC-${performanceObligationId}-${Date.now()}`;

  // Entry de reconhecimento de receita
  // Dr Deferred Revenue / Cr Revenue
  const revenueEntry = {
    tenantId,
    contractId,
    performanceObligationId,
    ledgerVersion: 2,
    source: "ifrs15-revenue-recognition",
    entryDate: now,
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    entryType: "revenue",
    debitAccount: "2500 - Deferred Revenue",
    creditAccount: "4000 - Revenue",
    amount: recognizedAmount,
    currency,
    exchangeRate: 1,
    description: `Revenue recognition for PO ${performanceObligationId}`,
    referenceNumber,
    isPosted: false,
    isReversed: false,
    createdAt: now,
  };

  try {
    const docRef = await db.collection(ledgerPath).add(revenueEntry);
    console.log(`[generateRevenueRecognitionEntries] ✅ Entry de receita criado: ${docRef.id}`);
    return { created: 1 };
  } catch (error: any) {
    console.error(`[generateRevenueRecognitionEntries] ❌ Erro:`, error);
    throw error;
  }
}
