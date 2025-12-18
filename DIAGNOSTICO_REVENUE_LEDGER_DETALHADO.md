# 🔍 Diagnóstico Detalhado: Revenue Ledger Não Mostra Entries

## Data: 2025-01-XX

## ✅ Alterações Implementadas

### 1. Logs Detalhados Adicionados

**Frontend (`client/src/lib/firestore-service.ts`):**
- ✅ Logs em `revenueLedgerService.getAll()` - mostra path, resultados e erros
- ✅ Logs em `revenueLedgerService.getByContract()` - mostra path, resultados e erros
- ✅ Logs em `getCollection()` - mostra path, constraints, documentos encontrados e erros detalhados

**Frontend (`client/src/pages/revenue-ledger.tsx`):**
- ✅ Logs no estado da query (tenantId, loading, entries count, errors)
- ✅ Logs na função queryFn
- ✅ Alert de debug em desenvolvimento mostrando informações detalhadas
- ✅ Mensagens de erro melhoradas com stack trace e dicas

### 2. Tratamento de Erros Melhorado

- ✅ Erros agora mostram código do erro, mensagem e stack trace
- ✅ Dica sobre índices faltando quando o erro mencionar "index"
- ✅ Mensagem de empty state mais informativa

## 🔍 Como Diagnosticar o Problema

### Passo 1: Abrir Console do Navegador (F12)

1. Acesse: https://ifrs15-revenue-manager.web.app/revenue-ledger
2. Abra o Console (F12 > Console)
3. Procure por logs começando com:
   - `[revenue-ledger]`
   - `[revenueLedgerService.getAll]`
   - `[getCollection]`

### Passo 2: Verificar os Logs

**O que você deve ver:**

```
[revenue-ledger] Buscando ledger entries para tenant: default
[revenueLedgerService.getAll] Buscando ledger entries para tenant: default
[revenueLedgerService.getAll] Path da coleção: tenants/default/revenueLedgerEntries
[getCollection] Buscando na coleção: tenants/default/revenueLedgerEntries
[getCollection] Total de documentos encontrados: X
[revenueLedgerService.getAll] Entries encontrados: X
[revenue-ledger] Entries retornados: X
```

### Passo 3: Identificar o Problema

#### Cenário A: Query Retorna 0 Documentos (Sem Erro)

**Logs mostram:**
```
[getCollection] Total de documentos encontrados: 0
```

**Possíveis causas:**
1. **Nenhum entry foi criado ainda** - Execute o Motor IFRS 15 em um contrato
2. **Entries foram criados em outro tenant** - Verifique o tenantId correto
3. **Entries foram criados mas com tenantId diferente** - Verifique no Firestore Console

**Solução:**
- Execute o Motor IFRS 15 em um contrato que tenha Performance Obligations
- Verifique no Firestore Console: `tenants/{tenantId}/revenueLedgerEntries`

#### Cenário B: Erro de Índice

**Logs mostram:**
```
[getCollection] ERRO ao buscar coleção...
⚠️ ERRO DE ÍNDICE: A query requer um índice composto que pode não existir
```

**Solução:**
- O Firebase Console deve mostrar um link para criar o índice automaticamente
- OU verifique `firestore.indexes.json` e faça deploy dos índices:
  ```bash
  firebase deploy --only firestore:indexes
  ```

#### Cenário C: Erro de Permissão

**Logs mostram:**
```
[getCollection] ERRO: Missing or insufficient permissions
```

**Solução:**
- Verifique as regras do Firestore em `firestore.rules`
- Garanta que o usuário tem permissão para ler `revenueLedgerEntries`

#### Cenário D: Erro de Path/Collection

**Logs mostram:**
```
[getCollection] ERRO: Collection not found
```

**Solução:**
- Verifique se a coleção existe no Firestore
- Verifique se o tenantId está correto

### Passo 4: Verificar Firestore Console

1. Acesse: https://console.firebase.google.com/project/ifrs15-revenue-manager/firestore
2. Navegue para: `tenants/default/revenueLedgerEntries` (ou seu tenantId)
3. Verifique se há documentos

**Se NÃO houver documentos:**
- Execute o Motor IFRS 15 em um contrato
- Verifique logs do Motor no Firebase Console > Functions > Logs

**Se HOUVER documentos mas não aparecerem:**
- Verifique se o `tenantId` dos documentos corresponde ao do usuário
- Verifique se há erros na query (veja console do navegador)

