/**
 * MAPEAMENTO COMPLETO DO AGENTE E2E
 * 
 * Este arquivo contém instruções detalhadas para o agente sobre:
 * - O que fazer em cada página
 * - Quais formulários preencher
 * - Quais botões clicar
 * - Quais dados inserir
 * - Ordem de execução
 */

import type { Page } from "@playwright/test";

/**
 * Dados de teste para preencher formulários
 */
export const TEST_DATA = {
  customer: {
    name: "Test Customer E2E",
    country: "Brazil",
    currency: "BRL",
    taxId: "12.345.678/0001-90",
    contactEmail: "test@customer.com",
    contactPhone: "+55 11 99999-9999",
    creditRating: "A",
    billingAddress: "Rua Teste, 123, São Paulo, SP, 01234-567",
  },
  contract: {
    contractNumber: `CTR-E2E-${Date.now()}`,
    title: "E2E Test Contract",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    totalValue: "100000.00",
    currency: "BRL",
    paymentTerms: "Net 30, 50% upfront payment",
  },
  revenueLedger: {
    referenceNumber: `REF-${Date.now()}`,
    description: "E2E Test Revenue Entry",
  },
  financingComponent: {
    nominalAmount: "50000",
    discountRate: "5.5",
    financingPeriodMonths: "12",
    currency: "BRL",
  },
  exchangeRate: {
    fromCurrency: "USD",
    toCurrency: "BRL",
    rate: "5.20",
    effectiveDate: new Date().toISOString().split("T")[0],
  },
};

/**
 * Mapeamento de ações por rota
 */
export interface RouteAction {
  route: string;
  description: string;
  actions: Action[];
  priority: "high" | "medium" | "low";
}

export interface Action {
  type: "click" | "fill" | "select" | "wait" | "navigate";
  selector: string;
  value?: string;
  description: string;
  required?: boolean;
  waitAfter?: number; // ms
}

/**
 * Mapeamento completo de todas as rotas e ações
 */
