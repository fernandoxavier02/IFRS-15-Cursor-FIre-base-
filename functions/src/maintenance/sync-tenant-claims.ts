import * as functions from "firebase-functions";
import admin, { db } from "../utils/admin";

/**
 * Callable: sincroniza o tenantId dos usuários a partir do documento `users/{uid}` para os custom claims do Firebase Auth.
 * Útil quando o claim não foi populado e o front/backend dependem dele.
 */
export const syncTenantClaims = functions.https.onCall(async (_data, context) => {
  console.log(`[syncTenantClaims] 🔄 Iniciando sincronização de tenantIds...`);
  
  if (!context.auth) {
    console.error(`[syncTenantClaims] ❌ Usuário não autenticado`);
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  console.log(`[syncTenantClaims] 👤 Usuário autenticado: ${context.auth.uid}`);

  const auth = admin.auth();
  const usersSnap = await db.collection("users").get();

  console.log(`[syncTenantClaims] 📊 Total de usuários encontrados: ${usersSnap.size}`);

  let updated = 0;
  let skipped = 0;

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    const data = doc.data() as any;
    const tenantId = data?.tenantId || data?.tenant?.id;

    if (!tenantId) {
      console.log(`[syncTenantClaims] ⏭️  Usuário ${uid}: sem tenantId, pulando...`);
      skipped++;
      continue;
    }

    try {
      const userRecord = await auth.getUser(uid);
      const currentClaims = userRecord.customClaims || {};

      console.log(`[syncTenantClaims] 🔍 Usuário ${uid}: tenantId no doc="${tenantId}", tenantId no claim="${currentClaims.tenantId || 'não definido'}"`);

      if (currentClaims.tenantId !== tenantId) {
        console.log(`[syncTenantClaims] ✏️  Atualizando claim do usuário ${uid} de "${currentClaims.tenantId || 'não definido'}" para "${tenantId}"`);
        await auth.setCustomUserClaims(uid, { ...currentClaims, tenantId });
        console.log(`[syncTenantClaims] ✅ Usuário ${uid}: claim atualizado com sucesso`);
        updated++;
      } else {
        console.log(`[syncTenantClaims] ✓ Usuário ${uid}: claim já está correto`);
      }
    } catch (err: any) {
      console.error(`[syncTenantClaims] ❌ Erro ao processar usuário ${uid}:`, err.message);
      console.error(`[syncTenantClaims] Stack:`, err.stack);
      skipped++;
    }
  }

  const result = { updated, skipped, total: usersSnap.size };
  console.log(`[syncTenantClaims] 📈 Resultado final:`, result);
  
  return result;
});
