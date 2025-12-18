# Diagnóstico: Ledger Entries Não Aparecem

## Data: 2025-01-XX

## Status do Deploy
✅ **Functions deployadas** com correção de fallback para `currentVersionId`
✅ **Hosting deployado** com logs de debug

## Verificação dos Contratos

### Contrato 1: `4f2VgSOAEqJMc8okDgUo`
- ✅ **currentVersionId**: `blghgIOcVQjNEVn8IUpb` (PRESENTE)
- ✅ **Versão existe**: Sim (versionNumber: 1)
- ✅ **Status**: `draft`
- ✅ **Valor**: BRL 12.000,00
- ✅ **Período**: 2025-12-01 a 2026-12-01

### Contrato 2: `oG0RA4FaK9qH7jBNswC8`
- ✅ **currentVersionId**: `E2jYDz5xtBgmgNhecrYk` (PRESENTE)
- ✅ **Versão existe**: Sim (versionNumber: 1)
- ✅ **Status**: `draft`
- ✅ **Valor**: BRL 12.000,00
- ✅ **Período**: 2025-12-01 a 2026-12-01

## Problemas Identificados

### 1. Contratos em Status "Draft"
- **Impacto**: Billing schedules não são gerados automaticamente para contratos em Draft
- **Solução**: Mudar status para `active` OU criar billing schedules manualmente

### 2. Performance Obligations (POs)
- **Verificação necessária**: Confirmar se há POs criadas nas versões
- **Verificação necessária**: Confirmar se POs têm `allocatedPrice` e datas (`startDate`/`endDate` ou `dueDate`)
- **Impacto**: Motor IFRS 15 precisa de POs com valores para calcular receita

### 3. Billing Schedules
- **Verificação necessária**: Confirmar se há billing schedules criados
- **Impacto**: Sem billing schedules, não há como marcar como "invoiced/paid" para gerar AR via trigger

## Ações Necessárias

### A) Verificar Performance Obligations

**No Firebase Console:**
1. Acesse: `tenants/default/contracts/4f2VgSOAEqJMc8okDgUo/versions/blghgIOcVQjNEVn8IUpb/performanceObligations`
2. Verifique se há documentos
3. Para cada PO, confirme:
   - ✅ `allocatedPrice` > 0
   - ✅ `recognitionMethod` definido
   - ✅ Se `point_in_time`: `dueDate` presente
   - ✅ Se `over_time`: `startDate`, `endDate` e `frequency` presentes

**Se não houver POs:**
- Criar pelo menos 1 PO na interface do contrato
- Definir `allocatedPrice` (soma ≤ totalValue do contrato)
- Definir método de reconhecimento e datas

### B) Verificar Billing Schedules

**No Firebase Console:**
1. Acesse: `tenants/default/billingSchedules`
2. Filtre por `contractId == 4f2VgSOAEqJMc8okDgUo` ou `oG0RA4FaK9qH7jBNswC8`
3. Verifique se há documentos

**Se não houver billing schedules:**
- POs devem ser criadas primeiro (geram billing schedules automaticamente)
- OU criar manualmente via interface

### C) Executar Motor IFRS 15

**Após garantir POs com valores:**
1. Acesse a página do contrato
2. Vá para aba "Ledger"
3. Clique em "Executar Motor IFRS 15"
4. Verifique logs no console do navegador (F12)
5. Verifique logs no Firebase Console > Functions > runIFRS15Engine

**O que o Motor deve gerar:**
- Se `transactionPrice > 0` e `totalRecognizedRevenue = 0`:
  - ✅ Entry de **Deferred Revenue** (Receita Diferida)
  - Débito: Contract Asset (1300) ou AR (1200)
  - Crédito: Deferred Revenue (2500)

### D) Verificar Ledger Entries Gerados

**No Firebase Console:**
1. Acesse: `tenants/default/revenueLedgerEntries`
2. Filtre por `contractId == 4f2VgSOAEqJMc8okDgUo` ou `oG0RA4FaK9qH7jBNswC8`
3. Verifique se há documentos criados

**Se não houver entries:**
- Verificar logs do Motor IFRS 15 no Firebase Console
- Verificar se `effectiveDeferredRevenue > 0` nos logs
- Verificar se não há erros na criação dos entries

## Checklist de Diagnóstico

- [ ] Contrato tem `currentVersionId` definido ✅
- [ ] Versão do contrato existe ✅
- [ ] Há Performance Obligations criadas?
- [ ] POs têm `allocatedPrice` > 0?
- [ ] POs têm datas configuradas (startDate/endDate ou dueDate)?
- [ ] Há billing schedules criados?
- [ ] Motor IFRS 15 foi executado?
- [ ] Logs do Motor mostram `effectiveDeferredRevenue > 0`?
- [ ] Logs do Motor mostram criação de entries?
- [ ] Há entries em `revenueLedgerEntries` no Firestore?

## Próximos Passos

1. **Verificar POs**: Confirmar se há POs com valores nas versões dos contratos
2. **Criar POs se necessário**: Adicionar pelo menos 1 PO com `allocatedPrice` e datas
3. **Executar Motor**: Rodar o Motor IFRS 15 e verificar logs
4. **Verificar Entries**: Confirmar se entries foram criados no Firestore
5. **Se ainda não aparecer**: Verificar logs detalhados do Motor no Firebase Console

## Logs para Verificar

### No Console do Navegador (F12):
```
[contract-details] Buscando ledger entries para contrato
[contract-details] Ledger entries encontrados: X
```

### No Firebase Console > Functions > Logs:
```
[runIFRS15Engine] Chamando generateAutomaticJournalEntries
[generateAutomaticJournalEntries] Iniciando para contrato...
[generateAutomaticJournalEntries] transactionPrice: X
[generateAutomaticJournalEntries] effectiveDeferredRevenue: X
[generateAutomaticJournalEntries] Criando entry de deferred_revenue
[generateAutomaticJournalEntries] Entry criado com ID: XXX
[generateAutomaticJournalEntries] ✅ Concluído com sucesso
```

## Notas Importantes

1. **Contratos em Draft**: Billing schedules não são gerados automaticamente. POs geram billing schedules, mas apenas quando o contrato está `active` ou quando POs são criadas manualmente.

2. **Motor IFRS 15**: Gera entries mesmo sem billing schedules, desde que:
   - Haja versão do contrato ✅
   - Haja POs com `allocatedPrice` > 0
   - `transactionPrice` > 0

3. **Receita Diferida**: O Motor agora gera automaticamente quando:
   - `transactionPrice > 0`
   - `totalRecognizedRevenue = 0`
   - Isso cria um entry de Deferred Revenue mesmo sem billing
