# 📖 Guia Prático de Uso - IFRS 15 Revenue Manager

## Índice
1. [Primeiros Passos](#primeiros-passos)
2. [Gerenciar Clientes](#gerenciar-clientes)
3. [Criar e Gerenciar Contratos](#criar-e-gerenciar-contratos)
4. [Performance Obligations](#performance-obligations)
5. [Motor IFRS 15](#motor-ifrs-15)
6. [Cronogramas de Faturamento](#cronogramas-de-faturamento)
7. [Razão de Receita](#razão-de-receita)
8. [Ingestão Automática de Contratos](#ingestão-automática)
9. [Componentes de Financiamento](#componentes-de-financiamento)
10. [Outras Funcionalidades](#outras-funcionalidades)

---

## 🚀 Primeiros Passos

### Login no Sistema

1. Acesse a URL do sistema
2. Na tela de login, digite:
   - **Email**: seu email cadastrado
   - **Senha**: sua senha
3. Clique em **"Sign In"**
4. Se for seu primeiro acesso:
   - Você pode precisar alterar a senha
   - Você pode precisar ativar uma licença

### Navegação

- **Sidebar Esquerda**: Menu principal com todas as funcionalidades
- **Header Superior**: Toggle de sidebar, seletor de idioma, toggle de tema
- **Dashboard**: Visão geral ao acessar `/`

---

## 👥 Gerenciar Clientes

### Como Criar um Cliente

**Localização**: Menu → **Customers** (`/customers`)

**Passo a Passo**:

1. Clique no botão **"New Customer"** (canto superior direito)
2. Preencha o formulário:
   - **Name**: Nome do cliente (obrigatório)
   - **Country**: País do cliente (obrigatório)
   - **Currency**: Moeda (ex: BRL, USD, EUR)
   - **Tax ID**: CNPJ/CPF (opcional)
   - **Contact Email**: Email de contato (opcional)
   - **Contact Phone**: Telefone (opcional)
   - **Credit Rating**: Classificação de crédito (opcional)
   - **Billing Address**: Endereço de cobrança (opcional)
3. Clique em **"Create Customer"**
4. O cliente aparecerá na lista

**Exemplo**:
```
Name: Acme Corporation
Country: Brazil
Currency: BRL
Tax ID: 12.345.678/0001-90
Contact Email: contato@acme.com
```

### Como Editar um Cliente

1. Na lista de clientes, encontre o cliente desejado
2. Clique no botão de edição (ícone de lápis)
3. Modifique os campos desejados
4. Clique em **"Save"**

### Como Deletar um Cliente

**⚠️ ATENÇÃO**: Só é possível deletar clientes que NÃO possuem contratos associados.

1. Vá para **Delete Management** (`/delete-management`)
2. Na seção **"Excluir Clientes"**
3. Encontre o cliente na lista
4. Clique em **"Deletar"**
5. **Confirmação dupla**: Digite o nome exato do cliente
6. Clique em **"Deletar Cliente"**

---

## 📄 Criar e Gerenciar Contratos

### Como Criar um Contrato Manualmente

**Localização**: Menu → **Contracts** (`/contracts`)

**Passo a Passo**:

1. Clique no botão **"New Contract"** (canto superior direito)
2. Preencha o formulário:

   **Campos Obrigatórios**:
   - **Customer**: Selecione um cliente da lista (deve existir antes)
   - **Contract Number**: Número único do contrato (ex: CTR-2024-001)
   - **Title**: Título/descrição do contrato
   - **Start Date**: Data de início do contrato
   - **Total Value**: Valor total do contrato (número)
   - **Currency**: Moeda do contrato

   **Campos Opcionais**:
   - **End Date**: Data de término (se houver)
   - **Payment Terms**: Termos de pagamento (ex: "Net 30", "50% upfront")
   
3. Clique em **"Create Contract"**
4. O sistema automaticamente:
   - Cria o contrato
   - Cria a versão inicial (versão 1)
   - Define o contrato como "draft"

**Exemplo**:
```
Customer: Acme Corporation
Contract Number: CTR-2024-001
Title: Software License Agreement - Annual
Start Date: 2024-01-01
End Date: 2024-12-31
Total Value: 120000
Currency: BRL
Payment Terms: Net 30
```

### Visualizar Detalhes do Contrato

1. Na lista de contratos, clique em qualquer contrato
2. Você será redirecionado para `/contracts/{id}`
3. A página mostra:
   - **Overview**: Informações gerais do contrato
   - **Performance Obligations**: Obrigações de performance
   - **Billing Schedule**: Cronograma de faturamento
   - **Revenue Ledger**: Entradas de receita

### Status do Contrato

Os contratos podem ter os seguintes status:
- **draft**: Rascunho (recém criado)
- **active**: Ativo
- **modified**: Modificado (tem nova versão)
- **terminated**: Terminado
- **expired**: Expirado

---

## 🎯 Performance Obligations

### O que são Performance Obligations?

Performance Obligations (POs) são as obrigações de performance do contrato - ou seja, os bens ou serviços distintos que você promete entregar ao cliente.

**Exemplo**: Em um contrato de software:
- PO 1: Licença do software (point in time)
- PO 2: Suporte técnico (over time)
- PO 3: Treinamento (point in time)

### Como Adicionar Performance Obligations

**Localização**: **Contract Details** → Aba **"Performance Obligations"**

**Passo a Passo**:

1. Acesse o contrato desejado (`/contracts/{id}`)
2. Vá para a aba **"Performance Obligations"**
3. Clique no botão **"Add"** (canto superior direito)
4. Preencha o formulário:

   **Campos Obrigatórios**:
   - **Description**: Descrição da obrigação (ex: "Software License", "Support Services")
   - **Allocated Price**: Preço alocado a esta obrigação (ex: 50000)
   - **Recognition Method**: 
     - **over_time**: Reconhecimento ao longo do tempo
     - **point_in_time**: Reconhecimento em um ponto específico

   **Campos Opcionais**:
   - **Measurement Method**: (apenas se over_time)
     - **input**: Método de entrada (ex: custos incorridos)
     - **output**: Método de saída (ex: unidades entregues)
   - **Percent Complete**: Percentual de conclusão (0-100)

5. Clique em **"Save"**

**⚠️ IMPORTANTE**: 
- Se o contrato não tiver versão, o sistema cria automaticamente a versão inicial
- A soma dos preços alocados deve ser igual ao valor total do contrato

**Exemplo**:
```
Description: Software License - Annual
Allocated Price: 80000
Recognition Method: point_in_time
Percent Complete: 0
```

### Como Editar Performance Obligations

1. Na lista de POs, encontre a obrigação desejada
2. Clique no botão de edição
3. Modifique os campos
4. Clique em **"Save"**

### Reconhecimento de Receita

- **Point in Time**: Receita reconhecida quando a obrigação é satisfeita (marcada como `isSatisfied = true`)
- **Over Time**: Receita reconhecida progressivamente baseada no `percentComplete`

---

## ⚙️ Motor IFRS 15

### O que é o Motor IFRS 15?

O Motor IFRS 15 executa automaticamente os **5 passos do modelo de reconhecimento de receita** conforme o padrão IFRS 15:

1. **Identificar o Contrato**
2. **Identificar Obrigações de Performance**
3. **Determinar Preço da Transação**
4. **Alocar Preço às Obrigações**
5. **Reconhecer Receita**

### Como Usar o Motor IFRS 15

**Localização**: Menu → **IFRS 15 Engine** (`/ifrs15`)

**Pré-requisitos**:
- ✅ Contrato criado
- ✅ Pelo menos uma Performance Obligation cadastrada

**Passo a Passo**:

1. Acesse **IFRS 15 Engine** no menu
2. **Selecione um Contrato**:
   - No dropdown "Selecione um contrato"
   - Escolha o contrato desejado
3. O sistema carrega automaticamente:
   - As Performance Obligations do contrato
   - Exibe os 5 passos do IFRS 15
4. **Clique em "Executar Motor"**
5. O sistema processa:
   - Valida o contrato
   - Calcula alocações de preço
   - Gera cronograma de reconhecimento
   - Atualiza valores nas POs
6. **Resultados exibidos**:
   - Preço total da transação
   - Alocações por PO
   - Receita reconhecida vs diferida
   - Cronograma de reconhecimento

### O que o Motor Faz?

#### Passo 1: Identificar o Contrato
- Verifica se o contrato existe
- Valida se está ativo
- Verifica se tem versão atual

#### Passo 2: Identificar Obrigações de Performance
- Lista todas as POs do contrato
- Verifica se são distintas
- Valida justificativas

#### Passo 3: Determinar Preço da Transação
- Soma o valor total do contrato
- Considera componentes variáveis (se houver)
- Subtrai componentes de financiamento (se houver)

#### Passo 4: Alocar Preço da Transação
- Aloca o preço às POs baseado nos preços alocados
- Se não houver preços standalone, usa alocação proporcional
- Calcula percentual de alocação

#### Passo 5: Reconhecer Receita
- **Point in Time**: Se `isSatisfied = true`, reconhece 100%
- **Over Time**: Reconhece baseado no `percentComplete`
- Gera cronograma mensal de reconhecimento
- Cria entradas no Revenue Ledger automaticamente

### Exemplo de Execução

```
Contrato: CTR-2024-001
Valor Total: R$ 120.000

Performance Obligations:
- PO 1: Software License (R$ 80.000) - Point in Time
- PO 2: Support (R$ 40.000) - Over Time (12 meses)

Resultado do Motor:
- Preço da Transação: R$ 120.000
- Alocação PO 1: R$ 80.000 (66.67%)
- Alocação PO 2: R$ 40.000 (33.33%)
- Receita Reconhecida: R$ 80.000 (PO 1 satisfeita)
- Receita Diferida: R$ 40.000 (PO 2 em andamento)
```

---

## 💰 Cronogramas de Faturamento

### O que são Billing Schedules?

Cronogramas de faturamento são os agendamentos de quando você vai faturar o cliente.

### Como Criar um Cronograma de Faturamento

**Localização**: Menu → **Billing Schedules** (`/billing-schedules`)

**Passo a Passo**:

1. Clique no botão **"New Billing"** (canto superior direito)
2. Preencha o formulário:

   **Campos Obrigatórios**:
   - **Contract**: Selecione o contrato
   - **Billing Date**: Data do faturamento
   - **Due Date**: Data de vencimento
   - **Amount**: Valor a ser faturado
   - **Currency**: Moeda

   **Campos Opcionais**:
   - **Frequency**: Frequência (one_time, monthly, quarterly, etc.)
   - **Notes**: Observações

3. Clique em **"Create Billing"**

**Exemplo**:
```
Contract: CTR-2024-001
Billing Date: 2024-01-15
Due Date: 2024-02-14
Amount: 10000
Currency: BRL
Frequency: monthly
```

### Status do Cronograma

- **scheduled**: Agendado (ainda não faturado)
- **invoiced**: Faturado (invoice gerado)
- **paid**: Pago (recebido)
- **overdue**: Vencido (não pago após due date)
- **cancelled**: Cancelado

### Atualizar Status

1. Na lista de cronogramas, encontre o item
2. Clique em **"Mark Invoiced"** (se scheduled)
3. Clique em **"Mark Paid"** (se invoiced)

### Visualizações

- **List View**: Tabela com todos os cronogramas
- **Calendar View**: Visualização mensal em calendário

---

## 📊 Razão de Receita (Revenue Ledger)

### O que é o Revenue Ledger?

O Revenue Ledger é o razão de receita - um registro de todas as entradas de receita reconhecida e diferida.

### Como Visualizar o Revenue Ledger

**Localização**: Menu → **Revenue Ledger** (`/revenue-ledger`)

**O que você vê**:
- Lista de todas as entradas de receita
- Filtros por contrato, período, tipo
- Totais de receita reconhecida vs diferida

### Entradas Automáticas

O Motor IFRS 15 cria automaticamente entradas no Revenue Ledger quando:
- Uma Performance Obligation é satisfeita (point in time)
- Uma Performance Obligation progride (over time)
- O motor é executado

### Criar Entrada Manual

1. Clique em **"New Entry"**
2. Preencha:
   - **Contract**: Contrato relacionado
   - **Entry Date**: Data da entrada
   - **Entry Type**: 
     - **recognized**: Receita reconhecida
     - **deferred**: Receita diferida
   - **Amount**: Valor
   - **Description**: Descrição
3. Clique em **"Create Entry"**

---

## 🤖 Ingestão Automática de Contratos

### O que é a Ingestão Automática?

A ingestão automática usa **Inteligência Artificial** para extrair dados de contratos em PDF automaticamente.

### Como Usar a Ingestão Automática

**Localização**: Menu → **Contract Ingestion** (`/contract-ingestion`)

**Pré-requisitos**:
- ✅ Provedor de IA configurado (AI Settings)
- ✅ Plano que inclui esta funcionalidade

**Passo a Passo**:

1. **Upload do PDF**:
   - Clique em **"Choose File"** ou arraste o arquivo
   - Selecione o arquivo PDF do contrato
   - O sistema extrai o texto automaticamente

2. **Selecionar Provedor de IA**:
   - Escolha o provedor (GPT-4, Claude, Gemini, etc.)
   - Configured em **AI Settings**

3. **Iniciar Extração**:
   - Clique em **"Start AI Extraction"**
   - O sistema envia o texto para a IA
   - A IA extrai dados estruturados:
     - Número do contrato
     - Título
     - Cliente
     - Datas (início, fim)
     - Valor total
     - Moeda
     - Termos de pagamento
     - Line Items
     - Performance Obligations

4. **Revisar Dados Extraídos**:
   - O sistema mostra os dados extraídos
   - **Revise e corrija** se necessário
   - Adicione notas de revisão (opcional)

5. **Aprovar e Criar**:
   - Clique em **"Approve and Create Contract"**
   - O sistema cria automaticamente:
     - O contrato
     - A versão inicial
     - Os line items (se houver)
     - As performance obligations (se houver)

### Exemplo de Dados Extraídos

```json
{
  "contractNumber": "CTR-2024-001",
  "title": "Software License Agreement",
  "customerName": "Acme Corporation",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "totalValue": 120000,
  "currency": "BRL",
  "lineItems": [
    {
      "description": "Software License",
      "quantity": 1,
      "unitPrice": 100000,
      "totalPrice": 100000
    }
  ],
  "performanceObligations": [
    {
      "description": "Software License",
      "allocatedPrice": 100000,
      "recognitionMethod": "point_in_time"
    }
  ]
}
```

---

## 💳 Componentes de Financiamento

### O que são Componentes de Financiamento?

Componentes de financiamento significativo (IFRS 15.60-65) ocorrem quando o timing dos pagamentos fornece um benefício significativo de financiamento.

**Exemplo**: Contrato de R$ 120.000 com pagamento em 24 meses → há componente de financiamento.

### Como Calcular Componente de Financiamento

**Localização**: Menu → **Financing Components** (`/financing-components`)

**Passo a Passo**:

1. Clique em **"Calculate"** (canto superior direito)
2. Preencha o formulário:

   **Campos Obrigatórios**:
   - **Contract**: Selecione o contrato
   - **Nominal Amount**: Valor nominal (ex: 120000)
   - **Discount Rate**: Taxa de desconto anual (ex: 10%)
   - **Financing Period Months**: Período em meses (ex: 24)
   - **Currency**: Moeda

3. O sistema calcula automaticamente:
   - **Present Value**: Valor presente (descontado)
   - **Total Interest**: Juros totais (diferença)

4. Clique em **"Save"**

**Fórmula**:
```
Present Value = Nominal Amount / (1 + (Annual Rate / 12))^Months
Total Interest = Nominal Amount - Present Value
```

**Exemplo**:
```
Nominal Amount: R$ 120.000
Discount Rate: 10% ao ano
Period: 24 meses

Cálculo:
Monthly Rate = 10% / 12 = 0.833%
Present Value = 120.000 / (1.00833)^24 = R$ 98.350
Total Interest = 120.000 - 98.350 = R$ 21.650
```

### Visualização

A página mostra:
- **Total Nominal**: Soma de todos os valores nominais
- **Total Present Value**: Soma de todos os valores presentes
- **Total Interest**: Soma de todos os juros
- **Recognized Interest**: Juros já reconhecidos

---

## 🔧 Outras Funcionalidades

### Exchange Rates (Taxas de Câmbio)

**Localização**: Menu → **Exchange Rates** (`/exchange-rates`)

**Uso**: Gerenciar taxas de câmbio para conversão de moedas em contratos internacionais.

**Como usar**:
1. Clique em **"New Rate"**
2. Preencha:
   - **From Currency**: Moeda origem (ex: USD)
   - **To Currency**: Moeda destino (ex: BRL)
   - **Rate**: Taxa de câmbio (ex: 5.20)
   - **Effective Date**: Data de vigência
3. Clique em **"Create"**

### Consolidated Balances (Balanços Consolidados)

**Localização**: Menu → **Consolidated Balances** (`/consolidated-balances`)

**Uso**: Visualizar balanços consolidados por período (mensal/trimestral).

**O que mostra**:
- Contract Assets (Ativos de Contrato)
- Contract Liabilities (Passivos de Contrato)
- Recognized Revenue (Receita Reconhecida)
- Deferred Revenue (Receita Diferida)

### Revenue Waterfall (Cascata de Receita)

**Localização**: Menu → **Revenue Waterfall** (`/revenue-waterfall`)

**Uso**: Visualização em cascata da receita (gráfico waterfall).

### Contract Costs (Custos de Contrato)

**Localização**: Menu → **Contract Costs** (`/contract-costs`)

**Uso**: Gerenciar custos de obtenção e cumprimento de contratos (IFRS 15).

### Executive Dashboard

**Localização**: Menu → **Executive Dashboard** (`/executive-dashboard`)

**Uso**: Dashboard executivo com KPIs e métricas avançadas para gestão.

### IFRS 15 Accounting Control

**Localização**: Menu → **Accounting Control** (`/ifrs15-accounting-control`)

**Uso**: Controles contábeis e validações de conformidade IFRS 15.

### Reports (Relatórios)

**Localização**: Menu → **Reports** (`/reports`)

**Uso**: Gerar relatórios diversos do sistema.

### Audit Trail (Rastro de Auditoria)

**Localização**: Menu → **Audit Trail** (`/audit`)

**Uso**: Visualizar logs de todas as ações realizadas no sistema.

**Filtros disponíveis**:
- Por usuário
- Por entidade (contract, customer, etc.)
- Por ação (create, update, delete)
- Por período

### Settings (Configurações)

**Localização**: Menu → **Settings** (`/settings`)

**Uso**: Configurações do usuário e tenant.

### AI Settings

**Localização**: Menu → **AI Settings** (`/ai-settings`)

**Uso**: Configurar provedores de IA para ingestão de contratos.

**Como configurar**:
1. Clique em **"Add Provider"**
2. Selecione o provedor:
   - OpenAI (GPT-4, GPT-3.5)
   - Anthropic (Claude)
   - Google (Gemini)
   - OpenRouter
3. Configure:
   - **API Key**: Chave de API
   - **Model**: Modelo a usar
   - **Is Default**: Marcar como padrão
4. Clique em **"Save"**

### Delete Management

**Localização**: Menu → **Delete Management** (`/delete-management`)

**Uso**: Exclusão segura de clientes e contratos.

**⚠️ ATENÇÃO**: 
- Requer confirmação dupla (digitar nome/número)
- Não permite deletar cliente com contratos
- Deleta em cascata (contrato → versões → POs → etc.)

---

## 📋 Fluxo Completo: Do Contrato à Receita Reconhecida

### Cenário Completo

Vamos criar um exemplo completo do início ao fim:

#### 1. Criar Cliente
```
Menu → Customers → New Customer
Name: TechCorp Solutions
Country: Brazil
Currency: BRL
```

#### 2. Criar Contrato
```
Menu → Contracts → New Contract
Customer: TechCorp Solutions
Contract Number: CTR-2024-050
Title: Software License + Support - Annual
Start Date: 2024-01-01
End Date: 2024-12-31
Total Value: 120000
Currency: BRL
```

#### 3. Adicionar Performance Obligations
```
Contract Details → Performance Obligations → Add

PO 1:
Description: Software License
Allocated Price: 80000
Recognition Method: point_in_time

PO 2:
Description: Support Services
Allocated Price: 40000
Recognition Method: over_time
Measurement Method: input
Percent Complete: 0
```

#### 4. Executar Motor IFRS 15
```
Menu → IFRS 15 Engine
Select Contract: CTR-2024-050
Click: Executar Motor

Resultado:
- Preço da Transação: R$ 120.000
- PO 1 Alocada: R$ 80.000
- PO 2 Alocada: R$ 40.000
- Receita Reconhecida: R$ 0 (PO 1 não satisfeita ainda)
- Receita Diferida: R$ 120.000
```

#### 5. Marcar PO 1 como Satisfeita
```
Contract Details → Performance Obligations
PO 1 → Edit → Marcar isSatisfied = true
```

#### 6. Executar Motor Novamente
```
IFRS 15 Engine → Executar Motor

Resultado:
- Receita Reconhecida: R$ 80.000 (PO 1)
- Receita Diferida: R$ 40.000 (PO 2 em andamento)
```

#### 7. Atualizar Progresso da PO 2
```
Contract Details → Performance Obligations
PO 2 → Edit → Percent Complete: 50%
```

#### 8. Executar Motor Novamente
```
IFRS 15 Engine → Executar Motor

Resultado:
- Receita Reconhecida: R$ 100.000 (R$ 80k PO1 + R$ 20k PO2)
- Receita Diferida: R$ 20.000 (restante da PO2)
```

#### 9. Criar Cronograma de Faturamento
```
Menu → Billing Schedules → New Billing
Contract: CTR-2024-050
Billing Date: 2024-01-15
Due Date: 2024-02-14
Amount: 10000
Frequency: monthly
```

#### 10. Visualizar Revenue Ledger
```
Menu → Revenue Ledger
Ver entradas automáticas criadas pelo motor:
- Entry 1: R$ 80.000 recognized (PO 1)
- Entry 2: R$ 20.000 recognized (PO 2 - 50%)
- Entry 3: R$ 20.000 deferred (PO 2 - restante)
```

---

## 💡 Dicas e Boas Práticas

### 1. Sempre crie o cliente antes do contrato
- O contrato precisa de um cliente associado

### 2. A soma dos preços alocados deve igualar o valor total
- Se o contrato é R$ 100.000, a soma das POs deve ser R$ 100.000

### 3. Execute o motor após cada mudança significativa
- Após adicionar POs
- Após marcar PO como satisfeita
- Após atualizar percentComplete

### 4. Use a ingestão automática para contratos em PDF
- Economiza tempo
- Reduz erros de digitação
- Sempre revise os dados extraídos

### 5. Mantenha os cronogramas de faturamento atualizados
- Marque como "invoiced" quando gerar a nota
- Marque como "paid" quando receber o pagamento

### 6. Monitore o Revenue Ledger regularmente
- Verifique se as entradas estão corretas
- Confira os totais de reconhecida vs diferida

### 7. Use o Audit Trail para rastreabilidade
- Todas as ações são registradas
- Útil para auditoria e compliance

---

## ❓ Perguntas Frequentes

### Q: Por que o botão "Add" de Performance Obligations está bloqueado?
**R**: O contrato precisa ter uma versão. O sistema cria automaticamente quando você tenta adicionar a primeira PO.

### Q: Como modificar um contrato existente?
**R**: O sistema usa versionamento. Crie uma nova versão do contrato (via Cloud Function ou manualmente) para fazer modificações.

### Q: O que acontece se eu deletar um contrato?
**R**: O sistema deleta em cascata:
- Versões do contrato
- Performance Obligations
- Line Items
- Billing Schedules relacionados
- Revenue Ledger Entries relacionados

### Q: Posso ter múltiplas versões de um contrato?
**R**: Sim! Cada modificação cria uma nova versão, mantendo o histórico.

### Q: Como o motor calcula a alocação de preço?
**R**: Se houver preços standalone nas POs, usa esses. Caso contrário, aloca proporcionalmente ao valor total.

### Q: Quando a receita é reconhecida?
**R**: 
- **Point in Time**: Quando `isSatisfied = true`
- **Over Time**: Progressivamente baseado no `percentComplete`

---

## 🎓 Conclusão

Este guia cobre todas as funcionalidades principais do sistema IFRS 15 Revenue Manager. 

**Lembre-se**:
- Sempre revise os dados antes de aprovar
- Execute o motor após mudanças significativas
- Mantenha os cronogramas atualizados
- Use o Audit Trail para rastreabilidade

Para mais informações sobre a arquitetura técnica, consulte `ARQUITETURA_E_FLUXOS.md`.
