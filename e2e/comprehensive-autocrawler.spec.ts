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

import { test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
    ALL_ROUTES,
    ROUTES_BY_PRIORITY,
    generateComprehensiveReport,
    processPageComprehensively,
    type PageReport
} from "./comprehensive-agent";
import { attachGuards, checkErrors, type ErrorCollection } from "./guards";
import { LOGIN_SELECTORS } from "./routes";

let errors: ErrorCollection;
const consoleLogs: string[] = [];
const networkErrors: string[] = [];

test.describe("Comprehensive E2E Agent", () => {
  test.beforeEach(async ({ page }) => {
    // Anexar guards para capturar erros
    errors = attachGuards(page);
    
    // Coletar logs do console
    page.on("console", (msg) => {
      const text = msg.text();
      const type = msg.type();
      if (type === "error") {
        consoleLogs.push(`[CONSOLE ERROR] ${text}`);
      } else if (type === "warning") {
        consoleLogs.push(`[CONSOLE WARNING] ${text}`);
      }
    });
    
    // Coletar erros de rede
    page.on("requestfailed", (request) => {
      const url = request.url();
      const failure = request.failure()?.errorText || "Unknown";
      // Ignorar erros normais do Firestore
      if (!url.includes("firestore.googleapis.com") || !failure.includes("ERR_ABORTED")) {
        networkErrors.push(`[NETWORK ERROR] ${url} - ${failure}`);
      }
    });
    
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 500) {
        networkErrors.push(`[NETWORK ERROR] ${response.url()} - Status ${status}`);
      } else if (status === 404 && (response.url().includes("/api/") || response.url().includes("cloudfunctions.net"))) {
        networkErrors.push(`[API 404] ${response.url()}`);
      }
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Verificar erros coletados
    const result = checkErrors(errors);
    
    if (result.hasErrors) {
      console.log(result.summary);
      
      await testInfo.attach("error-summary", {
        body: result.summary,
        contentType: "text/plain",
      });
    }
  });

  test("Navegar por todas as páginas e executar ações completas", async ({ page }) => {
    const startTime = new Date().toISOString();
    const pageReports: PageReport[] = [];
    
    console.log("\n" + "=".repeat(60));
    console.log("🚀 INICIANDO AGENTE E2E COMPREHENSIVO");
    console.log("=".repeat(60));
    console.log(`📍 Total de rotas: ${ALL_ROUTES.length}`);
    console.log(`🕐 Início: ${startTime}`);
    console.log("=".repeat(60) + "\n");

    // 1. Navegar para a página inicial
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    // 2. Fazer login automático
    const needsLogin = await checkIfNeedsLogin(page);
    
    if (needsLogin) {
      console.log("\n" + "=".repeat(60));
      console.log("🔐 REALIZANDO LOGIN AUTOMÁTICO");
      console.log("=".repeat(60) + "\n");
      
      await performLogin(page);
      
      console.log("\n✅ Login realizado com sucesso!\n");
    }

    // 3. Aguardar dashboard carregar
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 4. Processar TODAS as páginas
    console.log("\n" + "=".repeat(60));
    console.log("📄 INICIANDO PROCESSAMENTO DE PÁGINAS");
    console.log("=".repeat(60) + "\n");
    
    for (let i = 0; i < ALL_ROUTES.length; i++) {
      const route = ALL_ROUTES[i];
      const routeType = getRouteType(route);
      console.log(`\n[${i + 1}/${ALL_ROUTES.length}] Processando: ${route} [${routeType}]`);
      console.log("-".repeat(60));
      
      try {
        const report = await Promise.race([
          processPageComprehensively(page, route, consoleLogs, networkErrors),
          new Promise<PageReport>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout processing ${route}`)), 90000)
          )
        ]).catch((error) => {
          console.log(`   ❌ Erro ao processar ${route}: ${error.message}`);
          return {
            route,
            visited: false,
            buttonsClicked: 0,
            formsFilled: 0,
            formsSaved: 0,
            consoleErrors: [],
            networkErrors: [],
            pageErrors: [error.message],
            success: false,
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          } as PageReport;
        });
        
        pageReports.push(report);
        
        if (report.success) {
          console.log(`✅ Página processada:`);
          console.log(`   - Botões clicados: ${report.buttonsClicked}`);
          console.log(`   - Formulários preenchidos: ${report.formsFilled}`);
          console.log(`   - Formulários salvos: ${report.formsSaved}`);
          console.log(`   - Erros encontrados: ${report.consoleErrors.length + report.networkErrors.length + report.pageErrors.length}`);
        } else {
          console.log(`⚠️  Página processada com erros: ${report.errorMessage || "Erro desconhecido"}`);
        }
        
        // Pausa entre páginas (maior para rotas críticas)
        const pauseTime = routeType === "critical" ? 1000 : 500;
        await page.waitForTimeout(pauseTime);
        
        // Fechar qualquer modal/dialog que possa estar aberto
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(200);
        
      } catch (error: any) {
        console.log(`   ❌ Erro crítico ao processar ${route}: ${error.message}`);
        pageReports.push({
          route,
          visited: false,
          buttonsClicked: 0,
          formsFilled: 0,
          formsSaved: 0,
          consoleErrors: [],
          networkErrors: [],
          pageErrors: [error.message],
          success: false,
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 5. Gerar relatório completo
    console.log("\n" + "=".repeat(60));
    console.log("📊 GERANDO RELATÓRIO COMPLETO");
    console.log("=".repeat(60) + "\n");
    
    const comprehensiveReport = generateComprehensiveReport(pageReports);
    comprehensiveReport.endTime = new Date().toISOString();
    comprehensiveReport.duration = new Date(comprehensiveReport.endTime).getTime() - 
                                   new Date(comprehensiveReport.startTime).getTime();
    
    console.log(comprehensiveReport.summary);
    
    // Salvar relatório em arquivo
    const reportDir = join(process.cwd(), "test-results", "comprehensive-reports");
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const reportFile = join(reportDir, `comprehensive-report-${timestamp}.json`);
    writeFileSync(reportFile, JSON.stringify(comprehensiveReport, null, 2));
    console.log(`\n💾 Relatório salvo em: ${reportFile}`);
    
    // Salvar relatório em texto
    const reportTextFile = join(reportDir, `comprehensive-report-${timestamp}.txt`);
    writeFileSync(reportTextFile, comprehensiveReport.summary);
    console.log(`💾 Relatório em texto salvo em: ${reportTextFile}`);
    
    console.log("\n" + "=".repeat(60));
    console.log("🏁 AGENTE E2E COMPREHENSIVO FINALIZADO");
    console.log("=".repeat(60) + "\n");
    
    // Manter navegador aberto por 10 segundos
    console.log("⏸️  Mantendo navegador aberto por 10 segundos...");
    await page.waitForTimeout(10000);
  });
});

/**
 * Verifica se a página atual é a tela de login
 */
async function checkIfNeedsLogin(page: Page): Promise<boolean> {
  const hasEmailInput = await page.locator(LOGIN_SELECTORS.emailInput).first().isVisible({ timeout: 3000 }).catch(() => false);
  const hasPasswordInput = await page.locator(LOGIN_SELECTORS.passwordInput).first().isVisible({ timeout: 1000 }).catch(() => false);
  const url = page.url();
  const isLoginUrl = url.includes("/login");
  const isLandingPage = !isLoginUrl && !hasEmailInput && !hasPasswordInput;
  
  return (hasEmailInput && hasPasswordInput) || isLoginUrl || isLandingPage;
}

/**
 * Realiza login automático
 */
async function performLogin(page: Page): Promise<void> {
  const email = "fernandocostaxavier@gmail.com";
  const password = "Fcxv020781@";
  
  const url = page.url();
  const isLoginPage = url.includes("/login");
  
  if (!isLoginPage) {
    console.log("   🔹 Procurando botão 'Entrar'...");
    const entrarSelectors = [
      'button:has-text("Entrar")',
      'a:has-text("Entrar")',
      '[data-testid*="login"]',
      'button:has-text("Login")',
    ];
    
    let clicked = false;
    for (const selector of entrarSelectors) {
      try {
        const button = page.locator(selector).first();
        const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          await button.click();
          clicked = true;
          await page.waitForTimeout(1000);
          break;
        }
      } catch (err) {
        continue;
      }
    }
    
    if (!clicked) {
      await page.goto("/login", { timeout: 30000 });
    }
    
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  
  console.log("   🔹 Preenchendo email...");
  const emailInput = page.locator('input[type="email"][data-testid="input-login-email"], input[type="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);
  await page.waitForTimeout(300);
  
  console.log("   🔹 Preenchendo password...");
  const passwordInput = page.locator('input[type="password"][data-testid="input-login-password"], input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 10000 });
  await passwordInput.fill(password);
  await page.waitForTimeout(300);
  
  console.log("   🔹 Clicando em 'Sign in'...");
  const submitButton = page.locator(LOGIN_SELECTORS.submitButton).first();
  await submitButton.waitFor({ state: "visible", timeout: 5000 });
  await submitButton.click();
  
  console.log("   ⏳ Aguardando login completar...");
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  console.log("   ✅ Login realizado!");
}

/**
 * Determina o tipo de rota para aplicar estratégias diferentes
 */
function getRouteType(route: string): "simple" | "forms" | "complex" | "critical" {
  if (ROUTES_BY_PRIORITY.simple.includes(route as any)) return "simple";
  if (ROUTES_BY_PRIORITY.forms.includes(route as any)) return "forms";
  if (ROUTES_BY_PRIORITY.complex.includes(route as any)) return "complex";
  if (ROUTES_BY_PRIORITY.critical.includes(route as any)) return "critical";
  return "simple";
}
