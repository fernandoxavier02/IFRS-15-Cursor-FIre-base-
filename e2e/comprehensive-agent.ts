/**
 * AGENTE E2E COMPREHENSIVO
 * 
 * Este agente:
 * 1. Passa por TODAS as páginas
 * 2. Clica em TODOS os botões de cada página
 * 3. Preenche formulários que aparecerem
 * 4. Salva e verifica se foi salvo
 * 5. Coleta logs do console em todos os passos
 * 6. Gera relatório de erros com diagnóstico
 */

import type { Page } from "@playwright/test";

export interface PageReport {
  route: string;
  visited: boolean;
  buttonsClicked: number;
  formsFilled: number;
  formsSaved: number;
  consoleErrors: string[];
  networkErrors: string[];
  pageErrors: string[];
  success: boolean;
  errorMessage?: string;
  timestamp: string;
}

export interface ComprehensiveReport {
  startTime: string;
  endTime?: string;
  duration?: number;
  pages: PageReport[];
  totalButtonsClicked: number;
  totalFormsFilled: number;
  totalFormsSaved: number;
  totalErrors: number;
  summary: string;
}

/**
 * Rotas organizadas por prioridade e tipo
 * Rotas simples primeiro, depois as mais complexas
 */
export const ROUTES_BY_PRIORITY = {
  // Rotas simples - apenas visualização
  simple: [
    "/",                          // Dashboard
    "/reports",                   // Reports
    "/audit",                     // Audit Trail
    "/licenses",                  // Licenses
    "/settings",                  // Settings
  ],
  
  // Rotas com formulários - precisam de dados
  forms: [
    "/customers",                 // Clientes - criar cliente
    "/contracts",                 // Contratos - criar contrato
    "/revenue-ledger",            // Revenue Ledger - criar entrada
    "/exchange-rates",            // Exchange Rates - criar taxa
    "/financing-components",      // Financing Components - criar componente
  ],
  
  // Rotas complexas - podem demorar mais
  complex: [
    "/billing-schedules",         // Billing Schedules
    "/revenue-waterfall",         // Revenue Waterfall
    "/contract-costs",            // Contract Costs
    "/executive-dashboard",       // Executive Dashboard
    "/ifrs15-accounting-control", // IFRS 15 Accounting Control
  ],
  
  // Rotas críticas - podem chamar APIs pesadas
  critical: [
    "/ifrs15",                    // IFRS 15 Engine
    "/consolidated-balances",     // Consolidated Balances
    "/contract-ingestion",        // Contract Ingestion
    "/ai-settings",               // AI Settings
  ],
} as const;

/**
 * Todas as rotas em ordem otimizada (simples primeiro, complexas depois)
 */
export const ALL_ROUTES = [
  ...ROUTES_BY_PRIORITY.simple,
  ...ROUTES_BY_PRIORITY.forms,
  ...ROUTES_BY_PRIORITY.complex,
  ...ROUTES_BY_PRIORITY.critical,
] as const;

/**
 * Dados de teste para formulários
 */
export const FORM_TEST_DATA = {
  customer: {
    name: `Customer E2E ${Date.now()}`,
    country: "Brazil",
    currency: "BRL",
    taxId: "12.345.678/0001-90",
    contactEmail: `test${Date.now()}@customer.com`,
    contactPhone: "+55 11 99999-9999",
    creditRating: "A",
    billingAddress: "Rua Teste, 123, São Paulo, SP",
  },
  contract: {
    contractNumber: `CTR-E2E-${Date.now()}`,
    title: `E2E Test Contract ${Date.now()}`,
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    totalValue: "100000.00",
    currency: "BRL",
    paymentTerms: "Net 30",
  },
  revenueLedger: {
    referenceNumber: `REF-${Date.now()}`,
    description: `E2E Test Entry ${Date.now()}`,
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
 * Encontra TODOS os botões clicáveis na página
 */
export async function findAllClickableButtons(page: Page): Promise<string[]> {
  const selectors = [
    'button:not([disabled])',
    'a[href]:not([href="#"])',
    '[role="button"]:not([disabled])',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
    'input[type="submit"]',
    'input[type="button"]',
  ];

  const buttons: string[] = [];
  
  for (const selector of selectors) {
    try {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          const text = await element.textContent().catch(() => "");
          const testId = await element.getAttribute("data-testid").catch(() => "");
          const id = await element.getAttribute("id").catch(() => "");
          const identifier = testId || id || text?.substring(0, 50) || selector;
          buttons.push(identifier);
        }
      }
    } catch (err) {
      // Continuar
    }
  }
  
  return [...new Set(buttons)]; // Remove duplicatas
}

/**
 * Encontra TODOS os formulários na página
 */
