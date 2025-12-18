/**
 * IFRS 15 Revenue Recognition Engine
 * 
 * Implements the 5-Step Model:
 * Step 1: Identify the contract(s) with a customer
 * Step 2: Identify the performance obligations in the contract
 * Step 3: Determine the transaction price
 * Step 4: Allocate the transaction price to the performance obligations
 * Step 5: Recognize revenue when (or as) the entity satisfies a performance obligation
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";
import { generateInitialDeferredRevenueEntries } from "./initial-ledger-entries";
import { generateRevenueLedgerV2ForContract } from "./ledger-v2";

// Types
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  standaloneSelllingPrice?: number;
  isDistinct: boolean;
  distinctWithinContext: boolean;
  recognitionMethod: "over_time" | "point_in_time";
  measurementMethod?: "input" | "output";
  deliveryStartDate?: admin.firestore.Timestamp;
  deliveryEndDate?: admin.firestore.Timestamp;
}

interface PerformanceObligation {
  id: string;
  description: string;
  lineItemIds?: string[];
  allocatedPrice: number;
  recognitionMethod: "over_time" | "point_in_time";
  measurementMethod?: "input" | "output";
  percentComplete: number;
  recognizedAmount: number;
  deferredAmount: number;
  isSatisfied: boolean;
  satisfiedDate?: admin.firestore.Timestamp;
  justification?: string;
}

interface ContractVersion {
  id: string;
  contractId: string;
  versionNumber: number;
  effectiveDate: admin.firestore.Timestamp;
  totalValue: number;
  isProspective: boolean;
}

interface Contract {
  id: string;
  tenantId: string;
  customerId: string;
  contractNumber: string;
  title: string;
  status: string;
  startDate: admin.firestore.Timestamp;
  endDate?: admin.firestore.Timestamp;
  totalValue: number;
  currency: string;
  currentVersionId?: string;
}

interface VariableConsideration {
  id: string;
  type: string;
  estimatedAmount: number;
  constraintApplied: boolean;
  constraintReason?: string;
  probability?: number;
}

export interface IFRS15Result {
  contractId: string;
  versionId: string;
  calculatedAt: admin.firestore.Timestamp;
  
  // Step 1: Contract identification
  contractExists: boolean;
  contractModified: boolean;
  
  // Step 2: Performance obligations
  performanceObligations: {
    id: string;
    description: string;
    isDistinct: boolean;
    bundled: boolean;
    justification: string;
  }[];
  
  // Step 3: Transaction price
  transactionPrice: number;
  fixedPrice: number;
  variableConsideration: number;
  financingComponent: number;
  constrainedAmount: number;
  
  // Step 4: Allocation
  allocations: {
    poId: string;
    description: string;
    standaloneSelllingPrice: number;
    allocationPercentage: number;
    allocatedAmount: number;
  }[];
  
  // Step 5: Revenue recognition
  revenueSchedule: {
    poId: string;
    periods: {
      periodStart: Date;
      periodEnd: Date;
      scheduledAmount: number;
      recognizedAmount: number;
      deferredAmount: number;
    }[];
  }[];
  
  // Summary
  totalRecognizedRevenue: number;
  totalDeferredRevenue: number;
  contractAsset: number;
  contractLiability: number;
  
  // Audit
  inputs: Record<string, any>;
  warnings: string[];
  errors: string[];
}

// Helper function to calculate months between dates
function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) + 1
  );
}

// Helper to generate monthly periods
function generateMonthlyPeriods(start: Date, end: Date): { start: Date; end: Date }[] {
  const periods: { start: Date; end: Date }[] = [];
  let current = new Date(start);
  
  while (current <= end) {
    const periodStart = new Date(current);
    const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // Last day of month
    
    if (periodEnd > end) {
      periods.push({ start: periodStart, end: end });
    } else {
      periods.push({ start: periodStart, end: periodEnd });
    }
    
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  
  return periods;
}

/**
 * Gera automaticamente os lançamentos contábeis do IFRS 15 no Revenue Ledger
 * 
 * Lançamentos gerados:
 * 1. AR (Accounts Receivable) - Quando há faturamento não recebido
 * 2. Receita (Revenue) - Quando há receita reconhecida
 * 3. Receita Diferida (Deferred Revenue) - Quando há receita diferida
 * 4. Custo (Cost) - Quando há custos do contrato amortizados
 */
/**
 * Check if a ledger entry already exists to prevent duplicates
 */
