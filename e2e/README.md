# E3E Autocrawler - Agente E2E Automático

## 📋 Descrição

Agente E2E automático que navega pelo IFRS 15 Revenue Manager, clica em menus/botões e detecta erros de console/network (especialmente 404 em `/api/*`).

## 🚀 Características

- ✅ **Browser visível** - Você pode ver toda a navegação em tempo real
- ✅ **Login automático** - Usa credenciais configuradas via variáveis de ambiente
- ✅ **Gravação de vídeo** - Todo teste gera um vídeo da navegação
- ✅ **Trace completo** - Captura trace do Playwright para debugging
- ✅ **Relatório HTML** - Gera relatório visual ao final
- ✅ **Detecção de erros** - Captura console.error, pageerror, requests falhados, 500+, e 404 em APIs

## 🔧 Configuração

### Variáveis de Ambiente

Configure as seguintes variáveis de ambiente antes de rodar os testes:

```powershell
$env:E2E_BASE_URL = "https://ifrs15-revenue-manager.firebaseapp.com"
$env:E2E_EMAIL = "seu-email@exemplo.com"
$env:E2E_PASSWORD = "sua-senha"
```

Ou use o arquivo `env.e2e.example` como template.

### Instalação

```bash
# Instalar dependências
npm install

# Instalar browser do Playwright (se necessário)
npx playwright install chromium
```

## 📦 Como Usar

### Via Script PowerShell (recomendado)

```powershell
# Executar com variáveis já configuradas
.\e2e-run.ps1
```

### Via npm scripts

```bash
# Executar testes E2E
npm run e2e

# Executar com UI do Playwright
npm run e2e:ui

# Executar em modo debug
npm run e2e:debug

# Ver relatório HTML
npm run e2e:report
```

### Via linha de comando

```powershell
# Com variáveis inline
$env:E2E_BASE_URL = "https://ifrs15-revenue-manager.firebaseapp.com"
$env:E2E_EMAIL = "seu-email@exemplo.com"  
$env:E2E_PASSWORD = "sua-senha"
npx playwright test
```

## 📊 Artefatos Gerados

Após cada execução, os seguintes artefatos são gerados:

| Artefato | Localização | Descrição |
|----------|-------------|-----------|
| Vídeo | `test-results/*/video.webm` | Gravação da navegação |
| Trace | `test-results/*/trace.zip` | Trace completo do Playwright |
| Relatório | `playwright-report/` | Relatório HTML interativo |

### Ver Relatório HTML

```bash
npx playwright show-report
```

### Ver Trace

Abra o trace no Playwright Trace Viewer:

```bash
npx playwright show-trace test-results/.../trace.zip
```

## 🛡️ Erros Detectados

O agente detecta os seguintes tipos de erros:

| Tipo | Descrição | Criticidade |
|------|-----------|-------------|
| `console.error` | Erros no console do browser | ⚠️ Média |
| `pageerror` | Exceções JavaScript não tratadas | 🔴 Alta |
| `requestfailed` | Requests que falharam | 🔴 Alta |
| `response >= 500` | Erros de servidor | 🔥 Crítica |
| `404 em /api/*` | Endpoints de API não encontrados | ⚠️ **CRÍTICA** |

## 📍 Rotas Testadas

O agente visita as seguintes rotas:

1. `/` - Dashboard
2. `/contracts` - Contratos
3. `/customers` - Clientes
4. `/ifrs15` - IFRS 15 Engine ⚡
5. `/billing-schedules` - Billing Schedules
6. `/revenue-ledger` - Revenue Ledger
7. `/consolidated-balances` - Consolidated Balances ⚡
8. `/revenue-waterfall` - Revenue Waterfall
9. `/contract-costs` - Contract Costs
10. `/exchange-rates` - Exchange Rates
11. `/financing-components` - Financing Components
12. `/executive-dashboard` - Executive Dashboard
13. `/ifrs15-accounting-control` - Accounting Control
14. `/reports` - Reports
15. `/contract-ingestion` - Contract Ingestion ⚡
16. `/ai-settings` - AI Settings ⚡
17. `/licenses` - Licenses
18. `/audit` - Audit Trail
19. `/settings` - Settings

⚡ = Rota crítica (mais interações executadas)

## 🔒 Segurança

O agente evita cliques em botões/links que contenham:
- `excluir`, `delete`, `remover`, `apagar`
- `cancelar`, `revogar`
- `logout`, `sair`
- Elementos com `data-danger="true"` ou classe `.destructive`

## 📝 Estrutura de Arquivos

```
e2e/
├── autocrawler.spec.ts  # Teste principal do agente
├── guards.ts            # Listeners de captura de erros
├── routes.ts            # Lista de rotas e seletores
└── README.md            # Esta documentação

playwright.config.ts     # Configuração do Playwright
e2e-run.ps1             # Script PowerShell para executar
env.e2e.example         # Exemplo de configuração
```

## 🐛 Troubleshooting

### Browser não abre

```bash
npx playwright install chromium
```

### Login falha

Verifique se as credenciais estão corretas nas variáveis de ambiente.

### Teste muito lento

Reduza o `slowMo` em `playwright.config.ts`:

```typescript
launchOptions: {
  slowMo: 50, // default é 75
},
```

### Quero rodar em modo headless (sem browser visível)

Altere em `playwright.config.ts`:

```typescript
headless: true, // default é false
```