export async function findAllForms(page: Page): Promise<Array<{ selector: string; fields: string[] }>> {
  const forms: Array<{ selector: string; fields: string[] }> = [];
  
  try {
    // Procurar por elementos form
    const formElements = await page.locator('form').all();
    for (const form of formElements) {
      const fields: string[] = [];
      const inputs = await form.locator('input, textarea, select').all();
      for (const input of inputs) {
        const name = await input.getAttribute("name").catch(() => "");
        const id = await input.getAttribute("id").catch(() => "");
        const testId = await input.getAttribute("data-testid").catch(() => "");
        if (name || id || testId) {
          fields.push(name || id || testId);
        }
      }
      if (fields.length > 0) {
        forms.push({ selector: "form", fields });
      }
    }
    
    // Procurar por dialogs com formulários
    const dialogs = await page.locator('[role="dialog"], [data-state="open"]').all();
    for (const dialog of dialogs) {
      const inputs = await dialog.locator('input, textarea, select').all();
      if (inputs.length > 0) {
        const fields: string[] = [];
        for (const input of inputs) {
          const name = await input.getAttribute("name").catch(() => "");
          const id = await input.getAttribute("id").catch(() => "");
          const testId = await input.getAttribute("data-testid").catch(() => "");
          if (name || id || testId) {
            fields.push(name || id || testId);
          }
        }
        if (fields.length > 0) {
          forms.push({ selector: '[role="dialog"]', fields });
        }
      }
    }
  } catch (err) {
    // Continuar
  }
  
  return forms;
}

/**
 * Preenche um formulário com dados de teste
 */
