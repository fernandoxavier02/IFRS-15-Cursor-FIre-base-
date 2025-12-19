import * as functions from "firebase-functions";
import { db } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

/**
 * Callable: Apaga TODOS os balances de contratos (Contract Balances) do tenant
 * 
 * ⚠️ ATENÇÃO: Esta função é destrutiva e apaga TODOS os balances de contratos do tenant.
 * Use apenas em caso de emergência ou para limpar dados incorretos.
 * Após apagar, execute o Motor IFRS 15 novamente para recalcular os balances corretamente.
 */
export const deleteAllContractBalances = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId;
  if (!tenantId) {
    throw new functions.https.HttpsError("failed-precondition", "No tenant associated");
  }

  console.log(`[deleteAllContractBalances] 🗑️ Iniciando exclusão de TODOS os balances de contratos para tenant: ${tenantId}`);

  try {
    const contractsPath = tenantCollection(tenantId, COLLECTIONS.CONTRACTS);
    const contractsSnapshot = await db.collection(contractsPath).get();
    
    if (contractsSnapshot.empty) {
      console.log(`[deleteAllContractBalances] ⚠️ Nenhum contrato encontrado para tenant: ${tenantId}`);
      return {
        success: true,
        deleted: 0,
        contractsProcessed: 0,
        message: "Nenhum contrato encontrado",
      };
    }

    let totalDeleted = 0;
    let contractsProcessed = 0;

    // Processar cada contrato
    for (const contractDoc of contractsSnapshot.docs) {
      const balancesPath = `${contractDoc.ref.path}/balances`;
      const balancesSnapshot = await db.collection(balancesPath).get();
      
      if (!balancesSnapshot.empty) {
        console.log(`[deleteAllContractBalances] 📊 Contrato ${contractDoc.id}: ${balancesSnapshot.size} balances encontrados`);
        
        // Deletar em lotes para evitar timeout
        const batchSize = 500;
        const batches: any[] = [];
        let currentBatch = db.batch();
        let batchCount = 0;

        balancesSnapshot.forEach((balanceDoc) => {
          currentBatch.delete(balanceDoc.ref);
          batchCount++;
          totalDeleted++;

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

        // Executar todos os batches para este contrato
        for (let i = 0; i < batches.length; i++) {
          await batches[i].commit();
        }

        contractsProcessed++;
        console.log(`[deleteAllContractBalances] ✅ Contrato ${contractDoc.id}: ${balancesSnapshot.size} balances deletados`);
      }
    }

    console.log(`[deleteAllContractBalances] ✅ Exclusão concluída: ${totalDeleted} balances deletados de ${contractsProcessed} contratos`);

    return {
      success: true,
      deleted: totalDeleted,
      contractsProcessed,
      message: `${totalDeleted} balances deletados de ${contractsProcessed} contratos com sucesso`,
    };
  } catch (error: any) {
    console.error(`[deleteAllContractBalances] ❌ Erro ao deletar balances:`, error);
    throw new functions.https.HttpsError(
      "internal",
      `Erro ao deletar balances: ${error.message}`
    );
  }
});
