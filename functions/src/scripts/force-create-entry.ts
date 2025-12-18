/**
 * Script para FORÇAR criação de um entry de teste diretamente no Firestore
 * Execute: npx ts-node functions/src/scripts/force-create-entry.ts
 */

import * as admin from "firebase-admin";
import { db, Timestamp } from "../utils/admin";
import { COLLECTIONS, tenantCollection } from "../utils/collections";

// Inicializar Firebase Admin (já deve estar inicializado se executado via functions)
if (!admin.apps.length) {
  admin.initializeApp();
}

async function forceCreateEntry() {
  const tenantId = "default";
  const contractId = "z840V7YEPSzYokxYR4tl"; // ID do contrato "21"
  const now = Timestamp.now();
  const contractStartDate = new Date("2025-06-17");
  const contractEndDate = new Date("2026-06-17");
  const transactionPrice = 25000;

  console.log(`\n🔧 FORÇANDO criação de entry de teste...\n`);
  console.log(`Tenant: ${tenantId}`);
  console.log(`Contract: ${contractId}`);
  console.log(`Transaction Price: ${transactionPrice}`);
  console.log(`Collection Path: ${tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)}\n`);

  const forcedEntry = {
    tenantId,
    contractId,
    entryDate: now,
    periodStart: Timestamp.fromDate(contractStartDate),
    periodEnd: Timestamp.fromDate(contractEndDate),
    entryType: "deferred_revenue",
    debitAccount: "1300 - Contract Asset",
    creditAccount: "2500 - Deferred Revenue",
    amount: transactionPrice,
    currency: "BRL",
    exchangeRate: 1,
    description: `Receita diferida FORÇADA - Script de teste`,
    referenceNumber: `DEF-FORCE-TEST-${Date.now()}`,
    isPosted: false,
    createdAt: now,
  };

  try {
    console.log(`📝 Criando entry...`);
    const docRef = await db
      .collection(tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES))
      .add(forcedEntry);
    
    console.log(`✅ Entry criado com sucesso!`);
    console.log(`   ID: ${docRef.id}`);
    console.log(`   Path completo: ${tenantCollection(tenantId, COLLECTIONS.REVENUE_LEDGER_ENTRIES)}/${docRef.id}\n`);
    
    // Verificar se foi criado
    const verifyDoc = await docRef.get();
    if (verifyDoc.exists) {
      console.log(`✅ Verificação: Entry existe no Firestore`);
      console.log(`   Dados:`, verifyDoc.data());
    } else {
      console.log(`❌ ERRO: Entry não foi encontrado após criação!`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error(`❌ ERRO ao criar entry:`, error);
    console.error(`Stack:`, error.stack);
    process.exit(1);
  }
}

forceCreateEntry();
