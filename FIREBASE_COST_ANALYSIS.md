# Análise de Custos Mensais - Firebase IFRS 15 Revenue Manager

## 📊 Estrutura do Projeto

### Serviços Utilizados:
- ✅ **Firestore Database** (NoSQL)
- ✅ **Cloud Functions** (26+ functions)
- ✅ **Firebase Authentication**
- ✅ **Firebase Hosting**
- ✅ **Firebase Storage** (opcional)

---

## 💰 Preços Firebase (Plano Blaze - Pay as you go)

### Firestore
- **Armazenamento**: $0.18/GB/mês
- **Leituras**: $0.06 por 100k operações
- **Escritas**: $0.18 por 100k operações
- **Exclusões**: $0.02 por 100k operações
- **Cota gratuita**: 1GB storage, 50k reads/dia, 20k writes/dia, 20k deletes/dia

### Cloud Functions
- **Invocações**: $0.40 por 1 milhão de invocações
- **GB-segundo**: $0.0000025 por GB-segundo
- **GHZ-segundo**: $0.0000100 por GHz-segundo
- **Cota gratuita**: 2 milhões de invocações/mês, 400k GB-segundos, 200k GHz-segundos
- **Memória padrão**: 256MB por function

### Firebase Authentication
- **Gratuito**: Até 50.000 usuários ativos/mês
- **Após 50k**: $0.0055 por usuário adicional

### Firebase Hosting
- **Armazenamento**: $0.026/GB/mês
- **Transferência**: $0.15/GB
- **Cota gratuita**: 10GB storage, 360MB/day transfer

### Firebase Storage
- **Armazenamento**: $0.026/GB/mês
- **Download**: $0.12/GB
- **Upload**: $0.05/GB
- **Cota gratuita**: 5GB storage, 1GB/day download, 20GB/day upload

---

## 📈 Cenários de Uso

### 🟢 Cenário 1: Pequeno (Startup/Teste)
**Assunções:**
- 3 tenants
- 10 usuários ativos/mês
- 50 contratos total
- 200 operações Firestore/dia
- 1.000 invocações de functions/dia
- 100MB de dados no Firestore

**Custos Mensais:**

| Serviço | Uso | Custo |
|---------|-----|-------|
| Firestore Storage | 100MB | **$0.00** (dentro da cota) |
| Firestore Reads | 6k/mês | **$0.00** (dentro da cota) |
| Firestore Writes | 6k/mês | **$0.00** (dentro da cota) |
| Cloud Functions | 30k/mês | **$0.00** (dentro da cota) |
| Firebase Auth | 10 usuários | **$0.00** (dentro da cota) |
| Firebase Hosting | 50MB/mês | **$0.00** (dentro da cota) |
| **TOTAL MENSAL** | | **$0.00** |

✅ **Resultado: GRATUITO** (dentro das cotas gratuitas)

---

### 🟡 Cenário 2: Médio (Empresa Pequena)
**Assunções:**
- 10 tenants
- 50 usuários ativos/mês
- 500 contratos total
- 2.000 operações Firestore/dia (60k/mês)
- 5.000 invocações de functions/dia (150k/mês)
- 2GB de dados no Firestore
- 5GB de transferência hosting/mês

**Custos Mensais:**

| Serviço | Uso | Cálculo | Custo |
|---------|-----|---------|-------|
| Firestore Storage | 2GB | (2GB - 1GB) × $0.18 | **$0.18** |
| Firestore Reads | 60k/mês | (60k - 50k) × $0.06/100k | **$0.01** |
| Firestore Writes | 20k/mês | Dentro da cota | **$0.00** |
| Cloud Functions | 150k/mês | Dentro da cota | **$0.00** |
| Firebase Auth | 50 usuários | Dentro da cota | **$0.00** |
| Firebase Hosting | 5GB transfer | (5GB - 10.8GB) | **$0.00** |
| **TOTAL MENSAL** | | | **$0.19** |

✅ **Resultado: ~$0.19/mês** (quase gratuito)

---

### 🟠 Cenário 3: Grande (Empresa Média)
**Assunções:**
- 50 tenants
- 200 usuários ativos/mês
- 2.500 contratos total
- 10.000 operações Firestore/dia (300k/mês)
- 20.000 invocações de functions/dia (600k/mês)
- 10GB de dados no Firestore
- 20GB de transferência hosting/mês
- IFRS 15 Engine executado 500x/mês (cálculos pesados)

**Custos Mensais:**

| Serviço | Uso | Cálculo | Custo |
|---------|-----|---------|-------|
| Firestore Storage | 10GB | (10GB - 1GB) × $0.18 | **$1.62** |
| Firestore Reads | 300k/mês | (300k - 50k) × $0.06/100k | **$0.15** |
| Firestore Writes | 100k/mês | (100k - 20k) × $0.18/100k | **$0.14** |
| Cloud Functions | 600k/mês | Dentro da cota | **$0.00** |
| Cloud Functions (GB-s) | ~50k GB-s | Dentro da cota | **$0.00** |
| Firebase Auth | 200 usuários | Dentro da cota | **$0.00** |
| Firebase Hosting | 20GB transfer | (20GB - 10.8GB) × $0.15 | **$1.38** |
| **TOTAL MENSAL** | | | **$3.29** |

