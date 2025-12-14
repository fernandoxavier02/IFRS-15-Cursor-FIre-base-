import type { PlaywrightController } from '../browser/playwright-controller.js';
import type { FirestoreClient } from '../data/firestore-client.js';
import type { StateManager } from './state-manager.js';

export type ValidationType = 
  | 'url'
  | 'element'
  | 'elementText'
  | 'elementCount'
  | 'inputValue'
  | 'toast'
  | 'console'
  | 'network'
  | 'firestore'
  | 'screenshot';

export interface ValidationRule {
  type: ValidationType;
  // For URL validation - supports string, RegExp, or array of strings
  expected?: string | RegExp | string[];
  // For element validation
  selector?: string;
  state?: 'visible' | 'hidden' | 'enabled' | 'disabled';
  text?: string;
  count?: number;
  // For console validation
  level?: 'error' | 'warning' | 'info' | 'log';
  // For Firestore validation
  collection?: string;
  query?: Record<string, unknown>;
  documentId?: string;
  // For network validation
  urlPattern?: string | RegExp;
  statusCode?: number;
  // Description
  description?: string;
}

export interface ValidationResult {
  rule: ValidationRule;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  message: string;
  duration: number;
}

export class ResultValidator {
  private controller: PlaywrightController;
  private firestoreClient?: FirestoreClient;
  private stateManager: StateManager;

  constructor(
    controller: PlaywrightController,
    stateManager: StateManager,
    firestoreClient?: FirestoreClient
  ) {
    this.controller = controller;
    this.stateManager = stateManager;
    this.firestoreClient = firestoreClient;
  }