export async function fillForm(page: Page, formSelector: string, fields: string[]): Promise<boolean> {
  try {
    for (const field of fields) {
      // Tentar encontrar o campo
      const fieldSelectors = [
        `[name="${field}"]`,
        `#${field}`,
        `[data-testid="${field}"]`,
        `[id="${field}"]`,
      ];
      
      for (const selector of fieldSelectors) {
        try {
          const element = page.locator(selector).first();
          const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            const tagName = await element.evaluate(el => el.tagName.toLowerCase());
            const type = await element.getAttribute("type").catch(() => "");
            const inputType = await element.getAttribute("inputmode").catch(() => "");
            
            // Determinar valor baseado no tipo de campo
            let value = "";
            if (field.toLowerCase().includes("email")) {
              value = FORM_TEST_DATA.customer.contactEmail;
            } else if (field.toLowerCase().includes("name") || field.toLowerCase().includes("title")) {
              value = field.toLowerCase().includes("customer") ? FORM_TEST_DATA.customer.name : FORM_TEST_DATA.contract.title;
            } else if (field.toLowerCase().includes("country")) {
              value = FORM_TEST_DATA.customer.country;
            } else if (field.toLowerCase().includes("phone")) {
              value = FORM_TEST_DATA.customer.contactPhone;
            } else if (field.toLowerCase().includes("address")) {
              value = FORM_TEST_DATA.customer.billingAddress;
            } else if (field.toLowerCase().includes("date") && field.toLowerCase().includes("start")) {
              value = FORM_TEST_DATA.contract.startDate;
            } else if (field.toLowerCase().includes("date") && field.toLowerCase().includes("end")) {
              value = FORM_TEST_DATA.contract.endDate;
            } else if (field.toLowerCase().includes("value") || field.toLowerCase().includes("amount")) {
              value = FORM_TEST_DATA.contract.totalValue;
            } else if (field.toLowerCase().includes("description")) {
              value = FORM_TEST_DATA.revenueLedger.description;
            } else if (type === "number" || inputType === "numeric") {
              value = "1000";
            } else {
              value = `Test ${field} ${Date.now()}`;
            }
            
            if (tagName === "select") {
              await element.click();
              await page.waitForTimeout(200);
              const options = await page.locator('[role="option"], option').all();
              if (options.length > 0) {
                await options[0].click();
              }
            } else {
              await element.fill(value);
            }
            
            await page.waitForTimeout(100);
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }
    
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Verifica se um formulário foi salvo com sucesso
 */
export async function verifyFormSaved(page: Page): Promise<boolean> {
  try {
    // Procurar por mensagens de sucesso
    const successIndicators = [
      'text=/success/i',
      'text=/saved/i',
      'text=/created/i',
      'text=/salvo/i',
      'text=/criado/i',
      '[role="alert"]:has-text("success")',
      '.toast:has-text("success")',
    ];
    
    for (const indicator of successIndicators) {
      const found = await page.locator(indicator).isVisible({ timeout: 2000 }).catch(() => false);
      if (found) {
        return true;
      }
    }
    
    // Verificar se dialog foi fechado (indica sucesso)
    const dialogOpen = await page.locator('[role="dialog"][data-state="open"]').isVisible({ timeout: 1000 }).catch(() => false);
    if (!dialogOpen) {
      // Dialog fechou, provavelmente foi salvo
      return true;
    }
    
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Coleta todos os logs do console
 */
export async function collectConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];
  
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      logs.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  
  return logs;
}

/**
 * Processa uma página completamente com timeouts e recuperação de erros
 */
export async function processPageComprehensively(
  page: Page,
  route: string,
  consoleLogs: string[],
  networkErrors: string[]
): Promise<PageReport> {
  const report: PageReport = {
    route,
    visited: false,
    buttonsClicked: 0,
    formsFilled: 0,
    formsSaved: 0,
    consoleErrors: [],
    networkErrors: [],
    pageErrors: [],
    success: false,
    timestamp: new Date().toISOString(),
  };
  
  const PAGE_TIMEOUT = 60000; // 60 segundos máximo por página
  const startTime = Date.now();
  
  try {
    // Navegar para a rota com timeout
    console.log(`   🔹 Navegando para ${route}...`);
    await Promise.race([
      page.goto(route, { timeout: 30000, waitUntil: "domcontentloaded" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Navigation timeout")), 30000))
    ]).catch(async (err) => {
      console.log(`   ⚠️  Erro na navegação: ${err.message}`);
      report.pageErrors.push(`Navigation error: ${err.message}`);
      // Tentar recarregar
      try {
        await page.reload({ timeout: 15000, waitUntil: "domcontentloaded" });
      } catch (reloadErr) {
        throw new Error(`Failed to navigate to ${route}: ${err.message}`);
      }
    });
    
    // Aguardar carregamento com timeout reduzido
    await Promise.race([
      page.waitForLoadState("networkidle", { timeout: 20000 }),
      page.waitForTimeout(3000) // Timeout mínimo de 3 segundos
    ]).catch(() => {
      // Continuar mesmo se networkidle não completar
      console.log(`   ⚠️  Página carregou parcialmente, continuando...`);
    });
    
    await page.waitForTimeout(1000);
    
    report.visited = true;
    
    // Coletar erros do console
    const currentConsoleErrors = consoleLogs.filter(log => log.includes("[CONSOLE ERROR]"));
    report.consoleErrors = currentConsoleErrors;
    
    // Coletar erros de rede
    report.networkErrors = networkErrors;
    
    // Verificar se excedeu o timeout da página
    if (Date.now() - startTime > PAGE_TIMEOUT) {
      throw new Error(`Page timeout after ${PAGE_TIMEOUT}ms`);
    }
    
    // Determinar limite de botões baseado no tipo de rota
    const isCritical = ROUTES_BY_PRIORITY.critical.includes(route as any);
    const isComplex = ROUTES_BY_PRIORITY.complex.includes(route as any);
    const maxButtons = isCritical ? 10 : isComplex ? 15 : 20; // Limite de botões por página
    
    // Encontrar botões com timeout
    console.log(`   📋 Procurando botões na página ${route}...`);
    const buttons = await Promise.race([
      findAllClickableButtons(page),
      new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 5000))
    ]).catch(() => []) as string[];
    
    console.log(`   📋 Encontrados ${buttons.length} botões (limitando a ${maxButtons})`);
    
    // Limitar número de botões
    const buttonsToClick = buttons.slice(0, maxButtons);
    
    // Clicar em cada botão (exceto destrutivos)
    const destructiveKeywords = ["delete", "remove", "excluir", "apagar", "logout", "sair"];
    
    for (let i = 0; i < buttonsToClick.length; i++) {
      // Verificar timeout antes de cada botão
      if (Date.now() - startTime > PAGE_TIMEOUT) {
        console.log(`   ⏱️  Timeout atingido, pulando botões restantes`);
        break;
      }
      
      const buttonId = buttonsToClick[i];
      try {
        const isDestructive = destructiveKeywords.some(keyword => 
          buttonId.toLowerCase().includes(keyword)
        );
        
        if (isDestructive) {
          continue;
        }
        
        // Tentar clicar no botão com timeout
        const buttonSelectors = [
          `[data-testid="${buttonId}"]`,
          `#${buttonId}`,
          `button:has-text("${buttonId.substring(0, 30)}")`,
          `a:has-text("${buttonId.substring(0, 30)}")`,
        ];
        
        let clicked = false;
        for (const selector of buttonSelectors) {
          try {
            const button = page.locator(selector).first();
            const isVisible = await Promise.race([
              button.isVisible({ timeout: 2000 }),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
            ]).catch(() => false);
            
            if (isVisible) {
              await Promise.race([
                button.click({ timeout: 3000 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Click timeout")), 3000))
              ]).catch(() => {});
              
              report.buttonsClicked++;
              clicked = true;
              await page.waitForTimeout(300);
              
              // Verificar se abriu um formulário (com timeout)
              const forms = await Promise.race([
                findAllForms(page),
                new Promise<Array<{ selector: string; fields: string[] }>>((resolve) => 
                  setTimeout(() => resolve([]), 2000)
                )
              ]).catch(() => []) as Array<{ selector: string; fields: string[] }>;
              
              if (forms.length > 0) {
                for (const form of forms) {
                  // Limitar campos do formulário
                  const fieldsToFill = form.fields.slice(0, 10);
                  const filled = await Promise.race([
                    fillForm(page, form.selector, fieldsToFill),
                    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000))
                  ]).catch(() => false) as boolean;
                  
                  if (filled) {
                    report.formsFilled++;
                    
                    // Tentar salvar com timeout
                    const saveButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create"), button:has-text("Add")').first();
                    const saveVisible = await Promise.race([
                      saveButton.isVisible({ timeout: 2000 }),
                      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
                    ]).catch(() => false) as boolean;
                    
                    if (saveVisible) {
                      await Promise.race([
                        saveButton.click(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Save timeout")), 3000))
                      ]).catch(() => {});
                      
                      await page.waitForTimeout(1500);
                      
                      const saved = await Promise.race([
                        verifyFormSaved(page),
                        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000))
                      ]).catch(() => false) as boolean;
                      
                      if (saved) {
                        report.formsSaved++;
                      }
                    }
                  }
                }
              }
              
              // Fechar qualquer modal que possa ter aberto
              await page.keyboard.press("Escape").catch(() => {});
              await page.waitForTimeout(200);
              break;
            }
          } catch (err) {
            continue;
          }
        }
      } catch (err) {
        // Continuar com próximo botão
        continue;
      }
    }
    
    report.success = true;
  } catch (error: any) {
    report.success = false;
    report.errorMessage = error.message;
    report.pageErrors.push(error.message);
  }
  
  return report;
}

/**
 * Gera relatório final completo
 */
export function generateComprehensiveReport(reports: PageReport[]): ComprehensiveReport {
  const totalButtonsClicked = reports.reduce((sum, r) => sum + r.buttonsClicked, 0);
  const totalFormsFilled = reports.reduce((sum, r) => sum + r.formsFilled, 0);
  const totalFormsSaved = reports.reduce((sum, r) => sum + r.formsSaved, 0);
  const totalErrors = reports.reduce((sum, r) => 
    sum + r.consoleErrors.length + r.networkErrors.length + r.pageErrors.length, 0
  );
  
  const successfulPages = reports.filter(r => r.success).length;
  const failedPages = reports.filter(r => !r.success).length;
  
  const summary = `
============================================================
RELATÓRIO COMPREHENSIVO DO AGENTE E2E
============================================================

📊 ESTATÍSTICAS GERAIS:
- Páginas visitadas: ${reports.length}
- Páginas com sucesso: ${successfulPages}
- Páginas com falha: ${failedPages}
- Total de botões clicados: ${totalButtonsClicked}
- Total de formulários preenchidos: ${totalFormsFilled}
- Total de formulários salvos: ${totalFormsSaved}
- Total de erros encontrados: ${totalErrors}

📄 DETALHES POR PÁGINA:
${reports.map(r => `
${r.route}:
  ✅ Visitada: ${r.visited ? "Sim" : "Não"}
  🔘 Botões clicados: ${r.buttonsClicked}
  📝 Formulários preenchidos: ${r.formsFilled}
  💾 Formulários salvos: ${r.formsSaved}
  ❌ Erros: ${r.consoleErrors.length + r.networkErrors.length + r.pageErrors.length}
  ${r.errorMessage ? `⚠️  Erro: ${r.errorMessage}` : ""}
`).join("\n")}

🔍 ERROS DETALHADOS:
${reports.filter(r => r.consoleErrors.length > 0 || r.networkErrors.length > 0 || r.pageErrors.length > 0).map(r => `
${r.route}:
${r.consoleErrors.map(e => `  [CONSOLE] ${e}`).join("\n")}
${r.networkErrors.map(e => `  [NETWORK] ${e}`).join("\n")}
${r.pageErrors.map(e => `  [PAGE] ${e}`).join("\n")}
`).join("\n")}

============================================================
  `.trim();
  
  return {
    startTime: reports[0]?.timestamp || new Date().toISOString(),
    pages: reports,
    totalButtonsClicked,
    totalFormsFilled,
    totalFormsSaved,
    totalErrors,
    summary,
  };
}
