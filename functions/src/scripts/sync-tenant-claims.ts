/**
 * Script para sincronizar tenantId dos usuários para custom claims
 * Execute: npx ts-node functions/src/scripts/sync-tenant-claims.ts
 */

import * as admin from "firebase-admin";
import { auth, db } from "../utils/admin";

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

async function syncTenantClaims() {
  console.log(`\n🔄 Sincronizando tenantIds para custom claims...\n`);

  const usersSnap = await db.collection("users").get();
  let updated = 0;
  let skipped = 0;

  console.log(`📊 Total de usuários encontrados: ${usersSnap.size}\n`);

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    const data = doc.data() as any;
    const tenantId = data?.tenantId || data?.tenant?.id;

    if (!tenantId) {
      console.log(`⏭️  Usuário ${uid}: sem tenantId, pulando...`);
      skipped++;
      continue;
    }

    try {
      const userRecord = await auth.getUser(uid);
      const currentClaims = userRecord.customClaims || {};

      if (currentClaims.tenantId !== tenantId) {
        await auth.setCustomUserClaims(uid, { ...currentClaims, tenantId });
        console.log(`✅ Usuário ${uid}: tenantId atualizado para "${tenantId}"`);
        updated++;
      } else {
        console.log(`✓ Usuário ${uid}: tenantId já está correto ("${tenantId}")`);
      }
    } catch (err: any) {
      console.error(`❌ Erro ao processar usuário ${uid}:`, err.message);
      skipped++;
    }
  }

  console.log(`\n📈 Resumo:`);
  console.log(`   ✅ Atualizados: ${updated}`);
  console.log(`   ⏭️  Pulados: ${skipped}`);
  console.log(`   📊 Total: ${usersSnap.size}\n`);

  process.exit(0);
}

syncTenantClaims().catch((error) => {
  console.error(`❌ ERRO:`, error);
  process.exit(1);
});
