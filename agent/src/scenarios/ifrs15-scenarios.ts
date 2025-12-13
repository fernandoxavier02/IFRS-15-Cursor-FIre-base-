import { TestScenario } from '../core/orchestrator.js';
import { ResultValidator } from '../core/result-validator.js';

/**
 * IFRS 15 Revenue Recognition test scenarios
 */
export const ifrs15Scenarios: TestScenario[] = [
  {
    name: 'Navigate to IFRS 15 Engine',
    description: 'Verify IFRS 15 Engine page loads correctly',
    tags: ['ifrs15', 'smoke', 'navigation'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/ifrs15', description: 'Navigate to IFRS 15 Engine' },
      { type: 'waitForElement', target: 'h1:has-text("IFRS 15")', description: 'Wait for page title' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/ifrs15'),
      ResultValidator.createRules.elementVisible('h1'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  {
    name: 'View IFRS 15 five-step model',
    description: 'Verify all five steps of IFRS 15 are displayed',
    tags: ['ifrs15', 'ui'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/ifrs15', description: 'Navigate to IFRS 15 Engine' },
      { type: 'waitForElement', target: 'h1:has-text("IFRS 15")', description: 'Wait for page load' },
    ],
    validations: [
      {
        type: 'elementText',
        selector: 'body',
        text: 'Identify the Contract',
        description: 'Step 1 should be visible',
      },
      {
        type: 'elementText',
        selector: 'body',
        text: 'Performance Obligations',
        description: 'Step 2 should be visible',
      },
      {
        type: 'elementText',
        selector: 'body',
        text: 'Transaction Price',
        description: 'Step 3 should be visible',
      },
      {
        type: 'elementText',
        selector: 'body',
        text: 'Allocate',
        description: 'Step 4 should be visible',
      },
      {
        type: 'elementText',
        selector: 'body',
        text: 'Recognize Revenue',
        description: 'Step 5 should be visible',
      },
    ],
  },

  {
    name: 'Select contract in IFRS 15 Engine',
    description: 'Select a contract to analyze with IFRS 15 engine',
    tags: ['ifrs15', 'functionality'],
    preconditions: ['authenticated', 'contract_exists'],
    steps: [
      { type: 'navigate', target: '/ifrs15', description: 'Navigate to IFRS 15 Engine' },
      { type: 'waitForElement', target: 'select, [role="combobox"]', description: 'Wait for contract selector' },
      { type: 'click', target: 'select, [role="combobox"]', description: 'Open contract dropdown' },
      { type: 'wait', value: 500, description: 'Wait for options to load' },
      { type: 'click', target: '[role="option"]:first-child', description: 'Select first contract' },
      { type: 'wait', value: 2000, description: 'Wait for data to load' },
    ],
    validations: [
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== BILLING SCHEDULES ====================
  {
    name: 'View Billing Schedules page',
    description: 'Navigate to and verify billing schedules page',
    tags: ['ifrs15', 'billing', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/billing-schedules', description: 'Navigate to Billing Schedules' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/billing-schedules'),
      ResultValidator.createRules.elementVisible('h1'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== REVENUE LEDGER ====================
  {
    name: 'View Revenue Ledger page',
    description: 'Navigate to and verify revenue ledger page',
    tags: ['ifrs15', 'ledger', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/revenue-ledger', description: 'Navigate to Revenue Ledger' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/revenue-ledger'),
      ResultValidator.createRules.elementVisible('h1'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== CONSOLIDATED BALANCES ====================
  {
    name: 'View Consolidated Balances page',
    description: 'Navigate to and verify consolidated balances page',
    tags: ['ifrs15', 'balances', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/consolidated-balances', description: 'Navigate to Consolidated Balances' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/consolidated-balances'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== REVENUE WATERFALL ====================
  {
    name: 'View Revenue Waterfall page',
    description: 'Navigate to and verify revenue waterfall analysis',
    tags: ['ifrs15', 'waterfall', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/revenue-waterfall', description: 'Navigate to Revenue Waterfall' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/revenue-waterfall'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== CONTRACT COSTS ====================
  {
    name: 'View Contract Costs page',
    description: 'Navigate to and verify contract costs (ASC 340-40)',
    tags: ['ifrs15', 'costs', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/contract-costs', description: 'Navigate to Contract Costs' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/contract-costs'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== EXCHANGE RATES ====================
  {
    name: 'View Exchange Rates page',
    description: 'Navigate to and verify exchange rates page',
    tags: ['ifrs15', 'forex', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/exchange-rates', description: 'Navigate to Exchange Rates' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/exchange-rates'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== FINANCING COMPONENTS ====================
  {
    name: 'View Financing Components page',
    description: 'Navigate to and verify financing components (significant financing)',
    tags: ['ifrs15', 'financing', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/financing-components', description: 'Navigate to Financing Components' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/financing-components'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== EXECUTIVE DASHBOARD ====================
  {
    name: 'View Executive Dashboard',
    description: 'Navigate to executive dashboard with IFRS 15 KPIs',
    tags: ['ifrs15', 'dashboard', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/executive-dashboard', description: 'Navigate to Executive Dashboard' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/executive-dashboard'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== ACCOUNTING CONTROL ====================
  {
    name: 'View IFRS 15 Accounting Control page',
    description: 'Navigate to accounting control for IFRS 15 oversight',
    tags: ['ifrs15', 'accounting', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/ifrs15-accounting-control', description: 'Navigate to Accounting Control' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/ifrs15-accounting-control'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== REPORTS ====================
  {
    name: 'View Reports page',
    description: 'Navigate to IFRS 15 disclosure reports',
    tags: ['ifrs15', 'reports', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/reports', description: 'Navigate to Reports' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/reports'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  // ==================== CONTRACT DETAILS WITH PO ====================
  {
    name: 'Add Performance Obligation to Contract',
    description: 'Navigate to contract details and add a performance obligation',
    tags: ['ifrs15', 'po', 'functionality'],
    preconditions: ['authenticated', 'contract_exists'],
    steps: [
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts' },
      { type: 'waitForElement', target: 'table tbody tr', description: 'Wait for contracts' },
      { type: 'click', target: 'table tbody tr:first-child', description: 'Click first contract' },
      { type: 'wait', value: 2000, description: 'Wait for navigation' },
      { type: 'waitForElement', target: 'button:has-text("Add")', description: 'Wait for add button', options: { timeout: 10000 } },
      { type: 'click', target: 'button:has-text("Add Obligation"), button:has-text("Add")', description: 'Click add obligation' },
      { type: 'waitForDialog', description: 'Wait for dialog' },
      { type: 'fill', target: 'input[name="description"]', value: 'Software License - Test PO', description: 'Fill description' },
      { type: 'fill', target: 'input[name="allocatedPrice"]', value: '25000', description: 'Fill allocated price' },
      { type: 'click', target: 'button[type="submit"]', description: 'Submit form' },
      { type: 'wait', value: 2000, description: 'Wait for creation' },
    ],
    validations: [
      ResultValidator.createRules.toastAppears('Success'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },
];

export default ifrs15Scenarios;
