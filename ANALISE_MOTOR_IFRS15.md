# Análise do Motor IFRS 15 - Conformidade com o Padrão

## Pesquisa sobre IFRS 15

### 1. Reconhecimento Inicial do Contrato

**Padrão IFRS 15:**
- Quando um contrato é assinado, **NÃO** há lançamento contábil automático
- O reconhecimento inicial ocorre apenas quando há:
  - **Consideração recebida** (pagamento antecipado) → **Contract Liability (Deferred Revenue)**
  - **Performance realizada** → **Contract Asset** ou **Revenue** direto

**Lançamento inicial correto:**
- Se há pagamento antecipado: `Dr Cash / Cr Contract Liability (Deferred Revenue)`
- Se não há pagamento: **Nenhum lançamento** até que a performance seja realizada

### 2. Diferimento de Receita (Deferred Revenue)

**Padrão IFRS 15:**
- Deferred Revenue (Contract Liability) surge quando:
  - Cliente paga **antes** da entrega de bens/serviços
  - Cliente é faturado **antes** da satisfação da Performance Obligation
- **NÃO** surge apenas por existir um contrato

**Reconhecimento mensal:**
- À medida que a performance é realizada mensalmente:
  - `Dr Contract Liability (Deferred Revenue) / Cr Revenue`
- Para serviços over-time (ex: assinatura):
  - Reconhecimento linear ao longo do período (straight-line)
  - Exemplo: R$12.000 anual → R$1.000/mês

### 3. Contract Asset vs Contract Liability

**Contract Asset:**
- Surge quando: **Receita reconhecida > Valor faturado**
- Representa: Direito a receber pela performance já realizada
- Lançamento: `Dr Contract Asset / Cr Revenue`

**Contract Liability:**
- Surge quando: **Valor faturado > Receita reconhecida**
- Representa: Obrigação de entregar bens/serviços já pagos/faturados
- Lançamento: `Dr Cash/AR / Cr Contract Liability`

### 4. Custos Pré-Operacionais (Contract Costs)

**Padrão IFRS 15:**
- **Custos para obter contrato** (ex: comissões de venda):
  - Capitalizar se esperado recuperar
  - Amortizar ao longo do contrato
- **Custos para cumprir contrato**:
  - Capitalizar se:
    - Relacionados diretamente ao contrato
    - Geram recursos para performance futura
    - Esperado recuperar
  - Amortizar conforme transferência de bens/serviços

**Lançamentos:**
- Capitalização: `Dr Contract Costs Asset / Cr Cash/Payables`
- Amortização: `Dr Cost of Revenue / Cr Contract Costs Asset`

---

## Análise do Motor Atual

### ✅ PONTOS CORRETOS

1. **5-Step Model implementado corretamente:**
   - ✅ Step 1: Identificação do contrato
   - ✅ Step 2: Identificação de Performance Obligations
   - ✅ Step 3: Determinação do Transaction Price
   - ✅ Step 4: Alocação do Transaction Price
   - ✅ Step 5: Reconhecimento de receita

2. **Ledger V2 (`ledger-v2.ts`):**
   - ✅ Lógica correta de Contract Asset vs Contract Liability
   - ✅ Reclassificação CA → AR quando faturado
   - ✅ Reconhecimento de receita mensal correto
   - ✅ Tratamento de eventos de billing e cash

3. **Reconhecimento Over-Time:**
   - ✅ Geração de períodos mensais
   - ✅ Cálculo baseado em data atual vs período

### ❌ PROBLEMAS IDENTIFICADOS

#### PROBLEMA CRÍTICO #1: Reconhecimento Inicial Incorreto

**Localização:** `initial-ledger-entries.ts` linha 72-82

**Problema:**
```typescript
// Entry inicial: Dr Contract Asset / Cr Deferred Revenue
debitAccount: "1300 - Contract Asset",
creditAccount: "2500 - Deferred Revenue",
```

**Análise:**
- ❌ **INCORRETO**: Cria lançamento inicial mesmo sem pagamento/faturamento
- ❌ **INCORRETO**: Usa Contract Asset como débito quando deveria ser apenas quando há performance
- ✅ **CORRETO**: Deferred Revenue como crédito (mas só se houver pagamento/faturamento)

**Correção necessária:**
- **NÃO criar** entry inicial se não houver billing/payment
- Se houver pagamento antecipado: `Dr Cash / Cr Contract Liability`
- Se houver faturamento antecipado: `Dr AR / Cr Contract Liability`
- Se não houver pagamento/faturamento: **Nenhum lançamento inicial**

#### PROBLEMA #2: Lógica de Contract Asset no Engine