async function checkExistingEntry(
  tenantId: string,
  contractId: string,
  entryType: string,
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

/**
 * Build a deterministic reference number to avoid duplicated entries across reruns.
 */
function buildReference(
  prefix: string,
  contractId: string,
  periodStart: Date,
  periodEnd: Date
): string {
  return `${prefix}-${contractId}-${periodStart.getTime()}-${periodEnd.getTime()}`;
}

async function generateAutomaticJournalEntries(
  tenantId: string,
  contractId: string,
  ifrs15Result: IFRS15Result,
  totalBilled: number,
  totalCashReceived: number,
  currency: string,
  entryDate: admin.firestore.Timestamp,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  try {
    console.log(`[generateAutomaticJournalEntries] Iniciando para contrato ${contractId}, tenant ${tenantId}`);
    console.log(`[generateAutomaticJournalEntries] transactionPrice: ${ifrs15Result.transactionPrice}, totalRecognizedRevenue: ${ifrs15Result.totalRecognizedRevenue}, totalDeferredRevenue: ${ifrs15Result.totalDeferredRevenue}`);
    console.log(`[generateAutomaticJournalEntries] totalBilled: ${totalBilled}, totalCashReceived: ${totalCashReceived}`);
    
    const ledgerCollection = db.collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES));
    const entryDateTimestamp = Timestamp.fromDate(entryDate.toDate());
    const periodStartTimestamp = Timestamp.fromDate(periodStart);
    const periodEndTimestamp = Timestamp.fromDate(periodEnd);
    
    // Lógica de lançamentos contábeis do IFRS 15:
    // 
    // 1. AR (Accounts Receivable) - Quando há faturamento não recebido
    //    Débito: AR | Crédito: Revenue (quando faturado)
    //
    // 2. Receita Reconhecida - Quando há receita reconhecida pelo IFRS 15
    //    Se há faturamento: Débito: AR | Crédito: Revenue
    //    Se não há faturamento: Débito: Contract Asset | Crédito: Revenue
    //
    // 3. Receita Diferida - Quando há receita que ainda não foi reconhecida
    //    Débito: AR (se faturado) ou Contract Asset | Crédito: Deferred Revenue
    //
    // 4. Custo - Quando há custos do contrato amortizados
    //    Débito: Cost of Revenue | Crédito: Contract Costs Asset

    // 1. AR (Accounts Receivable) - Contas a Receber
    // Quando há faturamento não recebido em dinheiro
    const accountsReceivable = totalBilled - totalCashReceived;
    if (accountsReceivable > 0) {
      const referenceNumber = buildReference("AR-AUTO", contractId, periodStart, periodEnd);
      const exists = await checkExistingEntry(
        tenantId,
        contractId,
        "receivable",
        referenceNumber,
        periodStart,
        periodEnd
      );

      if (!exists) {
        await ledgerCollection.add({
        tenantId,
        contractId,
        entryDate: entryDateTimestamp,
        periodStart: periodStartTimestamp,
        periodEnd: periodEndTimestamp,
        entryType: "receivable",
        debitAccount: "1200 - Accounts Receivable (AR)",
        creditAccount: "4000 - Revenue",
        amount: accountsReceivable,
        currency,
        exchangeRate: 1,
        description: `AR automático - Faturamento não recebido do contrato ${contractId}`,
        referenceNumber: buildReference("AR-AUTO", contractId, periodStart, periodEnd),
        isPosted: false,
        createdAt: entryDateTimestamp,
        });
      }
    }

    // 3. Receita (Revenue) - Receita Reconhecida
    // Quando há receita reconhecida pelo IFRS 15
    // Se há faturamento: Débito: AR | Crédito: Revenue
    // Se não há faturamento: Débito: Contract Asset | Crédito: Revenue
    if (ifrs15Result.totalRecognizedRevenue > 0) {
      // Determinar conta de débito baseado em se há faturamento ou não
      let debitAccount: string;
      if (totalBilled >= ifrs15Result.totalRecognizedRevenue) {
        // Há faturamento suficiente, usar AR
        debitAccount = "1200 - Accounts Receivable (AR)";
      } else if (ifrs15Result.contractAsset > 0) {
        // Não há faturamento suficiente, usar Contract Asset
        debitAccount = "1300 - Contract Asset";
      } else {
        // Fallback para AR
        debitAccount = "1200 - Accounts Receivable (AR)";
      }
      
      const referenceNumber = buildReference("REV-AUTO", contractId, periodStart, periodEnd);
      const exists = await checkExistingEntry(
        tenantId,
        contractId,
        "revenue",
        referenceNumber,
        periodStart,
        periodEnd
      );

      if (!exists) {
        await ledgerCollection.add({
        tenantId,
        contractId,
        entryDate: entryDateTimestamp,
        periodStart: periodStartTimestamp,
        periodEnd: periodEndTimestamp,
        entryType: "revenue",
        debitAccount,
        creditAccount: "4000 - Revenue",
        amount: ifrs15Result.totalRecognizedRevenue,
        currency,
        exchangeRate: 1,
        description: `Receita reconhecida automaticamente pelo IFRS 15 Engine`,
        referenceNumber: buildReference("REV-AUTO", contractId, periodStart, periodEnd),
        isPosted: false,
        createdAt: entryDateTimestamp,
        });
      }
    }

    // 4. Receita Diferida (Deferred Revenue) - Receita Diferida
    // Quando há receita que ainda não foi reconhecida
    // Débito: AR (se faturado) ou Contract Asset | Crédito: Deferred Revenue
    // IMPORTANTE: Se totalDeferredRevenue é 0, mas transactionPrice > 0 e totalRecognizedRevenue = 0,
    // isso significa que temos receita total não reconhecida que deve aparecer como diferida
    // CORREÇÃO: Se não há POs mas há transactionPrice, ainda devemos criar um entry de Deferred Revenue
    let effectiveDeferredRevenue = ifrs15Result.totalDeferredRevenue > 0 
      ? ifrs15Result.totalDeferredRevenue 
      : (ifrs15Result.transactionPrice > 0 && ifrs15Result.totalRecognizedRevenue === 0 
          ? ifrs15Result.transactionPrice 
          : 0);
    
    // Se ainda é 0 mas transactionPrice > 0, usar transactionPrice diretamente
    // Isso garante que contratos sem POs ainda gerem entries
    if (effectiveDeferredRevenue === 0 && ifrs15Result.transactionPrice > 0) {
      console.log(`[generateAutomaticJournalEntries] ⚠️ effectiveDeferredRevenue é 0 mas transactionPrice > 0. Usando transactionPrice como fallback.`);
      effectiveDeferredRevenue = ifrs15Result.transactionPrice;
    }
    
    console.log(`[generateAutomaticJournalEntries] effectiveDeferredRevenue: ${effectiveDeferredRevenue}`);
    console.log(`[generateAutomaticJournalEntries] Condições para criar entry:`, {
      totalDeferredRevenue: ifrs15Result.totalDeferredRevenue,
      transactionPrice: ifrs15Result.transactionPrice,
      totalRecognizedRevenue: ifrs15Result.totalRecognizedRevenue,
      effectiveDeferredRevenue,
      willCreateEntry: effectiveDeferredRevenue > 0,
    });
    
    if (effectiveDeferredRevenue > 0) {
      const referenceNumber = buildReference(
        "DEF-AUTO",
        contractId,
        periodStart,
        periodEnd
      );
      const exists = await checkExistingEntry(
        tenantId,
        contractId,
        "deferred_revenue",
        referenceNumber,
        periodStart,
        periodEnd
      );

      if (!exists) {
        // Determinar conta de débito baseado em se há faturamento ou não
        let debitAccount: string;
        if (totalBilled > 0) {
          // Há faturamento, usar AR
          debitAccount = "1200 - Accounts Receivable (AR)";
        } else {
          // Não há faturamento, usar Contract Asset
          debitAccount = "1300 - Contract Asset";
        }

        const entryData = {
          tenantId,
          contractId,
          entryDate: entryDateTimestamp,
          periodStart: periodStartTimestamp,
          periodEnd: periodEndTimestamp,
          entryType: "deferred_revenue",
          debitAccount,
          creditAccount: "2500 - Deferred Revenue",
          amount: effectiveDeferredRevenue,
          currency,
          exchangeRate: 1,
          description: `Receita diferida automaticamente pelo IFRS 15 Engine`,
          referenceNumber,
          isPosted: false,
          createdAt: entryDateTimestamp,
        };
        
        console.log(`[generateAutomaticJournalEntries] Criando entry de deferred_revenue:`, JSON.stringify(entryData, null, 2));
        const docRef = await ledgerCollection.add(entryData);
        console.log(`[generateAutomaticJournalEntries] Entry criado com ID: ${docRef.id}`);
      } else {
        console.log(`[generateAutomaticJournalEntries] Entry já existe, pulando criação`);
      }
    } else {
      console.log(`[generateAutomaticJournalEntries] ⚠️ effectiveDeferredRevenue é 0, não criando entry`);
      console.log(`[generateAutomaticJournalEntries] Valores:`, {
        transactionPrice: ifrs15Result.transactionPrice,
        totalDeferredRevenue: ifrs15Result.totalDeferredRevenue,
        totalRecognizedRevenue: ifrs15Result.totalRecognizedRevenue,
        totalBilled,
        totalCashReceived,
      });
      
      // GARANTIR QUE SEMPRE CRIE UM ENTRY SE HOUVER VALOR NO CONTRATO
      // Mesmo que effectiveDeferredRevenue seja 0, se transactionPrice > 0, criar entry
      if (ifrs15Result.transactionPrice > 0) {
        console.log(`[generateAutomaticJournalEntries] 🔧 FORÇANDO criação de entry mesmo com effectiveDeferredRevenue = 0`);
        const referenceNumber = `DEF-FORCE-${contractId}-${periodStart.getTime()}-${periodEnd.getTime()}`;
        
        // Verificar se já existe um entry forçado para este período
        const existingForced = await db
          .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
          .where("contractId", "==", contractId)
          .where("entryType", "==", "deferred_revenue")
          .where("referenceNumber", "==", referenceNumber)
          .limit(1)
          .get();

        if (existingForced.empty) {
          const entryData = {
            tenantId,
            contractId,
            entryDate: entryDateTimestamp,
            periodStart: periodStartTimestamp,
            periodEnd: periodEndTimestamp,
            entryType: "deferred_revenue",
            debitAccount: totalBilled > 0 ? "1200 - Accounts Receivable (AR)" : "1300 - Contract Asset",
            creditAccount: "2500 - Deferred Revenue",
            amount: ifrs15Result.transactionPrice,
            currency,
            exchangeRate: 1,
            description: `Receita diferida forçada (transactionPrice > 0 mas effectiveDeferredRevenue = 0)`,
            referenceNumber,
            isPosted: false,
            createdAt: entryDateTimestamp,
          };
          
          console.log(`[generateAutomaticJournalEntries] 📝 Criando entry FORÇADO:`, JSON.stringify(entryData, null, 2));
          console.log(`[generateAutomaticJournalEntries] 📁 Collection: ${tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)}`);
          
          try {
            const docRef = await ledgerCollection.add(entryData);
            console.log(`[generateAutomaticJournalEntries] ✅ Entry FORÇADO criado com ID: ${docRef.id}`);
            console.log(`[generateAutomaticJournalEntries] ✅ Path completo: ${tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)}/${docRef.id}`);
            
            // Verificar se foi realmente criado
            const verifyDoc = await docRef.get();
            if (verifyDoc.exists) {
              console.log(`[generateAutomaticJournalEntries] ✅ Verificação: Entry existe no Firestore`);
            } else {
              console.error(`[generateAutomaticJournalEntries] ❌ ERRO CRÍTICO: Entry não foi encontrado após criação!`);
            }
          } catch (addError: any) {
            console.error(`[generateAutomaticJournalEntries] ❌ ERRO ao adicionar entry forçado:`, addError);
            console.error(`[generateAutomaticJournalEntries] Stack:`, addError.stack);
            throw addError;
          }
        } else {
          console.log(`[generateAutomaticJournalEntries] Entry FORÇADO já existe (${existingForced.docs[0].id}), pulando`);
        }
      }
    }

    // 5. Custo (Cost) - Custos do Contrato Amortizados
    // Buscar custos do contrato e gerar lançamento se houver amortização
    // Débito: Cost of Revenue | Crédito: Contract Costs Asset
    const contractCostsSnapshot = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACT_COSTS))
      .where("contractId", "==", contractId)
      .get();

    let totalAmortizedCosts = 0;
    for (const costDoc of contractCostsSnapshot.docs) {
      const cost = costDoc.data();
      const amortized = Number(cost.totalAmortized || 0);
      if (amortized > 0) {
        totalAmortizedCosts += amortized;
      }
    }

    if (totalAmortizedCosts > 0) {
      const referenceNumber = buildReference(
        "COST-AUTO",
        contractId,
        periodStart,
        periodEnd
      );
      const exists = await checkExistingEntry(
        tenantId,
        contractId,
        "commission_expense",
        referenceNumber,
        periodStart,
        periodEnd
      );

      if (!exists) {
        await ledgerCollection.add({
          tenantId,
          contractId,
          entryDate: entryDateTimestamp,
          periodStart: periodStartTimestamp,
          periodEnd: periodEndTimestamp,
          entryType: "commission_expense",
          debitAccount: "5000 - Cost of Revenue",
          creditAccount: "1500 - Contract Costs Asset",
          amount: totalAmortizedCosts,
          currency,
          exchangeRate: 1,
          description: `Custos do contrato amortizados automaticamente`,
          referenceNumber,
          isPosted: false,
          createdAt: entryDateTimestamp,
        });
      }
    }

    // 6. Contract Asset - Se houver (Receita reconhecida > Faturamento)
    // Débito: Contract Asset | Crédito: Revenue
    if (ifrs15Result.contractAsset > 0) {
      const referenceNumber = buildReference(
        "CA-AUTO",
        contractId,
        periodStart,
        periodEnd
      );
      const exists = await checkExistingEntry(
        tenantId,
        contractId,
        "contract_asset",
        referenceNumber,
        periodStart,
        periodEnd
      );

      if (!exists) {
        await ledgerCollection.add({
          tenantId,
          contractId,
          entryDate: entryDateTimestamp,
          periodStart: periodStartTimestamp,
          periodEnd: periodEndTimestamp,
          entryType: "contract_asset",
          debitAccount: "1300 - Contract Asset",
          creditAccount: "4000 - Revenue",
          amount: ifrs15Result.contractAsset,
          currency,
          exchangeRate: 1,
          description: `Contract Asset gerado automaticamente pelo IFRS 15`,
          referenceNumber,
          isPosted: false,
          createdAt: entryDateTimestamp,
        });
      }
    }

    // 7. Contract Liability - Se houver (Faturamento > Receita reconhecida)
    // Débito: Revenue | Crédito: Contract Liability
    if (ifrs15Result.contractLiability > 0) {
      const referenceNumber = buildReference(
        "CL-AUTO",
        contractId,
        periodStart,
        periodEnd
      );
      const exists = await checkExistingEntry(
        tenantId,
        contractId,
        "contract_liability",
        referenceNumber,
        periodStart,
        periodEnd
      );

      if (!exists) {
        await ledgerCollection.add({
          tenantId,
          contractId,
          entryDate: entryDateTimestamp,
          periodStart: periodStartTimestamp,
          periodEnd: periodEndTimestamp,
          entryType: "contract_liability",
          debitAccount: "4000 - Revenue",
          creditAccount: "2600 - Contract Liability",
          amount: ifrs15Result.contractLiability,
          currency,
          exchangeRate: 1,
          description: `Contract Liability gerado automaticamente pelo IFRS 15`,
          referenceNumber,
          isPosted: false,
          createdAt: entryDateTimestamp,
        });
      }
    }

    // 8. Financing Income - Se houver componente de financiamento significativo
    // Verificar se há componente de financiamento (contratos > 12 meses)
    const contractStartDate = periodStart;
    const contractEndDate = periodEnd;
    const contractDurationMonths = monthsBetween(contractStartDate, contractEndDate);

    if (contractDurationMonths > 12 && ifrs15Result.financingComponent > 0) {
      const referenceNumber = buildReference(
        "FIN-AUTO",
        contractId,
        periodStart,
        periodEnd
      );
      const exists = await checkExistingEntry(
        tenantId,
        contractId,
        "financing_income",
        referenceNumber,
        periodStart,
        periodEnd
      );

      if (!exists) {
        await ledgerCollection.add({
          tenantId,
          contractId,
          entryDate: entryDateTimestamp,
          periodStart: periodStartTimestamp,
          periodEnd: periodEndTimestamp,
          entryType: "financing_income",
          debitAccount: "1300 - Contract Asset",
          creditAccount: "4100 - Financing Income",
          amount: ifrs15Result.financingComponent,
          currency,
          exchangeRate: 1,
          description: `Financing income recognized for significant financing component`,
          referenceNumber,
          isPosted: false,
          createdAt: entryDateTimestamp,
        });
      }
    }

    // Contar quantos entries foram criados
    const entriesCount = await ledgerCollection
      .where("contractId", "==", contractId)
      .where("createdAt", ">=", entryDateTimestamp)
      .get();
    
    console.log(`[generateAutomaticJournalEntries] ✅ Concluído com sucesso para contrato ${contractId}`);
    console.log(`[generateAutomaticJournalEntries] Total de entries criados nesta execução: ${entriesCount.size}`);
    console.log(`[generateAutomaticJournalEntries] Resumo final:`, {
      effectiveDeferredRevenue,
      accountsReceivable: totalBilled - totalCashReceived,
      totalRecognizedRevenue: ifrs15Result.totalRecognizedRevenue,
      contractAsset: ifrs15Result.contractAsset,
      contractLiability: ifrs15Result.contractLiability,
      entriesCreated: entriesCount.size,
    });
  } catch (error: any) {
    console.error(`[generateAutomaticJournalEntries] ❌ Erro ao gerar lançamentos contábeis automáticos:`, error);
    console.error(`[generateAutomaticJournalEntries] Stack trace:`, error.stack);
    console.error(`[generateAutomaticJournalEntries] Detalhes:`, {
      tenantId,
      contractId,
      transactionPrice: ifrs15Result.transactionPrice,
      totalRecognizedRevenue: ifrs15Result.totalRecognizedRevenue,
      totalDeferredRevenue: ifrs15Result.totalDeferredRevenue,
      totalBilled,
      totalCashReceived,
    });
    // Não falhar o processo principal se a geração de lançamentos falhar
    // Mas logar o erro para debug
  }
}

