# Correção: AR Duplicado - Análise e Solução

## Problema Identificado

**Situação relatada:**
- Contrato com vigência de jan/2025 a dez/2025 (12 meses)
- Em 31/12/2025, mostrava **R$12.333,37 de AR pendente**
- Esperado: apenas 1 mês de recebimento pendente

**Causa raiz:**
Duplicação de entries de AR causada por duas funções criando entries:

1. **Ledger V2** (`generateRevenueLedgerV2ForContract`):
   - Cria entries individuais de AR para cada billing
   - Para cada billing com status "invoiced": `Dr AR / Cr Contract Asset` ou `Dr AR / Cr Contract Liability`
   - Para cada cash: `Dr Cash / Cr AR` (baixa AR)

2. **Função Legacy** (`generateAutomaticJournalEntries`):
   - Criava entry agregado de AR: `Dr AR / Cr Revenue` com valor `totalBilled - totalCashReceived`
   - Isso duplicava os entries individuais já criados pelo Ledger V2

## Exemplo do Problema

**Cenário:**
- Contrato de 12 meses, R$12.000 total
- 12 billings mensais de R$1.000 cada, todos com status "invoiced"
- Nenhum pagamento recebido ainda

**O que acontecia:**

1. **Ledger V2 criava 12 entries individuais:**
   - Billing 1: `Dr AR R$1.000 / Cr Contract Liability R$1.000`
   - Billing 2: `Dr AR R$1.000 / Cr Contract Liability R$1.000`
   - ... (até billing 12)
   - **Total AR criado pelo Ledger V2: R$12.000**

2. **Função Legacy criava 1 entry agregado:**
   - `Dr AR R$12.000 / Cr Revenue R$12.000`
   - **Total AR criado pela função legacy: R$12.000**

3. **Resultado:**
   - **AR total no sistema: R$24.000** (duplicado!)
   - Mas apenas R$12.000 foi realmente faturado
   - O sistema mostrava AR incorreto

## Correção Implementada

### Mudança #1: Desabilitada criação de AR na função legacy

**Arquivo:** `functions/src/ifrs15/engine.ts` linha 253-263

**Antes:**
```typescript
const accountsReceivable = totalBilled - totalCashReceived;
if (accountsReceivable > 0) {
  // Criava entry agregado de AR
  await ledgerCollection.add({
    debitAccount: "1200 - Accounts Receivable (AR)",
    creditAccount: "4000 - Revenue",
    amount: accountsReceivable,
    // ...
  });
}
```

**Depois:**
```typescript
// DESABILITADO - Entries de AR são criados pelo Ledger V2 baseado em eventos individuais
// Criar entry agregado aqui causaria DUPLICAÇÃO dos entries individuais já criados pelo Ledger V2
console.log(`[generateAutomaticJournalEntries] ⚠️ Esta função é LEGACY - entries de AR são criados pelo Ledger V2`);
console.log(`[generateAutomaticJournalEntries] Pulando criação de AR agregado`);
```

### Mudança #2: Desabilitada criação de Revenue na função legacy

**Arquivo:** `functions/src/ifrs15/engine.ts` linha 265-272

**Motivo:** Revenue também estava sendo criado duplicado (mesmo problema)

**Depois:**
```typescript
// DESABILITADO - Entries de Revenue são criados pelo Ledger V2 baseado em revenue recognition events
// Criar entry agregado aqui causaria DUPLICAÇÃO dos entries individuais já criados pelo Ledger V2
console.log(`[generateAutomaticJournalEntries] ⚠️ Esta função é LEGACY - entries de Revenue são criados pelo Ledger V2`);
```

### Mudança #3: Desabilitada criação de Contract Asset na função legacy

**Arquivo:** `functions/src/ifrs15/engine.ts` linha 352-389

**Problema:** Criava entry agregado `Dr Contract Asset / Cr Revenue` que duplicava entries individuais do Ledger V2

**Antes:**
```typescript
if (ifrs15Result.contractAsset > 0) {
  await ledgerCollection.add({
    debitAccount: "1300 - Contract Asset",
    creditAccount: "4000 - Revenue",
    amount: ifrs15Result.contractAsset,
    // ...
  });
}
```

**Depois:**
```typescript
// DESABILITADO - Entries de Contract Asset são criados pelo Ledger V2 baseado em revenue recognition events
// Criar entry agregado aqui causaria DUPLICAÇÃO dos entries individuais já criados pelo Ledger V2
console.log(`[generateAutomaticJournalEntries] ⚠️ Esta função é LEGACY - entries de Contract Asset são criados pelo Ledger V2`);
```