export const ROUTE_MAPPING: RouteAction[] = [
  {
    route: "/",
    description: "Dashboard - Visualizar métricas principais",
    priority: "high",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: '[data-testid*="card"]', description: "Clicar em cards de métricas", required: false },
    ],
  },
  {
    route: "/customers",
    description: "Clientes - Criar novo cliente",
    priority: "high",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: '[data-testid="button-new-customer"], button:has-text("New Customer"), button:has-text("Add Customer")', description: "Clicar em botão para criar novo cliente" },
      { type: "wait", selector: '[data-testid="input-customer-name"]', description: "Aguardar dialog abrir", waitAfter: 300 },
      { type: "fill", selector: '[data-testid="input-customer-name"]', value: TEST_DATA.customer.name, description: "Preencher nome do cliente" },
      { type: "fill", selector: '[data-testid="input-country"]', value: TEST_DATA.customer.country, description: "Preencher país" },
      { type: "select", selector: '[data-testid="select-currency"]', value: TEST_DATA.customer.currency, description: "Selecionar moeda" },
      { type: "fill", selector: '[data-testid="input-tax-id"]', value: TEST_DATA.customer.taxId, description: "Preencher Tax ID" },
      { type: "fill", selector: '[data-testid="input-email"]', value: TEST_DATA.customer.contactEmail, description: "Preencher email" },
      { type: "fill", selector: '[data-testid="input-phone"]', value: TEST_DATA.customer.contactPhone, description: "Preencher telefone" },
      { type: "select", selector: '[data-testid="select-credit-rating"]', value: TEST_DATA.customer.creditRating, description: "Selecionar credit rating" },
      { type: "fill", selector: '[data-testid="input-billing-address"]', value: TEST_DATA.customer.billingAddress, description: "Preencher endereço" },
      { type: "click", selector: 'button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add"), button[type="submit"]:has-text("Save")', description: "Salvar cliente", waitAfter: 1000 },
    ],
  },
  {
    route: "/contracts",
    description: "Contratos - Criar novo contrato",
    priority: "high",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: '[data-testid="button-new-contract"], button:has-text("New Contract"), button:has-text("Create Contract")', description: "Clicar em botão para criar novo contrato" },
      { type: "wait", selector: '[data-testid="select-customer"]', description: "Aguardar dialog abrir", waitAfter: 300 },
      { type: "select", selector: '[data-testid="select-customer"]', value: "", description: "Selecionar primeiro cliente disponível" },
      { type: "fill", selector: '[data-testid="input-contract-number"]', value: TEST_DATA.contract.contractNumber, description: "Preencher número do contrato" },
      { type: "fill", selector: '[data-testid="input-title"]', value: TEST_DATA.contract.title, description: "Preencher título" },
      { type: "fill", selector: '[data-testid="input-start-date"]', value: TEST_DATA.contract.startDate, description: "Preencher data de início" },
      { type: "fill", selector: '[data-testid="input-end-date"]', value: TEST_DATA.contract.endDate, description: "Preencher data de término" },
      { type: "fill", selector: '[data-testid="input-total-value"]', value: TEST_DATA.contract.totalValue, description: "Preencher valor total" },
      { type: "select", selector: '[data-testid="select-currency"]', value: TEST_DATA.contract.currency, description: "Selecionar moeda" },
      { type: "fill", selector: '[data-testid="input-payment-terms"]', value: TEST_DATA.contract.paymentTerms, description: "Preencher termos de pagamento" },
      { type: "click", selector: '[data-testid="button-submit-contract"], button[type="submit"]:has-text("Create Contract")', description: "Salvar contrato", waitAfter: 1000 },
    ],
  },
  {
    route: "/revenue-ledger",
    description: "Revenue Ledger - Criar nova entrada",
    priority: "high",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("New Entry"), button:has-text("Create Entry"), button:has-text("Add Entry")', description: "Clicar em botão para criar nova entrada" },
      { type: "wait", selector: '[data-testid="input-reference"], input[placeholder*="reference"]', description: "Aguardar dialog abrir", waitAfter: 300 },
      { type: "fill", selector: '[data-testid="input-reference"], input[placeholder*="reference"]', value: TEST_DATA.revenueLedger.referenceNumber, description: "Preencher número de referência" },
      { type: "fill", selector: '[data-testid="input-description"], textarea[placeholder*="description"]', value: TEST_DATA.revenueLedger.description, description: "Preencher descrição" },
      { type: "click", selector: '[data-testid="button-submit-entry"], button[type="submit"]:has-text("Create Entry")', description: "Salvar entrada", waitAfter: 1000 },
    ],
  },
  {
    route: "/financing-components",
    description: "Financing Components - Criar componente de financiamento",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("New"), button:has-text("Create"), button:has-text("Add")', description: "Clicar em botão para criar componente" },
      { type: "wait", selector: 'input[type="number"]', description: "Aguardar dialog abrir", waitAfter: 300 },
      { type: "fill", selector: 'input[placeholder*="nominal"], input[placeholder*="amount"]', value: TEST_DATA.financingComponent.nominalAmount, description: "Preencher valor nominal" },
      { type: "fill", selector: 'input[placeholder*="discount"], input[placeholder*="rate"]', value: TEST_DATA.financingComponent.discountRate, description: "Preencher taxa de desconto" },
      { type: "fill", selector: 'input[placeholder*="period"], input[placeholder*="months"]', value: TEST_DATA.financingComponent.financingPeriodMonths, description: "Preencher período em meses" },
      { type: "select", selector: 'select:has([value="BRL"])', value: TEST_DATA.financingComponent.currency, description: "Selecionar moeda" },
      { type: "click", selector: 'button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Calculate")', description: "Calcular e salvar", waitAfter: 1000 },
    ],
  },
  {
    route: "/exchange-rates",
    description: "Exchange Rates - Criar taxa de câmbio",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("New"), button:has-text("Add"), button:has-text("Create")', description: "Clicar em botão para criar taxa" },
      { type: "wait", selector: 'select, input[type="date"]', description: "Aguardar dialog abrir", waitAfter: 300 },
      { type: "select", selector: 'select:first-of-type', value: TEST_DATA.exchangeRate.fromCurrency, description: "Selecionar moeda origem" },
      { type: "select", selector: 'select:nth-of-type(2)', value: TEST_DATA.exchangeRate.toCurrency, description: "Selecionar moeda destino" },
      { type: "fill", selector: 'input[type="number"], input[placeholder*="rate"]', value: TEST_DATA.exchangeRate.rate, description: "Preencher taxa" },
      { type: "fill", selector: 'input[type="date"]', value: TEST_DATA.exchangeRate.effectiveDate, description: "Preencher data efetiva" },
      { type: "click", selector: 'button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")', description: "Salvar taxa", waitAfter: 1000 },
    ],
  },
  {
    route: "/billing-schedules",
    description: "Billing Schedules - Visualizar e interagir",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("New"), button:has-text("Create"), button:has-text("Add")', description: "Tentar criar novo schedule", required: false },
      { type: "click", selector: 'table button, [role="button"]', description: "Clicar em botões da tabela", required: false },
    ],
  },
  {
    route: "/consolidated-balances",
    description: "Consolidated Balances - Visualizar balanços",
    priority: "high",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 800 },
      { type: "click", selector: 'button, [role="button"]', description: "Clicar em botões de filtro/visualização", required: false },
    ],
  },
  {
    route: "/revenue-waterfall",
    description: "Revenue Waterfall - Visualizar gráfico",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button, select', description: "Interagir com controles", required: false },
    ],
  },
  {
    route: "/contract-costs",
    description: "Contract Costs - Gerenciar custos",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("New"), button:has-text("Add")', description: "Tentar criar novo custo", required: false },
    ],
  },
  {
    route: "/executive-dashboard",
    description: "Executive Dashboard - Visualizar dashboard executivo",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button, select', description: "Interagir com filtros", required: false },
    ],
  },
  {
    route: "/ifrs15",
    description: "IFRS 15 Engine - Processar contratos",
    priority: "high",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 800 },
      { type: "click", selector: 'button:has-text("Process"), button:has-text("Calculate"), button:has-text("Run")', description: "Tentar processar contratos", required: false },
    ],
  },
  {
    route: "/ifrs15-accounting-control",
    description: "IFRS 15 Accounting Control - Controles contábeis",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button, select', description: "Interagir com controles", required: false },
    ],
  },
  {
    route: "/reports",
    description: "Reports - Visualizar relatórios",
    priority: "low",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("Generate"), button:has-text("Export")', description: "Tentar gerar/exportar relatório", required: false },
    ],
  },
  {
    route: "/contract-ingestion",
    description: "Contract Ingestion - Ingestão de contratos via AI",
    priority: "high",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("Upload"), button:has-text("Ingest")', description: "Tentar fazer upload", required: false },
    ],
  },
  {
    route: "/ai-settings",
    description: "AI Settings - Configurações de IA",
    priority: "medium",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("Save"), button[type="submit"]', description: "Salvar configurações se houver mudanças", required: false },
    ],
  },
  {
    route: "/licenses",
    description: "Licenses - Gerenciar licenças",
    priority: "low",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button', description: "Interagir com botões", required: false },
    ],
  },
  {
    route: "/audit",
    description: "Audit Trail - Visualizar auditoria",
    priority: "low",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button, select', description: "Interagir com filtros", required: false },
    ],
  },
  {
    route: "/settings",
    description: "Settings - Configurações gerais",
    priority: "low",
    actions: [
      { type: "wait", selector: "body", description: "Aguardar carregamento", waitAfter: 500 },
      { type: "click", selector: 'button:has-text("Save"), button[type="submit"]', description: "Salvar configurações se houver mudanças", required: false },
    ],
  },
];