// Legacy generator kept for reference (Ledger v2 supersedes it).
void generateAutomaticJournalEntries;

/**
 * Main IFRS 15 Engine Cloud Function
 * 
 * Executes the 5-Step revenue recognition model
 */
export const runIFRS15Engine = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { contractId, versionId, options = {} } = data;
    const tenantId = context.auth.token.tenantId;
    const userId = context.auth.uid;

    console.log(`[runIFRS15Engine] 🚀 INICIANDO Motor IFRS 15`);
    console.log(`[runIFRS15Engine] 👤 Usuário: ${userId}`);
    console.log(`[runIFRS15Engine] 🏢 tenantId do token: ${context.auth.token.tenantId}`);
    console.log(`[runIFRS15Engine] 🏢 tenantId usado: ${tenantId}`);
    console.log(`[runIFRS15Engine] 📄 contractId: ${contractId}`);

    if (!tenantId) {
      console.error(`[runIFRS15Engine] ❌ ERRO: tenantId não encontrado no token!`);
      console.error(`[runIFRS15Engine] Token completo:`, JSON.stringify(context.auth.token, null, 2));
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    if (!contractId) {
      throw new functions.https.HttpsError("invalid-argument", "Contract ID required");
    }

    const now = Timestamp.now();
    const result: IFRS15Result = {
      contractId,
      versionId: "",
      calculatedAt: now,
      contractExists: false,
      contractModified: false,
      performanceObligations: [],
      transactionPrice: 0,
      fixedPrice: 0,
      variableConsideration: 0,
      financingComponent: 0,
      constrainedAmount: 0,
      allocations: [],
      revenueSchedule: [],
      totalRecognizedRevenue: 0,
      totalDeferredRevenue: 0,
      contractAsset: 0,
      contractLiability: 0,
      inputs: { contractId, versionId, options, tenantId },
      warnings: [],
      errors: [],
    };

    try {
      // ===============================
      // STEP 1: Identify the Contract
      // ===============================
      
      const contractRef = db
        .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
        .doc(contractId);
      
      const contractDoc = await contractRef.get();
      
      if (!contractDoc.exists) {
        result.errors.push("Contract not found");
        throw new functions.https.HttpsError("not-found", "Contract not found");
      }

      const contract = { id: contractDoc.id, ...contractDoc.data() } as Contract;
      result.contractExists = true;

      // Helper: garantir que exista uma versão atual; se não houver, criar versão 1 automaticamente
      const ensureCurrentVersion = async (): Promise<string> => {
        let currentId = versionId || contract.currentVersionId;

        if (currentId) {
          const exists = await contractRef.collection("versions").doc(currentId).get();
          if (exists.exists) {
            return currentId;
          }
        }

        // Buscar última versão existente
        const versionsSnapshot = await contractRef
          .collection("versions")
          .orderBy("versionNumber", "desc")
          .limit(1)
          .get();

        if (!versionsSnapshot.empty) {
          currentId = versionsSnapshot.docs[0].id;
          await contractRef.update({ currentVersionId: currentId });
          console.warn(
            `[runIFRS15Engine] currentVersionId ausente; usando versão ${currentId} e atualizando contrato`
          );
          return currentId;
        }

        // Criar versão inicial automaticamente
        const nowTs = Timestamp.now();
        const effectiveDate =
          (contract.startDate && (contract.startDate as any).toDate?.()) ||
          (contract.startDate ? new Date(contract.startDate as any) : new Date());

        const versionRef = await contractRef.collection("versions").add({
          contractId,
          versionNumber: 1,
          effectiveDate: Timestamp.fromDate(effectiveDate),
          totalValue: Number(contract.totalValue || 0),
          isProspective: true,
          createdAt: nowTs,
          createdBy: userId,
          description: "Versão inicial (criada automaticamente pelo IFRS 15 Engine)",
        } as Partial<ContractVersion>);

        await contractRef.update({ currentVersionId: versionRef.id, status: contract.status || "active" });
        console.warn(
          `[runIFRS15Engine] Nenhuma versão encontrada para contrato ${contractId}; criada versão inicial ${versionRef.id}`
        );
        return versionRef.id;
      };

      // Get or create version
      const targetVersionId = await ensureCurrentVersion();

      result.versionId = targetVersionId;

      const versionRef = contractRef.collection("versions").doc(targetVersionId);
      const versionDoc = await versionRef.get();

      if (!versionDoc.exists) {
        result.errors.push("Contract version not found");
        throw new functions.https.HttpsError("not-found", "Contract version not found");
      }

      const version = { id: versionDoc.id, ...versionDoc.data() } as ContractVersion;
      
      // Check if this is a modified contract
      if (version.versionNumber > 1) {
        result.contractModified = true;
      }

      // ===============================
      // STEP 2: Identify Performance Obligations
      // ===============================
      
      // Get line items
      const lineItemsSnapshot = await versionRef.collection("lineItems").get();
      const lineItems: LineItem[] = lineItemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LineItem));

      // Get existing performance obligations
      const posSnapshot = await versionRef.collection("performanceObligations").get();
      let performanceObligations: PerformanceObligation[] = posSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PerformanceObligation));

      // If no POs exist, create them from line items
      if (performanceObligations.length === 0 && lineItems.length > 0) {
        result.warnings.push("No performance obligations found. Creating from line items.");
        
        for (const item of lineItems) {
          // Each distinct line item becomes a separate PO
          if (item.isDistinct && item.distinctWithinContext) {
            const poRef = await versionRef.collection("performanceObligations").add({
              contractVersionId: targetVersionId,
              description: item.description,
              lineItemIds: [item.id],
              allocatedPrice: item.totalPrice,
              recognitionMethod: item.recognitionMethod,
              measurementMethod: item.measurementMethod,
              percentComplete: 0,
              recognizedAmount: 0,
              deferredAmount: item.totalPrice,
              isSatisfied: false,
              justification: "Auto-generated from distinct line item",
              createdAt: now,
            });

            performanceObligations.push({
              id: poRef.id,
              description: item.description,
              lineItemIds: [item.id],
              allocatedPrice: item.totalPrice,
              recognitionMethod: item.recognitionMethod,
              measurementMethod: item.measurementMethod,
              percentComplete: 0,
              recognizedAmount: 0,
              deferredAmount: item.totalPrice,
              isSatisfied: false,
              justification: "Auto-generated from distinct line item",
            });
          }
        }
      }

      // Map POs for result
      result.performanceObligations = performanceObligations.map(po => ({
        id: po.id,
        description: po.description,
        isDistinct: true,
        bundled: (po.lineItemIds?.length || 0) > 1,
        justification: po.justification || "Deemed distinct",
      }));

      console.log(`[runIFRS15Engine] STEP 2: Performance Obligations processadas: ${result.performanceObligations.length}`);
      if (performanceObligations.length === 0) {
        console.warn(`[runIFRS15Engine] ⚠️ NENHUMA Performance Obligation encontrada! O Motor não conseguirá calcular receita sem POs.`);
        result.warnings.push("Nenhuma Performance Obligation encontrada. Crie pelo menos uma PO para calcular receita.");
      }

      // ===============================
      // STEP 3: Determine Transaction Price
      // ===============================
      
      console.log(`[runIFRS15Engine] STEP 3: Determinando Transaction Price`);
      console.log(`[runIFRS15Engine] Performance Obligations encontradas: ${performanceObligations.length}`);
      performanceObligations.forEach((po, idx) => {
        console.log(`[runIFRS15Engine] PO ${idx + 1}: ${po.description}, allocatedPrice: ${po.allocatedPrice}, recognitionMethod: ${po.recognitionMethod}`);
      });
      
      // Fixed price from contract
      result.fixedPrice = version.totalValue;
      console.log(`[runIFRS15Engine] Fixed price (version.totalValue): ${result.fixedPrice}`);

      // Get variable considerations
      const vcSnapshot = await versionRef.collection("variableConsiderations").get();
      const variableConsiderations: VariableConsideration[] = vcSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as VariableConsideration));

      for (const vc of variableConsiderations) {
        if (vc.constraintApplied) {
          result.constrainedAmount += vc.estimatedAmount;
          result.warnings.push(`Variable consideration constrained: ${vc.type} - ${vc.constraintReason}`);
        } else {
          result.variableConsideration += vc.estimatedAmount;
        }
      }

      // Check for significant financing component
      const contractStartDate = contract.startDate.toDate();
      const contractEndDate = contract.endDate?.toDate() || new Date(contractStartDate.getFullYear() + 1, contractStartDate.getMonth(), contractStartDate.getDate());
      const contractDurationMonths = monthsBetween(contractStartDate, contractEndDate);
      
      // If contract spans more than 12 months, may have financing component
      if (contractDurationMonths > 12) {
        result.warnings.push(`Contract spans ${contractDurationMonths} months. Consider evaluating significant financing component.`);
      }

      result.transactionPrice = result.fixedPrice + result.variableConsideration - result.constrainedAmount + result.financingComponent;
      console.log(`[runIFRS15Engine] Transaction Price calculado: ${result.transactionPrice}`, {
        fixedPrice: result.fixedPrice,
        variableConsideration: result.variableConsideration,
        constrainedAmount: result.constrainedAmount,
        financingComponent: result.financingComponent,
      });

      // ===============================
      // STEP 4: Allocate Transaction Price
      // ===============================
      
      // Calculate standalone selling prices
      const totalSSP = performanceObligations.reduce((sum, po) => {
        // Use explicit SSP if available from line items, otherwise use allocated price
        const relatedLineItems = lineItems.filter(li => po.lineItemIds?.includes(li.id));
        const ssp = relatedLineItems.reduce((s, li) => s + (li.standaloneSelllingPrice || li.totalPrice), 0);
        return sum + (ssp || po.allocatedPrice);
      }, 0);

      // Allocate based on relative SSP method
      for (const po of performanceObligations) {
        const relatedLineItems = lineItems.filter(li => po.lineItemIds?.includes(li.id));
        const poSSP = relatedLineItems.reduce((s, li) => s + (li.standaloneSelllingPrice || li.totalPrice), 0) || po.allocatedPrice;
        const allocationPercentage = totalSSP > 0 ? poSSP / totalSSP : 1 / performanceObligations.length;
        const allocatedAmount = result.transactionPrice * allocationPercentage;

        result.allocations.push({
          poId: po.id,
          description: po.description,
          standaloneSelllingPrice: poSSP,
          allocationPercentage: Math.round(allocationPercentage * 10000) / 100, // Percentage with 2 decimals
          allocatedAmount: Math.round(allocatedAmount * 100) / 100,
        });

        // Update PO with allocated price
        await versionRef.collection("performanceObligations").doc(po.id).update({
          allocatedPrice: Math.round(allocatedAmount * 100) / 100,
        });
      }

      // ===============================
      // STEP 5: Recognize Revenue
      // ===============================
      
      console.log(`[runIFRS15Engine] STEP 5: Reconhecendo Receita`);
      console.log(`[runIFRS15Engine] Processando ${performanceObligations.length} Performance Obligations`);
      
      for (const po of performanceObligations) {
        const allocation = result.allocations.find(a => a.poId === po.id);
        if (!allocation) continue;

        const poAmount = allocation.allocatedAmount;
        const revenueScheduleEntry: IFRS15Result["revenueSchedule"][0] = {
          poId: po.id,
          periods: [],
        };

        if (po.recognitionMethod === "point_in_time") {
          // Point in time - recognize immediately if satisfied
          const period = {
            periodStart: contractStartDate,
            periodEnd: contractStartDate,
            scheduledAmount: poAmount,
            recognizedAmount: po.isSatisfied ? poAmount : 0,
            deferredAmount: po.isSatisfied ? 0 : poAmount,
          };

          revenueScheduleEntry.periods.push(period);

          if (po.isSatisfied) {
            result.totalRecognizedRevenue += poAmount;
          } else {
            result.totalDeferredRevenue += poAmount;
          }
        } else {
          // Over time - generate periodic recognition schedule
          const relatedLineItems = lineItems.filter(li => po.lineItemIds?.includes(li.id));
          let poStartDate = contractStartDate;
          let poEndDate = contractEndDate;

          // Use line item dates if available
          for (const li of relatedLineItems) {
            if (li.deliveryStartDate) {
              poStartDate = li.deliveryStartDate.toDate();
            }
            if (li.deliveryEndDate) {
              poEndDate = li.deliveryEndDate.toDate();
            }
          }

          const periods = generateMonthlyPeriods(poStartDate, poEndDate);
          const totalPeriods = periods.length;
          const amountPerPeriod = Math.round((poAmount / totalPeriods) * 100) / 100;

          let remainingAmount = poAmount;
          const today = new Date();

          for (let i = 0; i < periods.length; i++) {
            const period = periods[i];
            const isLastPeriod = i === periods.length - 1;
            const periodAmount = isLastPeriod ? remainingAmount : amountPerPeriod;
            const isPast = period.end < today;

            const recognizedAmount = isPast ? periodAmount : 0;
            const deferredAmount = isPast ? 0 : periodAmount;

            revenueScheduleEntry.periods.push({
              periodStart: period.start,
              periodEnd: period.end,
              scheduledAmount: periodAmount,
              recognizedAmount,
              deferredAmount,
            });

            result.totalRecognizedRevenue += recognizedAmount;
            result.totalDeferredRevenue += deferredAmount;
            remainingAmount -= amountPerPeriod;
          }
        }

        result.revenueSchedule.push(revenueScheduleEntry);

        // Save revenue schedules to Firestore
        const poRef = versionRef.collection("performanceObligations").doc(po.id);
        
        // Delete existing schedules
        const existingSchedules = await poRef.collection("revenueSchedules").get();
        const batch = db.batch();
        existingSchedules.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Create new schedules
        for (const period of revenueScheduleEntry.periods) {
          await poRef.collection("revenueSchedules").add({
            performanceObligationId: po.id,
            periodStart: Timestamp.fromDate(period.periodStart),
            periodEnd: Timestamp.fromDate(period.periodEnd),
            scheduledAmount: period.scheduledAmount,
            recognizedAmount: period.recognizedAmount,
            isRecognized: period.recognizedAmount > 0,
            recognizedDate: period.recognizedAmount > 0 ? now : null,
            createdAt: now,
          });
        }

        // Update PO with calculated amounts
        await poRef.update({
          recognizedAmount: revenueScheduleEntry.periods.reduce((sum, p) => sum + p.recognizedAmount, 0),
          deferredAmount: revenueScheduleEntry.periods.reduce((sum, p) => sum + p.deferredAmount, 0),
          percentComplete: Math.round((revenueScheduleEntry.periods.reduce((sum, p) => sum + p.recognizedAmount, 0) / allocation.allocatedAmount) * 100),
        });
      }

      // Calculate contract balances
      // Contract Asset = Revenue recognized > Billed (billing > recognition = liability)
      // Contract Liability = Billed > Revenue recognized

      // Get billing information
      const billingsSnapshot = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
        .where("contractId", "==", contractId)
        .where("status", "in", ["invoiced", "paid"])
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

      console.log(`[runIFRS15Engine] Resumo de receita:`, {
        totalRecognizedRevenue: result.totalRecognizedRevenue,
        totalDeferredRevenue: result.totalDeferredRevenue,
        totalBilled,
        totalCashReceived,
      });

      if (result.totalRecognizedRevenue > totalBilled) {
        result.contractAsset = result.totalRecognizedRevenue - totalBilled;
        result.contractLiability = 0;
      } else {
        result.contractAsset = 0;
        result.contractLiability = totalBilled - result.totalRecognizedRevenue;
      }
      
      console.log(`[runIFRS15Engine] Contract balances:`, {
        contractAsset: result.contractAsset,
        contractLiability: result.contractLiability,
      });

      // Save contract balance
      await contractRef.collection("balances").add({
        contractId,
        periodDate: now,
        contractAsset: result.contractAsset,
        contractLiability: result.contractLiability,
        receivable: totalBilled - totalCashReceived,
        revenueRecognized: result.totalRecognizedRevenue,
        cashReceived: totalCashReceived,
        createdAt: now,
      });

      // Create audit log
      await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
        tenantId,
        userId,
        entityType: "contract",
        entityId: contractId,
        action: "recognize",
        newValue: {
          calculationType: "IFRS15_ENGINE",
          transactionPrice: result.transactionPrice,
          recognizedRevenue: result.totalRecognizedRevenue,
          deferredRevenue: result.totalDeferredRevenue,
        },
        createdAt: now,
      });

      // Gerar lançamentos contábeis automaticamente
      console.log(`[runIFRS15Engine] Chamando generateAutomaticJournalEntries para contrato ${contractId}`);
      console.log(`[runIFRS15Engine] Valores antes de gerar entries:`, {
        transactionPrice: result.transactionPrice,
        totalRecognizedRevenue: result.totalRecognizedRevenue,
        totalDeferredRevenue: result.totalDeferredRevenue,
        totalBilled,
        totalCashReceived,
        contractValue: version.totalValue,
      });
      try {
        // Gerar ledger entries baseados em eventos (billing, payment, etc)
        await generateRevenueLedgerV2ForContract({
          tenantId,
          contractId,
          upTo: now.toDate(),
        });
        console.log(`[runIFRS15Engine] Ledger v2 gerado com sucesso`);

        // NOVO: Gerar entries iniciais de deferred revenue
        // Isso garante que sempre haverá entries, mesmo sem billing
        console.log(`[runIFRS15Engine] 🎬 Gerando entries iniciais de deferred revenue...`);
        const initialResult = await generateInitialDeferredRevenueEntries({
          tenantId,
          contractId,
          ifrs15Result: result,
          contractStartDate,
          contractEndDate,
          currency: contract.currency || "BRL",
        });
        console.log(`[runIFRS15Engine] Initial entries: criados=${initialResult.created}, pulados=${initialResult.skipped}`);

        console.log(`[runIFRS15Engine] ✅ generateAutomaticJournalEntries concluído com sucesso`);
        
        // VERIFICAÇÃO CRÍTICA: Se transactionPrice > 0 mas nenhum entry foi criado, FORÇAR criação
        console.log(`[runIFRS15Engine] 🔍 Verificando se entries foram criados...`);
        console.log(`[runIFRS15Engine] Path da coleção: ${tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)}`);
        console.log(`[runIFRS15Engine] contractId: ${contractId}, tenantId: ${tenantId}`);
        
        const ledgerSnapshot = await db
          .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
          .where("contractId", "==", contractId)
          .get();
        
        console.log(`[runIFRS15Engine] 📊 Entries existentes para este contrato: ${ledgerSnapshot.size}`);
        console.log(`[runIFRS15Engine] transactionPrice: ${result.transactionPrice}, empty: ${ledgerSnapshot.empty}`);
        
        if (false && ledgerSnapshot.empty && result.transactionPrice > 0) {
          console.log(`[runIFRS15Engine] ⚠️ CRÍTICO: Nenhum entry foi criado mas transactionPrice > 0. FORÇANDO criação...`);
          const forcedEntry = {
            tenantId,
            contractId,
            entryDate: now,
            periodStart: Timestamp.fromDate(contractStartDate),
            periodEnd: Timestamp.fromDate(contractEndDate),
            entryType: "deferred_revenue",
            debitAccount: totalBilled > 0 ? "1200 - Accounts Receivable (AR)" : "1300 - Contract Asset",
            creditAccount: "2500 - Deferred Revenue",
            amount: result.transactionPrice,
            currency: contract.currency || "BRL",
            exchangeRate: 1,
            description: `Receita diferida FORÇADA - Motor IFRS 15 (transactionPrice > 0 mas nenhum entry foi criado)`,
            referenceNumber: `DEF-FORCE-${contractId}-${Date.now()}`,
            isPosted: false,
            createdAt: now,
          };
          
          console.log(`[runIFRS15Engine] 📝 Dados do entry forçado:`, JSON.stringify(forcedEntry, null, 2));
          
          try {
            const forcedDocRef = await db
              .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
              .add(forcedEntry);
            console.log(`[runIFRS15Engine] ✅ Entry FORÇADO criado com ID: ${forcedDocRef.id}`);
            console.log(`[runIFRS15Engine] ✅ Path completo: ${tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)}/${forcedDocRef.id}`);
          } catch (forceError: any) {
            console.error(`[runIFRS15Engine] ❌ ERRO ao criar entry forçado:`, forceError);
            console.error(`[runIFRS15Engine] Stack:`, forceError.stack);
            throw forceError;
          }
        } else if (!ledgerSnapshot.empty) {
          console.log(`[runIFRS15Engine] ✅ Entries já existem para este contrato (${ledgerSnapshot.size} encontrados)`);
        } else if (result.transactionPrice === 0) {
          console.log(`[runIFRS15Engine] ⚠️ transactionPrice é 0, não criando entry forçado`);
        }
      } catch (journalError: any) {
        console.error(`[runIFRS15Engine] ❌ ERRO ao gerar journal entries:`, journalError);
        console.error(`[runIFRS15Engine] Stack trace:`, journalError.stack);
        // Não falhar o engine por causa de journal entries, mas tentar criar um entry básico
        if (false && result.transactionPrice > 0) {
          try {
            console.log(`[runIFRS15Engine] Tentando criar entry básico após erro...`);
            const basicEntry = {
              tenantId,
              contractId,
              entryDate: now,
              periodStart: Timestamp.fromDate(contractStartDate),
              periodEnd: Timestamp.fromDate(contractEndDate),
              entryType: "deferred_revenue",
              debitAccount: "1300 - Contract Asset",
              creditAccount: "2500 - Deferred Revenue",
              amount: result.transactionPrice,
              currency: contract.currency || "BRL",
              exchangeRate: 1,
              description: `Receita diferida criada após erro no generateAutomaticJournalEntries`,
              referenceNumber: `DEF-ERROR-${contractId}-${Date.now()}`,
              isPosted: false,
              createdAt: now,
            };
            const basicDocRef = await db
              .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
              .add(basicEntry);
            console.log(`[runIFRS15Engine] ✅ Entry básico criado após erro com ID: ${basicDocRef.id}`);
          } catch (basicError: any) {
            console.error(`[runIFRS15Engine] ❌ ERRO ao criar entry básico:`, basicError);
          }
        }
        result.warnings.push(`Erro ao gerar lançamentos contábeis: ${journalError.message}`);
      }

      // Log final do resultado
      console.log(`[runIFRS15Engine] ✅ Motor IFRS 15 concluído para contrato ${contractId}`);
      console.log(`[runIFRS15Engine] Resultado final:`, {
        transactionPrice: result.transactionPrice,
        totalRecognizedRevenue: result.totalRecognizedRevenue,
        totalDeferredRevenue: result.totalDeferredRevenue,
        contractAsset: result.contractAsset,
        contractLiability: result.contractLiability,
        errors: result.errors.length,
        warnings: result.warnings.length,
      });

      return result;
    } catch (error: any) {
      console.error("[runIFRS15Engine] Erro no IFRS 15 Engine:", error);
      console.error("[runIFRS15Engine] Stack trace:", error.stack);
      result.errors.push(error.message || "Unknown error");
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError("internal", "Failed to run IFRS 15 engine");
    }
  }
);

