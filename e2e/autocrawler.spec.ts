import { expect, test, type Page } from "@playwright/test";
import { attachGuards, checkErrors, type ErrorCollection } from "./guards";
import { CRITICAL_ROUTES, LOGIN_SELECTORS, MAIN_ROUTES } from "./routes";

/**
 * E3E Autocrawler - Agente automático de testes E2E
 * 
 * Objetivo: Navegar pelas principais rotas do app, clicar em elementos
 * seguros e detectar erros de console/network (especialmente 404 em /api/)
 * 
 * Configuração via variáveis de ambiente:
 * - E2E_BASE_URL: URL base do app
 * - E2E_EMAIL: Email para login
 * - E2E_PASSWORD: Senha para login
 */

// Credenciais de teste (via env ou default)
const TEST_EMAIL = process.env.E2E_EMAIL || "fernandocostaxavier@gmail.com";
const TEST_PASSWORD = process.env.E2E_PASSWORD || "Fcxv020781@";

// Blacklist de textos que indicam ações destrutivas
const DESTRUCTIVE_TEXT_BLACKLIST = [
  "excluir",
  "apagar",
  "delete",
  "remover",
  "cancelar",
  "revogar",
  "logout",
  "sair",
  "remove",
  "destroy",
  "terminate",
];

// Limite de cliques por página
const MAX_CLICKS_PER_PAGE = 25;

// Tempo de espera entre cliques (ms)
const CLICK_DELAY = 200;

let errors: ErrorCollection;

