# Migration TODO - Eliminar Legado /api e Padronizar Firebase

**Data de Criação**: Dezembro 2024
**Objetivo**: Remover resquícios de Express/Replit/Drizzle/Postgres e padronizar 100% em Firebase

---

## 📋 INVENTÁRIO - Parte A

### 1. Exports Existentes em `functions/src/index.ts`

#### Auth Triggers
- `activateUserLicense` - Callable para ativar licença de usuário
- `createUserWithTenant` - Callable para criar usuário com tenant
- `onUserCreated` - Trigger onCreate
- `onUserDeleted` - Trigger onDelete
- `setUserClaims` - Callable para setar claims

#### Stripe
- `createCheckoutSession` - Callable para criar sessão de checkout
- `createPortalSession` - Callable para portal do cliente
- `getStripePublishableKey` - Callable para obter chave pública
- `getSubscriptionPlans` - Callable para listar planos
- `cancelSubscription` - Callable para cancelar assinatura
- `resumeSubscription` - Callable para reativar assinatura
- `stripeWebhook` - HTTPS webhook do Stripe

#### AI
- `processIngestionJob` - Trigger para processar jobs de ingestão
- `approveReviewAndCreateContract` - Callable para aprovar review

#### REST APIs (HTTPS)
- `contractsApi` - API REST para contratos
- `customersApi` - API REST para clientes
- `dashboardApi` - API REST para dashboard

#### IFRS 15 Engine
- `runIFRS15Engine` - Callable para executar motor IFRS 15
- `createContractVersion` - Callable para criar versão de contrato
- `generateBillingSchedule` - Callable para gerar cronograma de faturamento

#### Reports
- `generateDisaggregatedRevenueReport` - Callable para relatório de receita desagregada
- `generateContractBalancesReport` - Callable para relatório de saldos
- `generateRemainingObligationsReport` - Callable para relatório de obrigações restantes

#### Scheduled Functions
- `cleanupExpiredCheckouts` - Diário às 2h
- `checkOverdueBillings` - Diário às 8h
- `releaseLicenseLocks` - A cada 10 minutos
- `calculateMonthlyBalances` - 1º de cada mês
- `processEmailQueue` - A cada 5 minutos

#### Outros
- `initializeSystem` - HTTPS para inicialização (⚠️ TEM CREDENCIAIS HARDCODED)
- `licenseHeartbeat` - Callable para heartbeat de licença

---

### 2. Chamadas `/api/` no Frontend

| Arquivo | Linha | Endpoint | Status | Substituição Proposta |
|---------|-------|----------|--------|----------------------|
| `admin-licenses.tsx` | 127 | `/api/admin/licenses` | ❌ Quebrado | Criar service Firestore + Function |
| `ai-settings.tsx` | 406 | Placeholder URL | ✅ OK | Não é chamada real |

---

### 3. Arquivos `convertApiUrl` e `apiRequest`

| Arquivo | Status | Ação |
|---------|--------|------|
| `queryClient.ts` | Parcialmente usado | Remover após migração completa |

**Mapeamentos existentes em `convertApiUrl`:**
- `/api/contracts` → `contractsApi` ✅
- `/api/customers` → `customersApi` ✅
- `/api/dashboard` → `dashboardApi` ✅

---

### 4. Arquivos Legados a Remover

| Pasta/Arquivo | Tipo | Ação |
|---------------|------|------|
| `server/` | Pasta inteira | 🗑️ REMOVER |
| `server/ai-service.ts` | Express service | 🗑️ REMOVER |
| `server/db.legacy.ts` | Drizzle DB | 🗑️ REMOVER |
| `server/email.ts` | Email service | 🗑️ REMOVER |
| `server/index.ts` | Express entry | 🗑️ REMOVER |
| `server/routes.legacy.ts` | Express routes | 🗑️ REMOVER |
| `server/static.ts` | Static files | 🗑️ REMOVER |
| `server/storage.legacy.ts` | Drizzle storage | 🗑️ REMOVER |
| `server/stripeClient.ts` | Stripe client | 🗑️ REMOVER (usar functions) |
| `server/vite.ts` | Vite middleware | 🗑️ REMOVER |
| `server/webhookHandlers.ts` | Webhook handlers | 🗑️ REMOVER |
| `drizzle.config.ts` | Drizzle config | 🗑️ REMOVER |
| `shared/schema.ts` | Drizzle schema | 🗑️ REMOVER |
| `replit.md` | Replit docs | 🗑️ REMOVER |

