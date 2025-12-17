# 📚 Tutorial Detalhado e Completo - IFRS 15 Revenue Manager

## Índice
1. [Visão Geral do Sistema e Relacionamentos](#visão-geral)
2. [Fluxo Completo: Do Cliente à Receita Reconhecida](#fluxo-completo)
3. [Como as Funcionalidades Se Relacionam](#relacionamentos)
4. [Motor IFRS 15: Funcionamento Detalhado](#motor-ifrs-15)
5. [Sistema de Versionamento de Contratos](#versionamento)
6. [Fluxo de Dados: Performance Obligations → Revenue Ledger](#fluxo-dados)
7. [Billing Schedules e Reconhecimento de Receita](#billing-revenue)
8. [Cenários Avançados e Casos de Uso](#cenarios-avancados)
9. [Troubleshooting e Problemas Comuns](#troubleshooting)

---

## 🎯 Visão Geral do Sistema e Relacionamentos

### Hierarquia de Dados e Dependências

```
TENANT (Organização)
│
├── CUSTOMERS (Clientes)
│   │
│   └── CONTRACTS (Contratos) [DEPENDE DE: Customer]
│       │
│       ├── VERSIONS (Versões) [DEPENDE DE: Contract]
│       │   │
│       │   ├── LINE ITEMS (Itens de Linha) [DEPENDE DE: Version]
│       │   │
│       │   └── PERFORMANCE OBLIGATIONS (POs) [DEPENDE DE: Version]
│       │       │
│       │       └── REVENUE SCHEDULES (Cronogramas de Receita) [GERADO POR: Motor IFRS 15]
│       │
│       ├── BILLING SCHEDULES (Cronogramas de Faturamento) [DEPENDE DE: Contract]
│       │
│       └── REVENUE LEDGER ENTRIES (Razão de Receita) [DEPENDE DE: Contract, PO, Billing]
│
├── FINANCING COMPONENTS (Componentes de Financiamento) [DEPENDE DE: Contract]
│
├── EXCHANGE RATES (Taxas de Câmbio) [USADO POR: Contracts, Revenue Ledger]
│
└── CONSOLIDATED BALANCES (Balanços Consolidados) [AGREGA: Revenue Ledger, Contracts]
```

### Regras de Dependência

1. **Não pode criar Contrato sem Cliente**
   - O campo `customerId` é obrigatório
   - O cliente deve existir antes

2. **Não pode adicionar PO sem Versão**
   - Sistema cria versão automaticamente se não existir
   - PO sempre pertence a uma versão específica

3. **Não pode executar Motor sem PO**
   - Motor precisa de pelo menos uma Performance Obligation
   - Motor usa a versão atual do contrato

4. **Revenue Ledger é gerado automaticamente**
   - Motor IFRS 15 cria entradas automaticamente
   - Pode também criar manualmente

5. **Billing Schedules são independentes**
   - Podem ser criados sem executar o motor
   - Mas são usados pelo motor para calcular Contract Assets/Liabilities

---

## 🔄 Fluxo Completo: Do Cliente à Receita Reconhecida

### Cenário Real: Contrato de Software com Suporte

Vamos seguir um exemplo completo passo a passo, mostrando como cada ação se relaciona com as outras.

#### FASE 1: Setup Inicial

##### Passo 1.1: Criar Cliente

**Onde**: `/customers` → Botão "New Customer"

**Ação**:
```typescript
customerService.create(tenantId, {
  name: "TechCorp Solutions",
  country: "Brazil",
  currency: "BRL",
  taxId: "12.345.678/0001-90"
})
```

**O que acontece**:
- Cria documento em `tenants/{tenantId}/customers/{customerId}`
- Cliente fica disponível para seleção em contratos
- **Relacionamento**: Cliente → pode ter múltiplos Contratos

**Dados criados**:
```json
{
  "id": "cust-001",
  "name": "TechCorp Solutions",
  "country": "Brazil",
  "currency": "BRL",
  "tenantId": "tenant-001"
}
```

##### Passo 1.2: Criar Contrato

**Onde**: `/contracts` → Botão "New Contract"

**Ação**:
```typescript
contractService.create(tenantId, {
  customerId: "cust-001",
  contractNumber: "CTR-2024-050",
  title: "Software License + Support - Annual",
  startDate: Timestamp(2024-01-01),
  endDate: Timestamp(2024-12-31),
  totalValue: 120000,
  currency: "BRL"
})
```

**O que acontece internamente**:

1. **Cria o Contrato**:
   ```json
   {
     "id": "contract-001",
     "customerId": "cust-001",
     "contractNumber": "CTR-2024-050",
     "status": "draft",
     "totalValue": 120000
   }
   ```

2. **Cria Versão Inicial Automaticamente**:
   ```typescript
   // Dentro de contractService.create()
   const versionId = await contractVersionService.create(tenantId, contractId, {
     versionNumber: 1,
     effectiveDate: startDate,
     totalValue: 120000,
     isProspective: true
   })
   
   // Atualiza contrato com versão atual
   await contractService.update(tenantId, contractId, {
     currentVersionId: versionId
   })
   ```

3. **Versão criada**:
   ```json
   {
     "id": "version-001",
     "contractId": "contract-001",
     "versionNumber": 1,
     "totalValue": 120000
   }
   ```

**Relacionamentos criados**:
- `Contract.customerId` → `Customer.id` (referência)
- `Contract.currentVersionId` → `Version.id` (referência)
- `Version.contractId` → `Contract.id` (referência)

**Estado do sistema**:
```
Customer: ✅ Criado
Contract: ✅ Criado (status: draft)
Version: ✅ Criada automaticamente (versão 1)
POs: ❌ Ainda não existem
Motor: ❌ Não pode executar (sem POs)
```

#### FASE 2: Configurar Performance Obligations

##### Passo 2.1: Adicionar Primeira PO

**Onde**: `/contracts/contract-001` → Aba "Performance Obligations" → Botão "Add"

**Ação**:
```typescript
performanceObligationService.create(tenantId, contractId, versionId, {
  description: "Software License - Annual",
  allocatedPrice: 80000,
  recognitionMethod: "point_in_time",
  percentComplete: 0,
  isSatisfied: false
})
```

**O que acontece**:
- Cria PO na subcoleção: `contracts/{contractId}/versions/{versionId}/performanceObligations/{poId}`
- PO inicial tem `recognizedAmount = 0` e `deferredAmount = 80000`

**Dados criados**:
```json
{
  "id": "po-001",
  "contractVersionId": "version-001",
  "description": "Software License - Annual",
  "allocatedPrice": 80000,
  "recognitionMethod": "point_in_time",
  "percentComplete": 0,
  "recognizedAmount": 0,
  "deferredAmount": 80000,
  "isSatisfied": false
}
```

**Relacionamentos**:
- `PO.contractVersionId` → `Version.id` (referência)
- PO pertence a uma versão específica

##### Passo 2.2: Adicionar Segunda PO

**Ação**:
```typescript
performanceObligationService.create(tenantId, contractId, versionId, {
  description: "Support Services - 12 months",
  allocatedPrice: 40000,
  recognitionMethod: "over_time",
  measurementMethod: "input",
  percentComplete: 0
})
```

**Dados criados**:
```json
{
  "id": "po-002",
  "contractVersionId": "version-001",
  "description": "Support Services - 12 months",
  "allocatedPrice": 40000,
  "recognitionMethod": "over_time",
  "measurementMethod": "input",
  "percentComplete": 0,
  "recognizedAmount": 0,
  "deferredAmount": 40000,
  "isSatisfied": false
}
```

**Estado do sistema**:
```
Customer: ✅
Contract: ✅ (status: draft)
Version: ✅ (versão 1)
POs: ✅ 2 POs criadas (R$ 80k + R$ 40k = R$ 120k)
Motor: ✅ Pode executar agora
```

**Validação importante**:
- Soma dos `allocatedPrice` = `Contract.totalValue` ✅
- 80.000 + 40.000 = 120.000 ✅

#### FASE 3: Executar Motor IFRS 15

##### Passo 3.1: Primeira Execução do Motor

**Onde**: `/ifrs15` → Selecionar contrato → Botão "Executar Motor"

**O que acontece internamente**:

1. **Chama Cloud Function**:
   ```typescript
   const result = await ifrs15Service.runEngine(contractId)
   // Chama: runIFRS15Engine Cloud Function
   ```

2. **Cloud Function executa os 5 passos**:

   **PASSO 1: Identificar o Contrato**
   ```typescript
   // Busca contrato
   const contract = await contractService.getById(tenantId, contractId)
   // Busca versão atual
   const version = await contractVersionService.getById(tenantId, contractId, contract.currentVersionId)
   // Valida: contrato existe, está ativo, tem versão
   ```

   **PASSO 2: Identificar Performance Obligations**
   ```typescript
   // Busca todas as POs da versão
   const pos = await performanceObligationService.getAll(tenantId, contractId, versionId)
   // Resultado: [po-001, po-002]
   ```

   **PASSO 3: Determinar Preço da Transação**
   ```typescript
   // Preço fixo do contrato
   fixedPrice = version.totalValue // 120000
   
   // Busca considerações variáveis (se houver)
   variableConsideration = 0
   
   // Busca componente de financiamento (se houver)
   financingComponent = 0
   
   // Preço total da transação
   transactionPrice = fixedPrice + variableConsideration - financingComponent
   // = 120000
   ```

   **PASSO 4: Alocar Preço da Transação**
   ```typescript
   // Calcula Standalone Selling Prices (SSP)
   // Se não houver SSP explícito, usa allocatedPrice
   
   po1SSP = 80000  // PO 1
   po2SSP = 40000  // PO 2
   totalSSP = 120000
   
   // Calcula percentual de alocação
   po1Percentage = 80000 / 120000 = 66.67%
   po2Percentage = 40000 / 120000 = 33.33%
   
   // Aloca preço da transação
   po1Allocated = 120000 * 0.6667 = 80000
   po2Allocated = 120000 * 0.3333 = 40000
   
   // Atualiza POs com preços alocados
   await updatePO(po1, { allocatedPrice: 80000 })
   await updatePO(po2, { allocatedPrice: 40000 })
   ```

   **PASSO 5: Reconhecer Receita**
   ```typescript
   // Para cada PO, determina reconhecimento
   
   // PO 1: point_in_time
   if (po1.isSatisfied) {
     recognizedAmount = 80000
     deferredAmount = 0
   } else {
     recognizedAmount = 0
     deferredAmount = 80000
   }
   // Resultado: recognizedAmount = 0 (não satisfeita ainda)
   
   // PO 2: over_time
   // Reconhece baseado em percentComplete
   recognizedAmount = 40000 * (percentComplete / 100)
   // percentComplete = 0 → recognizedAmount = 0
   deferredAmount = 40000 - 0 = 40000
   
   // Totais
   totalRecognized = 0 + 0 = 0
   totalDeferred = 80000 + 40000 = 120000
   ```

3. **Gera Revenue Schedules**:
   ```typescript
   // Para cada PO, cria cronograma de reconhecimento
   
   // PO 1: point_in_time
   revenueSchedule[po1] = [{
     periodStart: 2024-01-01,
     periodEnd: 2024-01-01,
     scheduledAmount: 80000,
     recognizedAmount: 0,  // Não satisfeita
     deferredAmount: 80000
   }]
   
   // PO 2: over_time (12 meses)
   revenueSchedule[po2] = [
     { period: 2024-01, recognizedAmount: 0, deferredAmount: 3333.33 },
     { period: 2024-02, recognizedAmount: 0, deferredAmount: 3333.33 },
     // ... 12 períodos mensais
   ]
   ```

4. **Cria Entradas no Revenue Ledger**:
   ```typescript
   // Motor chama generateAutomaticJournalEntries()
   
   // Entrada 1: Receita Diferida (PO 1)
   await revenueLedgerService.create({
     contractId: "contract-001",
     performanceObligationId: "po-001",
     entryType: "deferred_revenue",
     debitAccount: "Contract Asset",
     creditAccount: "Deferred Revenue",
     amount: 80000,
     periodStart: 2024-01-01,
     periodEnd: 2024-01-01
   })
   
   // Entrada 2: Receita Diferida (PO 2)
   await revenueLedgerService.create({
     contractId: "contract-001",
     performanceObligationId: "po-002",
     entryType: "deferred_revenue",
     debitAccount: "Contract Asset",
     creditAccount: "Deferred Revenue",
     amount: 40000,
     periodStart: 2024-01-01,
     periodEnd: 2024-12-31
   })
   ```

5. **Atualiza POs com valores calculados**:
   ```typescript
   await updatePO(po1, {
     recognizedAmount: 0,
     deferredAmount: 80000,
     percentComplete: 0
   })
   
   await updatePO(po2, {
     recognizedAmount: 0,
     deferredAmount: 40000,
     percentComplete: 0
   })
   ```

**Resultado da primeira execução**:
```
Preço da Transação: R$ 120.000
Alocação PO 1: R$ 80.000 (66.67%)
Alocação PO 2: R$ 40.000 (33.33%)
Receita Reconhecida: R$ 0
Receita Diferida: R$ 120.000
Revenue Ledger: 2 entradas criadas (deferred_revenue)
```

**Estado do sistema após motor**:
```
Contract: ✅
Version: ✅
POs: ✅ (valores atualizados pelo motor)
Revenue Schedules: ✅ (criados para cada PO)
Revenue Ledger: ✅ (2 entradas de deferred_revenue)
```

##### Passo 3.2: Marcar PO 1 como Satisfeita

**Onde**: `/contracts/contract-001` → Aba "Performance Obligations" → Editar PO 1

**Ação**:
```typescript
await performanceObligationService.update(tenantId, contractId, versionId, po1Id, {
  isSatisfied: true
})
```

**O que acontece**:
- PO 1 agora tem `isSatisfied = true`
- Mas `recognizedAmount` ainda é 0 (precisa executar motor novamente)

##### Passo 3.3: Segunda Execução do Motor

**Onde**: `/ifrs15` → Executar Motor novamente

**O que acontece**:

**PASSO 5 (reconhecimento) - Recalculado**:
```typescript
// PO 1: point_in_time
if (po1.isSatisfied) {  // ✅ Agora é true
  recognizedAmount = 80000
  deferredAmount = 0
}

// PO 2: over_time (ainda 0%)
recognizedAmount = 0
deferredAmount = 40000

// Totais
totalRecognized = 80000
totalDeferred = 40000
```

**Gera novas entradas no Revenue Ledger**:
```typescript
// Entrada 3: Receita Reconhecida (PO 1)
await revenueLedgerService.create({
  entryType: "revenue",
  debitAccount: "Contract Asset",
  creditAccount: "Revenue",
  amount: 80000,
  description: "Software License recognized (point in time)"
})

// Atualiza entrada anterior de deferred_revenue
// Reverte a entrada de R$ 80k deferred → reconhece R$ 80k
```

**Atualiza POs**:
```typescript
await updatePO(po1, {
  recognizedAmount: 80000,
  deferredAmount: 0,
  percentComplete: 100
})
```

**Resultado da segunda execução**:
```
Receita Reconhecida: R$ 80.000 (PO 1 satisfeita)
Receita Diferida: R$ 40.000 (PO 2 em andamento)
Revenue Ledger: +1 entrada (revenue) criada
```

#### FASE 4: Progressão da PO 2 (Over Time)

##### Passo 4.1: Atualizar Percentual de Conclusão

**Onde**: `/contracts/contract-001` → Aba "Performance Obligations" → Editar PO 2

**Ação**:
```typescript
await performanceObligationService.update(tenantId, contractId, versionId, po2Id, {
  percentComplete: 50  // 50% concluído
})
```

##### Passo 4.2: Terceira Execução do Motor

**O que acontece**:

**PASSO 5 (reconhecimento) - Recalculado**:
```typescript
// PO 1: point_in_time (já satisfeita)
recognizedAmount = 80000
deferredAmount = 0

// PO 2: over_time (50% concluído)
recognizedAmount = 40000 * (50 / 100) = 20000
deferredAmount = 40000 - 20000 = 20000

// Totais
totalRecognized = 80000 + 20000 = 100000
totalDeferred = 0 + 20000 = 20000
```

**Gera nova entrada no Revenue Ledger**:
```typescript
// Entrada 4: Receita Reconhecida (PO 2 - 50%)
await revenueLedgerService.create({
  entryType: "revenue",
  amount: 20000,
  description: "Support Services recognized (50% complete)"
})
```

**Resultado**:
```
Receita Reconhecida: R$ 100.000
Receita Diferida: R$ 20.000
```

#### FASE 5: Billing Schedules e Recebimentos

##### Passo 5.1: Criar Cronograma de Faturamento

**Onde**: `/billing-schedules` → Botão "New Billing"

**Ação**:
```typescript
billingScheduleService.create(tenantId, {
  contractId: "contract-001",
  billingDate: "2024-01-15",
  dueDate: "2024-02-14",
  amount: 10000,
  currency: "BRL",
  status: "scheduled",
  frequency: "monthly"
})
```

**O que acontece**:
- Cria documento em `tenants/{tenantId}/billingSchedules/{scheduleId}`
- Status inicial: `scheduled`

**Dados criados**:
```json
{
  "id": "billing-001",
  "contractId": "contract-001",
  "billingDate": "2024-01-15",
  "dueDate": "2024-02-14",
  "amount": 10000,
  "status": "scheduled"
}
```

##### Passo 5.2: Marcar como Faturado

**Onde**: `/billing-schedules` → Botão "Mark Invoiced"

**Ação**:
```typescript
billingScheduleService.update(tenantId, "billing-001", {
  status: "invoiced",
  invoicedAt: Timestamp.now(),
  invoiceNumber: "INV-2024-001"
})
```

**O que acontece**:
- Status muda para `invoiced`
- Campo `invoicedAt` é preenchido
- **Relacionamento**: Billing Schedule agora pode ser usado pelo motor para calcular Contract Assets/Liabilities

##### Passo 5.3: Motor Recalcula com Billing

**O que acontece no motor**:

```typescript
// Motor busca billing schedules
const billings = await billingScheduleService.getByContract(tenantId, contractId)
const totalBilled = billings
  .filter(b => b.status === "invoiced" || b.status === "paid")
  .reduce((sum, b) => sum + b.amount, 0)
// totalBilled = 10000

// Calcula Contract Asset vs Liability
// Contract Asset = Receita Reconhecida > Faturado
// Contract Liability = Faturado > Receita Reconhecida

if (totalRecognizedRevenue > totalBilled) {
  // Há Contract Asset
  contractAsset = 100000 - 10000 = 90000
} else if (totalBilled > totalRecognizedRevenue) {
  // Há Contract Liability
  contractLiability = 10000 - 100000 = -90000 (negativo, então não há liability)
}

// Gera entrada de Contract Asset
await revenueLedgerService.create({
  entryType: "contract_asset",
  amount: 90000,
  description: "Contract Asset: Revenue recognized but not yet billed"
})
```

##### Passo 5.4: Marcar como Pago

**Onde**: `/billing-schedules` → Botão "Mark Paid"

**Ação**:
```typescript
billingScheduleService.update(tenantId, "billing-001", {
  status: "paid",
  paidAt: Timestamp.now(),
  paidAmount: 10000
})
```

**O que acontece no motor**:
```typescript
// Recalcula com pagamento
totalCashReceived = 10000

// Gera entrada de Cash
await revenueLedgerService.create({
  entryType: "cash",
  debitAccount: "Cash",
  creditAccount: "Accounts Receivable",
  amount: 10000
})
```

---

## 🔗 Como as Funcionalidades Se Relacionam

### 1. Customer ↔ Contract

**Relacionamento**: 1:N (Um cliente pode ter múltiplos contratos)

**Como funciona**:
- Contrato sempre referencia um `customerId`
- Ao deletar cliente, sistema verifica se há contratos
- Não permite deletar cliente com contratos

**Código**:
```typescript
// Ao criar contrato
contract.customerId = "cust-001"  // Referência

// Ao buscar contrato com detalhes
const customer = await customerService.getById(tenantId, contract.customerId)
contract.customerName = customer.name
```

### 2. Contract ↔ Version

**Relacionamento**: 1:N (Um contrato pode ter múltiplas versões)

**Como funciona**:
- Contrato sempre tem pelo menos uma versão (criada automaticamente)
- `Contract.currentVersionId` aponta para versão atual
- Versões antigas são mantidas para histórico
- Modificações criam nova versão

**Fluxo de versionamento**:
```
Contrato Criado
  └─> Versão 1 criada automaticamente
      └─> Contract.currentVersionId = "version-001"

Modificação do Contrato
  └─> Cloud Function: createContractVersion
      ├─> Copia versão atual
      ├─> Incrementa versionNumber (1 → 2)
      ├─> Copia lineItems
      ├─> Copia performanceObligations
      └─> Atualiza Contract.currentVersionId = "version-002"
```

**Código**:
```typescript
// Ao criar contrato
const versionId = await contractVersionService.create(tenantId, contractId, {
  versionNumber: 1,
  effectiveDate: startDate,
  totalValue: contract.totalValue
})
await contractService.update(tenantId, contractId, {
  currentVersionId: versionId
})
```

### 3. Version ↔ Performance Obligations

**Relacionamento**: 1:N (Uma versão pode ter múltiplas POs)

**Como funciona**:
- PO sempre pertence a uma versão específica
- PO tem `contractVersionId` que referencia a versão
- Ao criar nova versão, POs são copiadas
- Motor sempre usa POs da versão atual

**Estrutura no Firestore**:
```
contracts/{contractId}/
  └── versions/{versionId}/
      └── performanceObligations/{poId}
          {
            contractVersionId: "version-001",
            description: "...",
            allocatedPrice: 80000
          }
```

**Código**:
```typescript
// Ao adicionar PO
await addDoc(
  collection(db, `contracts/${contractId}/versions/${versionId}/performanceObligations`),
  {
    contractVersionId: versionId,
    description: "...",
    allocatedPrice: 80000
  }
)
```

### 4. Performance Obligations ↔ Revenue Ledger

**Relacionamento**: 1:N (Uma PO pode gerar múltiplas entradas no ledger)

**Como funciona**:
- Motor IFRS 15 cria entradas no Revenue Ledger baseado nas POs
- Cada entrada referencia `performanceObligationId`
- Entradas são criadas automaticamente quando:
  - PO é satisfeita (point in time)
  - PO progride (over time)
  - Motor é executado

**Tipos de entradas geradas**:
```typescript
// Quando PO não está satisfeita (point in time)
{
  entryType: "deferred_revenue",
  performanceObligationId: "po-001",
  amount: 80000,
  debitAccount: "Contract Asset",
  creditAccount: "Deferred Revenue"
}

// Quando PO é satisfeita (point in time)
{
  entryType: "revenue",
  performanceObligationId: "po-001",
  amount: 80000,
  debitAccount: "Contract Asset",
  creditAccount: "Revenue"
}

// Quando PO progride (over time)
{
  entryType: "revenue",
  performanceObligationId: "po-002",
  amount: 20000,  // 50% de 40000
  debitAccount: "Contract Asset",
  creditAccount: "Revenue"
}
```

**Código no Motor**:
```typescript
// Dentro de runIFRS15Engine, após calcular reconhecimento
await generateAutomaticJournalEntries(
  tenantId,
  contractId,
  ifrs15Result,
  totalBilled,
  totalCashReceived,
  currency,
  entryDate,
  periodStart,
  periodEnd
)
```

### 5. Billing Schedules ↔ Revenue Ledger

**Relacionamento**: 1:N (Um billing pode gerar múltiplas entradas)

**Como funciona**:
- Billing Schedules são independentes das POs
- Motor usa billings para calcular Contract Assets/Liabilities
- Quando billing é pago, gera entrada de Cash

**Fluxo**:
```
Billing Schedule Criado
  └─> Status: scheduled
      └─> Ainda não gera entrada no ledger

Billing Marcado como Invoiced
  └─> Status: invoiced
      └─> Motor calcula:
          - Se Receita Reconhecida > Faturado → Contract Asset
          - Se Faturado > Receita Reconhecida → Contract Liability

Billing Marcado como Paid
  └─> Status: paid
      └─> Motor gera entrada:
          {
            entryType: "cash",
            billingScheduleId: "billing-001",
            debitAccount: "Cash",
            creditAccount: "Accounts Receivable",
            amount: 10000
          }
```

**Código no Motor**:
```typescript
// Busca billings do contrato
const billingsSnapshot = await db
  .collection(tenantCollection(tenantId, COLLECTIONS.BILLING_SCHEDULES))
  .where("contractId", "==", contractId)
  .where("status", "in", ["invoiced", "paid"])
  .get()

let totalBilled = 0
let totalCashReceived = 0

for (const doc of billingsSnapshot.docs) {
  const billing = doc.data()
  totalBilled += Number(billing.amount || 0)
  if (billing.status === "paid") {
    totalCashReceived += Number(billing.paidAmount || billing.amount || 0)
  }
}

// Calcula Contract Asset/Liability
if (result.totalRecognizedRevenue > totalBilled) {
  result.contractAsset = result.totalRecognizedRevenue - totalBilled
} else if (totalBilled > result.totalRecognizedRevenue) {
  result.contractLiability = totalBilled - result.totalRecognizedRevenue
}
```

### 6. Motor IFRS 15 ↔ Todas as Funcionalidades

**Relacionamento**: Motor é o orquestrador central

**O que o motor faz**:
1. **Lê dados de múltiplas fontes**:
   - Contract
   - Version
   - Performance Obligations
   - Line Items
   - Variable Considerations
   - Billing Schedules
   - Financing Components

2. **Calcula e atualiza**:
   - Alocações de preço
   - Reconhecimento de receita
   - Revenue Schedules
   - Percentuais de conclusão

3. **Gera dados em múltiplos lugares**:
   - Atualiza POs (recognizedAmount, deferredAmount)
   - Cria Revenue Schedules
   - Cria Revenue Ledger Entries
   - Calcula Contract Assets/Liabilities

**Fluxo completo do motor**:
```
Motor Executado
  │
  ├─> PASSO 1: Busca Contract + Version
  │
  ├─> PASSO 2: Busca Performance Obligations
  │   └─> Se não houver, cria a partir de Line Items
  │
  ├─> PASSO 3: Calcula Transaction Price
  │   ├─> Fixed Price (do contrato)
  │   ├─> Variable Considerations
  │   └─> Financing Components
  │
  ├─> PASSO 4: Aloca Preço às POs
  │   ├─> Calcula Standalone Selling Prices
  │   ├─> Calcula percentuais de alocação
  │   └─> Atualiza PO.allocatedPrice
  │
  ├─> PASSO 5: Reconhece Receita
  │   ├─> Para cada PO:
  │   │   ├─> Point in Time: Se isSatisfied → reconhece 100%
  │   │   └─> Over Time: Reconhece baseado em percentComplete
  │   ├─> Cria Revenue Schedules
  │   └─> Atualiza PO.recognizedAmount e PO.deferredAmount
  │
  ├─> Calcula Contract Assets/Liabilities
  │   ├─> Busca Billing Schedules
  │   ├─> Compara Receita Reconhecida vs Faturado
  │   └─> Calcula diferença
  │
  └─> Gera Revenue Ledger Entries
      ├─> Entradas de Revenue (receita reconhecida)
      ├─> Entradas de Deferred Revenue (receita diferida)
      ├─> Entradas de Contract Asset
      ├─> Entradas de Contract Liability
      └─> Entradas de Cash (se houver pagamentos)
```

---

## ⚙️ Motor IFRS 15: Funcionamento Detalhado

### Arquitetura do Motor

O motor é uma **Cloud Function** que executa no backend (Firebase Functions), não no frontend.

**Por quê?**
- Cálculos complexos
- Múltiplas operações de banco de dados
- Geração de múltiplos documentos
- Processamento que pode levar tempo

### Fluxo Detalhado dos 5 Passos

#### PASSO 1: Identificar o Contrato

**Objetivo**: Validar que o contrato existe e atende aos critérios do IFRS 15

**Critérios do IFRS 15**:
1. ✅ Contrato aprovado pelas partes
2. ✅ Identificação dos direitos de cada parte
3. ✅ Identificação dos termos de pagamento
4. ✅ Substância comercial
5. ✅ Probabilidade de cobrança

**Código**:
```typescript
// Busca contrato
const contractRef = db
  .collection(tenantCollection(tenantId, COLLECTIONS.CONTRACTS))
  .doc(contractId)

const contractDoc = await contractRef.get()
if (!contractDoc.exists) {
  throw new Error("Contract not found")
}

const contract = contractDoc.data()

// Busca versão atual
const versionId = contract.currentVersionId
if (!versionId) {
  throw new Error("Contract has no versions")
}

const versionDoc = await contractRef
  .collection("versions")
  .doc(versionId)
  .get()

const version = versionDoc.data()

// Valida status
if (contract.status === "terminated" || contract.status === "expired") {
  result.warnings.push("Contract is terminated or expired")
}
```

**Resultado**:
- `result.contractExists = true`
- `result.versionId = versionId`
- Se versão > 1: `result.contractModified = true`

#### PASSO 2: Identificar Performance Obligations

**Objetivo**: Identificar todos os bens/serviços distintos prometidos

**Como identifica**:
1. Busca POs existentes na versão
2. Se não houver POs, cria a partir de Line Items distintos
3. Valida se são distintas (não agrupadas)

**Código**:
```typescript
// Busca POs existentes
const posSnapshot = await versionRef
  .collection("performanceObligations")
  .get()

let performanceObligations = posSnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}))

// Se não houver POs, cria a partir de Line Items
if (performanceObligations.length === 0) {
  const lineItemsSnapshot = await versionRef
    .collection("lineItems")
    .get()
  
  const lineItems = lineItemsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  
  // Cada line item distinto vira uma PO
  for (const item of lineItems) {
    if (item.isDistinct && item.distinctWithinContext) {
      const poRef = await versionRef
        .collection("performanceObligations")
        .add({
          contractVersionId: versionId,
          description: item.description,
          allocatedPrice: item.totalPrice,
          recognitionMethod: item.recognitionMethod,
          // ...
        })
      
      performanceObligations.push({
        id: poRef.id,
        ...poRef.data()
      })
    }
  }
}

// Mapeia para resultado
result.performanceObligations = performanceObligations.map(po => ({
  id: po.id,
  description: po.description,
  isDistinct: true,
  bundled: (po.lineItemIds?.length || 0) > 1,
  justification: po.justification || "Deemed distinct"
}))
```

**Resultado**:
- Lista de POs identificadas
- Cada PO marcada como distinta ou agrupada

#### PASSO 3: Determinar Preço da Transação

**Objetivo**: Calcular o preço total que será alocado às POs

**Componentes do Preço da Transação**:
1. **Fixed Price**: Valor fixo do contrato
2. **Variable Consideration**: Considerações variáveis (descontos, bônus, etc.)
3. **Financing Component**: Componente de financiamento (se houver)
4. **Constrained Amount**: Valor restringido (estimativas conservadoras)

**Código**:
```typescript
// Preço fixo
result.fixedPrice = version.totalValue

// Considerações variáveis
const vcSnapshot = await versionRef
  .collection("variableConsiderations")
  .get()

const variableConsiderations = vcSnapshot.docs.map(doc => doc.data())

for (const vc of variableConsiderations) {
  if (vc.constraintApplied) {
    // Valor restringido (estimativa conservadora)
    result.constrainedAmount += vc.estimatedAmount
  } else {
    // Valor variável não restringido
    result.variableConsideration += vc.estimatedAmount
  }
}

// Componente de financiamento
// Busca em financingComponents collection
const financingComponents = await financingComponentService
  .getByContract(tenantId, contractId)

for (const fc of financingComponents) {
  // Juros de financiamento reduzem o preço da transação
  result.financingComponent += Number(fc.totalInterest || 0)
}

// Preço total da transação
result.transactionPrice = 
  result.fixedPrice + 
  result.variableConsideration - 
  result.constrainedAmount - 
  result.financingComponent
```

**Exemplo**:
```
Fixed Price: R$ 120.000
Variable Consideration: R$ 10.000 (bônus)
Constrained Amount: R$ 2.000 (estimativa conservadora)
Financing Component: R$ 5.000 (juros)

Transaction Price = 120.000 + 10.000 - 2.000 - 5.000 = R$ 123.000
```

#### PASSO 4: Alocar Preço da Transação

**Objetivo**: Distribuir o preço da transação entre as POs

**Método**: Standalone Selling Price (SSP) - Preço de venda standalone

**Como funciona**:
1. Se PO tem `standaloneSelllingPrice` explícito → usa esse
2. Se não, usa `allocatedPrice` da PO
3. Calcula percentual: `PO_SSP / Total_SSP`
4. Aloca: `Transaction_Price * Percentual`

**Código**:
```typescript
// Calcula total de SSPs
const totalSSP = performanceObligations.reduce((sum, po) => {
  // Busca line items relacionados
  const relatedLineItems = lineItems.filter(li => 
    po.lineItemIds?.includes(li.id)
  )
  
  // SSP da PO = soma dos SSPs dos line items, ou allocatedPrice
  const poSSP = relatedLineItems.reduce((s, li) => 
    s + (li.standaloneSelllingPrice || li.totalPrice), 0
  ) || po.allocatedPrice
  
  return sum + poSSP
}, 0)

// Aloca para cada PO
for (const po of performanceObligations) {
  const relatedLineItems = lineItems.filter(li => 
    po.lineItemIds?.includes(li.id)
  )
  
  const poSSP = relatedLineItems.reduce((s, li) => 
    s + (li.standaloneSelllingPrice || li.totalPrice), 0
  ) || po.allocatedPrice
  
  // Percentual de alocação
  const allocationPercentage = totalSSP > 0 
    ? poSSP / totalSSP 
    : 1 / performanceObligations.length
  
  // Valor alocado
  const allocatedAmount = result.transactionPrice * allocationPercentage
  
  result.allocations.push({
    poId: po.id,
    description: po.description,
    standaloneSelllingPrice: poSSP,
    allocationPercentage: Math.round(allocationPercentage * 10000) / 100,
    allocatedAmount: Math.round(allocatedAmount * 100) / 100
  })
  
  // Atualiza PO com preço alocado
  await versionRef
    .collection("performanceObligations")
    .doc(po.id)
    .update({
      allocatedPrice: Math.round(allocatedAmount * 100) / 100
    })
}
```

**Exemplo**:
```
PO 1 SSP: R$ 80.000
PO 2 SSP: R$ 40.000
Total SSP: R$ 120.000

Transaction Price: R$ 123.000

PO 1 Percentage: 80.000 / 120.000 = 66.67%
PO 1 Allocated: 123.000 * 0.6667 = R$ 82.001

PO 2 Percentage: 40.000 / 120.000 = 33.33%
PO 2 Allocated: 123.000 * 0.3333 = R$ 40.999
```

#### PASSO 5: Reconhecer Receita

**Objetivo**: Determinar quando e quanto de receita reconhecer

**Dois métodos**:

1. **Point in Time** (Ponto no Tempo):
   - Receita reconhecida quando PO é satisfeita
   - `isSatisfied = true` → reconhece 100%
   - `isSatisfied = false` → reconhece 0% (tudo fica diferido)

2. **Over Time** (Ao Longo do Tempo):
   - Receita reconhecida progressivamente
   - Baseado em `percentComplete`
   - Métodos: `input` (custos) ou `output` (unidades entregues)

**Código**:
```typescript
for (const po of performanceObligations) {
  const allocation = result.allocations.find(a => a.poId === po.id)
  if (!allocation) continue
  
  const poAmount = allocation.allocatedAmount
  const revenueScheduleEntry = {
    poId: po.id,
    periods: []
  }
  
  if (po.recognitionMethod === "point_in_time") {
    // Point in time
    const recognizedAmount = po.isSatisfied ? poAmount : 0
    const deferredAmount = po.isSatisfied ? 0 : poAmount
    
    revenueScheduleEntry.periods.push({
      periodStart: contractStartDate,
      periodEnd: contractStartDate,
      scheduledAmount: poAmount,
      recognizedAmount,
      deferredAmount
    })
    
    if (po.isSatisfied) {
      result.totalRecognizedRevenue += poAmount
    } else {
      result.totalDeferredRevenue += poAmount
    }
  } else {
    // Over time
    const percentComplete = po.percentComplete || 0
    const recognizedAmount = poAmount * (percentComplete / 100)
    const deferredAmount = poAmount - recognizedAmount
    
    // Gera períodos mensais
    const contractStart = contract.startDate.toDate()
    const contractEnd = contract.endDate?.toDate() || 
      new Date(contractStart.getFullYear() + 1, contractStart.getMonth(), contractStart.getDate())
    
    const months = monthsBetween(contractStart, contractEnd)
    const monthlyAmount = poAmount / months
    
    for (let i = 0; i < months; i++) {
      const periodStart = new Date(contractStart)
      periodStart.setMonth(periodStart.getMonth() + i)
      
      const periodEnd = new Date(periodStart)
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      periodEnd.setDate(0) // Último dia do mês
      
      // Calcula quanto reconhecer neste período
      const periodPercent = Math.min(
        (i + 1) / months * 100,
        percentComplete
      ) - Math.min(i / months * 100, percentComplete)
      
      const periodRecognized = poAmount * (periodPercent / 100)
      const periodDeferred = monthlyAmount - periodRecognized
      
      revenueScheduleEntry.periods.push({
        periodStart,
        periodEnd,
        scheduledAmount: monthlyAmount,
        recognizedAmount: periodRecognized,
        deferredAmount: periodDeferred
      })
    }
    
    result.totalRecognizedRevenue += recognizedAmount
    result.totalDeferredRevenue += deferredAmount
  }
  
  result.revenueSchedule.push(revenueScheduleEntry)
  
  // Atualiza PO
  await poRef.update({
    recognizedAmount: revenueScheduleEntry.periods.reduce((sum, p) => 
      sum + p.recognizedAmount, 0
    ),
    deferredAmount: revenueScheduleEntry.periods.reduce((sum, p) => 
      sum + p.deferredAmount, 0
    ),
    percentComplete: Math.round(
      (revenueScheduleEntry.periods.reduce((sum, p) => 
        sum + p.recognizedAmount, 0
      ) / poAmount) * 100
    )
  })
}
```

**Geração de Revenue Ledger**:
```typescript
// Após calcular reconhecimento, gera entradas no ledger
await generateAutomaticJournalEntries(
  tenantId,
  contractId,
  ifrs15Result,
  totalBilled,
  totalCashReceived,
  currency,
  entryDate,
  periodStart,
  periodEnd
)

// Dentro de generateAutomaticJournalEntries:
// 1. Receita Reconhecida
if (recognizedRevenue > 0) {
  await revenueLedgerService.create({
    entryType: "revenue",
    debitAccount: "Contract Asset",
    creditAccount: "Revenue",
    amount: recognizedRevenue
  })
}

// 2. Receita Diferida
if (deferredRevenue > 0) {
  await revenueLedgerService.create({
    entryType: "deferred_revenue",
    debitAccount: "Contract Asset",
    creditAccount: "Deferred Revenue",
    amount: deferredRevenue
  })
}

// 3. Contract Asset (se Receita > Faturado)
if (recognizedRevenue > totalBilled) {
  await revenueLedgerService.create({
    entryType: "contract_asset",
    debitAccount: "Contract Asset",
    creditAccount: "Revenue",
    amount: recognizedRevenue - totalBilled
  })
}

// 4. Contract Liability (se Faturado > Receita)
if (totalBilled > recognizedRevenue) {
  await revenueLedgerService.create({
    entryType: "contract_liability",
    debitAccount: "Revenue",
    creditAccount: "Contract Liability",
    amount: totalBilled - recognizedRevenue
  })
}
```

---

## 📋 Sistema de Versionamento de Contratos

### Por que Versionamento?

O IFRS 15 exige que modificações de contratos sejam tratadas de forma específica:
- **Modificação Prospectiva**: Nova versão substitui a anterior
- **Modificação Retrospectiva**: Ajusta valores já reconhecidos

### Como Funciona

#### Criar Nova Versão

**Quando criar**:
- Mudança no valor do contrato
- Mudança nas obrigações de performance
- Mudança nos termos de pagamento
- Qualquer modificação significativa

**Como criar**:
```typescript
// Cloud Function: createContractVersion
const newVersionNumber = currentVersion.versionNumber + 1

// Cria nova versão
const newVersionRef = await contractRef
  .collection("versions")
  .add({
    contractId,
    versionNumber: newVersionNumber,
    effectiveDate: effectiveDate,
    totalValue: currentVersion.totalValue, // Pode ser modificado
    modificationReason: "Price increase",
    isProspective: true
  })

// Copia line items
const lineItemsSnapshot = await currentVersionRef
  .collection("lineItems")
  .get()

for (const doc of lineItemsSnapshot.docs) {
  await newVersionRef.collection("lineItems").add({
    ...doc.data(),
    contractVersionId: newVersionRef.id
  })
}

// Copia performance obligations
const posSnapshot = await currentVersionRef
  .collection("performanceObligations")
  .get()

for (const doc of posSnapshot.docs) {
  await newVersionRef.collection("performanceObligations").add({
    ...doc.data(),
    contractVersionId: newVersionRef.id
  })
}

// Atualiza contrato
await contractRef.update({
  currentVersionId: newVersionRef.id,
  status: "modified"
})
```

#### Estrutura de Versões

```
Contract: CTR-2024-050
│
├── Version 1 (Original)
│   ├── Line Items: [item-1, item-2]
│   └── POs: [po-1, po-2]
│
├── Version 2 (Modificação)
│   ├── Line Items: [item-3, item-4] (copiados e modificados)
│   └── POs: [po-3, po-4] (copiados e modificados)
│
└── Version 3 (Outra Modificação)
    ├── Line Items: [item-5, item-6]
    └── POs: [po-5, po-6]
```

**Versão Atual**: `Contract.currentVersionId = "version-3"`

#### Motor e Versionamento

**Motor sempre usa versão atual**:
```typescript
// Motor busca versão atual
const versionId = contract.currentVersionId

// Busca POs da versão atual
const pos = await performanceObligationService.getAll(
  tenantId, 
  contractId, 
  versionId  // Sempre usa versão atual
)
```

**Histórico preservado**:
- Versões antigas não são deletadas
- POs antigas permanecem com valores históricos
- Revenue Ledger mantém referências às versões antigas

---

## 🔄 Fluxo de Dados: Performance Obligations → Revenue Ledger

### Fluxo Completo de Dados

```
1. PO Criada
   └─> allocatedPrice = 80000
       recognizedAmount = 0
       deferredAmount = 80000
       isSatisfied = false

2. Motor Executado (Primeira Vez)
   └─> PASSO 4: Aloca preço
       └─> PO.allocatedPrice atualizado (se necessário)
   └─> PASSO 5: Reconhece receita
       ├─> PO.isSatisfied = false
       ├─> recognizedAmount = 0
       └─> deferredAmount = 80000
   └─> Gera Revenue Ledger Entry
       └─> {
             entryType: "deferred_revenue",
             amount: 80000,
             performanceObligationId: "po-001"
           }

3. PO Marcada como Satisfeita
   └─> PO.isSatisfied = true
       (recognizedAmount ainda é 0)

4. Motor Executado (Segunda Vez)
   └─> PASSO 5: Recalcula reconhecimento
       ├─> PO.isSatisfied = true
       ├─> recognizedAmount = 80000
       └─> deferredAmount = 0
   └─> Gera Revenue Ledger Entry
       └─> {
             entryType: "revenue",
             amount: 80000,
             performanceObligationId: "po-001"
           }
   └─> Reverte entrada anterior de deferred_revenue
       └─> Cria entrada reversa ou ajusta valores

5. Revenue Ledger Atualizado
   └─> Total Recognized: R$ 80.000
       Total Deferred: R$ 0
```

### Tipos de Entradas no Revenue Ledger

#### 1. Revenue (Receita Reconhecida)
```json
{
  "entryType": "revenue",
  "debitAccount": "Contract Asset",
  "creditAccount": "Revenue",
  "amount": 80000,
  "performanceObligationId": "po-001",
  "description": "Software License recognized (point in time)"
}
```

**Quando criada**:
- PO point_in_time satisfeita
- PO over_time com percentComplete > 0

#### 2. Deferred Revenue (Receita Diferida)
```json
{
  "entryType": "deferred_revenue",
  "debitAccount": "Contract Asset",
  "creditAccount": "Deferred Revenue",
  "amount": 80000,
  "performanceObligationId": "po-001"
}
```

**Quando criada**:
- PO point_in_time não satisfeita
- PO over_time com percentComplete < 100%

#### 3. Contract Asset (Ativo de Contrato)
```json
{
  "entryType": "contract_asset",
  "debitAccount": "Contract Asset",
  "creditAccount": "Revenue",
  "amount": 90000,
  "description": "Revenue recognized but not yet billed"
}
```

**Quando criada**:
- Receita Reconhecida > Total Faturado
- Exemplo: Reconheceu R$ 100k, mas só faturou R$ 10k → Contract Asset de R$ 90k

#### 4. Contract Liability (Passivo de Contrato)
```json
{
  "entryType": "contract_liability",
  "debitAccount": "Revenue",
  "creditAccount": "Contract Liability",
  "amount": 20000,
  "description": "Billed but revenue not yet recognized"
}
```

**Quando criada**:
- Total Faturado > Receita Reconhecida
- Exemplo: Faturou R$ 50k, mas só reconheceu R$ 30k → Contract Liability de R$ 20k

#### 5. Cash (Dinheiro Recebido)
```json
{
  "entryType": "cash",
  "debitAccount": "Cash",
  "creditAccount": "Accounts Receivable",
  "amount": 10000,
  "billingScheduleId": "billing-001"
}
```

**Quando criada**:
- Billing Schedule marcado como "paid"

#### 6. Receivable (Contas a Receber)
```json
{
  "entryType": "receivable",
  "debitAccount": "Accounts Receivable",
  "creditAccount": "Revenue",
  "amount": 10000,
  "billingScheduleId": "billing-001"
}
```

**Quando criada**:
- Billing Schedule marcado como "invoiced"
- Representa faturamento não recebido

---

## 💰 Billing Schedules e Reconhecimento de Receita

### Relacionamento Billing ↔ Revenue

**Importante**: Billing Schedules e Revenue Recognition são **independentes** mas **relacionados**.

**Independência**:
- Você pode criar billing sem executar o motor
- Você pode executar o motor sem criar billing
- Billing não afeta o cálculo de reconhecimento de receita

**Relacionamento**:
- Motor usa billings para calcular Contract Assets/Liabilities
- Billing pago gera entrada de Cash no Revenue Ledger
- Billing faturado gera entrada de Receivable

### Fluxo Completo com Billing

```
1. Contrato Criado
   └─> Total Value: R$ 120.000

2. POs Criadas
   ├─> PO 1: R$ 80.000 (point in time)
   └─> PO 2: R$ 40.000 (over time)

3. Motor Executado
   └─> Receita Reconhecida: R$ 0
       Receita Diferida: R$ 120.000
       Revenue Ledger: 2 entradas (deferred_revenue)

4. Billing Schedule Criado
   └─> Amount: R$ 10.000
       Status: scheduled
       (Ainda não afeta Revenue Ledger)

5. Billing Marcado como Invoiced
   └─> Status: invoiced
       Motor recalcula:
       ├─> Receita Reconhecida: R$ 0
       ├─> Total Faturado: R$ 10.000
       └─> Contract Liability: R$ 10.000
           (Faturou mais do que reconheceu)
   └─> Revenue Ledger: +1 entrada (contract_liability)

6. PO 1 Satisfeita + Motor Executado
   └─> Receita Reconhecida: R$ 80.000
       Total Faturado: R$ 10.000
       Contract Asset: R$ 70.000
       (Reconheceu mais do que faturou)
   └─> Revenue Ledger: 
       ├─> +1 entrada (revenue: R$ 80k)
       └─> +1 entrada (contract_asset: R$ 70k)

7. Billing Marcado como Paid
   └─> Status: paid
       Motor recalcula:
       └─> Total Cash Received: R$ 10.000
   └─> Revenue Ledger: +1 entrada (cash: R$ 10k)
```

### Cálculo de Contract Asset vs Liability

**Fórmula**:
```typescript
// Busca todos os billings faturados ou pagos
const totalBilled = billings
  .filter(b => b.status === "invoiced" || b.status === "paid")
  .reduce((sum, b) => sum + b.amount, 0)

// Compara com receita reconhecida
if (totalRecognizedRevenue > totalBilled) {
  // Há Contract Asset
  contractAsset = totalRecognizedRevenue - totalBilled
  // Significa: Reconheceu receita, mas ainda não faturou tudo
} else if (totalBilled > totalRecognizedRevenue) {
  // Há Contract Liability
  contractLiability = totalBilled - totalRecognizedRevenue
  // Significa: Faturou, mas ainda não reconheceu toda a receita
}
```

**Exemplos**:

**Cenário 1: Contract Asset**
```
Receita Reconhecida: R$ 100.000
Total Faturado: R$ 30.000
Contract Asset: R$ 70.000

Interpretação: Você já reconheceu R$ 100k de receita (entregou o serviço),
mas só faturou R$ 30k. Os R$ 70k restantes são um ativo (direito de receber).
```

**Cenário 2: Contract Liability**
```
Receita Reconhecida: R$ 20.000
Total Faturado: R$ 50.000
Contract Liability: R$ 30.000

Interpretação: Você faturou R$ 50k (recebeu dinheiro adiantado),
mas só reconheceu R$ 20k de receita (entregou parcialmente).
Os R$ 30k restantes são um passivo (obrigação de entregar).
```

---

## 🎯 Cenários Avançados e Casos de Uso

### Cenário 1: Contrato com Múltiplas POs e Modificação

**Situação**:
- Contrato inicial: R$ 100.000
- PO 1: Software (R$ 60k) - point in time
- PO 2: Suporte (R$ 40k) - over time
- Após 3 meses: Contrato modificado para R$ 120.000

**Fluxo**:

1. **Setup Inicial**:
   ```
   Contract: R$ 100.000
   Version 1:
     PO 1: R$ 60.000 (point in time)
     PO 2: R$ 40.000 (over time)
   ```

2. **Motor Executa (Versão 1)**:
   ```
   Transaction Price: R$ 100.000
   PO 1 Alocada: R$ 60.000
   PO 2 Alocada: R$ 40.000
   Receita Reconhecida: R$ 0
   Receita Diferida: R$ 100.000
   ```

3. **PO 1 Satisfeita**:
   ```
   PO 1.isSatisfied = true
   ```

4. **Motor Executa Novamente**:
   ```
   Receita Reconhecida: R$ 60.000 (PO 1)
   Receita Diferida: R$ 40.000 (PO 2)
   ```

5. **Contrato Modificado**:
   ```
   Cloud Function: createContractVersion
   Version 2 criada:
     - Copia PO 1 e PO 2
     - Total Value atualizado: R$ 120.000
   Contract.currentVersionId = "version-2"
   ```

6. **Motor Executa (Versão 2)**:
   ```
   Transaction Price: R$ 120.000
   PO 1 Alocada: R$ 72.000 (60k * 1.2)
   PO 2 Alocada: R$ 48.000 (40k * 1.2)
   
   Mas PO 1 já foi satisfeita na versão 1!
   → Reconhece R$ 72.000 (novo valor)
   → Ajuste de R$ 12.000 (diferença)
   
   Receita Reconhecida: R$ 72.000
   Receita Diferida: R$ 48.000
   ```

7. **Revenue Ledger**:
   ```
   Entrada 1: Revenue R$ 60.000 (versão 1)
   Entrada 2: Ajuste R$ 12.000 (diferença versão 2)
   Entrada 3: Deferred R$ 48.000 (PO 2 versão 2)
   ```

### Cenário 2: Contrato com Componente de Financiamento

**Situação**:
- Contrato: R$ 120.000
- Pagamento: 24 meses (R$ 5.000/mês)
- Taxa de desconto: 10% ao ano

**Fluxo**:

1. **Criar Financing Component**:
   ```
   Nominal Amount: R$ 120.000
   Discount Rate: 10%
   Period: 24 months
   
   Cálculo:
   Present Value = 120.000 / (1.00833)^24 = R$ 98.350
   Total Interest = 120.000 - 98.350 = R$ 21.650
   ```

2. **Motor Executa**:
   ```
   Transaction Price = Fixed Price - Financing Component
   Transaction Price = 120.000 - 21.650 = R$ 98.350
   
   (O preço da transação é o valor presente, não o nominal)
   ```

3. **Alocação**:
   ```
   PO 1 Alocada: R$ 65.567 (66.67% de 98.350)
   PO 2 Alocada: R$ 32.783 (33.33% de 98.350)
   ```

4. **Reconhecimento de Juros**:
   ```
   Juros são reconhecidos ao longo dos 24 meses
   Mensal: R$ 21.650 / 24 = R$ 902,08
   
   Revenue Ledger:
   - Entradas de Revenue (receita principal)
   - Entradas de Financing Income (juros mensais)
   ```

### Cenário 3: Contrato com Ingestão Automática

**Situação**: Você tem um PDF de contrato e quer importar automaticamente

**Fluxo**:

1. **Upload PDF**:
   ```
   /contract-ingestion → Upload arquivo PDF
   Sistema extrai texto (OCR)
   ```

2. **Envio para IA**:
   ```
   Cloud Function: extractContractData
   Envia texto para LLM (GPT-4, Claude, etc.)
   LLM extrai dados estruturados:
   {
     contractNumber: "CTR-2024-100",
     title: "Software License Agreement",
     customerName: "TechCorp",
     startDate: "2024-01-01",
     totalValue: 120000,
     lineItems: [...],
     performanceObligations: [...]
   }
   ```

3. **Revisão Manual**:
   ```
   Sistema mostra dados extraídos
   Usuário revisa e corrige se necessário
   Adiciona notas de revisão
   ```

4. **Aprovação**:
   ```
   Cloud Function: approveReviewAndCreateContract
   
   Cria automaticamente:
   ├─> Customer (se não existir)
   ├─> Contract
   ├─> Version 1
   ├─> Line Items
   └─> Performance Obligations
   ```

5. **Próximos Passos**:
   ```
   Contrato já está pronto!
   Pode executar o motor imediatamente
   ```

---

## 🔧 Troubleshooting e Problemas Comuns

### Problema 1: Botão "Add" de PO Bloqueado

**Causa**: Contrato não tem versão

**Solução**:
- Sistema cria versão automaticamente ao adicionar primeira PO
- Se não criar, verifique se o contrato foi criado corretamente

**Verificação**:
```typescript
// Verificar se contrato tem versão
const contract = await contractService.getById(tenantId, contractId)
if (!contract.currentVersionId) {
  // Criar versão manualmente se necessário
}
```

### Problema 2: Motor Não Reconhece Receita

**Causas Possíveis**:

1. **PO Point in Time não está satisfeita**:
   ```
   Solução: Marcar PO.isSatisfied = true
   ```

2. **PO Over Time com percentComplete = 0**:
   ```
   Solução: Atualizar PO.percentComplete > 0
   ```

3. **Motor não foi executado após mudanças**:
   ```
   Solução: Executar motor novamente
   ```

**Verificação**:
```typescript
// Verificar estado das POs
const pos = await performanceObligationService.getAll(tenantId, contractId, versionId)
pos.forEach(po => {
  console.log(`PO: ${po.description}`)
  console.log(`  isSatisfied: ${po.isSatisfied}`)
  console.log(`  percentComplete: ${po.percentComplete}`)
  console.log(`  recognizedAmount: ${po.recognizedAmount}`)
})
```

### Problema 3: Soma de POs Não Bate com Valor do Contrato

**Causa**: Preços alocados incorretos

**Solução**:
- Verificar soma: `PO1.allocatedPrice + PO2.allocatedPrice = Contract.totalValue`
- Ajustar preços alocados se necessário
- Executar motor novamente (motor recalcula alocações)

**Validação**:
```typescript
const totalPOs = pos.reduce((sum, po) => sum + po.allocatedPrice, 0)
const contractValue = contract.totalValue

if (Math.abs(totalPOs - contractValue) > 0.01) {
  console.error("Soma de POs não bate com valor do contrato!")
}
```

### Problema 4: Revenue Ledger Não Atualiza

**Causas**:

1. **Motor não foi executado**:
   ```
   Solução: Executar motor
   ```

2. **Cache do React Query**:
   ```
   Solução: Invalidar cache
   queryClient.invalidateQueries(["ledger-entries"])
   ```

3. **Motor executou mas não gerou entradas**:
   ```
   Verificar: Se há receita reconhecida
   Se não há, verificar POs
   ```

### Problema 5: Contract Asset/Liability Incorreto

**Causa**: Billing Schedules não estão atualizados

**Solução**:
1. Verificar status dos billings
2. Marcar como "invoiced" quando faturar
3. Marcar como "paid" quando receber
4. Executar motor novamente

**Verificação**:
```typescript
const billings = await billingScheduleService.getByContract(tenantId, contractId)
const totalBilled = billings
  .filter(b => b.status === "invoiced" || b.status === "paid")
  .reduce((sum, b) => sum + b.amount, 0)

console.log(`Total Faturado: ${totalBilled}`)
console.log(`Receita Reconhecida: ${totalRecognized}`)
console.log(`Contract Asset: ${Math.max(0, totalRecognized - totalBilled)}`)
console.log(`Contract Liability: ${Math.max(0, totalBilled - totalRecognized)}`)
```

---

## 📊 Resumo dos Relacionamentos

### Tabela de Dependências

| Funcionalidade | Depende De | Gera/Cria | Usado Por |
|---------------|------------|-----------|-----------|
| **Customer** | Nada | - | Contracts |
| **Contract** | Customer | Version (automático) | POs, Billings, Revenue Ledger |
| **Version** | Contract | - | POs, Line Items |
| **PO** | Version | Revenue Schedules | Motor IFRS 15, Revenue Ledger |
| **Billing Schedule** | Contract | - | Motor IFRS 15, Revenue Ledger |
| **Motor IFRS 15** | Contract, Version, POs | Revenue Schedules, Revenue Ledger Entries | Dashboard, Reports |
| **Revenue Ledger** | Contract, PO, Billing | - | Dashboard, Consolidated Balances |
| **Financing Component** | Contract | - | Motor IFRS 15 |

### Fluxo de Dados Principal

```
Customer
  ↓
Contract (cria Version automaticamente)
  ↓
Performance Obligations (adicionadas manualmente)
  ↓
Motor IFRS 15 (calcula e atualiza)
  ├─> Atualiza POs (recognizedAmount, deferredAmount)
  ├─> Cria Revenue Schedules
  └─> Cria Revenue Ledger Entries
      ↓
Dashboard (agrega dados)
```

### Quando Executar o Motor

Execute o motor quando:
- ✅ Adicionar novas POs
- ✅ Modificar POs existentes
- ✅ Marcar PO como satisfeita (point in time)
- ✅ Atualizar percentComplete (over time)
- ✅ Criar/modificar Billing Schedules
- ✅ Modificar contrato (nova versão)
- ✅ Adicionar Componente de Financiamento

**Não precisa executar**:
- ❌ Apenas visualizar dados
- ❌ Criar Billing Schedule (mas execute depois para calcular Assets/Liabilities)

---

## 🎓 Conclusão

Este tutorial detalhado cobre:

1. ✅ **Fluxos completos** passo a passo
2. ✅ **Como cada função se relaciona** com outras
3. ✅ **Funcionamento interno** do Motor IFRS 15
4. ✅ **Sistema de versionamento** de contratos
5. ✅ **Fluxo de dados** entre componentes
6. ✅ **Cenários avançados** e casos de uso
7. ✅ **Troubleshooting** de problemas comuns

**Principais Takeaways**:

- **Motor IFRS 15 é o orquestrador central** que conecta todas as funcionalidades
- **Versionamento preserva histórico** e permite modificações
- **Revenue Ledger é gerado automaticamente** pelo motor
- **Billing Schedules são independentes** mas usados para calcular Assets/Liabilities
- **Sempre execute o motor após mudanças significativas**

Para mais detalhes técnicos, consulte `ARQUITETURA_E_FLUXOS.md`.
