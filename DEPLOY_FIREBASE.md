# Deploy Firebase - Atualizações Necessárias

**Data**: Dezembro 2024  
**Objetivo**: Aplicar alterações recentes que requerem atualização no Firebase

---

## 📋 Alterações Realizadas no Código

### 1. Novos Serviços Firestore
- ✅ `consolidatedBalanceService` - Criado em `client/src/lib/firestore-service.ts`
  - `getAll()` - Busca todos os balances
  - `getByPeriod()` - Busca por intervalo de datas
  - `getLatest()` - Busca o mais recente

### 2. Dashboards com Dados Reais
- ✅ **Executive Dashboard**: Revenue trend agora usa `revenueLedgerService.getAll()`
- ✅ **Revenue Waterfall**: Agora usa `consolidatedBalanceService` em vez de dados mockados

### 3. Configuração Storage
- ✅ Bucket alterado de `firebasestorage.app` para `appspot.com`

---

## 🔥 O Que Precisa Ser Deployado no Firebase

### 1. Firestore Rules ✅ (Já Configurado)
As regras já estão corretas:
- `consolidatedBalances` - Linha 176-179: `allow read` para tenant, `allow write` para admin/finance
- `revenueLedgerEntries` - Linha 150-155: `allow read` para tenant, `allow write` para admin/finance

**Ação**: Nenhuma alteração necessária nas regras.

### 2. Firestore Indexes ⚠️ (NOVOS ÍNDICES ADICIONADOS)
Adicionados novos índices em `firestore.indexes.json`:

#### Índice 1: Consolidated Balances por Período (ASCENDING)
```json
{
  "collectionGroup": "consolidatedBalances",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "periodDate", "order": "ASCENDING" }
  ]
}
```
**Uso**: Query `getByPeriod()` que filtra por range de datas e ordena ASCENDING.

#### Índice 2: Revenue Ledger Entries por Data (ASCENDING)
```json
{
  "collectionGroup": "revenueLedgerEntries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "entryDate", "order": "ASCENDING" }
  ]
}
```
**Uso**: Query de revenue trend no executive dashboard que agrupa por mês.

**Ação**: Deploy dos índices:
```bash
firebase deploy --only firestore:indexes
```

**Nota**: Os índices podem levar alguns minutos para serem criados. O Firebase mostrará um link para acompanhar o progresso.

### 3. Storage Bucket ✅ (Apenas Configuração Local)
A alteração do bucket é apenas no código cliente (`client/src/lib/firebase.ts`).  
**Ação**: Nenhum deploy necessário, mas verifique se o bucket `ifrs15-revenue-manager.appspot.com` existe no projeto Firebase.

Para verificar:
```bash
firebase storage:get
```

### 4. Cloud Functions ✅ (Nenhuma Alteração)
Nenhuma alteração nas Functions foi necessária. As Functions existentes já suportam:
- `generateContractBalancesReport` - Usado por `reportsService`
- `runIFRS15Engine` - Já existente e funcionando

**Ação**: Nenhuma alteração necessária.

---

## 🚀 Comandos de Deploy

### Deploy Completo (Recomendado)
```bash
# 1. Build do frontend
npm run build

# 2. Deploy de tudo (hosting + functions + firestore indexes)
firebase deploy
```

### Deploy Apenas dos Índices (Se já fez deploy do código)
```bash
firebase deploy --only firestore:indexes
```

### Deploy Apenas do Hosting (Se já fez deploy dos índices)
```bash
npm run build
firebase deploy --only hosting
```

---

## ✅ Checklist Pós-Deploy

Após o deploy, verifique:

- [ ] **Índices criados**: Acesse Firebase Console → Firestore → Indexes e confirme que os novos índices estão "Enabled"
- [ ] **Regras aplicadas**: Teste leitura/escrita de `consolidatedBalances` e `revenueLedgerEntries`
- [ ] **Executive Dashboard**: Abra a página e verifique se o revenue trend carrega sem erros
- [ ] **Revenue Waterfall**: Abra a página e verifique se os dados consolidados aparecem (ou estado vazio se não houver dados)
- [ ] **Storage Bucket**: Se usar Storage, verifique se o bucket `appspot.com` está acessível

---

## 🔍 Verificação de Índices

Se os índices ainda estiverem sendo criados, você verá erros como:
```
The query requires an index. You can create it here: [link]
```

Nesse caso:
1. Clique no link fornecido pelo Firebase
2. Ou aguarde alguns minutos e tente novamente
3. Ou verifique o status em: Firebase Console → Firestore → Indexes

---

## 📝 Notas Importantes

1. **Índices Compostos**: Os novos índices são necessários para queries com `where` + `orderBy` em campos diferentes
2. **Performance**: Os índices melhoram a performance das queries de período
3. **Custo**: Índices não têm custo adicional, mas queries mais rápidas reduzem custos de leitura

---

**Última atualização**: Dezembro 2024
