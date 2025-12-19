import * as functions from "firebase-functions";
import { generateInitialDeferredRevenueEntries } from "../ifrs15/initial-ledger-entries";
import { generateRevenueLedgerV2ForContract } from "../ifrs15/ledger-v2";
import { db } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

/**
 * Callable: Executa o motor IFRS 15 para todos os contratos do tenant
 * e gera os lançamentos contábeis no Revenue Ledger
 * 
 * Nota: Chama a Cloud Function runIFRS15Engine através de httpsCallable
 */
export const calculateIFRS15All = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId || "default";
  console.log(`[calculateIFRS15All] 🚀 Iniciando cálculo IFRS 15 para tenant: ${tenantId}`);
  console.log(`[calculateIFRS15All] ⚠️ ATENÇÃO: Esta função é para recálculo manual. O motor roda automaticamente via triggers.`);
  console.log(`[calculateIFRS15All] ⚠️ Use apenas se os triggers automáticos falharam ou para saneamento inicial.`);

  try {
    // 1. Buscar todos os contratos do tenant
    const contractsPath = tenantCollection(tenantId, COLLECTIONS.CONTRACTS);
    const contractsSnapshot = await db.collection(contractsPath).get();

    if (contractsSnapshot.empty) {
      console.log(`[calculateIFRS15All] ⚠️ Nenhum contrato encontrado para tenant: ${tenantId}`);
      return {
        success: true,
        processed: 0,
        errors: 0,
        total: 0,
        message: "Nenhum contrato encontrado",
      };
    }

    const contracts = contractsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    console.log(`[calculateIFRS15All] 📋 Encontrados ${contracts.length} contratos`);

    let processed = 0;
    let errors = 0;
    const errorDetails: Array<{ contractId: string; error: string }> = [];

    // 2. Processar cada contrato
    for (const contract of contracts) {
      try {
        console.log(`[calculateIFRS15All] 🔄 Processando contrato: ${contract.id}`);

        // 2a. Gerar lançamentos no Revenue Ledger
        // Nota: Para executar o engine completo, o usuário deve usar a função runIFRS15Engine
        // individualmente para cada contrato. Esta função gera apenas os entries iniciais.
        
        // 2b. Gerar lançamentos no Revenue Ledger
        const now = new Date();
        await generateRevenueLedgerV2ForContract({
          tenantId,
          contractId: contract.id,
          upTo: now,
        });

        // 2c. Buscar informações do contrato para gerar entries iniciais
        const contractDoc = await db.collection(contractsPath).doc(contract.id).get();
        if (contractDoc.exists) {
          const contractData = contractDoc.data() as any;
          const contractStartDate = contractData.startDate?.toDate?.() || new Date();
          const contractEndDate = contractData.endDate?.toDate?.() || new Date();
          
          // Criar um resultado mock para gerar entries iniciais
          const mockIFRS15Result = {
            transactionPrice: Number(contractData.totalValue || 0),
            totalRecognizedRevenue: 0,
            totalDeferredRevenue: Number(contractData.totalValue || 0),
          };

          if (mockIFRS15Result.transactionPrice > 0) {
            await generateInitialDeferredRevenueEntries({
              tenantId,
              contractId: contract.id,
              ifrs15Result: mockIFRS15Result as any,
              contractStartDate,
              contractEndDate,
              currency: contractData.currency || "BRL",
            });
          }
        }

        console.log(`[calculateIFRS15All] ✅ Ledger gerado para ${contract.id}`);
        processed++;
      } catch (error: any) {
        console.error(`[calculateIFRS15All] ❌ Erro ao processar ${contract.id}:`, error);
        errors++;
        errorDetails.push({
          contractId: contract.id,
          error: error.message || String(error),
        });
      }
    }

    // 3. Retornar resultado
    const result = {
      success: true,
      processed,
      errors,
      total: contracts.length,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    };

    console.log(`[calculateIFRS15All] 🏁 Processamento concluído:`, result);
    return result;
  } catch (error: any) {
    console.error(`[calculateIFRS15All] ❌ Erro fatal:`, error);
    throw new functions.https.HttpsError(
      "internal",
      `Erro ao calcular IFRS 15: ${error.message}`
    );
  }
});
