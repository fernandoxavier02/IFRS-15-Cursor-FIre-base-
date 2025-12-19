import * as functions from "firebase-functions";
import { db } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

/**
 * Callable: Apaga TODOS os lançamentos contábeis (Revenue Ledger Entries) do tenant
 * 
 * ⚠️ ATENÇÃO: Esta função é destrutiva e apaga TODOS os lançamentos do tenant.
 * Use apenas em caso de emergência ou para limpar dados incorretos.
 */
export const deleteAllLedgerEntries = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
  }

  console.log(`[deleteAllLedgerEntries] 🗑️ Iniciando exclusão de TODOS os lançamentos para tenant: ${tenantId}`);

  try {
    const ledgerPath = tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES);
    
    // Buscar todos os documentos
    const snapshot = await db.collection(ledgerPath).get();
    
    if (snapshot.empty) {
      console.log(`[deleteAllLedgerEntries] ⚠️ Nenhum lançamento encontrado para tenant: ${tenantId}`);
      return {
        success: true,
        deleted: 0,
        message: "Nenhum lançamento encontrado",
      };
    }

    console.log(`[deleteAllLedgerEntries] 📊 Encontrados ${snapshot.size} lançamentos para deletar`);

    // Deletar em lotes para evitar timeout
    const batchSize = 500;
    let deleted = 0;
    const batches: any[] = [];
    let currentBatch = db.batch();
    let batchCount = 0;

    snapshot.forEach((doc) => {
      currentBatch.delete(doc.ref);
      batchCount++;
      deleted++;

      if (batchCount >= batchSize) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }
    });

    // Adicionar o último batch se houver documentos restantes
    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    // Executar todos os batches
    console.log(`[deleteAllLedgerEntries] 🔄 Executando ${batches.length} batches de exclusão...`);
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      console.log(`[deleteAllLedgerEntries] ✅ Batch ${i + 1}/${batches.length} concluído`);
    }

    console.log(`[deleteAllLedgerEntries] ✅ Exclusão concluída: ${deleted} lançamentos deletados`);

    return {
      success: true,
      deleted,
      message: `${deleted} lançamentos deletados com sucesso`,
    };
  } catch (error: any) {
    console.error(`[deleteAllLedgerEntries] ❌ Erro ao deletar lançamentos:`, error);
    throw new functions.https.HttpsError(
      "internal",
      `Erro ao deletar lançamentos: ${error.message}`
    );
  }
});
