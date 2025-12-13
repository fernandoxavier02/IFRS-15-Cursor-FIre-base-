import { appConfig } from '../config/app-config.js';
import { TestScenario } from '../core/orchestrator.js';
import { ResultValidator } from '../core/result-validator.js';

/**
 * Authentication-related test scenarios
 */
export const authScenarios: TestScenario[] = [
  {
    name: 'Login with valid credentials',
    description: 'Verify that a user can login with correct email and password',
    tags: ['auth', 'smoke', 'critical'],
    steps: [
      { type: 'navigate', target: '/login', description: 'Navigate to login page' },
      { type: 'waitForElement', target: '[data-testid="input-login-email"]', description: 'Wait for email input' },
      { type: 'fill', target: '[data-testid="input-login-email"]', value: appConfig.testAdminEmail, description: 'Fill email' },
      { type: 'fill', target: '[data-testid="input-login-password"]', value: appConfig.testAdminPassword, description: 'Fill password' },
      { type: 'click', target: '[data-testid="button-login-submit"]', description: 'Click login button' },
      { type: 'wait', value: 2000, description: 'Wait for authentication' },
      { type: 'waitForNavigation', target: '/', description: 'Wait for redirect to dashboard' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/'),
      ResultValidator.createRules.elementVisible('[data-testid="button-sidebar-toggle"]'),
      ResultValidator.createRules.noConsoleErrors(),
    ],
  },

  {
    name: 'Login with invalid credentials',
    description: 'Verify that login fails with incorrect password',
    tags: ['auth', 'negative'],
    steps: [
      { type: 'navigate', target: '/login', description: 'Navigate to login page' },
      { type: 'waitForElement', target: '[data-testid="input-login-email"]', description: 'Wait for email input' },
      { type: 'fill', target: '[data-testid="input-login-email"]', value: 'test@example.com', description: 'Fill email' },
      { type: 'fill', target: '[data-testid="input-login-password"]', value: 'wrongpassword123', description: 'Fill wrong password' },
      { type: 'click', target: '[data-testid="button-login-submit"]', description: 'Click login button' },
      { type: 'wait', value: 2000, description: 'Wait for response' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/login'),
      {
        type: 'toast',
        text: 'error',
        description: 'Error toast should appear',
      },
    ],
  },

  {
    name: 'Login with empty credentials',
    description: 'Verify that login is prevented with empty fields',
    tags: ['auth', 'validation'],
    steps: [
      { type: 'navigate', target: '/login', description: 'Navigate to login page' },
      { type: 'waitForElement', target: '[data-testid="input-login-email"]', description: 'Wait for email input' },
      { type: 'click', target: '[data-testid="button-login-submit"]', description: 'Click login without filling fields' },
      { type: 'wait', value: 1000, description: 'Wait for validation' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/login'),
    ],
  },

  {
    name: 'Toggle password visibility',
    description: 'Verify that password visibility can be toggled',
    tags: ['auth', 'ui'],
    steps: [
      { type: 'navigate', target: '/login', description: 'Navigate to login page' },
      { type: 'waitForElement', target: '[data-testid="input-login-email"]', description: 'Wait for page load' },
      { type: 'fill', target: '[data-testid="input-login-password"]', value: 'testpassword', description: 'Fill password' },
      { type: 'click', target: '[data-testid="button-toggle-password"]', description: 'Toggle password visibility' },
      { type: 'wait', value: 500, description: 'Wait for toggle' },
    ],
    validations: [
      {
        type: 'element',
        selector: '[data-testid="input-login-password"][type="text"]',
        state: 'visible',
        description: 'Password should be visible (type=text)',
      },
    ],
  },

  {
    name: 'Navigate to subscribe from login',
    description: 'Verify that subscribe link works from login page',
    tags: ['auth', 'navigation'],
    steps: [
      { type: 'navigate', target: '/login', description: 'Navigate to login page' },
      { type: 'waitForElement', target: '[data-testid="link-subscribe"]', description: 'Wait for subscribe link' },
      { type: 'click', target: '[data-testid="link-subscribe"]', description: 'Click subscribe link' },
      { type: 'waitForNavigation', description: 'Wait for navigation' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/subscribe'),
    ],
  },

  {
    name: 'Authenticated user redirected from login',
    description: 'Verify that logged in user is redirected away from login page',
    tags: ['auth', 'redirect'],
    preconditions: ['authenticated'],
    steps: [
      { type: 'navigate', target: '/login', description: 'Navigate to login page while authenticated' },
      { type: 'wait', value: 2000, description: 'Wait for redirect' },
    ],
    validations: [
      {
        type: 'url',
        expected: '/',
        description: 'Should be redirected to dashboard',
      },
    ],
  },

  {
    name: 'Unauthenticated user redirected to login',
    description: 'Verify that unauthenticated user is redirected to login from protected routes',
    tags: ['auth', 'security'],
    steps: [
      { type: 'navigate', target: '/contracts', description: 'Navigate to protected page' },
      { type: 'wait', value: 2000, description: 'Wait for redirect' },
    ],
    validations: [
      {
        type: 'url',
        expected: '/login',
        description: 'Should be redirected to login',
      },
    ],
  },

  {
    name: 'Public pages accessible without auth',
    description: 'Verify that showcase page is accessible without authentication',
    tags: ['auth', 'public'],
    steps: [
      { type: 'navigate', target: '/showcase', description: 'Navigate to showcase' },
      { type: 'waitForElement', target: 'h1', description: 'Wait for page load' },
    ],
    validations: [
      ResultValidator.createRules.urlIs('/showcase'),
      ResultValidator.createRules.elementVisible('h1'),
    ],
  },
];

export default authScenarios;
