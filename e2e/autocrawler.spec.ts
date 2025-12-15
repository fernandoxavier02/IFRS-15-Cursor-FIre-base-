import { test, type Page } from "@playwright/test";
import { ROUTE_MAPPING, executeAction } from "./agent-mapping";
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

// Credenciais de teste (não usadas - login é manual)
// Mantidas para referência caso precise no futuro
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
const CLICK_DELAY = 500; // 0.5 segundos para ações rápidas

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
    
    // Não falhar o teste imediatamente - apenas reportar erros
    // Isso permite que o agente continue mesmo com alguns erros
    if (result.hasErrors) {
      console.log("\n⚠️  Erros detectados, mas continuando...");
    }
  });

  test("Navegar por todas as rotas e detectar erros", async ({ page }) => {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 Iniciando E3E Autocrawler");
    console.log("=".repeat(60));
    console.log(`📍 Base URL: ${page.context().browser()?.version || "N/A"}`);
    console.log(`🔑 Rotas a visitar: ${MAIN_ROUTES.length}`);
    console.log("=".repeat(60) + "\n");

    // 1. Navegar para a página inicial
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    // 2. Verificar se precisa fazer login e fazer automaticamente
    const needsLogin = await checkIfNeedsLogin(page);
    
    if (needsLogin) {
      console.log("\n" + "=".repeat(60));
      console.log("🔐 REALIZANDO LOGIN AUTOMÁTICO");
      console.log("=".repeat(60));
      console.log("👤 Fazendo login automaticamente...");
      console.log("=".repeat(60) + "\n");
      
      await performLogin(page);
      
      console.log("\n✅ Login realizado com sucesso! Continuando navegação automática...\n");
    }

    // 3. Aguardar dashboard carregar
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 4. Visitar cada rota seguindo o mapeamento completo
    for (const routeMapping of ROUTE_MAPPING) {
      const route = routeMapping.route;
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📄 Visitando rota: ${route}`);
      console.log(`📝 ${routeMapping.description}`);
      console.log(`🎯 Prioridade: ${routeMapping.priority.toUpperCase()}`);
      console.log(`📋 Ações planejadas: ${routeMapping.actions.length}`);
      console.log("=".repeat(60));
      
      try {
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

        // Executar ações mapeadas para esta rota
        let successCount = 0;
        let failCount = 0;
        
        for (const action of routeMapping.actions) {
          console.log(`   🔹 ${action.description}...`);
          const success = await executeAction(page, action);
          if (success) {
            successCount++;
          } else {
            failCount++;
            if (action.required) {
              console.log(`   ⚠️  Ação obrigatória falhou: ${action.description}`);
            }
          }
          // Pausa entre ações para visualização
          await page.waitForTimeout(CLICK_DELAY);
        }

        // Após executar ações mapeadas, fazer cliques adicionais em botões/interações
        const isCritical = CRITICAL_ROUTES.includes(route as any);
        if (isCritical) {
          console.log(`   ⚡ Rota crítica - executando interações adicionais`);
          await safeClickAll(page, 5); // Cliques adicionais limitados
        }
        
        console.log(`   ✅ Rota ${route} processada: ${successCount} ações bem-sucedidas, ${failCount} falhas`);
        
      } catch (error) {
        console.log(`   ❌ Erro ao processar ${route}: ${error}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🏁 E3E Autocrawler finalizado");
    console.log("=".repeat(60) + "\n");
    
    // Manter navegador aberto por 5 segundos para visualização
    console.log("⏸️  Mantendo navegador aberto por 5 segundos...");
    await page.waitForTimeout(5000);
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
  
  // Verificar se está na landing page (precisa clicar em "Entrar")
  const isLandingPage = !isLoginUrl && !hasEmailInput && !hasPasswordInput;
  
  return (hasEmailInput && hasPasswordInput) || isLoginUrl || isLandingPage;
}

/**
 * Realiza login automático seguindo os passos:
 * 1. Clicar em "Entrar" (se estiver na landing page)
 * 2. Preencher email: fernandocostaxavier@gmail.com
 * 3. Preencher password: Fcxv020781@
 * 4. Clicar em "Sign in"
 */
async function performLogin(page: Page): Promise<void> {
  const email = "fernandocostaxavier@gmail.com";
  const password = "Fcxv020781@";
  
  // Passo 1: Verificar se está na landing page e clicar em "Entrar"
  const url = page.url();
  const isLoginPage = url.includes("/login");
  
  if (!isLoginPage) {
    console.log("   🔹 Procurando botão 'Entrar' na landing page...");
    // Tentar vários seletores para o botão "Entrar"
    const entrarSelectors = [
      'button:has-text("Entrar")',
      'a:has-text("Entrar")',
      '[data-testid*="login"]',
      '[data-testid*="entrar"]',
      'button:has-text("Login")',
      'a:has-text("Login")',
    ];
    
    let clicked = false;
    for (const selector of entrarSelectors) {
      try {
        const button = page.locator(selector).first();
        const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          await button.click();
          console.log(`   ✅ Clicou em 'Entrar' usando seletor: ${selector}`);
          clicked = true;
          await page.waitForTimeout(1000);
          break;
        }
      } catch (err) {
        continue;
      }
    }
    
    if (!clicked) {
      // Se não encontrou, tentar navegar diretamente para /login
      console.log("   🔹 Navegando diretamente para /login...");
      await page.goto("/login", { timeout: 30000 });
    }
    
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  
  // Passo 2: Preencher email
  console.log("   🔹 Preenchendo email...");
  // Usar seletor mais específico
  const emailInput = page.locator('input[type="email"][data-testid="input-login-email"], input[type="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);
  await page.waitForTimeout(300);
  
  // Passo 3: Preencher password
  console.log("   🔹 Preenchendo password...");
  // Usar seletor mais específico para evitar pegar o botão "Forgot password"
  const passwordInput = page.locator('input[type="password"][data-testid="input-login-password"], input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 10000 });
  await passwordInput.fill(password);
  await page.waitForTimeout(300);
  
  // Passo 4: Clicar em "Sign in"
  console.log("   🔹 Clicando em 'Sign in'...");
  const submitButton = page.locator(LOGIN_SELECTORS.submitButton).first();
  await submitButton.waitFor({ state: "visible", timeout: 5000 });
  await submitButton.click();
  
  // Aguardar navegação após login
  console.log("   ⏳ Aguardando login completar...");
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  console.log("   ✅ Login realizado com sucesso!");
}

/**
 * Aguarda login manual do usuário
 * Verifica periodicamente se o usuário fez login (não está mais na tela de login)
 * NÃO tenta fazer login automaticamente - apenas aguarda passivamente
 */
async function waitForManualLogin(page: Page): Promise<void> {
  const maxWaitTime = 600000; // 10 minutos máximo de espera (tempo suficiente)
  const checkInterval = 500; // Verificar a cada 0.5 segundos (mais rápido)
  const startTime = Date.now();
  let checkCount = 0;

  console.log("⏳ Aguardando login manual... (verificando a cada 0.5 segundos)");

  while (Date.now() - startTime < maxWaitTime) {
    checkCount++;
    
    // Verificar se ainda está na tela de login
    const stillNeedsLogin = await checkIfNeedsLogin(page).catch(() => true);
    
    if (!stillNeedsLogin) {
      // Login detectado! Aguardar um pouco para garantir que a página carregou
      console.log(`✅ Login detectado após ${checkCount} verificações!`);
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      return;
    }

    // Mostrar progresso a cada 20 verificações (10 segundos)
    if (checkCount % 20 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`⏳ Ainda aguardando login... (${elapsed}s decorridos)`);
    }

    // Aguardar antes de verificar novamente
    await page.waitForTimeout(checkInterval);
  }

  throw new Error("Timeout: Login manual não foi detectado dentro do tempo limite (10 minutos)");
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
