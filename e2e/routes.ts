/**
 * Lista de rotas principais do IFRS 15 Revenue Manager
 * 
 * Baseado em:
 * - client/src/App.tsx (definição de rotas)
 * - client/src/components/app-sidebar.tsx (menu de navegação)
 */

/**
 * Rotas principais que serão visitadas pelo agente
 * Ordenadas por prioridade/risco
 */
export const MAIN_ROUTES = [
  // Overview - Rotas principais
  "/",                          // Dashboard
  "/contracts",                 // Contratos
  "/customers",                 // Clientes
  
  // Revenue Recognition - IFRS 15
  "/ifrs15",                    // IFRS 15 Engine (CRÍTICO - pode chamar /api/)
  "/billing-schedules",         // Billing Schedules
  "/revenue-ledger",            // Revenue Ledger
  "/consolidated-balances",     // Consolidated Balances (CRÍTICO)
  "/revenue-waterfall",         // Revenue Waterfall
  "/contract-costs",            // Contract Costs
  "/exchange-rates",            // Exchange Rates
  "/financing-components",      // Financing Components
  "/executive-dashboard",       // Executive Dashboard
  "/ifrs15-accounting-control", // IFRS 15 Accounting Control
  "/reports",                   // Reports
  
  // AI Ingestion
  "/contract-ingestion",        // Contract Ingestion
  "/ai-settings",               // AI Settings (CRÍTICO)
  
  // Administration
  "/licenses",                  // Licenses
  "/audit",                     // Audit Trail
  "/settings",                  // Settings
] as const;

/**
 * Rotas críticas que têm maior chance de chamar endpoints /api/
 * Devem ser testadas com mais atenção
 */
export const CRITICAL_ROUTES = [
  "/ifrs15",
  "/consolidated-balances",
  "/ai-settings",
  "/contract-ingestion",
] as const;

/**
 * Rotas que requerem dados específicos para funcionar
 * (ex: detalhes de contrato)
 */
export const DATA_DEPENDENT_ROUTES = [
  // "/contracts/:id" - precisa de um ID válido
] as const;

/**
 * Seletores de elementos do menu para navegação
 */
export const MENU_SELECTORS = {
  // Sidebar trigger
  sidebarToggle: '[data-testid="button-sidebar-toggle"]',
  
  // Links de navegação no menu
  navLinks: {
    dashboard: '[data-testid="nav-dashboard"]',
    contracts: '[data-testid="nav-contracts"]',
    customers: '[data-testid="nav-customers"]',
    ifrs15: '[data-testid="nav-ifrs15"]',
    billingSchedules: '[data-testid="nav-billingSchedules"]',
    revenueLedger: '[data-testid="nav-revenueLedger"]',
    consolidatedBalances: '[data-testid="nav-consolidatedBalances"]',
    revenueWaterfall: '[data-testid="nav-revenueWaterfall"]',
    contractCosts: '[data-testid="nav-contractCosts"]',
    exchangeRates: '[data-testid="nav-exchangeRates"]',
    financingComponents: '[data-testid="nav-financingComponents"]',
    executiveDashboard: '[data-testid="nav-executiveDashboard"]',
    ifrs15AccountingControl: '[data-testid="nav-ifrs15AccountingControl"]',
    reports: '[data-testid="nav-reports"]',
    contractIngestion: '[data-testid="nav-contractIngestion"]',
    aiSettings: '[data-testid="nav-aiSettings"]',
    licenses: '[data-testid="nav-licenses"]',
    audit: '[data-testid="nav-audit"]',
    settings: '[data-testid="nav-settings"]',
  },
  
  // Logout
  logout: '[data-testid="button-logout"]',
} as const;

/**
 * Seletores para a página de login
 */
export const LOGIN_SELECTORS = {
  emailInput: 'input[type="email"], [data-testid*="email"], [data-testid="input-login-email"]',
  passwordInput: 'input[type="password"], [data-testid*="password"], [data-testid="input-login-password"]',
  submitButton: 'button[type="submit"], [data-testid*="login"], [data-testid="button-login-submit"]',
} as const;
