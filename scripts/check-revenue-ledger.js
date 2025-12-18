// Script para verificar se há documentos na coleção revenueLedgerEntries
const admin = require("firebase-admin");
const path = require("path");

// Inicializar Firebase Admin
const serviceAccountPath = path.join(__dirname, "../functions/.env.json");
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkRevenueLedgerEntries() {
  const tenantId = "default";
  const collectionPath = `tenants/${tenantId}/revenueLedgerEntries`;
  
  console.log(`\n🔍 Verificando coleção: ${collectionPath}\n`);
  
  try {
    const snapshot = await db.collection(collectionPath).get();
    
    console.log(`📊 Total de documentos encontrados: ${snapshot.size}\n`);
    
    if (snapshot.empty) {
      console.log("❌ A coleção está VAZIA. Não há lançamentos contábeis.\n");
      console.log("💡 Para gerar lançamentos:");
      console.log("   1. Execute o Motor IFRS 15 em um contrato");
      console.log("   2. Marque billing schedules como 'invoiced'");
      console.log("   3. Marque Performance Obligations como 'satisfied'\n");
    } else {
      console.log("✅ Documentos encontrados:\n");
      snapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   Tipo: ${data.entryType || "N/A"}`);
        console.log(`   Contrato: ${data.contractId || "N/A"}`);
        console.log(`   Valor: ${data.amount || 0} ${data.currency || ""}`);
        console.log(`   Data: ${data.entryDate?.toDate?.() || "N/A"}`);
        console.log(`   Postado: ${data.isPosted ? "Sim" : "Não"}`);
        console.log("");
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao verificar coleção:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

checkRevenueLedgerEntries();