---

### 5. Credenciais Hardcoded (⚠️ CRÍTICO)

| Arquivo | Linha | Problema | Ação |
|---------|-------|----------|------|
| `functions/src/index.ts` | 266 | `INIT_SECRET_2024` | 🔒 Usar Secret Manager |
| `functions/src/index.ts` | 274 | `ADMIN_EMAIL` hardcoded | 🔒 Usar env vars |
| `functions/src/index.ts` | 275 | `ADMIN_PASSWORD` hardcoded | 🔒 Usar Secret Manager |

---

## ✅ CHECKLIST DE MIGRAÇÃO

### Parte B - Limpeza de Legado
- [ ] Remover pasta `server/` inteira
- [ ] Remover `drizzle.config.ts`
- [ ] Remover `shared/schema.ts` (manter `firestore-types.ts`)
- [ ] Remover `replit.md`
- [ ] Verificar package.json raiz (já limpo ✅)
- [ ] Remover scripts de migração obsoletos

### Parte C - Padronizar Data Layer
- [ ] Verificar todas as páginas usam services Firestore
- [ ] Remover `convertApiUrl` quando não mais necessário
- [ ] Garantir que nenhuma página usa URL literal `/api/`

### Parte D - APIs Faltantes
- [ ] `admin/licenses` - Implementar listagem admin de licenças
- [ ] Verificar se todas as features têm backend correspondente

### Parte E - Segurança e Onboarding
- [ ] Implementar `onboardUser` callable
- [ ] Remover credenciais hardcoded de `initializeSystem`
- [ ] Atualizar Firestore Rules

### Parte F - UX Mínima
- [ ] Implementar `sendPasswordResetEmail` no forgot password
- [ ] Verificar responsividade de DataTable
- [ ] Verificar grids responsivos

### Parte G - Segurança Crítica
- [ ] Migrar secrets para Secret Manager
- [ ] Desabilitar `initializeSystem` após uso inicial

### Parte H - Testes
- [ ] Smoke test todas as rotas
- [ ] Auth flow completo
- [ ] CRUD de contracts/customers
- [ ] IFRS 15 engine
- [ ] Deploy sem erros

---

## 📊 STATUS

| Parte | Descrição | Status |
|-------|-----------|--------|
| A | Auditoria e inventário | ✅ Completo |
| B | Limpeza de legado | ✅ Completo |
| C | Padronizar data layer | ✅ Completo |
| D | APIs faltantes | ⏳ Pendente |
| E | Segurança/onboarding | ✅ Completo |
| F | UX mínima | ✅ Completo |
| G | Segurança crítica | ✅ Completo |
| H | Testes | ⏳ Pendente |

---

## 📝 ALTERAÇÕES REALIZADAS

### Parte B - Limpeza Realizada
- ✅ Removida pasta `server/` (Express/legado)
- ✅ Removido `drizzle.config.ts`
- ✅ Removido `shared/schema.ts` (mantido `firestore-types.ts`)
- ✅ Removido `replit.md`
- ✅ Removido `package.firebase.json`
- ✅ Removida pasta `script/`

### Parte C - Padronização Data Layer
- ✅ Corrigidos imports de `@shared/schema` → `@shared/firestore-types`
- ✅ Simplificado `queryClient.ts` - removido `convertApiUrl`, `apiRequest`, `getQueryFn`
- ✅ Corrigida queryKey em `admin-licenses.tsx`

### Parte E/G - Segurança
- ✅ `initializeSystem` agora usa variáveis de ambiente em vez de credenciais hardcoded
- ✅ Senha gerada aleatoriamente para novos usuários
- ✅ Não expõe senhas de usuários existentes

### Parte F - UX
- ✅ Implementado `sendPasswordResetEmail` no Firebase Auth
- ✅ Botão "Forgot password?" agora envia email de reset real
- ✅ Verificado `DataTable` - já possui `overflow-x-auto` para scroll horizontal
- ✅ Adicionado scroll horizontal em tabelas de permissões (`settings.tsx`)
- ✅ Adicionado scroll horizontal em totais de contratos (`ifrs15-accounting-control.tsx`)
- ✅ Adicionado responsividade em formulário de ledger (`revenue-ledger.tsx`)

---

**Última atualização**: Dezembro 2024
