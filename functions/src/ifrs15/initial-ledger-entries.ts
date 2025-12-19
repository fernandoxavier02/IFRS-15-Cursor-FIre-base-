/**
 * Gerador de lançamentos contábeis iniciais
 * Cria entries de receita diferida/contract liability APENAS quando há billing ou payment
 * 
 * CONFORME IFRS 15:
 * - Deferred Revenue (Contract Liability) surge apenas quando há:
 *   - Pagamento antecipado (Cash recebido antes da performance)
 *   - Faturamento antecipado (AR criado antes da performance)
 * - NÃO cria entries apenas por existir um contrato
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
 * CONFORME IFRS 15:
 * - Cria entry de Contract Liability (Deferred Revenue) APENAS quando há billing ou payment
 * - Se há billing: Dr AR / Cr Contract Liability
 * - Se há payment sem billing: Dr Cash / Cr Contract Liability
 * - Se não há billing nem payment: NÃO cria entry (conforme IFRS 15)
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

  // 2. CONFORME IFRS 15: Verificar se há billing ou payment antes de criar entry
  // Contract Liability só surge quando há consideração recebida ou faturada ANTES da performance
  const billingsSnapshot = await db
    .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
    .where("contractId", "==", contractId)
    .where("status", "in", ["scheduled", "invoiced", "paid"])
    .get();

  let totalBilled = 0;
  let totalCashReceived = 0;
  
  for (const doc of billingsSnapshot.docs) {
    const billing = doc.data();
    totalBilled += Number(billing.amount || 0);
    if (billing.status === "paid") {
      totalCashReceived += Number(billing.paidAmount || billing.amount || 0);
    }
  }

  // Se não há billing nem payment, NÃO criar entry inicial (conforme IFRS 15)
  if (totalBilled === 0 && totalCashReceived === 0) {
    console.log(`[generateInitialDeferredRevenueEntries] ⏭️ Sem billing nem payment, não criando entry inicial (conforme IFRS 15)`);
    console.log(`[generateInitialDeferredRevenueEntries] IFRS 15: Contract Liability só surge quando há consideração recebida/faturada antes da performance`);
    return { created: 0, skipped: true, reason: "No billing or payment - no initial entry per IFRS 15" };
  }

  // 3. Se há billing ou payment, criar entry de Contract Liability
  // O valor a diferir é o mínimo entre transactionPrice e o valor faturado/recebido
  const amountToDefer = Math.min(ifrs15Result.transactionPrice, Math.max(totalBilled, totalCashReceived));
  
  if (amountToDefer <= 0) {
    console.log(`[generateInitialDeferredRevenueEntries] ⏭️ Valor a diferir é 0, pulando`);
    return { created: 0, skipped: true, reason: "Amount to defer is zero" };
  }

  const ledgerPath = tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES);
  const now = Timestamp.now();
  // Usar referenceNumber fixo (sem timestamp) para prevenir duplicatas
  const referenceNumber = `V2-INITIAL-DEF-${contractId}`;

  // 4. Verificar se já existe entry inicial para evitar duplicação
  // Verificar por contractId + source + entryType (mais robusto que apenas referenceNumber)
  const existingCheck = await db
    .collection(ledgerPath)
    .where("contractId", "==", contractId)
    .where("source", "==", "ifrs15-initial-deferred")
    .where("entryType", "==", "deferred_revenue")
    .limit(1)
    .get();

  if (!existingCheck.empty) {
    console.log(`[generateInitialDeferredRevenueEntries] ⏭️ Entry inicial já existe, pulando`);
    return { created: 0, skipped: true, reason: "Entry already exists" };
  }

  // 5. Verificar também pelo referenceNumber como ID do documento (usando doc().get())
  const docRef = db.collection(ledgerPath).doc(referenceNumber);
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    console.log(`[generateInitialDeferredRevenueEntries] ⏭️ Entry com referenceNumber ${referenceNumber} já existe como documento, pulando`);
    return { created: 0, skipped: true, reason: "Entry document already exists" };
  }

  // 6. Criar entry de Contract Liability (Deferred Revenue)
  // CONFORME IFRS 15: Criar apenas quando há billing ou payment
  // Se há billing: Dr AR / Cr Contract Liability
  // Se há payment sem billing: Dr Cash / Cr Contract Liability
  let debitAccount: string;
  if (totalBilled > 0) {
    // Há faturamento, usar AR
    debitAccount = "1200 - Accounts Receivable (AR)";
  } else if (totalCashReceived > 0) {
    // Há pagamento sem faturamento, usar Cash
    debitAccount = "1000 - Cash";
  } else {
    // Não deveria chegar aqui devido à verificação anterior, mas por segurança:
    console.log(`[generateInitialDeferredRevenueEntries] ⚠️ Sem billing nem payment, não criando entry`);
    return { created: 0, skipped: true, reason: "No billing or payment" };
  }

  // VALIDAÇÃO 1: Garantir que débito = crédito (double-entry accounting)
  if (amountToDefer <= 0) {
    throw new Error(
      `[generateInitialDeferredRevenueEntries] ❌ Valor inválido: ${amountToDefer}. O valor deve ser maior que zero.`
    );
  }

  // VALIDAÇÃO 2: Verificar se contas de débito e crédito são diferentes
  if (debitAccount === "2600 - Contract Liability") {
    throw new Error(
      `[generateInitialDeferredRevenueEntries] ❌ Contas iguais: débito e crédito não podem ser a mesma conta (${debitAccount})`
    );
  }

  const deferredRevenueEntry: any = {
    tenantId,
    contractId,
    ledgerVersion: 2,
    source: "ifrs15-initial-deferred",
    entryDate: now,
    periodStart: Timestamp.fromDate(contractStartDate),
    periodEnd: Timestamp.fromDate(contractEndDate),
    entryType: "deferred_revenue",
    debitAccount,
    creditAccount: "2600 - Contract Liability",
    amount: amountToDefer,
    currency,
    exchangeRate: 1,
    description: `Initial contract liability (Deferred Revenue) - Billed: ${totalBilled}, Cash: ${totalCashReceived}, Amount: ${amountToDefer}`,
    referenceNumber,
    isPosted: false,
    isReversed: false,
    createdAt: now,
  };
  
  // Remover campos undefined para evitar erro do Firestore
  Object.keys(deferredRevenueEntry).forEach(key => {
    if (deferredRevenueEntry[key] === undefined) {
      delete deferredRevenueEntry[key];
    }
  });

  try {
    // VALIDAÇÃO 3: Verificar se entry já existe ANTES de tentar criar (prevenir duplicatas)
    const docRef = db.collection(ledgerPath).doc(referenceNumber);
    const existingDoc = await docRef.get();
    if (existingDoc.exists) {
      console.log(
        `[generateInitialDeferredRevenueEntries] ⏭️ Entry já existe com referenceNumber ${referenceNumber}, pulando criação`
      );
      return { created: 0, skipped: true, reason: "Entry document already exists" };
    }

    // Usar referenceNumber como ID do documento para prevenir duplicatas automaticamente
    // (mesma estratégia usada em createLedgerEntry do ledger-v2.ts)
    await docRef.create(deferredRevenueEntry);
    console.log(`[generateInitialDeferredRevenueEntries] ✅ Entry criado com ID: ${referenceNumber}`);
    console.log(`[generateInitialDeferredRevenueEntries] Valor: ${amountToDefer} ${currency}`);
    console.log(`[generateInitialDeferredRevenueEntries] Debit Account: ${debitAccount} (Billed: ${totalBilled}, Cash: ${totalCashReceived})`);

    return { created: 1, skipped: false };
  } catch (error: any) {
    // Se o documento já existe (código 6 = ALREADY_EXISTS), retornar skipped
    if (error?.code === 6 || error?.message?.includes("Already exists")) {
      console.log(`[generateInitialDeferredRevenueEntries] ⏭️ Entry já existe (código ${error.code}), pulando`);
      return { created: 0, skipped: true, reason: "Entry document already exists" };
    }
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
  const revenueEntry: any = {
    tenantId,
    contractId,
    performanceObligationId,
    ledgerVersion: 2,
    source: "ifrs15-revenue-recognition",
    entryDate: now,
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    entryType: "revenue",
    debitAccount: "2600 - Contract Liability",
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
  
  // Remover campos undefined para evitar erro do Firestore
  Object.keys(revenueEntry).forEach(key => {
    if (revenueEntry[key] === undefined) {
      delete revenueEntry[key];
    }
  });

  try {
    const docRef = await db.collection(ledgerPath).add(revenueEntry);
    console.log(`[generateRevenueRecognitionEntries] ✅ Entry de receita criado: ${docRef.id}`);
    return { created: 1 };
  } catch (error: any) {
    console.error(`[generateRevenueRecognitionEntries] ❌ Erro:`, error);
    throw error;
  }
}
