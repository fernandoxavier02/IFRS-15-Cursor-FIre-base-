# Configuração de Variáveis de Ambiente - Firebase Functions

## ⚠️ IMPORTANTE: Migração para Nova Abordagem

O Firebase está descontinuando `functions.config()` em março de 2026. Devemos usar a nova abordagem com **params** ou **Secret Manager**.

---

## 📋 Variáveis Necessárias

### 1. INIT_SECRET
- **Uso**: Secret key para proteger a função `initializeSystem`
- **Tipo**: SECRET (usar Secret Manager)
- **Onde é usado**: `functions/src/index.ts` linha 269

### 2. INIT_ADMIN_EMAIL
- **Uso**: Email padrão do admin ao inicializar o sistema
- **Tipo**: STRING (pode ser variável de ambiente)
- **Onde é usado**: `functions/src/index.ts` linha 285

---

## 🔧 Método 1: Usando Secret Manager (Recomendado)

### Passo 1: Criar Secret no Secret Manager

```bash
# Criar secret para INIT_SECRET
echo "seu-secret-aqui" | gcloud secrets create INIT_SECRET \
  --data-file=- \
  --project=ifrs15-revenue-manager \
  --replication-policy="automatic"
```

### Passo 2: Atualizar código para usar Secret Manager

O código já suporta `process.env.INIT_SECRET`, então podemos configurar via Secret Manager.

### Passo 3: Configurar permissões

```bash
# Dar permissão para Cloud Functions acessar o secret
gcloud secrets add-iam-policy-binding INIT_SECRET \
  --member="serviceAccount:ifrs15-revenue-manager@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=ifrs15-revenue-manager
```

---

## 🔧 Método 2: Usando Variáveis de Ambiente (Mais Simples)

### Passo 1: Configurar via Firebase CLI (Legado - Funciona até março 2026)

```bash
# Configurar INIT_SECRET
firebase functions:config:set init.secret="seu-secret-aqui"

# Configurar INIT_ADMIN_EMAIL (opcional)
firebase functions:config:set init.admin_email="admin@exemplo.com"

# Fazer deploy para aplicar
firebase deploy --only functions
```

### Passo 2: Verificar configuração

```bash
firebase functions:config:get
```

---

## 🔧 Método 3: Usando Arquivo .env (Desenvolvimento Local)

Para desenvolvimento local com emuladores:

1. Criar `functions/.env`:
```env
INIT_SECRET=seu-secret-local
INIT_ADMIN_EMAIL=admin@exemplo.com
```

2. O código já lê `process.env.INIT_SECRET` e `process.env.INIT_ADMIN_EMAIL`

---

## ✅ Verificação

Após configurar, verifique se as variáveis estão acessíveis:

```bash
# Verificar config atual
firebase functions:config:get

# Testar função initializeSystem (se configurada)
curl "https://us-central1-ifrs15-revenue-manager.cloudfunctions.net/initializeSystem?key=seu-secret"
```

---

## 🚀 Próximos Passos

1. ✅ Configurar INIT_SECRET (escolher um método acima)
2. ✅ Configurar INIT_ADMIN_EMAIL (opcional)
3. ✅ Fazer deploy das functions: `firebase deploy --only functions`
4. ✅ Testar `initializeSystem` (se necessário)

---

**Nota**: Para produção, recomenda-se usar Secret Manager para valores sensíveis como INIT_SECRET.
