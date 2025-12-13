import { TestScenario } from '../core/orchestrator.js';
import { ResultValidator } from '../core/result-validator.js';

/**
 * CRUD (Create, Read, Update, Delete) test scenarios for customers and contracts
 */
export const crudScenarios: TestScenario[] = [
  // ==================== CUSTOMER SCENARIOS ====================
  {
    name: 'Create a new customer',
    description: 'Create a customer with all required fields',
    tags: ['crud', 'customer', 'smoke'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/customers', description: 'Navigate to customers page' },
      { type: 'waitForElement', target: '[data-testid="button-new-customer"]', description: 'Wait for page load' },
      { type: 'click', target: '[data-testid="button-new-customer"]', description: 'Click new customer button' },
      { type: 'waitForDialog', description: 'Wait for dialog to open' },
      { type: 'fill', target: '[data-testid="input-customer-name"]', value: 'Test Corp {{timestamp}}', description: 'Fill customer name' },
      { type: 'fill', target: '[data-testid="input-country"]', value: 'USA', description: 'Fill country' },
      { type: 'click', target: '[data-testid="select-currency"]', description: 'Open currency dropdown' },
      { type: 'click', target: '[role="option"]:has-text("USD")', description: 'Select USD' },
      { type: 'fill', target: '[data-testid="input-email"]', value: 'test{{timestamp}}@example.com', description: 'Fill email' },
      { type: 'click', target: '[data-testid="button-submit-customer"]', description: 'Submit form' },
      { type: 'wait', value: 2000, description: 'Wait for creation' },
    ],
    validations: [
      ResultValidator.createRules.toastAppears('Customer created'),
      {
        type: 'element',
        selector: '[role="dialog"]',
        state: 'hidden',
        description: 'Dialog should close after creation',
      },
    ],
  },

  {
    name: 'Create customer with all optional fields',
    description: 'Create a customer filling all available fields',
    tags: ['crud', 'customer', 'complete'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/customers', description: 'Navigate to customers page' },
      { type: 'waitForElement', target: '[data-testid="button-new-customer"]', description: 'Wait for page load' },
      { type: 'click', target: '[data-testid="button-new-customer"]', description: 'Click new customer button' },
      { type: 'waitForDialog', description: 'Wait for dialog to open' },
      { type: 'fill', target: '[data-testid="input-customer-name"]', value: 'Complete Corp {{timestamp}}', description: 'Fill customer name' },
      { type: 'fill', target: '[data-testid="input-country"]', value: 'Brazil', description: 'Fill country' },
      { type: 'click', target: '[data-testid="select-currency"]', description: 'Open currency dropdown' },
      { type: 'click', target: '[role="option"]:has-text("BRL")', description: 'Select BRL' },
      { type: 'fill', target: '[data-testid="input-tax-id"]', value: '12.345.678/0001-99', description: 'Fill tax ID' },
      { type: 'fill', target: '[data-testid="input-email"]', value: 'contact{{timestamp}}@example.com', description: 'Fill email' },
      { type: 'fill', target: '[data-testid="input-phone"]', value: '+55 11 99999-9999', description: 'Fill phone' },
      { type: 'click', target: '[data-testid="select-credit-rating"]', description: 'Open credit rating dropdown' },
      { type: 'click', target: '[role="option"]:has-text("AAA")', description: 'Select AAA rating' },
      { type: 'fill', target: '[data-testid="input-billing-address"]', value: '123 Test Street, São Paulo, Brazil', description: 'Fill address' },
      { type: 'click', target: '[data-testid="button-submit-customer"]', description: 'Submit form' },
      { type: 'wait', value: 2000, description: 'Wait for creation' },
    ],
    validations: [
      ResultValidator.createRules.toastAppears('Customer created'),
    ],
  },

  {
    name: 'Search for a customer',
    description: 'Search for customers by name',
    tags: ['crud', 'customer', 'search'],
    preconditions: ['authenticated', 'customer_exists'],
    steps: [
      { type: 'navigate', target: '/customers', description: 'Navigate to customers page' },
      { type: 'waitForElement', target: '[data-testid="input-search-customers"]', description: 'Wait for page load' },
      { type: 'fill', target: '[data-testid="input-search-customers"]', value: 'Test', description: 'Search for "Test"' },
      { type: 'wait', value: 1000, description: 'Wait for filter' },
    ],
    validations: [
      {
        type: 'element',
        selector: 'table tbody tr',
        state: 'visible',
        description: 'Should show filtered results',
      },
    ],
  },

  {
    name: 'Cancel customer creation',
    description: 'Verify that canceling customer creation discards changes',
    tags: ['crud', 'customer', 'cancel'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/customers', description: 'Navigate to customers page' },
      { type: 'waitForElement', target: '[data-testid="button-new-customer"]', description: 'Wait for page load' },
      { type: 'click', target: '[data-testid="button-new-customer"]', description: 'Click new customer button' },
      { type: 'waitForDialog', description: 'Wait for dialog to open' },
      { type: 'fill', target: '[data-testid="input-customer-name"]', value: 'Should Not Be Saved', description: 'Fill customer name' },
      { type: 'click', target: 'button:has-text("Cancel")', description: 'Click cancel button' },
      { type: 'wait', value: 1000, description: 'Wait for dialog to close' },
    ],
    validations: [
      {
        type: 'element',
        selector: '[role="dialog"]',
        state: 'hidden',
        description: 'Dialog should be closed',
      },
    ],
  },

  // ==================== CONTRACT SCENARIOS ====================
  {
    name: 'Create a new contract',
    description: 'Create a contract with required fields',
    tags: ['crud', 'contract', 'smoke'],
    preconditions: ['authenticated', 'customer_exists'],
    steps: [
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts page' },
      { type: 'waitForElement', target: '[data-testid="button-new-contract"]', description: 'Wait for page load' },
      { type: 'click', target: '[data-testid="button-new-contract"]', description: 'Click new contract button' },
      { type: 'waitForDialog', description: 'Wait for dialog to open' },
      { type: 'click', target: '[data-testid="select-customer"]', description: 'Open customer dropdown' },
      { type: 'wait', value: 500, description: 'Wait for dropdown' },
      { type: 'click', target: '[role="option"]:first-child', description: 'Select first customer' },
      { type: 'fill', target: '[data-testid="input-contract-number"]', value: 'CTR-{{timestamp}}', description: 'Fill contract number' },
      { type: 'fill', target: '[data-testid="input-title"]', value: 'Test Contract {{random}}', description: 'Fill title' },
      { type: 'fill', target: '[data-testid="input-start-date"]', value: '{{today}}', description: 'Fill start date' },
      { type: 'fill', target: '[data-testid="input-end-date"]', value: '{{futureDate}}', description: 'Fill end date' },
      { type: 'fill', target: '[data-testid="input-total-value"]', value: '100000', description: 'Fill total value' },
      { type: 'click', target: '[data-testid="select-currency"]', description: 'Open currency dropdown' },
      { type: 'click', target: '[role="option"]:has-text("USD")', description: 'Select USD' },
      { type: 'fill', target: '[data-testid="input-payment-terms"]', value: 'Net 30', description: 'Fill payment terms' },
      { type: 'click', target: '[data-testid="button-submit-contract"]', description: 'Submit form' },
      { type: 'wait', value: 2000, description: 'Wait for creation' },
    ],
    validations: [
      ResultValidator.createRules.toastAppears('Contract created'),
    ],
  },

  {
    name: 'Search for a contract',
    description: 'Search for contracts by number or title',
    tags: ['crud', 'contract', 'search'],
    preconditions: ['authenticated', 'contract_exists'],
    steps: [
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts page' },
      { type: 'waitForElement', target: '[data-testid="input-search-contracts"]', description: 'Wait for page load' },
      { type: 'fill', target: '[data-testid="input-search-contracts"]', value: 'CTR', description: 'Search for "CTR"' },
      { type: 'wait', value: 1000, description: 'Wait for filter' },
    ],
    validations: [
      {
        type: 'element',
        selector: 'table tbody tr',
        state: 'visible',
        description: 'Should show filtered results',
      },
    ],
  },

  {
    name: 'Filter contracts by status',
    description: 'Filter contracts using status dropdown',
    tags: ['crud', 'contract', 'filter'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts page' },
      { type: 'waitForElement', target: '[data-testid="select-status-filter"]', description: 'Wait for page load' },
      { type: 'click', target: '[data-testid="select-status-filter"]', description: 'Open status filter' },
      { type: 'click', target: '[role="option"]:has-text("Draft")', description: 'Select draft status' },
      { type: 'wait', value: 1000, description: 'Wait for filter' },
    ],
    validations: [
      // Status filter was applied (page doesn't error)
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  {
    name: 'View contract details',
    description: 'Click on a contract to view its details',
    tags: ['crud', 'contract', 'details'],
    preconditions: ['authenticated', 'contract_exists'],
    steps: [
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts page' },
      { type: 'waitForElement', target: 'table tbody tr', description: 'Wait for contracts to load' },
      { type: 'click', target: 'table tbody tr:first-child', description: 'Click first contract' },
      { type: 'wait', value: 2000, description: 'Wait for navigation' },
    ],
    validations: [
      {
        type: 'url',
        expected: /\/contracts\/[a-zA-Z0-9]+/,
        description: 'Should navigate to contract details',
      },
    ],
  },

  {
    name: 'Create contract with validation errors',
    description: 'Try to create a contract without required fields',
    tags: ['crud', 'contract', 'validation'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts page' },
      { type: 'waitForElement', target: '[data-testid="button-new-contract"]', description: 'Wait for page load' },
      { type: 'click', target: '[data-testid="button-new-contract"]', description: 'Click new contract button' },
      { type: 'waitForDialog', description: 'Wait for dialog to open' },
      // Don't fill required fields
      { type: 'click', target: '[data-testid="button-submit-contract"]', description: 'Submit without data' },
      { type: 'wait', value: 1000, description: 'Wait for validation' },
    ],
    validations: [
      {
        type: 'element',
        selector: '[role="dialog"]',
        state: 'visible',
        description: 'Dialog should remain open (form not submitted)',
      },
    ],
  },

  // ==================== COMBINED SCENARIOS ====================
  {
    name: 'Full customer to contract flow',
    description: 'Create a customer, then create a contract for that customer',
    tags: ['crud', 'e2e', 'flow'],
    preconditions: ['authenticated'],
    steps: [
      // Create customer
      { type: 'navigate', target: '/customers', description: 'Navigate to customers page' },
      { type: 'click', target: '[data-testid="button-new-customer"]', description: 'Click new customer button' },
      { type: 'waitForDialog', description: 'Wait for dialog' },
      { type: 'fill', target: '[data-testid="input-customer-name"]', value: 'E2E Test Corp {{timestamp}}', description: 'Fill customer name' },
      { type: 'fill', target: '[data-testid="input-country"]', value: 'USA', description: 'Fill country' },
      { type: 'click', target: '[data-testid="select-currency"]', description: 'Open currency dropdown' },
      { type: 'click', target: '[role="option"]:has-text("USD")', description: 'Select USD' },
      { type: 'click', target: '[data-testid="button-submit-customer"]', description: 'Submit customer' },
      { type: 'wait', value: 2000, description: 'Wait for creation' },
      
      // Navigate to contracts
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts' },
      { type: 'click', target: '[data-testid="button-new-contract"]', description: 'Click new contract' },
      { type: 'waitForDialog', description: 'Wait for dialog' },
      { type: 'click', target: '[data-testid="select-customer"]', description: 'Open customer dropdown' },
      { type: 'click', target: '[role="option"]:has-text("E2E Test Corp")', description: 'Select created customer' },
      { type: 'fill', target: '[data-testid="input-contract-number"]', value: 'E2E-{{timestamp}}', description: 'Fill contract number' },
      { type: 'fill', target: '[data-testid="input-title"]', value: 'E2E Test Contract', description: 'Fill title' },
      { type: 'fill', target: '[data-testid="input-start-date"]', value: '{{today}}', description: 'Fill start date' },
      { type: 'fill', target: '[data-testid="input-total-value"]', value: '50000', description: 'Fill value' },
      { type: 'click', target: '[data-testid="button-submit-contract"]', description: 'Submit contract' },
      { type: 'wait', value: 2000, description: 'Wait for creation' },
    ],
    validations: [
      ResultValidator.createRules.toastAppears('Contract created'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },
];

export default crudScenarios;