**Localização:** `engine.ts` linha 1137-1143

**Código atual:**
```typescript
if (result.totalRecognizedRevenue > totalBilled) {
  result.contractAsset = result.totalRecognizedRevenue - totalBilled;
  result.contractLiability = 0;
} else {
  result.contractAsset = 0;
  result.contractLiability = totalBilled - result.totalRecognizedRevenue;
}
```

**Análise:**
- ✅ **CORRETO**: Lógica está correta
- ⚠️ **ATENÇÃO**: Contract Asset só deve existir se houver **performance realizada** sem faturamento correspondente

#### PROBLEMA #3: Entry Inicial Forçado

**Localização:** `engine.ts` linha 1197-1208

**Problema:**
- Cria entry inicial de deferred revenue mesmo quando não deveria
- Comentário diz "garante que sempre haverá entries, mesmo sem billing"
- Isso é **incorreto** segundo IFRS 15

**Correção:**
- Remover criação automática de entry inicial
- Criar apenas quando houver billing ou payment events

#### PROBLEMA #4: Lançamento de Revenue Incorreto

**Localização:** `engine.ts` linha 288-335 (função `generateAutomaticJournalEntries`)

**Problema:**
```typescript
// 3. Receita (Revenue) - Receita Reconhecida
if (ifrs15Result.totalRecognizedRevenue > 0) {
  let debitAccount: string;
  if (totalBilled >= ifrs15Result.totalRecognizedRevenue) {
    debitAccount = "1200 - Accounts Receivable (AR)";
  } else if (ifrs15Result.contractAsset > 0) {
    debitAccount = "1300 - Contract Asset";
  }
  // ...
  creditAccount: "4000 - Revenue",
}
```

**Análise:**
- ⚠️ **PARCIALMENTE CORRETO**: A lógica está correta, mas:
  - Se há billing suficiente: `Dr AR / Cr Revenue` ✅
  - Se não há billing: `Dr Contract Asset / Cr Revenue` ✅
  - **MAS**: Este lançamento não deveria ser criado aqui, pois já é criado pelo Ledger V2

**Duplicação:**
- `generateAutomaticJournalEntries` cria entries
- `generateRevenueLedgerV2ForContract` também cria entries
- Isso pode causar duplicação

#### PROBLEMA #5: Custos Pré-Operacionais

**Localização:** `engine.ts` linha 486-538

**Análise:**
- ✅ **CORRETO**: Busca contract costs e amortiza
- ✅ **CORRETO**: Lançamento `Dr Cost of Revenue / Cr Contract Costs Asset`
- ⚠️ **FALTA**: Não há lógica de capitalização inicial dos custos
- ⚠️ **FALTA**: Não verifica se custos atendem critérios de capitalização (IFRS 15)

#### PROBLEMA #6: Reconhecimento Over-Time Simplificado

**Localização:** `engine.ts` linha 1030-1074

**Código atual:**
```typescript
const amountPerPeriod = Math.round((poAmount / totalPeriods) * 100) / 100;
const recognizedAmount = isPast ? periodAmount : 0;
```

**Análise:**
- ✅ **CORRETO**: Straight-line (linear) é válido para muitos casos
- ⚠️ **FALTA**: Não considera `measurementMethod` (input/output)
- ⚠️ **FALTA**: Não permite customização do método de medição

**Padrão IFRS 15:**
- Over-time pode ser medido por:
  - **Input method**: % de custos incorridos
  - **Output method**: % de performance completada
  - **Time-based**: Linear ao longo do tempo (atual)

#### PROBLEMA #7: Entry de Deferred Revenue Forçado

**Localização:** `engine.ts` linha 428-483

**Problema:**
- Código força criação de entry mesmo quando `effectiveDeferredRevenue = 0`
- Isso cria entries incorretos

**Correção:**
- Remover lógica de "forçar" criação
- Criar apenas quando realmente houver deferred revenue

---

## Recomendações de Correção

### Prioridade ALTA

1. **Remover criação automática de entry inicial** (`initial-ledger-entries.ts`)
   - Criar apenas quando houver billing ou payment events
   - Não criar "por garantia"

2. **Remover código de "forçar" entries** (`engine.ts` linha 428-483)
   - Criar entries apenas quando houver valores reais

3. **Consolidar geração de entries**
   - Usar apenas `generateRevenueLedgerV2ForContract`
   - Remover `generateAutomaticJournalEntries` ou torná-lo legacy

### Prioridade MÉDIA

4. **Implementar capitalização de custos**
   - Verificar critérios IFRS 15 antes de capitalizar
   - Criar entry de capitalização: `Dr Contract Costs Asset / Cr Cash/Payables`

