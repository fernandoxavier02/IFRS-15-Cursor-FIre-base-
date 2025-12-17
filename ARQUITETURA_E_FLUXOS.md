# Arquitetura e Fluxos do Sistema IFRS 15 Revenue Manager

## 📋 Índice
1. [Visão Geral da Arquitetura](#visão-geral)
2. [Fluxo de Autenticação](#fluxo-de-autenticação)
3. [Estrutura de Dados (Firestore)](#estrutura-de-dados)
4. [Camada de Serviços](#camada-de-serviços)
5. [Páginas e Funcionalidades](#páginas-e-funcionalidades)
6. [Fluxos Principais de Negócio](#fluxos-principais)
7. [Como Tudo Se Relaciona](#relacionamentos)

---

## 🏗️ Visão Geral da Arquitetura

### Stack Tecnológico
- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase Functions (Node.js)
- **Banco de Dados**: Cloud Firestore
- **Autenticação**: Firebase Authentication
- **Hosting**: Firebase Hosting
- **Estado**: React Query (TanStack Query)
- **Roteamento**: Wouter

### Estrutura de Pastas
```
client/src/
├── pages/          # Páginas da aplicação
├── components/     # Componentes reutilizáveis
├── lib/            # Serviços e utilitários
│   ├── firestore-service.ts  # Camada de acesso ao Firestore
│   ├── auth-firebase.tsx      # Autenticação
│   └── queryClient.ts         # Configuração React Query
└── App.tsx         # Roteador principal
```

---

## 🔐 Fluxo de Autenticação

### 1. Inicialização da Aplicação

```
App.tsx
  └─> AuthProvider (auth-firebase.tsx)
      └─> Verifica estado de autenticação do Firebase
          ├─> Se autenticado: busca dados do usuário no Firestore
          └─> Se não autenticado: mantém estado de loading
```

### 2. Processo de Login

```
1. Usuário acessa /login
   └─> Login.tsx exibe formulário

2. Usuário preenche email/senha e submete
   └─> login(email, password) em auth-firebase.tsx
       ├─> signInWithEmailAndPassword() do Firebase Auth
       ├─> fetchUserData() busca dados do usuário no Firestore
       │   └─> Collection: users/{userId}
       │       └─> Retorna: { tenantId, role, isActive, mustChangePassword, ... }
       │
       └─> Atualiza estado de autenticação
           ├─> Se mustChangePassword = true → redireciona para /change-password
           ├─> Se isActive = false → redireciona para /activate-license
           └─> Caso contrário → redireciona para / (Dashboard)
```

### 3. Proteção de Rotas

```
MainRouter (App.tsx)
  ├─> Verifica isAuthenticated
  ├─> Verifica needsPasswordChange → /change-password
  ├─> Verifica needsLicenseActivation → /activate-license
  └─> Se tudo OK → renderiza AppLayout com sidebar
```

### 4. Estrutura de Usuário no Firestore

```typescript
users/{userId}
{
  email: string
  tenantId: string          // ID do tenant (organização)
  role: "admin" | "finance" | "auditor" | "operations" | "readonly"
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Timestamp
  // ... outros campos
}
```

---

## 💾 Estrutura de Dados (Firestore)

### Hierarquia de Collections

```
tenants/{tenantId}/
├── customers/              # Clientes
├── contracts/              # Contratos
│   └── {contractId}/
│       ├── versions/       # Versões do contrato (modificações)
│       │   └── {versionId}/
│       │       ├── lineItems/           # Itens de linha
│       │       └── performanceObligations/  # Obrigações de performance
│       └── billingSchedules/  # Cronogramas de faturamento
├── revenueLedgerEntries/   # Entradas do razão de receita
├── financingComponents/    # Componentes de financiamento
├── exchangeRates/          # Taxas de câmbio
├── consolidatedBalances/   # Balanços consolidados
├── licenses/               # Licenças de software
└── auditLogs/             # Logs de auditoria
```

### Principais Entidades

#### 1. Tenant (Organização)
```typescript
tenants/{tenantId}
{
  name: string
  country: string
  currency: string
  planType: "starter" | "professional" | "enterprise"
  maxContracts: number
  maxLicenses: number
}
```

#### 2. Customer (Cliente)
```typescript
tenants/{tenantId}/customers/{customerId}
{
  name: string
  country: string
  currency: string
  taxId?: string
  contactEmail?: string
  // ...
}
```

#### 3. Contract (Contrato)
```typescript
tenants/{tenantId}/contracts/{contractId}
{
  customerId: string
  contractNumber: string
  title: string
  status: "draft" | "active" | "modified" | "terminated" | "expired"
  startDate: Timestamp
  endDate?: Timestamp
  totalValue: number
  currency: string
  currentVersionId?: string  // ID da versão atual
  // ...
}
```

#### 4. Contract Version (Versão do Contrato)
```typescript
tenants/{tenantId}/contracts/{contractId}/versions/{versionId}
{
  contractId: string
  versionNumber: number
  effectiveDate: Timestamp
  totalValue: number
  isProspective: boolean
  modificationReason?: string
  // ...
}
```

#### 5. Performance Obligation (Obrigação de Performance)
```typescript
tenants/{tenantId}/contracts/{contractId}/versions/{versionId}/performanceObligations/{poId}
{
  contractVersionId: string
  description: string
  allocatedPrice: number
  recognitionMethod: "over_time" | "point_in_time"
  percentComplete: number
  recognizedAmount: number
  deferredAmount: number
  // ...
}
```

---

## 🔧 Camada de Serviços

### firestore-service.ts

Este arquivo centraliza TODAS as operações com o Firestore. Cada entidade tem seu próprio serviço:

#### Estrutura de um Serviço

```typescript
export const customerService = {
  // Buscar todos
  async getAll(tenantId: string): Promise<Customer[]>
  
  // Buscar por ID
  async getById(tenantId: string, id: string): Promise<Customer | null>
  
  // Criar
  async create(tenantId: string, data: Omit<Customer, "id" | "createdAt">): Promise<string>
  
  // Atualizar
  async update(tenantId: string, id: string, data: Partial<Customer>): Promise<void>
  
  // Deletar
  async delete(tenantId: string, id: string): Promise<void>
}
```

#### Serviços Disponíveis

1. **customerService** - Gerenciamento de clientes
2. **contractService** - Gerenciamento de contratos
3. **contractVersionService** - Versões de contratos
4. **lineItemService** - Itens de linha
5. **performanceObligationService** - Obrigações de performance
6. **billingScheduleService** - Cronogramas de faturamento
7. **revenueLedgerService** - Razão de receita
8. **financingComponentService** - Componentes de financiamento
9. **exchangeRateService** - Taxas de câmbio
10. **consolidatedBalanceService** - Balanços consolidados
11. **licenseService** - Licenças
12. **auditLogService** - Logs de auditoria

#### Helpers Genéricos

```typescript
// Buscar documento por ID
getDocById<T>(path: string, id: string): Promise<T | null>

// Buscar coleção com filtros
getCollection<T>(path: string, ...constraints: QueryConstraint[]): Promise<T[]>

// Adicionar documento
addDocument<T>(path: string, data: Omit<T, "id" | "createdAt">): Promise<string>

// Atualizar documento
updateDocument(path: string, id: string, data: Record<string, any>): Promise<void>

// Deletar documento
deleteDocument(path: string, id: string): Promise<void>

// Deletar subcoleções (cascata)
deleteSubcollections(parentPath, parentId, subcollectionNames): Promise<void>
```

---

## 📄 Páginas e Funcionalidades

### 1. Dashboard (`/`)
**Arquivo**: `dashboard.tsx`

**Função**: Visão geral do sistema com métricas e alertas

**Fluxo**:
```
1. Carrega dados via React Query:
   - Contratos (contractService.getAll)
   - Revenue Ledger (revenueLedgerService.getAll)
   - Plan Info (tenantService.getPlanInfo)

2. Calcula métricas:
   - Total de contratos
   - Receita reconhecida vs diferida
   - Tendências de receita (últimos 12 meses)
   - Alertas de compliance (contratos expirando)

3. Exibe gráficos e cards com métricas
```

**Dados Exibidos**:
- Gráfico de tendência de receita (12 meses)
- Cards de métricas (Total Revenue, Recognized, Deferred)
- Alertas de compliance (contratos expirando, Q4 targets)

---

### 2. Customers (`/customers`)
**Arquivo**: `customers.tsx`

**Função**: Gerenciar clientes

**Fluxo**:
```
1. Lista clientes (customerService.getAll)
2. Permite criar novo cliente
3. Permite editar cliente existente
4. Exibe lista em tabela com busca
```

**Operações**:
- `createMutation` → `customerService.create()`
- `updateMutation` → `customerService.update()`
- `deleteMutation` → `customerService.delete()`

---

### 3. Contracts (`/contracts`)
**Arquivo**: `contracts.tsx`

**Função**: Listar e criar contratos

**Fluxo**:
```
1. Lista contratos (contractService.getAll)
2. Busca clientes para dropdown (customerService.getAll)
3. Ao criar contrato:
   └─> contractService.create()
       └─> Cria versão inicial automaticamente
           └─> contractVersionService.create()
               └─> Atualiza contract.currentVersionId
```

**Dados Exibidos**:
- Tabela com contratos
- Filtros por status
- Busca por número/título

---

### 4. Contract Details (`/contracts/:id`)
**Arquivo**: `contract-details.tsx`

**Função**: Visualizar e gerenciar detalhes de um contrato

**Fluxo**:
```
1. Carrega contrato (contractService.getById)
2. Carrega versões (contractVersionService.getAll)
3. Carrega obrigações de performance (performanceObligationService.getAll)
4. Carrega cronogramas (billingScheduleService.getByContract)
5. Carrega razão de receita (revenueLedgerService.getByContract)

6. Abas:
   - Overview: Informações gerais
   - Performance Obligations: Lista e adiciona POs
   - Billing Schedule: Cronograma de faturamento
   - Revenue Ledger: Entradas de receita
```

**Operações Especiais**:
- Se não houver versão ao adicionar PO → cria versão inicial automaticamente
- Permite adicionar Performance Obligations
- Exibe histórico de versões

---

### 5. IFRS 15 Engine (`/ifrs15`)
**Arquivo**: `ifrs15.tsx`

**Função**: Executar motor de cálculo IFRS 15

**Fluxo**:
```
1. Lista contratos disponíveis
2. Ao selecionar contrato:
   └─> Carrega Performance Obligations do contrato
       └─> Se não houver versão, busca primeira versão

3. Ao clicar "Executar Motor":
   └─> Chama Cloud Function: runIFRS15Engine
       └─> Executa 5 passos do IFRS 15:
           1. Identificar o contrato
           2. Identificar obrigações de performance
           3. Determinar preço da transação
           4. Alocar preço às obrigações
           5. Reconhecer receita quando satisfeita

4. Exibe resultados:
   - Preço total da transação
   - Alocações por PO
   - Cronograma de reconhecimento
   - Receita reconhecida vs diferida
```

**Cloud Function**: `functions/src/ifrs15/engine.ts`

---

### 6. Billing Schedules (`/billing-schedules`)
**Arquivo**: `billing-schedules.tsx`

**Função**: Gerenciar cronogramas de faturamento

**Fluxo**:
```
1. Lista cronogramas (billingScheduleService.getAll)
2. Calcula métricas:
   - Upcoming (próximos 30 dias)
   - Overdue (vencidos)
   - Total scheduled

3. Permite criar novo cronograma:
   └─> billingScheduleService.create()

4. Permite atualizar status:
   - scheduled → invoiced
   - invoiced → paid
```

**Visualizações**:
- Lista (tabela)
- Calendário (visualização mensal)

---

### 7. Revenue Ledger (`/revenue-ledger`)
**Arquivo**: `revenue-ledger.tsx`

**Função**: Razão de receita (entradas de receita reconhecida)

**Fluxo**:
```
1. Lista entradas (revenueLedgerService.getAll)
2. Filtros:
   - Por contrato
   - Por período
   - Por tipo (recognized, deferred)

3. Permite criar entrada manual:
   └─> revenueLedgerService.create()

4. Exibe totais:
   - Receita reconhecida
   - Receita diferida
   - Por contrato
```

---

### 8. Financing Components (`/financing-components`)
**Arquivo**: `financing-components.tsx`

**Função**: Calcular componentes de financiamento significativo (IFRS 15.60-65)

**Fluxo**:
```
1. Lista componentes existentes (financingComponentService.getAll)

2. Ao criar novo componente:
   └─> Calcula valor presente:
       - PV = Nominal / (1 + rate/12)^months
   └─> Calcula juros totais:
       - Interest = Nominal - PV
   └─> Salva (financingComponentService.create)

3. Exibe:
   - Total nominal
   - Total valor presente
   - Total juros
   - Juros reconhecidos
```

**Fórmula**:
```
Present Value = Nominal Amount / (1 + (Annual Rate / 12))^Months
Total Interest = Nominal Amount - Present Value
```

---

### 9. Consolidated Balances (`/consolidated-balances`)
**Arquivo**: `consolidated-balances.tsx`

**Função**: Balanços consolidados por período

**Fluxo**:
```
1. Lista balanços (consolidatedBalanceService.getAll)
2. Agrupa por período (mensal/trimestral)
3. Calcula:
   - Contract Assets
   - Contract Liabilities
   - Recognized Revenue
   - Deferred Revenue
```

---

### 10. Revenue Waterfall (`/revenue-waterfall`)
**Arquivo**: `revenue-waterfall.tsx`

**Função**: Visualização em cascata da receita

**Fluxo**:
```
1. Agrega dados de Revenue Ledger
2. Agrupa por período
3. Visualiza:
   - Receita bruta
   - Ajustes
   - Receita líquida
```

---

### 11. Contract Costs (`/contract-costs`)
**Arquivo**: `contract-costs.tsx`

**Função**: Custos de obtenção e cumprimento de contratos

---

### 12. Exchange Rates (`/exchange-rates`)
**Arquivo**: `exchange-rates.tsx`

**Função**: Gerenciar taxas de câmbio

**Fluxo**:
```
1. Lista taxas (exchangeRateService.getAll)
2. Permite criar/editar taxa
3. Usado para conversão de moedas em contratos
```

---

### 13. Executive Dashboard (`/executive-dashboard`)
**Arquivo**: `executive-dashboard.tsx`

**Função**: Dashboard executivo com KPIs e métricas avançadas

---

### 14. IFRS 15 Accounting Control (`/ifrs15-accounting-control`)
**Arquivo**: `ifrs15-accounting-control.tsx`

**Função**: Controles contábeis e validações IFRS 15

---

### 15. Contract Ingestion (`/contract-ingestion`)
**Arquivo**: `contract-ingestion.tsx`

**Função**: Ingestão de contratos via IA (OCR + LLM)

**Fluxo**:
```
1. Upload de PDF
2. Extração de texto (OCR)
3. Envio para LLM (GPT-4, Claude, etc.)
4. LLM extrai dados estruturados:
   - Informações do contrato
   - Cláusulas relevantes
   - Valores e datas
5. Revisão manual
6. Aprovação → cria contrato automaticamente
```

**Cloud Functions**:
- `extractContractData` - Extração via IA
- `approveReviewAndCreateContract` - Aprovação e criação

---

### 16. Delete Management (`/delete-management`)
**Arquivo**: `delete-management.tsx`

**Função**: Exclusão segura de clientes e contratos

**Fluxo**:
```
1. Lista clientes e contratos
2. Validações:
   - Não permite deletar cliente com contratos
   - Requer confirmação dupla (digitar nome/número)
3. Deleta em cascata:
   - Contrato → deleta versões, POs, lineItems
   - Contrato → deleta billingSchedules relacionados
   - Contrato → deleta revenueLedgerEntries relacionados
```

---

### 17. Audit Trail (`/audit`)
**Arquivo**: `audit.tsx`

**Função**: Logs de auditoria de todas as ações

**Fluxo**:
```
1. Lista logs (auditLogService.getAll)
2. Filtros:
   - Por usuário
   - Por entidade
   - Por ação
   - Por período
```

---

### 18. Settings (`/settings`)
**Arquivo**: `settings.tsx`

**Função**: Configurações do usuário e tenant

---

### 19. AI Settings (`/ai-settings`)
**Arquivo**: `ai-settings.tsx`

**Função**: Configuração de provedores de IA

---

## 🔄 Fluxos Principais de Negócio

### Fluxo 1: Criar e Processar Contrato Completo

```
1. Criar Cliente
   └─> customers.tsx
       └─> customerService.create()
           └─> Firestore: tenants/{tenantId}/customers/{customerId}

2. Criar Contrato
   └─> contracts.tsx
       └─> contractService.create()
           ├─> Firestore: tenants/{tenantId}/contracts/{contractId}
           └─> Cria versão inicial automaticamente
               └─> contractVersionService.create()
                   └─> Firestore: contracts/{contractId}/versions/{versionId}

3. Adicionar Performance Obligations
   └─> contract-details.tsx (aba Performance Obligations)
       └─> performanceObligationService.create()
           └─> Firestore: contracts/{contractId}/versions/{versionId}/performanceObligations/{poId}

4. Executar Motor IFRS 15
   └─> ifrs15.tsx
       └─> Cloud Function: runIFRS15Engine
           ├─> Calcula alocações
           ├─> Gera cronograma de reconhecimento
           └─> Atualiza POs com valores calculados

5. Criar Cronograma de Faturamento
   └─> billing-schedules.tsx
       └─> billingScheduleService.create()
           └─> Firestore: tenants/{tenantId}/billingSchedules/{scheduleId}

6. Reconhecer Receita
   └─> revenue-ledger.tsx
       └─> revenueLedgerService.create()
           └─> Firestore: tenants/{tenantId}/revenueLedgerEntries/{entryId}
```

### Fluxo 2: Ingestão Automática de Contrato

```
1. Upload PDF
   └─> contract-ingestion.tsx
       └─> Extrai texto (OCR)

2. Envia para IA
   └─> Cloud Function: extractContractData
       └─> LLM extrai dados estruturados

3. Revisão Manual
   └─> Usuário revisa e corrige dados extraídos

4. Aprovação
   └─> Cloud Function: approveReviewAndCreateContract
       ├─> Cria contrato
       ├─> Cria versão inicial
       ├─> Cria lineItems (se houver)
       └─> Cria performanceObligations (se houver)
```

### Fluxo 3: Modificação de Contrato

```
1. Acessar Contract Details
   └─> contract-details.tsx

2. Criar Nova Versão
   └─> Cloud Function: createContractVersion
       ├─> Copia versão atual
       ├─> Incrementa versionNumber
       ├─> Copia lineItems
       ├─> Copia performanceObligations
       └─> Atualiza contract.currentVersionId

3. Modificar Dados
   └─> Edita lineItems ou POs na nova versão

4. Motor IFRS 15 recalcula
   └─> ifrs15.tsx
       └─> runIFRS15Engine (com nova versão)
```

---

## 🔗 Como Tudo Se Relaciona

### Camadas da Aplicação

```
┌─────────────────────────────────────┐
│         PÁGINAS (UI)                │
│  (React Components + Hooks)        │
└──────────────┬──────────────────────┘
               │
               │ useQuery / useMutation
               │
┌──────────────▼──────────────────────┐
│    REACT QUERY (Estado/Cache)        │
│  (queryClient, invalidações)         │
└──────────────┬──────────────────────┘
               │
               │ Chama métodos
               │
┌──────────────▼──────────────────────┐
│   FIRESTORE SERVICE (Camada)         │
│  (firestore-service.ts)               │
│  - customerService                   │
│  - contractService                   │
│  - billingScheduleService             │
│  - ...                                │
└──────────────┬──────────────────────┘
               │
               │ Firebase SDK
               │
┌──────────────▼──────────────────────┐
│      CLOUD FIRESTORE                 │
│  (Banco de Dados NoSQL)              │
└──────────────────────────────────────┘
```

### Fluxo de Dados Típico

```
1. Usuário interage com UI (página)
   └─> Dispara ação (ex: criar contrato)

2. Página usa useMutation
   └─> mutationFn chama contractService.create()

3. firestore-service.ts
   └─> Usa Firebase SDK (addDoc, getDoc, etc.)
       └─> Escreve no Firestore

4. Firestore atualiza dados
   └─> Emite evento de mudança

5. React Query detecta mudança
   └─> Invalida queries relacionadas
       └─> Refaz fetch automático

6. UI atualiza automaticamente
   └─> Dados novos aparecem na tela
```

### Relacionamentos entre Entidades

```
Tenant (Organização)
  │
  ├─> Customers (1:N)
  │     │
  │     └─> Contracts (1:N)
  │           │
  │           ├─> Versions (1:N)
  │           │     │
  │           │     ├─> Line Items (1:N)
  │           │     └─> Performance Obligations (1:N)
  │           │
  │           ├─> Billing Schedules (1:N)
  │           └─> Revenue Ledger Entries (1:N)
  │
  ├─> Financing Components (1:N)
  ├─> Exchange Rates (1:N)
  ├─> Consolidated Balances (1:N)
  └─> Licenses (1:N)
```

### Dependências entre Páginas

```
Dashboard
  └─> Depende de: Contracts, Revenue Ledger

Contract Details
  └─> Depende de: Contract, Versions, POs, Billing, Revenue Ledger

IFRS 15 Engine
  └─> Depende de: Contract, Versions, POs
      └─> Gera: Revenue Ledger Entries

Billing Schedules
  └─> Depende de: Contracts
      └─> Relacionado com: Revenue Ledger

Revenue Ledger
  └─> Depende de: Contracts, POs
      └─> Usado por: Dashboard, Consolidated Balances
```

---

## 🎯 Pontos Importantes

### 1. Multi-tenancy
- Todos os dados são isolados por `tenantId`
- Cada usuário pertence a um tenant
- Queries sempre filtram por `tenantId`

### 2. Versionamento de Contratos
- Contratos podem ter múltiplas versões (modificações)
- Apenas uma versão é "atual" (`currentVersionId`)
- Versões antigas são mantidas para histórico

### 3. Cascata de Deletions
- Deletar contrato → deleta versões, POs, lineItems
- Deletar contrato → deleta billingSchedules relacionados
- Deletar contrato → deleta revenueLedgerEntries relacionados
- Não permite deletar cliente com contratos

### 4. Criação Automática de Versão
- Ao criar contrato → versão inicial criada automaticamente
- Ao adicionar PO sem versão → versão criada automaticamente

### 5. React Query Cache
- Queries são cacheadas por `queryKey`
- Invalidações atualizam cache automaticamente
- Exemplo: `["contracts", tenantId]` → cache de contratos

### 6. Cloud Functions
- Operações complexas rodam no backend
- Exemplos: `runIFRS15Engine`, `extractContractData`
- Acesso via `httpsCallable` do Firebase Functions

---

## 📝 Resumo Executivo

O sistema IFRS 15 Revenue Manager é uma aplicação React que gerencia contratos e receita conforme o padrão IFRS 15. A arquitetura segue o padrão:

1. **Frontend React** → Páginas interativas
2. **React Query** → Gerenciamento de estado e cache
3. **Firestore Service** → Camada de abstração para Firestore
4. **Cloud Firestore** → Banco de dados NoSQL
5. **Cloud Functions** → Lógica de negócio complexa

O fluxo principal é: **Usuário → Página → React Query → Service → Firestore → Atualização automática da UI**.

Todas as operações são multi-tenant, garantindo isolamento de dados entre organizações.
