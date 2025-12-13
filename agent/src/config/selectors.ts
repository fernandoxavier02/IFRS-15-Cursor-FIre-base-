/**
 * Centralized selectors for all UI elements in the IFRS 15 application.
 * Uses data-testid attributes where available, falls back to CSS selectors.
 */

export const SELECTORS = {
  // ==================== LOGIN PAGE ====================
  login: {
    email: '[data-testid="input-login-email"]',
    password: '[data-testid="input-login-password"]',
    submit: '[data-testid="button-login-submit"]',
    forgotPassword: '[data-testid="button-forgot-password"]',
    togglePassword: '[data-testid="button-toggle-password"]',
    subscribeLink: '[data-testid="link-subscribe"]',
    errorMessage: '[role="alert"]',
  },

  // ==================== CHANGE PASSWORD PAGE ====================
  changePassword: {
    currentPassword: 'input[name="currentPassword"]',
    newPassword: 'input[name="newPassword"]',
    confirmPassword: 'input[name="confirmPassword"]',
    submit: 'button[type="submit"]',
  },

  // ==================== ACTIVATE LICENSE PAGE ====================
  activateLicense: {
    licenseKey: 'input[name="licenseKey"]',
    submit: 'button[type="submit"]',
  },

  // ==================== LAYOUT / NAVIGATION ====================
  layout: {
    sidebarToggle: '[data-testid="button-sidebar-toggle"]',
    sidebar: '[data-sidebar]',
    mainContent: 'main',
    header: 'header',
    languageSelector: 'button:has-text("Select language")',
    themeToggle: 'button:has-text("Toggle theme")',
  },

  // ==================== SIDEBAR NAVIGATION ====================
  sidebar: {
    dashboard: 'a[href="/"]',
    contracts: 'a[href="/contracts"]',
    customers: 'a[href="/customers"]',
    ifrs15Engine: 'a[href="/ifrs15"]',
    billingSchedules: 'a[href="/billing-schedules"]',
    revenueLedger: 'a[href="/revenue-ledger"]',
    consolidatedBalances: 'a[href="/consolidated-balances"]',
    revenueWaterfall: 'a[href="/revenue-waterfall"]',
    contractCosts: 'a[href="/contract-costs"]',
    exchangeRates: 'a[href="/exchange-rates"]',
    financingComponents: 'a[href="/financing-components"]',
    executiveDashboard: 'a[href="/executive-dashboard"]',
    accountingControl: 'a[href="/ifrs15-accounting-control"]',
    reports: 'a[href="/reports"]',
    contractIngestion: 'a[href="/contract-ingestion"]',
    aiSettings: 'a[href="/ai-settings"]',
    licenses: 'a[href="/licenses"]',
    auditTrail: 'a[href="/audit"]',
    settings: 'a[href="/settings"]',
    adminLicenses: 'a[href="/admin/licenses"]',
  },

  // ==================== DASHBOARD PAGE ====================
  dashboard: {
    totalContractsCard: '[data-testid="metric-total-contracts"]',
    totalRevenueCard: '[data-testid="metric-total-revenue"]',
    recognizedRevenueCard: '[data-testid="metric-recognized-revenue"]',
    deferredRevenueCard: '[data-testid="metric-deferred-revenue"]',
    revenueTrendChart: '[data-testid="chart-revenue-trend"]',
    licenseUsageCard: '[data-testid="card-license-usage"]',
    recentContractsList: '[data-testid="list-recent-contracts"]',
    complianceAlerts: '[data-testid="card-compliance-alerts"]',
  },

  // ==================== CONTRACTS PAGE ====================
  contracts: {
    newButton: '[data-testid="button-new-contract"]',
    searchInput: '[data-testid="input-search-contracts"]',
    statusFilter: '[data-testid="select-status-filter"]',
    table: 'table',
    tableRow: (id: string) => `[data-testid="contract-row-${id}"]`,
    
    // Create Contract Dialog
    dialog: {
      customer: '[data-testid="select-customer"]',
      contractNumber: '[data-testid="input-contract-number"]',
      title: '[data-testid="input-title"]',
      startDate: '[data-testid="input-start-date"]',
      endDate: '[data-testid="input-end-date"]',
      totalValue: '[data-testid="input-total-value"]',
      currency: '[data-testid="select-currency"]',
      paymentTerms: '[data-testid="input-payment-terms"]',
      submitButton: '[data-testid="button-submit-contract"]',
      cancelButton: 'button:has-text("Cancel")',
    },
  },

  // ==================== CONTRACT DETAILS PAGE ====================
  contractDetails: {
    backButton: 'button:has-text("Back")',
    title: 'h1',
    statusBadge: '[data-testid="badge-contract-status"]',
    
    // Tabs
    tabs: {
      overview: '[data-testid="tab-overview"]',
      obligations: '[data-testid="tab-obligations"]',
      billing: '[data-testid="tab-billing"]',
      ledger: '[data-testid="tab-ledger"]',
    },
    
    // Performance Obligations
    obligations: {
      newButton: 'button:has-text("Add Obligation")',
      table: '[data-testid="table-obligations"]',
      dialog: {
        description: 'input[name="description"]',
        allocatedPrice: 'input[name="allocatedPrice"]',
        recognitionMethod: 'select[name="recognitionMethod"]',
        measurementMethod: 'select[name="measurementMethod"]',
        percentComplete: 'input[name="percentComplete"]',
        submit: 'button[type="submit"]',
      },
    },
  },

  // ==================== CUSTOMERS PAGE ====================
  customers: {
    newButton: '[data-testid="button-new-customer"]',
    searchInput: '[data-testid="input-search-customers"]',
    table: 'table',
    tableRow: (id: string) => `[data-testid="customer-row-${id}"]`,
    
    // Create Customer Dialog
    dialog: {
      name: '[data-testid="input-customer-name"]',
      country: '[data-testid="input-country"]',
      currency: '[data-testid="select-currency"]',
      taxId: '[data-testid="input-tax-id"]',
      email: '[data-testid="input-email"]',
      phone: '[data-testid="input-phone"]',
      creditRating: '[data-testid="select-credit-rating"]',
      billingAddress: '[data-testid="input-billing-address"]',
      submitButton: '[data-testid="button-submit-customer"]',
      cancelButton: 'button:has-text("Cancel")',
    },
  },

  // ==================== IFRS 15 ENGINE PAGE ====================
  ifrs15: {
    contractSelect: 'select, [role="combobox"]',
    runEngineButton: 'button:has-text("Run")',
    refreshButton: 'button:has-text("Refresh")',
    
    // Steps
    steps: {
      step1: '[data-testid="step-1"]',
      step2: '[data-testid="step-2"]',
      step3: '[data-testid="step-3"]',
      step4: '[data-testid="step-4"]',
      step5: '[data-testid="step-5"]',
    },
    
    // Obligations table
    obligationsTable: 'table',
  },

  // ==================== BILLING SCHEDULES PAGE ====================
  billingSchedules: {
    newButton: 'button:has-text("New")',
    searchInput: 'input[placeholder*="Search"]',
    statusFilter: 'select',
    table: 'table',
    
    dialog: {
      contract: 'select[name="contractId"]',
      billingDate: 'input[name="billingDate"]',
      dueDate: 'input[name="dueDate"]',
      amount: 'input[name="amount"]',
      currency: 'select[name="currency"]',
      frequency: 'select[name="frequency"]',
      submit: 'button[type="submit"]',
    },
  },

  // ==================== REVENUE LEDGER PAGE ====================
  revenueLedger: {
    searchInput: 'input[placeholder*="Search"]',
    dateFilter: 'input[type="date"]',
    typeFilter: 'select',
    table: 'table',
    exportButton: 'button:has-text("Export")',
  },

  // ==================== EXCHANGE RATES PAGE ====================
  exchangeRates: {
    newButton: 'button:has-text("New")',
    table: 'table',
    
    dialog: {
      fromCurrency: 'input[name="fromCurrency"]',
      toCurrency: 'input[name="toCurrency"]',
      rate: 'input[name="rate"]',
      effectiveDate: 'input[name="effectiveDate"]',
      source: 'input[name="source"]',
      submit: 'button[type="submit"]',
    },
  },

  // ==================== AI SETTINGS PAGE ====================
  aiSettings: {
    newProviderButton: 'button:has-text("Add Provider")',
    providersList: '[data-testid="providers-list"]',
    
    dialog: {
      provider: 'select[name="provider"]',
      name: 'input[name="name"]',
      apiKey: 'input[name="apiKey"]',
      model: 'select[name="model"]',
      isDefault: 'input[name="isDefault"]',
      submit: 'button[type="submit"]',
    },
  },

  // ==================== CONTRACT INGESTION PAGE ====================
  contractIngestion: {
    uploadArea: '[data-testid="upload-area"]',
    fileInput: 'input[type="file"]',
    processingStatus: '[data-testid="processing-status"]',
    reviewButton: 'button:has-text("Review")',
    approveButton: 'button:has-text("Approve")',
    rejectButton: 'button:has-text("Reject")',
  },

  // ==================== AUDIT TRAIL PAGE ====================
  audit: {
    searchInput: 'input[placeholder*="Search"]',
    entityFilter: 'select[name="entityType"]',
    actionFilter: 'select[name="action"]',
    dateFromFilter: 'input[name="dateFrom"]',
    dateToFilter: 'input[name="dateTo"]',
    table: 'table',
    exportButton: 'button:has-text("Export")',
  },

  // ==================== LICENSES PAGE ====================
  licenses: {
    table: 'table',
    activateButton: 'button:has-text("Activate")',
    revokeButton: 'button:has-text("Revoke")',
  },

  // ==================== SETTINGS PAGE ====================
  settings: {
    companyName: 'input[name="companyName"]',
    country: 'input[name="country"]',
    currency: 'select[name="currency"]',
    taxId: 'input[name="taxId"]',
    saveButton: 'button:has-text("Save")',
  },

  // ==================== COMMON ELEMENTS ====================
  common: {
    dialog: '[role="dialog"]',
    dialogClose: '[role="dialog"] button[aria-label="Close"]',
    toast: '[role="status"]',
    toastTitle: '[role="status"] [data-title]',
    toastDescription: '[role="status"] [data-description]',
    loadingSpinner: '.animate-spin',
    skeleton: '[data-testid="skeleton"]',
    emptyState: '[data-testid="empty-state"]',
    errorMessage: '[role="alert"]',
    confirmDialog: '[role="alertdialog"]',
    confirmButton: '[role="alertdialog"] button:has-text("Confirm")',
    cancelButton: '[role="alertdialog"] button:has-text("Cancel")',
  },

  // ==================== PUBLIC PAGES ====================
  landing: {
    heroTitle: 'h1',
    ctaButton: 'button:has-text("Get Started")',
    featuresSection: '[data-testid="features"]',
    pricingSection: '[data-testid="pricing"]',
  },

  showcase: {
    loginButton: 'button:has-text("Entrar")',
    subscribeButton: 'button:has-text("Assinar")',
    pricingCards: '[data-testid="pricing-cards"]',
  },

  subscribe: {
    emailInput: 'input[type="email"]',
    planSelect: 'select[name="plan"]',
    submitButton: 'button[type="submit"]',
  },
} as const;

// Helper function to get selector by path
export function getSelector(path: string): string {
  const parts = path.split('.');
  let current: unknown = SELECTORS;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      throw new Error(`Selector not found: ${path}`);
    }
  }
  
  if (typeof current !== 'string' && typeof current !== 'function') {
    throw new Error(`Invalid selector at path: ${path}`);
  }
  
  return current as string;
}

export default SELECTORS;