### Mudança #4: Desabilitada criação de Contract Liability na função legacy

**Arquivo:** `functions/src/ifrs15/engine.ts` linha 391-428

**Problema:** Criava entry agregado `Dr Revenue / Cr Contract Liability` que duplicava entries individuais do Ledger V2

**Antes:**
```typescript
if (ifrs15Result.contractLiability > 0) {
  await ledgerCollection.add({
    debitAccount: "4000 - Revenue",
    creditAccount: "2600 - Contract Liability",
    amount: ifrs15Result.contractLiability,
    // ...
  });
}
```

**Depois:**
```typescript
// DESABILITADO - Entries de Contract Liability são criados pelo Ledger V2 baseado em billing/payment events
// Criar entry agregado aqui causaria DUPLICAÇÃO dos entries individuais já criados pelo Ledger V2
console.log(`[generateAutomaticJournalEntries] ⚠️ Esta função é LEGACY - entries de Contract Liability são criados pelo Ledger V2`);
```

## Como Funciona Agora (Correto)

### Ledger V2 (Única fonte de entries)

**Processamento por eventos individuais:**

1. **Billing Event (Invoice):**
   - Se há Contract Asset antes: `Dr AR / Cr Contract Asset` (reclassificação)
   - Se não há: `Dr AR / Cr Contract Liability` (cria passivo)

2. **Cash Event (Payment):**
   - `Dr Cash / Cr AR` (baixa AR)
   - Se há excesso: `Dr Cash / Cr Contract Liability`

3. **Revenue Recognition Event:**
   - Se há Contract Liability: `Dr Contract Liability / Cr Revenue`
   - Se não há: `Dr Contract Asset / Cr Revenue`

**Resultado:**
- Entries criados baseados em eventos reais
- Sem duplicação
- AR calculado corretamente: `BilledToDate - CashToDate`

## Próximos Passos

### 1. Limpar dados incorretos existentes

**Opção A: Apagar todos os entries e recalcular**
- Usar botão "🗑️ Apagar Todos os Lançamentos" na página Revenue Ledger
- Executar Motor IFRS 15 novamente em cada contrato
- Entries serão criados corretamente pelo Ledger V2

**Opção B: Apagar apenas entries duplicados**
- Identificar entries com `referenceNumber` começando com "AR-AUTO" ou "REV-AUTO"
- Estes são os entries agregados incorretos criados pela função legacy
- Apagar apenas estes entries

### 2. Validar após correção

**Verificar:**
- AR deve ser igual a: Total faturado - Total recebido
- Para contrato de 12 meses sem pagamentos: AR = valor de 1 billing (último mês)
- Não deve haver entries duplicados

## Conformidade IFRS 15

✅ **Correto:** Entries são criados baseados em eventos individuais (billing, payment, performance)
✅ **Correto:** AR reflete apenas o que foi realmente faturado e não recebido
✅ **Correto:** Sem duplicação de entries

## Arquivos Modificados

1. `functions/src/ifrs15/engine.ts`
   - ✅ Desabilitada criação de AR agregado (linha 253-263)
   - ✅ Desabilitada criação de Revenue agregado (linha 265-272)
   - ✅ Desabilitada criação de Contract Asset agregado (linha 352-389)
   - ✅ Desabilitada criação de Contract Liability agregado (linha 391-428)
   - ✅ Desabilitada criação de Deferred Revenue agregado (já estava desabilitado anteriormente)
   - Adicionados logs explicativos para cada seção desabilitada

## Deploy

Após build bem-sucedido, fazer deploy:
```bash
firebase deploy --only functions
```

## Nota Importante

A função `generateAutomaticJournalEntries` agora está **completamente desabilitada** para criação de entries principais:
- ✅ AR (Accounts Receivable)
- ✅ Revenue (Receita)
- ✅ Deferred Revenue (Receita Diferida)
- ✅ Contract Asset
- ✅ Contract Liability

**Ela ainda pode criar:**
- Custos amortizados (`commission_expense`) - linha 298-350
- Financing Income - linha 430-471

**Recomendação:** Considerar remover completamente esta função legacy no futuro, deixando apenas o Ledger V2 como fonte única de entries. Se custos e financing income precisarem ser criados, devem ser movidos para o Ledger V2 ou para funções específicas dedicadas.
