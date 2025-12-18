import * as functions from "firebase-functions";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

/**
 * Callable: FORÇA criação de um entry de teste no Revenue Ledger
 * Útil para debug e teste
 */
export const forceCreateLedgerEntry = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const tenantId = context.auth.token.tenantId || "default";
  const contractId = data.contractId || "z840V7YEPSzYokxYR4tl";
  const amount = data.amount || 25000;

  console.log(`[forceCreateLedgerEntry] 🔧 FORÇANDO criação de entry...`);
  console.log(`[forceCreateLedgerEntry] tenantId do token: ${context.auth.token.tenantId}`);
  console.log(`[forceCreateLedgerEntry] tenantId usado: ${tenantId}`);
  console.log(`[forceCreateLedgerEntry] contractId: ${contractId}`);
  console.log(`[forceCreateLedgerEntry] amount: ${amount}`);

  const now = Timestamp.now();
  const contractStartDate = new Date("2025-06-17");
  const contractEndDate = new Date("2026-06-17");

  const collectionPath = tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES);
  console.log(`[forceCreateLedgerEntry] Collection path: ${collectionPath}`);

  const forcedEntry = {
    tenantId,
    contractId,
    entryDate: now,
    periodStart: Timestamp.fromDate(contractStartDate),
    periodEnd: Timestamp.fromDate(contractEndDate),
    entryType: "deferred_revenue",
    debitAccount: "1300 - Contract Asset",
    creditAccount: "2500 - Deferred Revenue",
    amount,
    currency: "BRL",
    exchangeRate: 1,
    description: `Receita diferida FORÇADA - Teste via callable`,
    referenceNumber: `DEF-FORCE-CALLABLE-${Date.now()}`,
    isPosted: false,
    createdAt: now,
  };

  try {
    console.log(`[forceCreateLedgerEntry] 📝 Criando entry...`);
    const docRef = await db.collection(collectionPath).add(forcedEntry);
    
    console.log(`[forceCreateLedgerEntry] ✅ Entry criado com ID: ${docRef.id}`);
    console.log(`[forceCreateLedgerEntry] ✅ Path completo: ${collectionPath}/${docRef.id}`);
    
    // Verificar se foi criado
    const verifyDoc = await docRef.get();
    if (verifyDoc.exists) {
      console.log(`[forceCreateLedgerEntry] ✅ Verificação: Entry existe no Firestore`);
      const data = verifyDoc.data();
      console.log(`[forceCreateLedgerEntry] Dados do entry:`, JSON.stringify(data, null, 2));
      
      // Verificar se pode ser lido pela query normal
      const querySnapshot = await db
        .collection(collectionPath)
        .where("contractId", "==", contractId)
        .get();
      console.log(`[forceCreateLedgerEntry] 📊 Query retorna ${querySnapshot.size} entries para contractId ${contractId}`);
      
      return {
        success: true,
        entryId: docRef.id,
        path: `${collectionPath}/${docRef.id}`,
        tenantId,
        contractId,
        queryResult: querySnapshot.size,
      };
    } else {
      console.error(`[forceCreateLedgerEntry] ❌ ERRO: Entry não foi encontrado após criação!`);
      return {
        success: false,
        error: "Entry não encontrado após criação",
      };
    }
  } catch (error: any) {
    console.error(`[forceCreateLedgerEntry] ❌ ERRO ao criar entry:`, error);
    console.error(`[forceCreateLedgerEntry] Stack:`, error.stack);
    throw new functions.https.HttpsError("internal", `Erro ao criar entry: ${error.message}`);
  }
});
