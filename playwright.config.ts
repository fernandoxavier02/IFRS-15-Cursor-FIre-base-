import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração do Playwright para o agente E2E do IFRS 15 Revenue Manager
 * 
 * Variáveis de ambiente:
 * - E2E_BASE_URL: URL base do app (default: https://ifrs15-revenue-manager.firebaseapp.com)
 * - E2E_EMAIL: Email para login automático
 * - E2E_PASSWORD: Senha para login automático
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "comprehensive-autocrawler.spec.ts", // Usar o agente comprehensivo
  
  // Timeout global para cada teste (10 minutos - tempo suficiente para navegar todas as rotas)
  timeout: 600000,
  
  // Timeout para expect assertions
  expect: {
    timeout: 10000,
  },
  
  // Não rodar em paralelo para melhor visualização
  fullyParallel: false,
  
  // Não permitir test.only em CI
  forbidOnly: !!process.env.CI,
  
  // Retries
  retries: process.env.CI ? 1 : 0,
  
  // Workers
  workers: 1,
  
  // Reporters
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  
  // Configurações globais
  use: {
    // URL base - usar env ou default para Firebase Hosting
    baseURL: process.env.E2E_BASE_URL || "https://ifrs15-revenue-manager.firebaseapp.com",
    
    // Browser visível (não headless)
    headless: false,
    
    // Manter browser aberto após teste (para debug)
    // Isso não é uma opção padrão do Playwright, mas podemos usar launchOptions
    
    // Delay entre ações para melhor visualização
    launchOptions: {
      slowMo: 100, // Reduzido para 100ms para ações mais rápidas
    },
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // Ignorar erros HTTPS
    ignoreHTTPSErrors: true,
    
    // Gravar vídeo sempre
    video: "on",
    
    // Gravar trace sempre
    trace: "on",
    
    // Screenshot em falha
    screenshot: "only-on-failure",
    
    // Timeout de navegação
    navigationTimeout: 30000,
    
    // Timeout de ação
    actionTimeout: 10000,
  },

  // Projetos (browsers)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
