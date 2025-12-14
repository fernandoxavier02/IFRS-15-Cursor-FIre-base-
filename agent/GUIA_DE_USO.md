# Guia de Uso do Agente de Testes IFRS 15

Este guia fornece instruções detalhadas sobre como configurar, executar e interpretar os resultados do agente de testes automatizados para o IFRS 15 Revenue Manager.

---

## 📋 Índice

1. [Instalação](#instalação)
2. [Configuração](#configuração)
3. [Comandos Básicos](#comandos-básicos)
4. [Executando Testes](#executando-testes)
5. [Interpretando Resultados](#interpretando-resultados)
6. [Análise com IA](#análise-com-ia)
7. [Relatórios](#relatórios)
8. [Troubleshooting](#troubleshooting)
9. [Boas Práticas](#boas-práticas)

---

## 🚀 Instalação

### Pré-requisitos

- **Node.js 20+** instalado
- **npm** ou **yarn** como gerenciador de pacotes
- Acesso à aplicação IFRS 15 (URL configurável)
- Credenciais de teste válidas

### Passo 1: Instalar Dependências

```bash
# Navegue até o diretório do agente
cd agent

# Instale as dependências do projeto
npm install
```

### Passo 2: Instalar Navegadores do Playwright

O Playwright precisa baixar os binários dos navegadores:

```bash
# Instalar Chromium (recomendado)
npx playwright install chromium

# Ou instalar todos os navegadores (opcional)
npx playwright install
```

### Passo 3: Verificar Instalação

```bash
# Verificar se o agente está funcionando
npm run start -- --help
```

Se tudo estiver correto, você verá a lista de comandos disponíveis.

---

## ⚙️ Configuração

### Criar Arquivo de Configuração

Crie um arquivo `.env` na raiz do diretório `agent/`:

```bash
# Copie o exemplo (se existir)
cp .env.example .env

# Ou crie manualmente
touch .env
```

### Variáveis de Ambiente Obrigatórias

```env
# URL da aplicação a ser testada
APP_URL=https://ifrs15-revenue-manager.web.app

# Credenciais de teste (usuário admin)
TEST_ADMIN_EMAIL=seu-email@exemplo.com
TEST_ADMIN_PASSWORD=sua-senha-segura
```

### Variáveis Opcionais (Análise com IA)

```env
# Para análise inteligente de falhas com OpenAI
OPENAI_API_KEY=sk-...

# Ou use Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Nota: Configure pelo menos uma das duas para usar análise com IA
```

### Variáveis Opcionais (Validação Firestore)

```env
# Para validação direta no banco de dados
FIREBASE_PROJECT_ID=seu-projeto-firebase
FIREBASE_CLIENT_EMAIL=service-account@projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Variáveis Opcionais (Comportamento do Navegador)

```env
# Executar com navegador visível (padrão: true = headless)
HEADLESS=false

# Adicionar delay entre ações (em ms) para debug
SLOW_MO=100

# Navegador a usar (chromium, firefox, webkit)
BROWSER=chromium
```

### Exemplo Completo de `.env`

```env
# Aplicação
APP_URL=https://ifrs15-revenue-manager.web.app
APP_ENV=production

# Credenciais
TEST_ADMIN_EMAIL=admin@exemplo.com
TEST_ADMIN_PASSWORD=SenhaSegura123!

# IA (opcional)
OPENAI_API_KEY=sk-proj-abc123...
# ANTHROPIC_API_KEY=sk-ant-xyz789...

# Firebase (opcional)
FIREBASE_PROJECT_ID=ifrs15-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Navegador
HEADLESS=true
SLOW_MO=0
BROWSER=chromium
```

---

## 🎮 Comandos Básicos

### Ver Ajuda

```bash
npm run start -- --help
```

### Listar Cenários Disponíveis

```bash
# Listar todos os cenários
npm run start list

# Filtrar por tag
npm run start list --tag auth
npm run start list --tag crud
npm run start list --tag ifrs15
```

### Ver Tags Disponíveis

```bash
npm run start tags
```

### Analisar Estrutura da Aplicação

```bash
# Navega pelas páginas principais e coleta informações
npm run start analyze
```

---

## 🧪 Executando Testes

### Executar Smoke Tests (Padrão)

Os smoke tests são testes rápidos que verificam funcionalidades básicas:

```bash
npm run start run
```

Isso executa:
- Login com credenciais válidas
- Carregamento do Dashboard
- Carregamento da página de Contratos
- Carregamento da página de Clientes

### Executar Todos os Testes

```bash
npm run start run --all
```

**⚠️ Atenção:** Isso pode levar vários minutos dependendo da quantidade de cenários.

### Executar por Tag

```bash
# Apenas testes de autenticação
npm run start run --tag auth

# Apenas testes CRUD
npm run start run --tag crud

# Apenas testes IFRS 15
npm run start run --tag ifrs15
```

### Executar Cenário Específico

```bash
# Por nome (busca parcial)
npm run start run --scenario "Login"

# Nome exato
npm run start run --scenario "Login with valid credentials"
```

### Executar com Navegador Visível

Útil para debug e entender o que o agente está fazendo:

```bash
npm run start run --no-headless
```

### Executar com Análise de IA

Quando habilitado, o agente usa IA para analisar falhas e sugerir correções:

```bash
npm run start run --ai-analysis
```

**Requisito:** Configure `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` no `.env`.

### Executar com Relatório Customizado

```bash
# Relatório em Markdown
npm run start run --report markdown

# Relatório em JSON
npm run start run --report json

# Relatório em HTML (padrão)
npm run start run --report html

# Sem gerar relatório
npm run start run --no-report
```

### Combinando Opções

```bash
# Exemplo: Executar todos os testes de autenticação com navegador visível e análise de IA
npm run start run --tag auth --no-headless --ai-analysis --report markdown
```

---

## 📊 Interpretando Resultados

### Saída no Console

Durante a execução, você verá:

```
═══════════════════════════════════════════════════════
IFRS 15 Test Agent
═══════════════════════════════════════════════════════
Browser initialized
Running smoke tests
Found 4 scenario(s) to run

[SCENARIO] Login Smoke Test
  ✓ Step 1: navigate /login (245ms)
  ✓ Step 2: waitForElement login.email (120ms)
  ✓ Step 3: fill login.email (89ms)
  ✓ Step 4: fill login.password (76ms)
  ✓ Step 5: click login.submit (234ms)
  ✓ Step 6: waitForNavigation / (1567ms)
  ✓ Validation: urlIs / (passed)
  ✓ Validation: noConsoleErrors (passed)
Duration: 2.3s

[SCENARIO] Dashboard Loads
  ✓ Step 1: navigate / (234ms)
  ✓ Step 2: waitForElement h1 (189ms)
  ✓ Validation: elementVisible h1 (passed)
Duration: 0.4s

═══════════════════════════════════════════════════════
Summary
════════════════════════════════════════════════════════
Total Scenarios: 4
Passed: 4
Failed: 0
Skipped: 0
Total Duration: 8.5s
Pass Rate: 100%
═══════════════════════════════════════════════════════
```

### Códigos de Saída

- **0**: Todos os testes passaram
- **1**: Pelo menos um teste falhou

### Estrutura de Resultados

Cada cenário retorna:

- **success**: `true` ou `false`
- **duration**: Tempo de execução em milissegundos
- **stepResults**: Array com resultados de cada passo
- **validationResults**: Array com resultados das validações
- **error**: Mensagem de erro (se houver)
- **screenshots**: Screenshots capturados (em caso de falha)

---

## 🤖 Análise com IA

### Quando Usar

A análise com IA é útil quando:
- Testes estão falhando e você não sabe o motivo
- Precisa de sugestões de correção
- Quer entender a causa raiz de problemas
- Precisa de um resumo executivo dos resultados

### Como Funciona

1. **Coleta de Contexto**: O agente coleta:
   - Passo que falhou
   - Validação que falhou
   - Erros do console do navegador
   - Chamadas de API que falharam
   - URL e título da página atual

2. **Análise**: Envia contexto para o LLM (OpenAI ou Anthropic)

3. **Resultado**: Retorna:
   - Resumo da falha
   - Causa raiz provável
   - Categoria (UI, API, validação, timeout, auth, desconhecido)
   - Severidade (crítico, alto, médio, baixo)
   - Sugestão de correção
   - Confiança na análise (0-1)

### Exemplo de Análise

```
[AI Analysis] Login Smoke Test
─────────────────────────────────────────────
Summary: Element not found during login form submission
Root Cause: Selector 'login.submit' may have changed or page structure updated
Category: ui
Severity: high
Suggested Fix: Verify selector in selectors.ts or use data-testid attribute
Confidence: 0.85
─────────────────────────────────────────────
```

### Configurando Análise com IA

**Opção 1: OpenAI (GPT-4)**

```env
OPENAI_API_KEY=sk-proj-abc123...
```

**Opção 2: Anthropic (Claude)**

```env
ANTHROPIC_API_KEY=sk-ant-xyz789...
```

**Nota:** O agente prefere Anthropic se ambas estiverem configuradas.

---

## 📝 Relatórios

### Localização dos Relatórios

Os relatórios são salvos em:
- `agent/reports/` - Relatórios HTML/JSON/Markdown
- `agent/screenshots/` - Screenshots de falhas
- `agent/logs/` - Logs de execução

### Formato HTML (Padrão)

Relatório visual completo com:
- Resumo executivo
- Detalhes de cada cenário
- Screenshots de falhas
- Logs do console
- Chamadas de API
- Análise de IA (se habilitada)

**Abrir:** Abra o arquivo `reports/report-YYYY-MM-DD-HHmmss.html` no navegador.

### Formato Markdown

Útil para:
- Documentação
- Integração com wikis
- Versionamento em Git

```bash
npm run start run --report markdown
```

### Formato JSON

Útil para:
- Processamento automatizado
- Integração com CI/CD
- Análise programática

```bash
npm run start run --report json
```

### Gerar Relatório de Execução Anterior

Se você salvou os resultados JSON:

```bash
npm run start report --input reports/results-2024-01-15.json --format html
```

---

## 🔧 Troubleshooting

### Problema: "Browser not found"

**Solução:**
```bash
npx playwright install chromium
```

### Problema: "Authentication failed"

**Possíveis causas:**
1. Credenciais incorretas no `.env`
2. Aplicação não está acessível na URL configurada
3. Usuário de teste não existe ou está bloqueado

**Solução:**
- Verifique `TEST_ADMIN_EMAIL` e `TEST_ADMIN_PASSWORD` no `.env`
- Teste login manual na aplicação
- Verifique se `APP_URL` está correto

### Problema: "Element not found"

**Possíveis causas:**
1. Seletor mudou na aplicação
2. Página carregou lentamente
3. Elemento não existe na página

**Solução:**
- Execute com `--no-headless` para ver o que está acontecendo
- Aumente timeouts no código do cenário
- Verifique se o seletor está correto em `src/config/selectors.ts`
- Use análise com IA: `--ai-analysis`

### Problema: "AI analysis not available"

**Solução:**
- Configure `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` no `.env`
- Verifique se a chave está válida
- Verifique sua cota de API

### Problema: Testes muito lentos

**Soluções:**
- Execute apenas smoke tests: `npm run start run` (sem `--all`)
- Execute por tag específica: `--tag auth`
- Desabilite screenshots: configure `SCREENSHOTS_ON_FAILURE=false` no `.env`
- Use modo headless (padrão)

### Problema: "Firestore validation failed"

**Solução:**
- Configure corretamente as variáveis do Firebase no `.env`
- Verifique se a chave privada está com `\n` preservados
- Validação Firestore é opcional - testes funcionam sem ela

### Problema: Relatório não gerado

**Solução:**
- Verifique permissões de escrita no diretório `reports/`
- Verifique se há espaço em disco
- Execute com `--report html` explicitamente

---

## ✅ Boas Práticas

### 1. Comece com Smoke Tests

Sempre comece executando os smoke tests antes de rodar a suíte completa:

```bash
npm run start run
```

### 2. Use Tags para Organização

Execute testes por categoria durante desenvolvimento:

```bash
# Durante desenvolvimento de autenticação
npm run start run --tag auth --no-headless

# Durante desenvolvimento de CRUD
npm run start run --tag crud
```

### 3. Habilite Análise de IA para Debug

Quando encontrar falhas, execute com análise de IA:

```bash
npm run start run --ai-analysis --no-headless
```

### 4. Revise Relatórios HTML

Sempre revise os relatórios HTML para entender falhas:

```bash
# Execute testes
npm run start run --all

# Abra o relatório gerado
open reports/report-*.html
```

### 5. Mantenha Credenciais Seguras

- Nunca commite o arquivo `.env` no Git
- Use variáveis de ambiente em CI/CD
- Rotacione credenciais regularmente

### 6. Use Navegador Visível para Debug

Quando algo não funciona, veja o que está acontecendo:

```bash
npm run start run --no-headless --scenario "Nome do Cenário"
```

### 7. Monitore Logs

Os logs estão em `logs/` e contêm informações detalhadas:

```bash
# Ver último log
tail -f logs/test-*.log
```

### 8. Execute em CI/CD

Configure o agente para executar automaticamente:

```yaml
# Exemplo GitHub Actions
- name: Run Tests
  run: |
    cd agent
    npm install
    npx playwright install chromium
    npm run start run --all
```

### 9. Adicione Novos Cenários

Quando encontrar bugs, adicione cenários de teste para prevenir regressões:

```typescript
// src/scenarios/bug-fixes.ts
export const bugFixScenario: TestScenario = {
  name: 'Fix: Bug específico',
  tags: ['bugfix'],
  steps: [...],
  validations: [...],
};
```

### 10. Revise Screenshots de Falhas

Screenshots são salvos automaticamente em falhas. Revise-os para entender o estado da página quando o teste falhou.

---

## 📚 Recursos Adicionais

### Estrutura de Cenários

Para entender como criar novos cenários, veja:
- `src/scenarios/auth-scenarios.ts`
- `src/scenarios/crud-scenarios.ts`
- `src/scenarios/ifrs15-scenarios.ts`

### Page Objects

Para entender como interagir com páginas, veja:
- `src/pages/base-page.ts`
- `src/pages/login-page.ts`
- `src/pages/dashboard-page.ts`

### Configuração de Seletores

Para gerenciar seletores CSS, veja:
- `src/config/selectors.ts`

---

## 🆘 Suporte

Se encontrar problemas:

1. Verifique este guia
2. Revise os logs em `logs/`
3. Execute com `--no-headless` para debug visual
4. Use `--ai-analysis` para sugestões de correção
5. Consulte o README.md principal

---

**Última atualização:** Dezembro 2024
