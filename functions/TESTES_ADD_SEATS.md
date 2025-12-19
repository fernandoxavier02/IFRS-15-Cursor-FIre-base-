# Testes do Fluxo: Adicionar Assentos

Este documento descreve os testes robustos implementados para validar todo o fluxo de adicionar assentos à subscription.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura de Testes](#estrutura-de-testes)
3. [Executar Testes](#executar-testes)
4. [Cobertura de Testes](#cobertura-de-testes)
5. [Teste Manual](#teste-manual)

---

## 🎯 Visão Geral

O fluxo completo de adicionar assentos envolve:

```
Usuário clica "Adicionar 1 Assento"
    ↓
✅ FRONTEND: Verifica se botão está habilitado
    ↓
✅ BACKEND: Verifica autenticação
    ↓
✅ BACKEND: Verifica se é admin
    ↓
✅ BACKEND: Valida quantity >= 1
    ↓
✅ BACKEND: Verifica se tenant existe
    ↓
✅ BACKEND: Verifica subscriptionStatus === "active"
    ↓
✅ BACKEND: Verifica se tem stripeSubscriptionId
    ↓
✅ BACKEND: Busca subscription no Stripe
    ↓
✅ BACKEND: Verifica se subscription tem items
    ↓
✅ STRIPE: Atualiza quantidade na subscription
    ✅ Proration automático (cobrança proporcional)
    ↓
✅ BACKEND: Atualiza maxLicenses no Firestore
    ↓
✅ FRONTEND: Atualiza UI com novos valores
```

---

## 📁 Estrutura de Testes

```
functions/
├── __tests__/
│   ├── setup.ts                           # Configuração global dos testes
│   ├── __mocks__/
│   │   ├── stripe.ts                      # Mock do Stripe SDK
│   │   └── firebase-admin.ts              # Mock do Firebase Admin
│   ├── stripe/
│   │   └── addSeatsToSubscription.test.ts # Testes unitários detalhados
│   ├── integration/
│   │   └── addSeats-flow.e2e.test.ts     # Testes E2E do fluxo completo
│   └── manual/
│       └── test-add-seats-manual.ts      # Script de teste manual
├── jest.config.js                         # Configuração do Jest
└── package.json                           # Dependências de teste
```

---

## 🚀 Executar Testes

### Instalar Dependências

```bash
cd functions
npm install
```

### Executar Todos os Testes

```bash
npm test
```

### Executar Testes em Modo Watch

```bash
npm run test:watch
```

### Executar Testes com Cobertura

```bash
npm run test:coverage
```

### Executar Apenas Testes de Add Seats

```bash
npm run test:add-seats
```

### Executar Testes Específicos

```bash
# Apenas testes unitários
npx jest addSeatsToSubscription.test.ts

# Apenas testes E2E
npx jest addSeats-flow.e2e.test.ts
```

---

## ✅ Cobertura de Testes

### Testes Unitários (`addSeatsToSubscription.test.ts`)

#### 1. Validações de Autenticação
- ✅ Rejeita quando usuário não está autenticado
- ✅ Aceita quando usuário está autenticado

#### 2. Validações de Autorização (Admin)
- ✅ Rejeita quando usuário não é admin
- ✅ Aceita quando usuário é admin
- ✅ Aceita quando usuário é systemAdmin

#### 3. Validações de Dados (quantity >= 1)
- ✅ Rejeita quando quantity < 1
- ✅ Rejeita quando quantity === 0
- ✅ Aceita quando quantity >= 1
- ✅ Usa quantity = 1 como padrão

#### 4. Validações de Tenant
- ✅ Rejeita quando tenant não existe
- ✅ Aceita quando tenant existe

#### 5. Validações de Subscription Status
- ✅ Rejeita quando subscriptionStatus !== "active"
- ✅ Rejeita quando subscriptionStatus === "canceled"
- ✅ Aceita quando subscriptionStatus === "active"

#### 6. Validações de Stripe Subscription ID
- ✅ Rejeita quando stripeSubscriptionId não existe
- ✅ Aceita quando stripeSubscriptionId existe

#### 7. Integração com Stripe
- ✅ Busca subscription no Stripe
- ✅ Rejeita quando subscription não existe no Stripe
- ✅ Rejeita quando subscription não tem items
- ✅ Atualiza quantity na subscription
- ✅ Usa proration_behavior: always_invoice

#### 8. Atualização do Firestore
- ✅ Atualiza maxLicenses no Firestore
- ✅ Calcula maxLicenses corretamente
- ✅ Mantém maxLicenses como -1 quando ilimitado

#### 9. Retorno da Função
- ✅ Retorna success: true
- ✅ Retorna newQuantity correto
- ✅ Retorna newMaxLicenses correto
- ✅ Retorna mensagem de sucesso

#### 10. Tratamento de Erros
- ✅ Trata erros do Stripe
- ✅ Preserva HttpsErrors do Firebase

### Testes E2E (`addSeats-flow.e2e.test.ts`)

#### Fluxo Completo
- ✅ Adicionar 1 assento com sucesso
- ✅ Adicionar múltiplos assentos
- ✅ Verificar proration automático
- ✅ Tratar erros em qualquer etapa
- ✅ Validar botão desabilitado quando subscription inativa
- ✅ Validar botão desabilitado quando licenças ilimitadas

---

## 🔧 Teste Manual

### Pré-requisitos

1. Firebase Emulators rodando:
   ```bash
   firebase emulators:start
   ```

2. Stripe CLI configurado:
   ```bash
   stripe login
   stripe listen --forward-to http://localhost:5001/ifrs15-revenue-manager/us-central1/stripeWebhook
   ```

3. Dados de teste no Firestore:
   - Tenant com `subscriptionStatus: "active"`
   - `stripeSubscriptionId` válido
   - Usuário admin autenticado

### Executar Teste Manual

```bash
cd functions
npx tsx __tests__/manual/test-add-seats-manual.ts
```

### O que o Teste Manual Verifica

1. ✅ Autenticação do usuário
2. ✅ Existência do tenant
3. ✅ Status da subscription
4. ✅ Existência do stripeSubscriptionId
5. ✅ Busca da subscription no Stripe
6. ✅ Validação de role admin
7. ✅ Validação de quantity >= 1
8. ✅ Simulação de atualização no Stripe
9. ✅ Simulação de atualização no Firestore

---

## 📊 Métricas de Cobertura

Após executar `npm run test:coverage`, você verá:

```
PASS  __tests__/stripe/addSeatsToSubscription.test.ts
PASS  __tests__/integration/addSeats-flow.e2e.test.ts

------------------|---------|----------|---------|---------|
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
All files         |   95.23 |    92.15 |   100.0 |   95.23 |
 checkout.ts      |   95.23 |    92.15 |   100.0 |   95.23 |
------------------|---------|----------|---------|---------|
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module 'stripe'"

```bash
cd functions
npm install stripe
```

### Erro: "Cannot find module 'firebase-admin'"

```bash
cd functions
npm install firebase-admin
```

### Erro: "Jest failed to parse a file"

Verifique se o `jest.config.js` está configurado corretamente e se todas as dependências estão instaladas.

### Erros de Mock

Certifique-se de que os mocks estão configurados corretamente em `__tests__/setup.ts` e `__tests__/__mocks__/`.

---

## 📝 Notas Importantes

1. **Mocks**: Os testes usam mocks para Stripe e Firebase para evitar chamadas reais durante os testes.

2. **Testes E2E**: Os testes E2E simulam o fluxo completo, mas ainda usam mocks. Para testes reais, use o script de teste manual.

3. **Cobertura**: O objetivo é manter cobertura acima de 90% para todas as funções críticas.

4. **Manutenção**: Atualize os testes sempre que a função `addSeatsToSubscription` for modificada.

---

## 🔄 Próximos Passos

1. Adicionar testes de performance
2. Adicionar testes de concorrência (múltiplos usuários adicionando assentos simultaneamente)
3. Adicionar testes de integração com Firebase Emulators
4. Configurar CI/CD para executar testes automaticamente

---

**Última atualização:** Dezembro 2024
