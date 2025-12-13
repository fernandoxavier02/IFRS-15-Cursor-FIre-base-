# Guia de Migração: Replit para Firebase

Este guia detalha os passos para migrar o aplicativo IFRS 15 Revenue Manager do Replit para o Firebase.

## Visão Geral da Migração

| Componente | Antes (Replit) | Depois (Firebase) |
|------------|----------------|-------------------|
| Banco de Dados | PostgreSQL + Drizzle ORM | Firestore |
| Autenticação | Express Sessions + Cookies | Firebase Authentication |
| Backend | Express Server | Cloud Functions |
| Hosting | Replit | Firebase Hosting |
| Email | Resend via Replit Connector | Firebase Extension (Trigger Email) |
| Pagamentos | Stripe via Replit Connector | Stripe SDK direto |

## Pré-requisitos

1. **Node.js 20+** instalado
2. **Firebase CLI** instalado: `npm install -g firebase-tools`
3. **Conta Firebase** com projeto criado
4. **Conta Stripe** (para pagamentos)

## Passo 1: Criar Projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto: `ifrs15-revenue-manager`
3. Ative os serviços:
   - **Authentication** (Email/Password)
   - **Firestore Database**
   - **Cloud Functions** (requer plano Blaze)
   - **Hosting**

## Passo 2: Configurar Ambiente Local

```bash
# Login no Firebase
firebase login

# Inicializar projeto (selecionar projeto existente)
firebase use ifrs15-revenue-manager

# Instalar dependências do projeto
npm install

# Instalar dependências das Functions
cd functions && npm install && cd ..
```

## Passo 3: Configurar Variáveis de Ambiente

### Cliente (.env no diretório raiz)

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=ifrs15-revenue-manager.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ifrs15-revenue-manager
VITE_FIREBASE_STORAGE_BUCKET=ifrs15-revenue-manager.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
VITE_USE_EMULATORS=false
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

### Cloud Functions

```bash
# Configurar secrets do Firebase
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set APP_URL
```

## Passo 4: Migrar Dados do PostgreSQL

1. Configure a variável `DATABASE_URL` com a string de conexão do PostgreSQL
2. Configure `GOOGLE_APPLICATION_CREDENTIALS` com o caminho para o service account JSON
3. Execute o script de migração:

```bash
npx tsx scripts/migrate-to-firestore.ts
```

**IMPORTANTE:** Após a migração, todos os usuários precisarão redefinir suas senhas, pois não é possível migrar hashes de senha entre sistemas.

## Passo 5: Atualizar o Código do Cliente

O cliente foi atualizado para usar Firebase. Principais mudanças:

1. **Autenticação**: Trocar `auth.tsx` por `auth-firebase.tsx`
   
   No `App.tsx`:
   ```tsx
   // Antes
   import { AuthProvider } from "@/lib/auth";
   
   // Depois
   import { AuthProvider } from "@/lib/auth-firebase";
   ```

2. **Chamadas de API**: Trocar `fetch('/api/...')` por serviços Firestore
   
   ```tsx
   // Antes
   const response = await fetch('/api/contracts');
   const contracts = await response.json();
   
   // Depois
   import { contractService } from "@/lib/firestore-service";
   const contracts = await contractService.getAll(tenantId);
   ```

## Passo 6: Configurar Firebase Extension para Email

1. No Firebase Console, vá em **Extensions**
2. Instale **Trigger Email**
3. Configure com seu provedor SMTP (SendGrid, Mailgun, etc.)
4. Veja `FIREBASE_EMAIL_EXTENSION.md` para detalhes

## Passo 7: Testar Localmente

```bash
# Iniciar emuladores Firebase
firebase emulators:start

# Em outro terminal, iniciar o cliente
npm run dev
```

Acesse:
- App: http://localhost:5173
- Emulator UI: http://localhost:4000

## Passo 8: Deploy

```bash
# Build do cliente
npm run build

# Deploy completo
firebase deploy

# Ou deploy parcial
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## Estrutura de Arquivos Criados

```
├── firebase.json              # Configuração Firebase
├── .firebaserc               # Projeto Firebase
├── firestore.rules           # Regras de segurança
├── firestore.indexes.json    # Índices Firestore
├── functions/                # Cloud Functions
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # Entry point
│       ├── auth/             # Auth triggers
│       ├── stripe/           # Stripe webhooks
│       ├── ai/               # AI processing
│       ├── api/              # REST APIs
│       ├── scheduled/        # Cron jobs
│       └── utils/            # Helpers
├── client/src/lib/
│   ├── firebase.ts           # Firebase SDK config
│   ├── auth-firebase.tsx     # Firebase Auth provider
│   └── firestore-service.ts  # Firestore service layer
├── shared/
│   └── firestore-types.ts    # TypeScript types
└── scripts/
    └── migrate-to-firestore.ts # Migration script
```

## Mudanças nas Rotas de API

| Antes (Express) | Depois (Firebase) |
|-----------------|-------------------|
| `POST /api/auth/login` | `signInWithEmailAndPassword()` |
| `GET /api/auth/me` | `onAuthStateChanged()` + Firestore |
| `POST /api/auth/logout` | `signOut()` |
| `GET /api/contracts` | `contractService.getAll()` |
| `POST /api/contracts` | `contractService.create()` |
| `GET /api/dashboard/stats` | `dashboardService.getStats()` |
| `POST /api/stripe/checkout` | `httpsCallable('createCheckoutSession')` |

## Considerações de Segurança

1. **Firestore Rules**: As regras em `firestore.rules` implementam:
   - Autenticação obrigatória
   - Isolamento multi-tenant
   - Controle de acesso por role (RBAC)

2. **Custom Claims**: Roles e tenant ID são armazenados em custom claims do Firebase Auth

3. **API Keys**: 
   - Stripe keys em Firebase Secrets
   - Firebase config pode ser pública (regras protegem os dados)

## Troubleshooting

### Erro: "Permission denied"
- Verifique se o usuário tem custom claims corretas
- Verifique as regras do Firestore

### Erro: "Function not found"
- Execute `firebase deploy --only functions`
- Verifique logs: `firebase functions:log`

### Erro: "Emulator not starting"
- Verifique se as portas estão disponíveis
- Reinicie os emuladores: `firebase emulators:start --clear-data`

## Custos Estimados

Firebase usa modelo pay-as-you-go (plano Blaze):

- **Firestore**: $0.06/100K leituras, $0.18/100K escritas
- **Cloud Functions**: 2M invocações grátis/mês
- **Hosting**: 10GB grátis/mês
- **Authentication**: Grátis para email/password

Para um uso típico de pequena/média empresa, espere ~$10-50/mês.

## Suporte

Em caso de dúvidas:
1. Verifique a documentação do Firebase
2. Consulte os logs do Firebase Console
3. Use o Emulator UI para debug local