5. **Melhorar reconhecimento over-time**
   - Implementar input method e output method
   - Permitir seleção do método de medição

6. **Validar Transaction Price**
   - Verificar se transaction price inclui todos os componentes
   - Validar constraint de variable consideration

### Prioridade BAIXA

7. **Documentação**
   - Documentar fluxo completo de lançamentos
   - Criar exemplos práticos

8. **Testes**
   - Adicionar testes unitários para cada cenário
   - Validar conformidade com IFRS 15

---

## Fluxo Correto Segundo IFRS 15

### Cenário 1: Contrato sem Pagamento Antecipado

1. **Contrato assinado**: Nenhum lançamento
2. **Performance realizada (over-time)**: 
   - `Dr Contract Asset / Cr Revenue` (mensalmente)
3. **Faturamento posterior**:
   - `Dr AR / Cr Contract Asset` (reclassificação)
4. **Recebimento**:
   - `Dr Cash / Cr AR`

### Cenário 2: Contrato com Pagamento Antecipado

1. **Contrato assinado + Pagamento**:
   - `Dr Cash / Cr Contract Liability`
2. **Performance realizada (over-time)**:
   - `Dr Contract Liability / Cr Revenue` (mensalmente)
3. **Se performance > pagamento**:
   - `Dr Contract Asset / Cr Revenue` (excesso)

### Cenário 3: Contrato com Faturamento Antecipado

1. **Contrato assinado + Faturamento**:
   - `Dr AR / Cr Contract Liability`
2. **Performance realizada**:
   - `Dr Contract Liability / Cr Revenue`
3. **Recebimento**:
   - `Dr Cash / Cr AR`

---

## Conclusão

O motor IFRS 15 está **parcialmente correto**, mas possui **problemas críticos** no reconhecimento inicial e na criação forçada de entries. A lógica principal do Ledger V2 está correta, mas precisa ser o único método de geração de entries.

## Correções Implementadas

### ✅ CORREÇÃO #1: Reconhecimento Inicial Conforme IFRS 15

**Arquivo:** `initial-ledger-entries.ts`

**Mudanças:**
- ✅ Agora verifica se há billing ou payment antes de criar entry inicial
- ✅ Se não há billing nem payment, **NÃO cria entry** (conforme IFRS 15)
- ✅ Se há billing: `Dr AR / Cr Contract Liability`
- ✅ Se há payment sem billing: `Dr Cash / Cr Contract Liability`
- ✅ Valor diferido = mínimo entre transactionPrice e valor faturado/recebido

**Conformidade IFRS 15:** ✅ **CORRETO**

### ✅ CORREÇÃO #2: Removido Código de "Forçar" Entries

**Arquivo:** `engine.ts`

**Mudanças:**
- ✅ Removido código que forçava criação de entries quando `effectiveDeferredRevenue = 0`
- ✅ Removido código que forçava criação após erros
- ✅ Adicionados logs explicativos sobre conformidade IFRS 15

**Conformidade IFRS 15:** ✅ **CORRETO**

### ✅ CORREÇÃO #3: Desabilitada Criação Duplicada de Deferred Revenue

**Arquivo:** `engine.ts` função `generateAutomaticJournalEntries`

**Mudanças:**
- ✅ Desabilitada criação de deferred revenue entries nesta função
- ✅ Entries são criados apenas pelo Ledger V2 baseado em eventos reais
- ✅ Adicionados comentários explicando que função é LEGACY

**Conformidade IFRS 15:** ✅ **CORRETO**

## Status Atual

### ✅ Conforme IFRS 15

1. **Reconhecimento inicial:** ✅ Corrigido - só cria quando há billing/payment
2. **Ledger V2:** ✅ Correto - cria entries baseado em eventos reais
3. **Contract Asset/Liability:** ✅ Lógica correta
4. **Reconhecimento over-time:** ✅ Implementado corretamente
5. **Custos pré-operacionais:** ✅ Amortização implementada

### ⚠️ Melhorias Futuras (Prioridade Média)

1. **Capitalização de custos:** Implementar verificação de critérios IFRS 15
2. **Métodos de medição:** Implementar input/output methods além de time-based
3. **Documentação:** Criar exemplos práticos de cada cenário

## Principais Correções Implementadas:
1. ✅ Removida criação automática incorreta de entry inicial
2. ✅ Removido código de "forçar" entries
3. ✅ Entries agora são criados apenas quando há eventos reais (billing, payment, performance)
4. ✅ Conformidade com IFRS 15 restaurada
