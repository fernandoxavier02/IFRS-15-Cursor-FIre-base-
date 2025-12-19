# Guia de Uso do Stripe CLI

Este guia documenta como usar o Stripe CLI para desenvolvimento local e testes com o IFRS 15 Revenue Manager.

---

## 📋 Índice

1. [Instalação](#instalação)
2. [Autenticação](#autenticação)
3. [Webhooks Locais](#webhooks-locais)
4. [Testar Eventos](#testar-eventos)
5. [Comandos Úteis](#comandos-úteis)
6. [Configuração para Desenvolvimento](#configuração-para-desenvolvimento)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Instalação

### Windows

```powershell
# Download do instalador em: https://github.com/stripe/stripe-cli/releases
# Ou usando Scoop (se instalado)
scoop install stripe
```

### Verificar Instalação

```bash
stripe --version
# Deve mostrar: stripe version 1.33.2 (ou versão mais recente)
```

---

## 🔐 Autenticação

### Primeira Autenticação

```bash
stripe login
```

Este comando irá:
1. Gerar um código de pareamento (ex: `feisty-golden-gain-wins`)
2. Abrir o navegador automaticamente ou fornecer um link
3. Você precisa confirmar no navegador do Stripe
4. A autenticação expira após 90 dias

**Exemplo de saída:**
```
Your pairing code is: feisty-golden-gain-wins
Press Enter to open the browser...
> Done! The Stripe CLI is configured for [Seu Nome] with account id acct_xxx
```

### Reautenticação

Quando a autenticação expirar (após 90 dias), execute novamente:
```bash
stripe login
```

---

## 🔔 Webhooks Locais

### Opção 1: Webhook Forwarding para Emuladores Firebase

Para testar webhooks localmente com Firebase Emulators:

```bash
stripe listen --forward-to http://localhost:5001/ifrs15-revenue-manager/us-central1/stripeWebhook
```

**O que isso faz:**
- Escuta todos os eventos do Stripe em tempo real
- Encaminha os eventos para o endpoint local do Firebase Functions
- Permite testar webhooks sem fazer deploy

**Saída esperada:**
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
> Forwarding events to http://localhost:5001/...
```

### Opção 2: Apenas Visualizar Eventos

Para apenas ver eventos sem encaminhar:

```bash
stripe listen
```

Mostra todos os eventos que acontecem na sua conta Stripe em tempo real.

### Obter Webhook Secret

O Stripe CLI gera um webhook secret único. Para obter o secret atual:

```bash
stripe listen --print-secret
```

**Saída:**
```
whsec_8cd6728978cc903b78b67399afdea77a14411cb6c9327fc535db3200501ece15
```

**⚠️ Importante:** Este secret deve ser configurado no arquivo `.env` das functions:
```env
STRIPE_WEBHOOK_SECRET=whsec_8cd6728978cc903b78b67399afdea77a14411cb6c9327fc535db3200501ece15
```

---

## 🧪 Testar Eventos

### Disparar Eventos de Teste

O Stripe CLI pode disparar eventos simulados para testar sua aplicação:

#### Testar Checkout Completo

```bash
stripe trigger checkout.session.completed
```

Simula um pagamento bem-sucedido. Útil para testar:
- Ativação de tenant
- Criação de subscription
- Ativação de usuários

#### Testar Atualização de Subscription

```bash
stripe trigger customer.subscription.updated
```

Simula uma mudança na subscription (upgrade, downgrade, etc.).

#### Testar Cancelamento

```bash
stripe trigger customer.subscription.deleted
```

Simula o cancelamento de uma subscription.

#### Testar Renovação

```bash
stripe trigger invoice.payment_succeeded
```

Simula o pagamento bem-sucedido de uma fatura de renovação.

### Listar Todos os Eventos Disponíveis

```bash
stripe trigger --help
```

Mostra todos os eventos que podem ser disparados.

### Eventos Mais Usados no Projeto

```bash
# Checkout completo (pagamento inicial)
stripe trigger checkout.session.completed

# Atualização de subscription
stripe trigger customer.subscription.updated

# Subscription cancelada
stripe trigger customer.subscription.deleted

# Pagamento de fatura bem-sucedido
stripe trigger invoice.payment_succeeded

# Pagamento de fatura falhou
stripe trigger invoice.payment_failed

# Mudança de preço na subscription
stripe trigger customer.subscription.updated --override subscription:items:0:price=price_xxx
```

---

## 📊 Comandos Úteis

### Ver Status da Conta

```bash
stripe status
```

Mostra informações sobre sua conta Stripe conectada.

### Listar Eventos Recentes

```bash
# Últimos 10 eventos
stripe events list

# Últimos 20 eventos
stripe events list --limit 20

# Filtrar por tipo
stripe events list --type checkout.session.completed
```

### Ver Logs em Tempo Real

```bash
stripe logs tail
```

Mostra eventos em tempo real, similar ao `stripe listen`, mas com mais detalhes.

### Testar API Diretamente

```bash
# Criar um customer de teste
stripe customers create --email teste@example.com --name "Teste"

# Criar um payment method
stripe payment_methods create --type card --card '{"number":"4242424242424242","exp_month":12,"exp_year":2025,"cvc":"123"}'

# Listar customers
stripe customers list

# Ver detalhes de um customer
stripe customers retrieve cus_xxxxx

# Criar checkout session
stripe checkout sessions create \
  --success-url "https://example.com/success" \
  --cancel-url "https://example.com/cancel" \
  --mode subscription \
  --line-items price=price_xxxxx,quantity=1
```

### Verificar Webhook Endpoint

```bash
# Listar webhook endpoints configurados
stripe webhook_endpoints list

# Ver detalhes de um endpoint
stripe webhook_endpoints retrieve we_xxxxx

# Ver eventos enviados para um endpoint
stripe webhook_endpoints list_events we_xxxxx
```

---

## ⚙️ Configuração para Desenvolvimento

### 1. Configurar Variáveis de Ambiente

Edite `functions/.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_8cd6728978cc903b78b67399afdea77a14411cb6c9327fc535db3200501ece15

# App Configuration
APP_URL=http://localhost:5173
```

**Onde encontrar as chaves:**
- **STRIPE_SECRET_KEY**: [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys)
- **STRIPE_PUBLISHABLE_KEY**: [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys)
- **STRIPE_WEBHOOK_SECRET**: Gerado pelo `stripe listen --print-secret`

### 2. Iniciar Desenvolvimento Local

**Terminal 1 - Firebase Emulators:**
```bash
cd "c:\Projetos\IFRS 15\Project-Pathfinder\Projeto IFRS 15"
firebase emulators:start
```

**Terminal 2 - Stripe Webhook Forwarding:**
```bash
stripe listen --forward-to http://localhost:5001/ifrs15-revenue-manager/us-central1/stripeWebhook
```

**Terminal 3 - Cliente (Opcional):**
```bash
cd "c:\Projetos\IFRS 15\Project-Pathfinder\Projeto IFRS 15\client"
npm run dev
```

### 3. Testar Fluxo Completo

1. Abra a aplicação em `http://localhost:5173`
2. Faça um checkout de teste
3. Use um cartão de teste: `4242 4242 4242 4242`
4. Veja os eventos sendo recebidos no Terminal 2
5. Veja os logs das functions no Terminal 1

---

## 🐛 Troubleshooting

### Erro: "Webhook signature verification failed"

**Causa:** O webhook secret no `.env` não corresponde ao gerado pelo Stripe CLI.

**Solução:**
1. Execute `stripe listen --print-secret`
2. Copie o secret gerado
3. Atualize no `functions/.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```
4. Reinicie os emuladores

### Erro: "Connection refused" ao fazer forwarding

**Causa:** Os emuladores Firebase não estão rodando.

**Solução:**
1. Certifique-se de que `firebase emulators:start` está rodando
2. Verifique se a porta 5001 está correta
3. Verifique se a URL está correta (incluindo o nome do projeto)

### Eventos não estão sendo recebidos

**Solução:**
1. Verifique se `stripe listen` está rodando
2. Verifique os logs do emulador para ver se há erros
3. Teste com `stripe trigger checkout.session.completed` para verificar se funciona

### Autenticação expirada

**Sintoma:** Erro "Authentication required" ou "Please login"

**Solução:**
```bash
stripe login
```

Siga o processo de autenticação novamente.

### Webhook secret diferente a cada execução

**Causa:** Cada vez que você executa `stripe listen`, um novo secret é gerado.

**Solução:**
1. Execute `stripe listen --print-secret` uma vez
2. Copie o secret gerado
3. Use esse mesmo secret no `.env`
4. Se precisar de um novo secret, atualize o `.env` com o novo valor

---

## 🔒 Segurança

### Desenvolvimento vs Produção

**Desenvolvimento (Stripe CLI):**
- Usa `whsec_xxx` (secret do CLI)
- Apenas para desenvolvimento local
- Não usar em produção

**Produção:**
- Configure webhook no [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
- Use o secret de produção (diferente)
- URL: `https://us-central1-ifrs15-revenue-manager.cloudfunctions.net/stripeWebhook`

### Test Mode vs Live Mode

O Stripe CLI usa **Test Mode** por padrão. Para usar Live Mode:

```bash
stripe listen --live
```

**⚠️ Atenção:** Use Live Mode apenas quando necessário e com cuidado!

---

## 📝 Eventos Implementados no Projeto

Os seguintes eventos Stripe são processados pelo webhook:

### `checkout.session.completed`
- **Quando:** Cliente completa um checkout
- **Ação:** Ativa tenant, atualiza subscription, ativa usuários

### `customer.subscription.updated`
- **Quando:** Subscription é atualizada (plano, quantidade, etc.)
- **Ação:** Atualiza dados do tenant no Firestore

### `customer.subscription.deleted`
- **Quando:** Subscription é cancelada
- **Ação:** Atualiza status do tenant para cancelado

### `invoice.payment_succeeded`
- **Quando:** Pagamento de fatura bem-sucedido
- **Ação:** Confirma renovação da subscription

### `invoice.payment_failed`
- **Quando:** Pagamento de fatura falhou
- **Ação:** Pode atualizar status da subscription

---

## 🎯 Workflow de Teste Recomendado

### 1. Teste Básico de Webhook

```bash
# Terminal 1: Iniciar emuladores
firebase emulators:start

# Terminal 2: Iniciar forwarding
stripe listen --forward-to http://localhost:5001/ifrs15-revenue-manager/us-central1/stripeWebhook

# Terminal 3: Disparar evento de teste
stripe trigger checkout.session.completed
```

### 2. Teste de Fluxo Completo

1. Registre uma empresa no site
2. Faça login na área do cliente
3. Escolha um plano e vá para checkout
4. Use cartão de teste: `4242 4242 4242 4242`
5. Veja o evento `checkout.session.completed` no Terminal 2
6. Verifique se o tenant foi ativado no Firestore

### 3. Teste de Adição de Assentos

1. Com subscription ativa, vá para "Gerenciar Usuários"
2. Clique em "Adicionar Assentos"
3. Verifique se a subscription foi atualizada no Stripe
4. Veja o evento `customer.subscription.updated` no Terminal 2

---

## 📚 Recursos Adicionais

- [Documentação Oficial do Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Webhook Events Reference](https://stripe.com/docs/api/events/types)
- [Test Cards](https://stripe.com/docs/testing)

---

## ✅ Checklist de Configuração

- [x] Stripe CLI instalado
- [x] Autenticado com `stripe login`
- [x] Webhook secret gerado e salvo em `.env`
- [x] Emuladores Firebase configurados
- [x] Testado com `stripe trigger checkout.session.completed`
- [ ] Webhook de produção configurado no Stripe Dashboard

---

## 🔄 Comandos Rápidos (Referência)

```bash
# Autenticação
stripe login

# Webhook forwarding
stripe listen --forward-to http://localhost:5001/ifrs15-revenue-manager/us-central1/stripeWebhook

# Obter secret
stripe listen --print-secret

# Testar eventos
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted

# Ver eventos
stripe events list
stripe logs tail

# Status
stripe status
```

---

**Última atualização:** Dezembro 2024  
**Stripe CLI Version:** 1.33.2