/**
 * Create new contract version (for modifications)
 */
export const createContractVersion = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { contractId, modificationReason, isProspective = true, effectiveDate } = data;
    const tenantId = context.auth.token.tenantId;
    const userId = context.auth.uid;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    if (!contractId || !modificationReason) {
      throw new functions.https.HttpsError("invalid-argument", "Contract ID and modification reason required");
    }

    const now = Timestamp.now();

    const contractRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .doc(contractId);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Contract not found");
    }

    const contract = contractDoc.data() as Contract;

    // Get current version to copy
    const currentVersionId = contract.currentVersionId;
    if (!currentVersionId) {
      throw new functions.https.HttpsError("failed-precondition", "Contract has no current version");
    }

    const currentVersionDoc = await contractRef.collection("versions").doc(currentVersionId).get();
    if (!currentVersionDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Current version not found");
    }

    const currentVersion = currentVersionDoc.data() as ContractVersion;

    // Create new version
    const newVersionNumber = currentVersion.versionNumber + 1;
    const newVersionRef = await contractRef.collection("versions").add({
      contractId,
      versionNumber: newVersionNumber,
      effectiveDate: effectiveDate ? Timestamp.fromDate(new Date(effectiveDate)) : now,
      description: `Version ${newVersionNumber} - ${modificationReason}`,
      totalValue: currentVersion.totalValue,
      modificationReason,
      isProspective,
      createdBy: userId,
      createdAt: now,
    });

    // Copy line items
    const lineItemsSnapshot = await contractRef.collection("versions").doc(currentVersionId).collection("lineItems").get();
    for (const doc of lineItemsSnapshot.docs) {
      await newVersionRef.collection("lineItems").add({
        ...doc.data(),
        contractVersionId: newVersionRef.id,
        createdAt: now,
      });
    }

    // Copy performance obligations
    const posSnapshot = await contractRef.collection("versions").doc(currentVersionId).collection("performanceObligations").get();
    for (const doc of posSnapshot.docs) {
      await newVersionRef.collection("performanceObligations").add({
        ...doc.data(),
        contractVersionId: newVersionRef.id,
        createdAt: now,
      });
    }

    // Update contract status and current version
    await contractRef.update({
      status: "modified",
      currentVersionId: newVersionRef.id,
      updatedAt: now,
    });

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId,
      entityType: "contract_version",
      entityId: newVersionRef.id,
      action: "create",
      newValue: {
        versionNumber: newVersionNumber,
        modificationReason,
        isProspective,
      },
      createdAt: now,
    });

    return {
      success: true,
      versionId: newVersionRef.id,
      versionNumber: newVersionNumber,
    };
  }
);