### Passo 5: Verificar Logs do Motor IFRS 15

1. Acesse: https://console.firebase.google.com/project/ifrs15-revenue-manager/functions/logs
2. Filtre por: `runIFRS15Engine`
3. Procure por:
   ```
   [runIFRS15Engine] Chamando generateAutomaticJournalEntries
   [generateAutomaticJournalEntries] Iniciando para contrato...
   [generateAutomaticJournalEntries] effectiveDeferredRevenue: X
   [generateAutomaticJournalEntries] Criando entry de deferred_revenue
   [generateAutomaticJournalEntries] Entry criado com ID: XXX
   ```

**Se NÃO houver esses logs:**
- O Motor não está sendo executado
- OU o Motor está falhando antes de criar entries

**Se HOUVER esses logs mas entries não aparecerem:**
- Verifique se o `tenantId` usado no Motor corresponde ao do usuário
- Verifique se há erros após a criação do entry

## 🎯 Checklist de Verificação

- [ ] Console do navegador aberto (F12)
- [ ] Logs aparecem no console
- [ ] Verificou o tenantId nos logs
- [ ] Verificou o path da coleção nos logs
- [ ] Verificou se há erros nos logs
- [ ] Verificou Firestore Console para documentos
- [ ] Verificou logs do Motor IFRS 15
- [ ] Executou o Motor IFRS 15 em um contrato
- [ ] Contrato tem Performance Obligations com valores
- [ ] Contrato está com status "active"

## 🚨 Problemas Comuns e Soluções

### Problema 1: "Nenhum lançamento encontrado" mas Motor foi executado

**Causa provável:** Entries foram criados mas com tenantId diferente

**Solução:**
1. Verifique no Firestore Console qual tenantId foi usado
2. Verifique no console do navegador qual tenantId o usuário tem
3. Se diferentes, corrija o tenantId do usuário OU crie entries no tenant correto

### Problema 2: Erro "index required"

**Causa:** Falta índice composto no Firestore

**Solução:**
1. O Firebase Console deve mostrar um link para criar o índice
2. OU execute: `firebase deploy --only firestore:indexes`

### Problema 3: Motor executa mas não cria entries

**Causa provável:** 
- `effectiveDeferredRevenue = 0` (sem receita para diferir)
- `transactionPrice = 0` (contrato sem valor)
- Erro silencioso na criação

**Solução:**
1. Verifique logs do Motor para ver valores calculados
2. Garanta que o contrato tem `totalValue > 0`
3. Garanta que há Performance Obligations com `allocatedPrice > 0`

## 📊 Informações que os Logs Mostram

### No Console do Navegador:

```javascript
// Estado da query
[revenue-ledger] Estado da query: {
  tenantId: "default",
  isLoading: false,
  hasEntries: true/false,
  entriesCount: X,
  error: null/Error
}

// Busca de entries
[revenue-ledger] Buscando ledger entries para tenant: default
[revenueLedgerService.getAll] Buscando ledger entries para tenant: default
[revenueLedgerService.getAll] Path da coleção: tenants/default/revenueLedgerEntries
[getCollection] Buscando na coleção: tenants/default/revenueLedgerEntries
[getCollection] Documento encontrado: {id: "...", ...}
[getCollection] Total de documentos encontrados: X
[revenueLedgerService.getAll] Entries encontrados: X
[revenue-ledger] Entries retornados: X
```

### No Firebase Console (Functions Logs):

```javascript
[runIFRS15Engine] Chamando generateAutomaticJournalEntries para contrato XXX
[generateAutomaticJournalEntries] Iniciando para contrato XXX, tenant default
[generateAutomaticJournalEntries] transactionPrice: 12000
[generateAutomaticJournalEntries] totalRecognizedRevenue: 0
[generateAutomaticJournalEntries] effectiveDeferredRevenue: 12000
[generateAutomaticJournalEntries] Criando entry de deferred_revenue: {...}
[generateAutomaticJournalEntries] Entry criado com ID: ABC123
[generateAutomaticJournalEntries] ✅ Concluído com sucesso
```

## 🎯 Próximos Passos

1. **Acesse a página Revenue Ledger**
2. **Abra o Console (F12)**
3. **Copie TODOS os logs que aparecem**
4. **Compartilhe os logs para análise**

Os logs vão mostrar EXATAMENTE onde está o problema:
- Se a query está falhando
- Se não há documentos
- Se há erro de índice
- Se há erro de permissão
- Se o tenantId está errado