✅ **Resultado: ~$3.29/mês**

---

### 🔴 Cenário 4: Enterprise (Grande Volume)
**Assunções:**
- 200 tenants
- 1.000 usuários ativos/mês
- 10.000 contratos total
- 50.000 operações Firestore/dia (1.5M/mês)
- 100.000 invocações de functions/dia (3M/mês)
- 50GB de dados no Firestore
- 100GB de transferência hosting/mês
- IFRS 15 Engine executado 5.000x/mês

**Custos Mensais:**

| Serviço | Uso | Cálculo | Custo |
|---------|-----|---------|-------|
| Firestore Storage | 50GB | (50GB - 1GB) × $0.18 | **$8.82** |
| Firestore Reads | 1.5M/mês | (1.5M - 50k) × $0.06/100k | **$0.87** |
| Firestore Writes | 500k/mês | (500k - 20k) × $0.18/100k | **$0.86** |
| Cloud Functions | 3M/mês | (3M - 2M) × $0.40/1M | **$0.40** |
| Cloud Functions (GB-s) | ~500k GB-s | (500k - 400k) × $0.0000025 | **$0.25** |
| Firebase Auth | 1.000 usuários | Dentro da cota | **$0.00** |
| Firebase Hosting | 100GB transfer | (100GB - 10.8GB) × $0.15 | **$13.38** |
| **TOTAL MENSAL** | | | **$24.58** |

✅ **Resultado: ~$24.58/mês**

---

## 📋 Resumo por Cenário

| Cenário | Tenants | Usuários | Contratos | Custo Mensal |
|---------|---------|----------|-----------|--------------|
| 🟢 Pequeno | 3 | 10 | 50 | **$0.00** |
| 🟡 Médio | 10 | 50 | 500 | **$0.19** |
| 🟠 Grande | 50 | 200 | 2.500 | **$3.29** |
| 🔴 Enterprise | 200 | 1.000 | 10.000 | **$24.58** |

---

## 💡 Otimizações para Reduzir Custos

### 1. **Firestore**
- ✅ Usar índices compostos para reduzir leituras
- ✅ Implementar cache no frontend (React Query)
- ✅ Usar batch writes quando possível
- ✅ Limpar dados antigos periodicamente

### 2. **Cloud Functions**
- ✅ Otimizar código para reduzir tempo de execução
- ✅ Usar memória adequada (não mais que necessário)
- ✅ Implementar cache para cálculos repetidos
- ✅ Agrupar operações quando possível

### 3. **Hosting**
- ✅ Usar CDN caching
- ✅ Comprimir assets (gzip/brotli)
- ✅ Lazy loading de componentes
- ✅ Service Worker para cache offline

### 4. **Monitoramento**
- ✅ Configurar alertas de custo no Firebase Console
- ✅ Revisar mensalmente o uso
- ✅ Usar Firebase Usage Dashboard

---

## 🎯 Recomendações

### Para Começar:
- **Cenário Pequeno/Médio**: Use o plano **Spark (Gratuito)** inicialmente
- Quando ultrapassar as cotas, migre automaticamente para **Blaze (Pay as you go)**

### Para Produção:
- Configure **orçamento e alertas** no Google Cloud Console
- Monitore uso diário nas primeiras semanas
- Use **Firebase Emulator Suite** para desenvolvimento (gratuito)

### Estimativa Realista:
- **Primeiros 6 meses**: $0-5/mês
- **Após crescimento**: $5-30/mês (dependendo do volume)
- **Custo por tenant**: ~$0.10-0.15/mês (em cenário médio)

---

## 📊 Comparação com Alternativas

| Solução | Custo Mensal (Cenário Médio) |
|---------|------------------------------|
| Firebase (Blaze) | **$0.19** |
| AWS Amplify | ~$25-50 |
| Heroku | ~$25-100 |
| VPS próprio | ~$20-40 + manutenção |
| Backend próprio | ~$50-200 + infraestrutura |

✅ **Firebase é a opção mais econômica** para este tipo de aplicação.

---

## ⚠️ Observações Importantes

1. **Cota Gratuita**: O plano Spark oferece cotas generosas que cobrem a maioria dos casos iniciais
2. **Crescimento Gradual**: Os custos aumentam proporcionalmente ao uso
3. **Sem Custos Ocultos**: Firebase é transparente com os preços
4. **Região**: Preços podem variar ligeiramente por região (usamos `southamerica-east1`)

---

## 🔗 Links Úteis

- [Firebase Pricing Calculator](https://firebase.google.com/pricing)
- [Google Cloud Billing](https://console.cloud.google.com/billing)
- [Firebase Usage Dashboard](https://console.firebase.google.com/project/ifrs15-revenue-manager/usage)

---

**Última atualização**: Dezembro 2024
**Preços baseados em**: Firebase Blaze Plan (USD)
