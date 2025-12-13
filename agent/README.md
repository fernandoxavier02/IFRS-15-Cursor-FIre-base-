# IFRS 15 Test Agent

Agente de IA para testes automatizados do IFRS 15 Revenue Manager.

## 🚀 Funcionalidades

- **Navegação Autônoma**: Navega por todas as 28 páginas da aplicação
- **Preenchimento de Formulários**: Preenche campos e cria dados de teste automaticamente
- **Validação de Resultados**: Verifica se as operações foram concluídas com sucesso
- **Captura de Console**: Coleta logs e erros do navegador
- **Monitoramento de Rede**: Monitora requisições de API
- **Análise com IA**: Analisa falhas usando OpenAI/Anthropic
- **Relatórios Detalhados**: Gera relatórios em HTML, JSON ou Markdown

## 📋 Pré-requisitos

- Node.js 20+
- npm ou yarn

## 🔧 Instalação

```bash
# Instalar dependências
npm install

# Instalar navegadores do Playwright
npx playwright install chromium
```

## ⚙️ Configuração

Copie `.env.example` para `.env` e configure:

```env
# URL da aplicação
APP_URL=https://ifrs15-revenue-manager.web.app

# Credenciais de teste
TEST_ADMIN_EMAIL=seu-email@exemplo.com
TEST_ADMIN_PASSWORD=sua-senha

# (Opcional) Para análise com IA
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# (Opcional) Firebase Admin para validação direta
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

## 🎮 Uso

### Listar cenários disponíveis

```bash
npm run start list
npm run start list --tag smoke
```

### Executar testes

```bash
# Executar smoke tests (padrão)
npm run start run

# Executar todos os testes
npm run start run --all

# Executar por tag
npm run start run --tag auth
npm run start run --tag crud
npm run start run --tag ifrs15

# Executar cenário específico
npm run start run --scenario "Login with valid credentials"

# Com navegador visível
npm run start run --no-headless

# Com análise de IA para falhas
npm run start run --ai-analysis

# Especificar formato do relatório
npm run start run --report markdown
```

### Ver tags disponíveis

```bash
npm run start tags
```

### Analisar estrutura da aplicação

```bash
npm run start analyze
```

## 📁 Estrutura do Projeto

```
agent/
├── src/
│   ├── browser/           # Camada de automação do navegador
│   │   ├── playwright-controller.ts
│   │   ├── console-capture.ts
│   │   └── network-monitor.ts
│   ├── core/              # Orquestração e validação
│   │   ├── orchestrator.ts
│   │   ├── action-planner.ts
│   │   ├── state-manager.ts
│   │   └── result-validator.ts
│   ├── pages/             # Page Objects
│   │   ├── base-page.ts
│   │   ├── login-page.ts
│   │   ├── dashboard-page.ts
│   │   ├── contracts-page.ts
│   │   └── ...
│   ├── scenarios/         # Cenários de teste
│   │   ├── auth-scenarios.ts
│   │   ├── crud-scenarios.ts
│   │   └── ifrs15-scenarios.ts
│   ├── data/              # Dados e validação Firestore
│   │   ├── test-data-generator.ts
│   │   └── firestore-client.ts
│   ├── ai/                # Integração com IA
│   │   ├── llm-engine.ts
│   │   └── error-analyzer.ts
│   ├── reporting/         # Logs e relatórios
│   │   ├── logger.ts
│   │   └── report-generator.ts
│   ├── config/            # Configurações
│   │   ├── app-config.ts
│   │   ├── test-config.ts
│   │   └── selectors.ts
│   └── index.ts           # CLI entry point
├── reports/               # Relatórios gerados
├── screenshots/           # Screenshots capturados
├── logs/                  # Logs de execução
├── package.json
└── tsconfig.json
```

## 🧪 Cenários de Teste

### Autenticação (auth)
- Login com credenciais válidas
- Login com credenciais inválidas
- Toggle de visibilidade da senha
- Redirecionamento de usuário autenticado
- Proteção de rotas

### CRUD (crud)
- Criar cliente
- Criar contrato
- Buscar clientes/contratos
- Filtrar por status
- Visualizar detalhes

### IFRS 15 (ifrs15)
- Navegação entre páginas IFRS 15
- Modelo de 5 passos
- Obrigações de desempenho
- Cronogramas de faturamento
- Ledger de receita
- Análise waterfall

## 📊 Validações Suportadas

| Tipo | Descrição |
|------|-----------|
| `url` | Verifica URL atual |
| `element` | Verifica estado de elemento (visible/hidden) |
| `elementText` | Verifica texto de elemento |
| `toast` | Aguarda notificação toast |
| `console` | Verifica erros no console |
| `network` | Verifica chamadas de API |
| `firestore` | Valida dados diretamente no Firestore |

## 🤖 Análise com IA

Quando habilitada (`--ai-analysis`), o agente usa LLMs para:

- Analisar causa raiz de falhas
- Sugerir correções
- Categorizar severidade
- Gerar resumos executivos

## 📝 Relatórios

Os relatórios incluem:

- Resumo executivo
- Detalhes de cada cenário
- Passos executados
- Validações realizadas
- Screenshots de falhas
- Análise de IA (quando habilitada)
- Logs do console
- Chamadas de API

## 🔧 Extensão

### Adicionar novo cenário

```typescript
// src/scenarios/meu-scenario.ts
import { TestScenario } from '../core/orchestrator.js';

export const meuCenario: TestScenario = {
  name: 'Meu novo cenário',
  tags: ['custom'],
  preconditions: ['authenticated'],
  steps: [
    { type: 'navigate', target: '/minha-pagina' },
    { type: 'fill', target: 'input[name="campo"]', value: 'valor' },
    { type: 'click', target: 'button[type="submit"]' },
  ],
  validations: [
    { type: 'toast', text: 'Sucesso' },
  ],
};
```

### Adicionar novo Page Object

```typescript
// src/pages/minha-page.ts
import { BasePage } from './base-page.js';

export class MinhaPagina extends BasePage {
  readonly route = '/minha-pagina';
  readonly expectedElements = ['#elemento-principal'];

  async minhaAcao(): Promise<void> {
    await this.controller.click('#meu-botao');
  }
}
```

## 📄 Licença

MIT