test.describe("E3E Autocrawler", () => {
  test.beforeEach(async ({ page }) => {
    // Anexar guards para capturar erros
    errors = attachGuards(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Verificar erros coletados
    const result = checkErrors(errors);
    
    if (result.hasErrors) {
      console.log(result.summary);
      
      // Anexar summary ao relatório
      await testInfo.attach("error-summary", {
        body: result.summary,
        contentType: "text/plain",
      });
    }
    
    // Falhar o teste se houver erros
    expect(result.hasErrors, result.summary).toBe(false);
  });

  test("Navegar por todas as rotas e detectar erros", async ({ page }) => {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 Iniciando E3E Autocrawler");
    console.log("=".repeat(60));
    console.log(`📍 Base URL: ${page.context().browser()?.version || "N/A"}`);
    console.log(`📧 Email: ${TEST_EMAIL}`);
    console.log(`🔑 Rotas a visitar: ${MAIN_ROUTES.length}`);
    console.log("=".repeat(60) + "\n");

    // 1. Navegar para a página inicial
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    // 2. Verificar se precisa fazer login
    const needsLogin = await checkIfNeedsLogin(page);
    
    if (needsLogin) {
      console.log("🔐 Detectado tela de login. Realizando login automático...");
      await performLogin(page, TEST_EMAIL, TEST_PASSWORD);
      console.log("✅ Login realizado com sucesso!\n");
    }

    // 3. Aguardar dashboard carregar
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 4. Visitar cada rota
    for (const route of MAIN_ROUTES) {
      console.log(`\n📄 Visitando rota: ${route}`);
      
      try {
        // Resetar erros para esta rota (para logging, mas mantém acumulado)
        const routeStartErrors = { ...errors };
        
        // Navegar para a rota
        await page.goto(route, { timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1000);

        // Verificar se caiu em página de erro
        const isErrorPage = await page.locator("text=404").isVisible().catch(() => false) ||
                           await page.locator("text=Not Found").isVisible().catch(() => false);
        
        if (isErrorPage) {
          console.log(`   ⚠️  Página de erro detectada em ${route}`);
          continue;
        }

        // Realizar cliques seguros na página
        const isCritical = CRITICAL_ROUTES.includes(route as any);
        if (isCritical) {
          console.log(`   ⚡ Rota crítica - executando mais interações`);
        }
        
        await safeClickAll(page, isCritical ? MAX_CLICKS_PER_PAGE : 10);
        
        console.log(`   ✅ Rota ${route} visitada com sucesso`);
        
      } catch (error) {
        console.log(`   ❌ Erro ao visitar ${route}: ${error}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🏁 E3E Autocrawler finalizado");
    console.log("=".repeat(60) + "\n");
  });
});

/**
 * Verifica se a página atual é a tela de login
 */
async function checkIfNeedsLogin(page: Page): Promise<boolean> {
  // Verificar se existe campo de email ou senha
  const hasEmailInput = await page.locator(LOGIN_SELECTORS.emailInput).first().isVisible({ timeout: 3000 }).catch(() => false);
  const hasPasswordInput = await page.locator(LOGIN_SELECTORS.passwordInput).first().isVisible({ timeout: 1000 }).catch(() => false);
  
  // Verificar se a URL contém "login"
  const url = page.url();
  const isLoginUrl = url.includes("/login");
  
  return (hasEmailInput && hasPasswordInput) || isLoginUrl;
}

/**
 * Realiza login automático
 */
async function performLogin(page: Page, email: string, password: string): Promise<void> {
  // Se não estiver na página de login, navegar para ela
  if (!page.url().includes("/login")) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }

  // Preencher email
  const emailInput = page.locator(LOGIN_SELECTORS.emailInput).first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);

  // Preencher senha
  const passwordInput = page.locator(LOGIN_SELECTORS.passwordInput).first();
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.fill(password);

  // Clicar no botão de submit
  const submitButton = page.locator(LOGIN_SELECTORS.submitButton).first();
  await submitButton.waitFor({ state: "visible", timeout: 5000 });
  await submitButton.click();

  // Aguardar navegação após login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

/**
 * Realiza cliques seguros em elementos da página
 */
async function safeClickAll(page: Page, maxClicks: number = MAX_CLICKS_PER_PAGE): Promise<void> {
  let clickCount = 0;
  const currentUrl = page.url();
  const currentPath = new URL(currentUrl).pathname;

  // Localizar elementos clicáveis
  const clickableSelectors = [
    // Links internos (não externos)
    'a[href^="/"]:not([href*="logout"]):not([href*="sair"])',
    // Botões habilitados
    'button:not([disabled]):not([data-danger="true"])',
    // Elementos com role button
    '[role="button"]:not([disabled]):not([data-danger="true"])',
    // Tabs
    '[role="tab"]',
    // Elementos de menu
    '[role="menuitem"]',
  ];

  for (const selector of clickableSelectors) {
    if (clickCount >= maxClicks) break;

    const elements = await page.locator(selector).all();
    
    for (const element of elements) {
      if (clickCount >= maxClicks) break;

      try {
        // Verificar se elemento está visível
        const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
        if (!isVisible) continue;

        // Obter texto do elemento
        const text = await element.textContent().catch(() => "") || "";
        const textLower = text.toLowerCase().trim();

        // Verificar blacklist
        const isDestructive = DESTRUCTIVE_TEXT_BLACKLIST.some(word => 
          textLower.includes(word)
        );
        if (isDestructive) {
          continue;
        }

        // Verificar se é um link de logout
        const href = await element.getAttribute("href").catch(() => null);
        if (href && (href.includes("logout") || href.includes("sair"))) {
          continue;
        }

        // Verificar se elemento tem data-danger
        const isDanger = await element.getAttribute("data-danger").catch(() => null);
        if (isDanger === "true") {
          continue;
        }

        // Verificar se elemento tem classe de perigo
        const className = await element.getAttribute("class").catch(() => "") || "";
        if (className.includes("destructive") || className.includes("danger")) {
          continue;
        }

        // Tentar clicar
        await element.click({ timeout: 2000 }).catch(() => {});
        clickCount++;
        
        // Aguardar um pouco
        await page.waitForTimeout(CLICK_DELAY);

        // Tentar fechar modal (pressionar Escape)
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(100);

        // Verificar se ainda está na mesma rota
        const newPath = new URL(page.url()).pathname;
        if (newPath !== currentPath && !newPath.startsWith(currentPath)) {
          // Voltou para outra página, voltar para a rota original
          await page.goto(currentPath).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        }

      } catch {
        // Ignorar erros de clique individual
      }
    }
  }

  // Fechar qualquer modal que possa estar aberto
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);
}