/**
 * Generate billing schedule for a contract
 */
export const generateBillingSchedule = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { contractId, frequency = "monthly", startDate } = data;
    const tenantId = context.auth.token.tenantId;
    const userId = context.auth.uid;

    if (!tenantId) {
      throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
    }

    if (!contractId) {
      throw new functions.https.HttpsError("invalid-argument", "Contract ID required");
    }

    const now = Timestamp.now();

    const contractRef = db
      .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
      .doc(contractId);

    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Contract not found");
    }

    const contract = contractDoc.data() as Contract;
    const contractStartDate = startDate ? new Date(startDate) : contract.startDate.toDate();
    const contractEndDate = contract.endDate?.toDate() || new Date(contractStartDate.getFullYear() + 1, contractStartDate.getMonth(), contractStartDate.getDate());

    // Calculate number of billing periods
    let periodMonths: number;
    switch (frequency) {
      case "monthly": periodMonths = 1; break;
      case "quarterly": periodMonths = 3; break;
      case "semi_annual": periodMonths = 6; break;
      case "annual": periodMonths = 12; break;
      default: periodMonths = 1;
    }

    const totalMonths = monthsBetween(contractStartDate, contractEndDate);
    const numberOfPeriods = Math.ceil(totalMonths / periodMonths);
    const amountPerPeriod = Math.round((contract.totalValue / numberOfPeriods) * 100) / 100;

    // Delete existing billing schedules for this contract
    const existingSchedules = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
      .where("contractId", "==", contractId)
      .get();

    const batch = db.batch();
    existingSchedules.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Create new billing schedules
    let currentDate = new Date(contractStartDate);
    let remainingAmount = contract.totalValue;
    const schedules = [];

    for (let i = 0; i < numberOfPeriods; i++) {
      const billingDate = new Date(currentDate);
      const dueDate = new Date(currentDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

      const isLastPeriod = i === numberOfPeriods - 1;
      const amount = isLastPeriod ? remainingAmount : amountPerPeriod;

      const scheduleRef = await db
        .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
        .add({
          tenantId,
          contractId,
          billingDate: Timestamp.fromDate(billingDate),
          dueDate: Timestamp.fromDate(dueDate),
          amount,
          currency: contract.currency,
          frequency,
          status: "scheduled",
          notes: `Billing ${i + 1} of ${numberOfPeriods}`,
          createdAt: now,
        });

      schedules.push({
        id: scheduleRef.id,
        billingDate,
        dueDate,
        amount,
      });

      remainingAmount -= amountPerPeriod;
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + periodMonths, currentDate.getDate());
    }

    // Create audit log
    await db.collection(tenantCollection(tenantId, COLLECTIONS.AUDIT_LOGS)).add({
      tenantId,
      userId,
      entityType: "billing_schedule",
      entityId: contractId,
      action: "create",
      newValue: {
        frequency,
        numberOfPeriods,
        totalAmount: contract.totalValue,
      },
      createdAt: now,
    });

    return {
      success: true,
      schedules,
    };
  }
);