/**
 * Função auxiliar para executar uma ação
 */
export async function executeAction(page: Page, action: Action): Promise<boolean> {
  try {
    switch (action.type) {
      case "wait":
        await page.waitForTimeout(action.waitAfter || 300);
        return true;
      
      case "click":
        // Tentar cada seletor até encontrar um que funcione
        const clickSelectors = action.selector.split(",").map(s => s.trim());
        
        for (const selector of clickSelectors) {
          try {
            const clickElement = page.locator(selector).first();
            const isVisible = await clickElement.isVisible({ timeout: 3000 }).catch(() => false);
            if (isVisible) {
              await clickElement.click({ timeout: 5000 });
              if (action.waitAfter) await page.waitForTimeout(action.waitAfter);
              return true;
            }
          } catch (err) {
            // Continua tentando próximo seletor
            continue;
          }
        }
        
        return !action.required; // Se não é obrigatório, retorna true mesmo se não encontrou
      
      case "fill":
        // Tentar cada seletor até encontrar um que funcione
        const fillSelectors = action.selector.split(",").map(s => s.trim());
        
        for (const selector of fillSelectors) {
          try {
            const fillElement = page.locator(selector).first();
            const fillVisible = await fillElement.isVisible({ timeout: 3000 }).catch(() => false);
            if (fillVisible && action.value) {
              await fillElement.clear();
              await fillElement.fill(action.value);
              if (action.waitAfter) await page.waitForTimeout(action.waitAfter);
              return true;
            }
          } catch (err) {
            // Continua tentando próximo seletor
            continue;
          }
        }
        
        return !action.required;
      
      case "select":
        // Tentar cada seletor até encontrar um que funcione
        const selectors = action.selector.split(",").map(s => s.trim());
        let selectSuccess = false;
        
        for (const selector of selectors) {
          try {
            const selectElement = page.locator(selector).first();
            const selectVisible = await selectElement.isVisible({ timeout: 3000 }).catch(() => false);
            
            if (selectVisible) {
              await selectElement.click();
              await page.waitForTimeout(500);
              
              // Aguardar o dropdown abrir
              await page.waitForTimeout(300);
              
              if (action.value) {
                // Tentar selecionar pelo valor exato
                const optionByValue = page.locator(`[role="option"][value="${action.value}"], option[value="${action.value}"]`).first();
                const optionByText = page.locator(`[role="option"]:has-text("${action.value}")`).first();
                
                const optionByValueVisible = await optionByValue.isVisible({ timeout: 1000 }).catch(() => false);
                const optionByTextVisible = await optionByText.isVisible({ timeout: 1000 }).catch(() => false);
                
                if (optionByValueVisible) {
                  await optionByValue.click();
                  selectSuccess = true;
                } else if (optionByTextVisible) {
                  await optionByText.click();
                  selectSuccess = true;
                } else if (action.value === "") {
                  // Se value está vazio, seleciona o primeiro item disponível
                  const firstOption = page.locator('[role="option"]:visible, option:visible').first();
                  const firstVisible = await firstOption.isVisible({ timeout: 1000 }).catch(() => false);
                  if (firstVisible) {
                    await firstOption.click();
                    selectSuccess = true;
                  }
                } else {
                  // Tentar encontrar por texto parcial
                  const partialOption = page.locator(`[role="option"]`).filter({ hasText: action.value }).first();
                  const partialVisible = await partialOption.isVisible({ timeout: 1000 }).catch(() => false);
                  if (partialVisible) {
                    await partialOption.click();
                    selectSuccess = true;
                  } else {
                    // Último recurso: primeiro item disponível
                    const firstOption = page.locator('[role="option"]:visible').first();
                    const firstVisible = await firstOption.isVisible({ timeout: 1000 }).catch(() => false);
                    if (firstVisible) {
                      await firstOption.click();
                      selectSuccess = true;
                    }
                  }
                }
              } else {
                // Se não tem valor, seleciona o primeiro item
                const firstOption = page.locator('[role="option"]:visible').first();
                const firstVisible = await firstOption.isVisible({ timeout: 1000 }).catch(() => false);
                if (firstVisible) {
                  await firstOption.click();
                  selectSuccess = true;
                }
              }
              
              if (selectSuccess) {
                await page.waitForTimeout(300);
                if (action.waitAfter) await page.waitForTimeout(action.waitAfter);
                return true;
              }
            }
          } catch (err) {
            // Continua tentando próximo seletor
            continue;
          }
        }
        
        return !action.required;
      
      case "navigate":
        await page.goto(action.value || "/");
        if (action.waitAfter) await page.waitForTimeout(action.waitAfter);
        return true;
      
      default:
        return false;
    }
  } catch (error) {
    console.log(`   ⚠️  Erro ao executar ação: ${action.description} - ${error}`);
    return !action.required; // Se não é obrigatório, continua mesmo com erro
  }
}