  /**
   * Validate a single rule
   */
  async validate(rule: ValidationRule): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      switch (rule.type) {
        case 'url':
          return await this.validateUrl(rule, startTime);
        case 'element':
          return await this.validateElement(rule, startTime);
        case 'elementText':
          return await this.validateElementText(rule, startTime);
        case 'elementCount':
          return await this.validateElementCount(rule, startTime);
        case 'inputValue':
          return await this.validateInputValue(rule, startTime);
        case 'toast':
          return await this.validateToast(rule, startTime);
        case 'console':
          return await this.validateConsole(rule, startTime);
        case 'network':
          return await this.validateNetwork(rule, startTime);
        case 'firestore':
          return await this.validateFirestore(rule, startTime);
        default:
          return {
            rule,
            passed: false,
            message: `Unknown validation type: ${rule.type}`,
            duration: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        rule,
        passed: false,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate multiple rules
   */
  async validateAll(rules: ValidationRule[]): Promise<{
    results: ValidationResult[];
    allPassed: boolean;
    passedCount: number;
    failedCount: number;
  }> {
    const results: ValidationResult[] = [];
    
    for (const rule of rules) {
      const result = await this.validate(rule);
      results.push(result);
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      results,
      allPassed: failedCount === 0,
      passedCount,
      failedCount,
    };
  }

  /**
   * Validate URL
   */
  private async validateUrl(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    const currentUrl = this.controller.getCurrentUrl();
    let passed = false;

    if (rule.expected instanceof RegExp) {
      passed = rule.expected.test(currentUrl);
    } else if (Array.isArray(rule.expected)) {
      // Check if current URL matches any of the expected URLs
      passed = rule.expected.some(expected => 
        currentUrl.includes(expected) || currentUrl === expected || currentUrl.endsWith(expected)
      );
    } else if (typeof rule.expected === 'string') {
      passed = currentUrl.includes(rule.expected) || currentUrl === rule.expected || currentUrl.endsWith(rule.expected);
    }

    return {
      rule,
      passed,
      actual: currentUrl,
      expected: rule.expected,
      message: passed 
        ? `URL matches expected pattern`
        : `URL mismatch: expected ${Array.isArray(rule.expected) ? `one of [${rule.expected.join(', ')}]` : `"${rule.expected}"`}, got "${currentUrl}"`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate element state
   */
  private async validateElement(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    if (!rule.selector) {
      return {
        rule,
        passed: false,
        message: 'No selector provided for element validation',
        duration: Date.now() - startTime,
      };
    }

    const isVisible = await this.controller.isElementVisible(rule.selector);
    const expectedState = rule.state || 'visible';
    
    let passed = false;
    switch (expectedState) {
      case 'visible':
        passed = isVisible;
        break;
      case 'hidden':
        passed = !isVisible;
        break;
      case 'enabled':
        if (isVisible) {
          const info = await this.controller.getElementInfo(rule.selector);
          passed = info?.isEnabled ?? false;
        }
        break;
      case 'disabled':
        if (isVisible) {
          const info = await this.controller.getElementInfo(rule.selector);
          passed = !(info?.isEnabled ?? true);
        }
        break;
    }

    return {
      rule,
      passed,
      actual: isVisible ? 'visible' : 'hidden',
      expected: expectedState,
      message: passed
        ? `Element "${rule.selector}" is ${expectedState}`
        : `Element "${rule.selector}" expected to be ${expectedState}, but was ${isVisible ? 'visible' : 'hidden'}`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate element text
   */
  private async validateElementText(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    if (!rule.selector) {
      return {
        rule,
        passed: false,
        message: 'No selector provided for text validation',
        duration: Date.now() - startTime,
      };
    }

    const text = await this.controller.getText(rule.selector);
    const expectedText = rule.text || '';
    const passed = text.includes(expectedText);

    return {
      rule,
      passed,
      actual: text,
      expected: expectedText,
      message: passed
        ? `Element text contains "${expectedText}"`
        : `Element text mismatch: expected to contain "${expectedText}", got "${text}"`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate element count
   */
  private async validateElementCount(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    if (!rule.selector) {
      return {
        rule,
        passed: false,
        message: 'No selector provided for count validation',
        duration: Date.now() - startTime,
      };
    }

    const count = await this.controller.getElementCount(rule.selector);
    const expectedCount = rule.count ?? 0;
    const passed = count === expectedCount;

    return {
      rule,
      passed,
      actual: count,
      expected: expectedCount,
      message: passed
        ? `Found ${count} elements matching "${rule.selector}"`
        : `Element count mismatch: expected ${expectedCount}, found ${count}`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate input value
   */
  private async validateInputValue(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    if (!rule.selector) {
      return {
        rule,
        passed: false,
        message: 'No selector provided for input validation',
        duration: Date.now() - startTime,
      };
    }

    const value = await this.controller.getInputValue(rule.selector);
    const expectedValue = rule.expected as string || '';
    const passed = value === expectedValue;

    return {
      rule,
      passed,
      actual: value,
      expected: expectedValue,
      message: passed
        ? `Input value matches expected`
        : `Input value mismatch: expected "${expectedValue}", got "${value}"`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate toast notification
   */
  private async validateToast(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    try {
      const toastText = await this.controller.waitForToast(rule.text, 5000);
      const passed = rule.text ? toastText.includes(rule.text) : true;

      return {
        rule,
        passed,
        actual: toastText,
        expected: rule.text,
        message: passed
          ? `Toast appeared with expected text`
          : `Toast text mismatch: expected "${rule.text}", got "${toastText}"`,
        duration: Date.now() - startTime,
      };
    } catch {
      return {
        rule,
        passed: false,
        message: `Toast did not appear within timeout`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate console logs
   */
  private async validateConsole(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    const consoleCapture = this.controller.consoleCapture;
    
    if (rule.level === 'error') {
      const errors = consoleCapture.getErrors();
      const expectedNone = rule.expected === 'none';
      const passed = expectedNone ? errors.length === 0 : errors.length > 0;

      return {
        rule,
        passed,
        actual: errors.length,
        expected: expectedNone ? 0 : 'some',
        message: passed
          ? expectedNone ? 'No console errors found' : `Found ${errors.length} console errors`
          : expectedNone ? `Found ${errors.length} unexpected console errors` : 'Expected console errors but found none',
        duration: Date.now() - startTime,
      };
    }

    if (rule.level === 'warning') {
      const warnings = consoleCapture.getWarnings();
      const expectedNone = rule.expected === 'none';
      const passed = expectedNone ? warnings.length === 0 : warnings.length > 0;

      return {
        rule,
        passed,
        actual: warnings.length,
        expected: expectedNone ? 0 : 'some',
        message: passed
          ? expectedNone ? 'No console warnings found' : `Found ${warnings.length} console warnings`
          : expectedNone ? `Found ${warnings.length} unexpected console warnings` : 'Expected console warnings but found none',
        duration: Date.now() - startTime,
      };
    }

    return {
      rule,
      passed: true,
      message: 'Console validation completed',
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate network requests
   */
  private async validateNetwork(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    const networkMonitor = this.controller.networkMonitor;
    
    if (rule.urlPattern) {
      const pattern = rule.urlPattern instanceof RegExp 
        ? rule.urlPattern 
        : new RegExp(rule.urlPattern);
      
      const calls = networkMonitor.getApiCallsByPattern(pattern);
      
      if (rule.statusCode) {
        const matching = calls.filter(c => c.response?.status === rule.statusCode);
        const passed = matching.length > 0;

        return {
          rule,
          passed,
          actual: calls.map(c => c.response?.status),
          expected: rule.statusCode,
          message: passed
            ? `Found API call matching pattern with status ${rule.statusCode}`
            : `No API call matching pattern with status ${rule.statusCode}`,
          duration: Date.now() - startTime,
        };
      }

      return {
        rule,
        passed: calls.length > 0,
        actual: calls.length,
        message: calls.length > 0
          ? `Found ${calls.length} API calls matching pattern`
          : 'No API calls matching pattern',
        duration: Date.now() - startTime,
      };
    }

    // Check for failed calls
    const failedCalls = networkMonitor.getFailedApiCalls();
    const expectedNoFailures = rule.expected === 'none';
    const passed = expectedNoFailures ? failedCalls.length === 0 : true;

    return {
      rule,
      passed,
      actual: failedCalls.length,
      message: passed
        ? 'No failed API calls'
        : `Found ${failedCalls.length} failed API calls`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Validate Firestore data
   */
  private async validateFirestore(rule: ValidationRule, startTime: number): Promise<ValidationResult> {
    if (!this.firestoreClient?.isInitialized()) {
      return {
        rule,
        passed: false,
        message: 'Firestore client not initialized',
        duration: Date.now() - startTime,
      };
    }

    const state = this.stateManager.getState();
    const tenantId = state.currentUser?.tenantId;

    if (!tenantId) {
      return {
        rule,
        passed: false,
        message: 'No tenant ID available for Firestore validation',
        duration: Date.now() - startTime,
      };
    }

    if (!rule.collection) {
      return {
        rule,
        passed: false,
        message: 'No collection specified for Firestore validation',
        duration: Date.now() - startTime,
      };
    }

    try {
      if (rule.documentId) {
        // Check specific document
        const doc = await this.firestoreClient.getTenantDocument(
          tenantId,
          rule.collection,
          rule.documentId
        );
        const passed = doc !== null;

        return {
          rule,
          passed,
          actual: doc ? 'exists' : 'not found',
          message: passed
            ? `Document ${rule.documentId} exists in ${rule.collection}`
            : `Document ${rule.documentId} not found in ${rule.collection}`,
          duration: Date.now() - startTime,
        };
      }

      if (rule.query) {
        // Query documents
        const [field, value] = Object.entries(rule.query)[0];
        const docs = await this.firestoreClient.query(
          `tenants/${tenantId}/${rule.collection}`,
          field,
          '==',
          value
        );
        const passed = docs.length > 0;

        return {
          rule,
          passed,
          actual: docs.length,
          message: passed
            ? `Found ${docs.length} documents matching query in ${rule.collection}`
            : `No documents found matching query in ${rule.collection}`,
          duration: Date.now() - startTime,
        };
      }

      return {
        rule,
        passed: false,
        message: 'No documentId or query provided for Firestore validation',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        rule,
        passed: false,
        message: `Firestore query error: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Create common validation rules
   */
  static createRules = {
    urlIs: (url: string): ValidationRule => ({
      type: 'url',
      expected: url,
      description: `URL should be ${url}`,
    }),

    elementVisible: (selector: string): ValidationRule => ({
      type: 'element',
      selector,
      state: 'visible',
      description: `Element ${selector} should be visible`,
    }),

    elementHidden: (selector: string): ValidationRule => ({
      type: 'element',
      selector,
      state: 'hidden',
      description: `Element ${selector} should be hidden`,
    }),

    elementContainsText: (selector: string, text: string): ValidationRule => ({
      type: 'elementText',
      selector,
      text,
      description: `Element ${selector} should contain "${text}"`,
    }),

    noConsoleErrors: (): ValidationRule => ({
      type: 'console',
      level: 'error',
      expected: 'none',
      description: 'No console errors should be present',
    }),

    toastAppears: (text?: string): ValidationRule => ({
      type: 'toast',
      text,
      description: text ? `Toast should appear with "${text}"` : 'Toast should appear',
    }),

    firestoreDocumentExists: (collection: string, query: Record<string, unknown>): ValidationRule => ({
      type: 'firestore',
      collection,
      query,
      description: `Document should exist in ${collection}`,
    }),

    apiCallSucceeds: (urlPattern: string): ValidationRule => ({
      type: 'network',
      urlPattern,
      statusCode: 200,
      description: `API call to ${urlPattern} should succeed`,
    }),
  };
}

export default ResultValidator;
