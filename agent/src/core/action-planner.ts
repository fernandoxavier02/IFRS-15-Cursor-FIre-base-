import type { PlaywrightController } from '../browser/playwright-controller.js';
import { getSelector } from '../config/selectors.js';
import type { StateManager } from './state-manager.js';

export type ActionType = 
  | 'navigate'
  | 'click'
  | 'fill'
  | 'clearAndFill'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'press'
  | 'hover'
  | 'wait'
  | 'waitForElement'
  | 'waitForElementHidden'
  | 'waitForNavigation'
  | 'waitForDialog'
  | 'waitForToast'
  | 'screenshot'
  | 'scroll';

export interface TestAction {
  type: ActionType;
  target?: string;
  value?: string | number;
  options?: Record<string, unknown>;
  description?: string;
}

export interface ActionResult {
  success: boolean;
  action: TestAction;
  duration: number;
  error?: string;
  screenshot?: Buffer;
}

export class ActionPlanner {
  private controller: PlaywrightController;
  private stateManager: StateManager;
  private executedActions: ActionResult[] = [];

  constructor(controller: PlaywrightController, stateManager: StateManager) {
    this.controller = controller;
    this.stateManager = stateManager;
  }

  /**
   * Resolve selector from path or return as-is
   */
  private resolveSelector(selectorOrPath: string): string {
    // If it looks like a CSS selector, return as-is
    if (selectorOrPath.startsWith('[') || 
        selectorOrPath.startsWith('.') || 
        selectorOrPath.startsWith('#') ||
        selectorOrPath.includes(':')) {
      return selectorOrPath;
    }

    // Try to resolve from SELECTORS
    try {
      return getSelector(selectorOrPath);
    } catch {
      // Return as-is if not found
      return selectorOrPath;
    }
  }

  /**
   * Interpolate variables in value
   */
  private interpolateValue(value: string, context: Record<string, string> = {}): string {
    return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      switch (key) {
        case 'timestamp':
          return Date.now().toString();
        case 'random':
          return Math.random().toString(36).substring(7);
        case 'today':
          return new Date().toISOString().split('T')[0];
        case 'futureDate':
          const future = new Date();
          future.setFullYear(future.getFullYear() + 1);
          return future.toISOString().split('T')[0];
        default:
          return context[key] || match;
      }
    });
  }

  /**
   * Execute a single action
   */
  async executeAction(action: TestAction, context: Record<string, string> = {}): Promise<ActionResult> {
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;
    let screenshot: Buffer | undefined;

    try {
      const target = action.target ? this.resolveSelector(action.target) : undefined;
      const value = action.value !== undefined 
        ? (typeof action.value === 'string' ? this.interpolateValue(action.value, context) : action.value)
        : undefined;

      switch (action.type) {
        case 'navigate':
          if (target) await this.controller.navigate(target);
          break;

        case 'click':
          if (target) await this.controller.click(target, action.options as { force?: boolean });
          break;

        case 'fill':
          if (target && value !== undefined) {
            await this.controller.fill(target, String(value));
          }
          break;

        case 'clearAndFill':
          if (target && value !== undefined) {
            await this.controller.clearAndFill(target, String(value));
          }
          break;

        case 'select':
          if (target && value !== undefined) {
            await this.controller.select(target, String(value));
          }
          break;

        case 'check':
          if (target) await this.controller.check(target);
          break;

        case 'uncheck':
          if (target) await this.controller.uncheck(target);
          break;

        case 'press':
          if (value) await this.controller.press(String(value));
          break;

        case 'hover':
          if (target) await this.controller.hover(target);
          break;

        case 'wait':
          await this.controller.wait(typeof value === 'number' ? value : 1000);
          break;

        case 'waitForElement':
          if (target) {
            await this.controller.waitForElement(target, {
              timeout: action.options?.timeout as number,
              state: action.options?.state as 'visible' | 'hidden',
            });
          }
          break;

        case 'waitForElementHidden':
          if (target) {
            await this.controller.waitForElementHidden(target, action.options?.timeout as number);
          }
          break;

        case 'waitForNavigation':
          await this.controller.waitForNavigation(target);
          break;

        case 'waitForDialog':
          await this.controller.waitForDialog();
          break;

        case 'waitForToast':
          await this.controller.waitForToast(value as string);
          break;

        case 'screenshot':
          screenshot = await this.controller.screenshot({
            path: value as string,
            fullPage: action.options?.fullPage as boolean,
          });
          break;

        case 'scroll':
          if (target) {
            await this.controller.scrollToElement(target);
          }
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Update state with current page
      this.stateManager.setCurrentPage(this.controller.getCurrentUrl());

    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : String(e);
      
      // Take screenshot on error
      try {
        screenshot = await this.controller.screenshot({ fullPage: true });
      } catch {
        // Ignore screenshot errors
      }
    }

    const result: ActionResult = {
      success,
      action,
      duration: Date.now() - startTime,
      error,
      screenshot,
    };

    this.executedActions.push(result);
    return result;
  }

  /**
   * Execute a sequence of actions
   */
  async executeActions(
    actions: TestAction[],
    context: Record<string, string> = {},
    stopOnError: boolean = true
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      this.stateManager.nextStep();

      const result = await this.executeAction(action, context);
      results.push(result);

      if (!result.success) {
        this.stateManager.addError(
          `Action ${i + 1} failed: ${action.type} ${action.target || ''} - ${result.error}`
        );

        if (stopOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Create action for login flow
   */
  createLoginActions(email: string, password: string): TestAction[] {
    return [
      { type: 'navigate', target: '/login', description: 'Navigate to login page' },
      { type: 'waitForElement', target: 'login.email', description: 'Wait for email input' },
      { type: 'fill', target: 'login.email', value: email, description: 'Fill email' },
      { type: 'fill', target: 'login.password', value: password, description: 'Fill password' },
      { type: 'click', target: 'login.submit', description: 'Click login button' },
      { type: 'waitForNavigation', target: '/', description: 'Wait for redirect to dashboard' },
    ];
  }

  /**
   * Create action for creating a customer
   */
  createCustomerActions(customerData: Record<string, string>): TestAction[] {
    return [
      { type: 'navigate', target: '/customers', description: 'Navigate to customers page' },
      { type: 'click', target: 'customers.newButton', description: 'Click new customer button' },
      { type: 'waitForDialog', description: 'Wait for dialog to open' },
      { type: 'fill', target: 'customers.dialog.name', value: customerData.name, description: 'Fill customer name' },
      { type: 'fill', target: 'customers.dialog.country', value: customerData.country, description: 'Fill country' },
      { type: 'click', target: 'customers.dialog.currency', description: 'Open currency dropdown' },
      { type: 'click', target: `[role="option"]:has-text("${customerData.currency}")`, description: 'Select currency' },
      { type: 'fill', target: 'customers.dialog.email', value: customerData.email || '', description: 'Fill email' },
      { type: 'click', target: 'customers.dialog.submitButton', description: 'Submit form' },
      { type: 'waitForToast', value: 'Customer created', description: 'Wait for success toast' },
    ];
  }

  /**
   * Create action for creating a contract
   */
  createContractActions(contractData: Record<string, string>): TestAction[] {
    return [
      { type: 'navigate', target: '/contracts', description: 'Navigate to contracts page' },
      { type: 'click', target: 'contracts.newButton', description: 'Click new contract button' },
      { type: 'waitForDialog', description: 'Wait for dialog to open' },
      { type: 'click', target: 'contracts.dialog.customer', description: 'Open customer dropdown' },
      { type: 'click', target: `[role="option"]:has-text("${contractData.customerName}")`, description: 'Select customer' },
      { type: 'fill', target: 'contracts.dialog.contractNumber', value: contractData.contractNumber, description: 'Fill contract number' },
      { type: 'fill', target: 'contracts.dialog.title', value: contractData.title, description: 'Fill title' },
      { type: 'fill', target: 'contracts.dialog.startDate', value: contractData.startDate, description: 'Fill start date' },
      { type: 'fill', target: 'contracts.dialog.endDate', value: contractData.endDate, description: 'Fill end date' },
      { type: 'fill', target: 'contracts.dialog.totalValue', value: contractData.totalValue, description: 'Fill total value' },
      { type: 'click', target: 'contracts.dialog.currency', description: 'Open currency dropdown' },
      { type: 'click', target: `[role="option"]:has-text("${contractData.currency}")`, description: 'Select currency' },
      { type: 'click', target: 'contracts.dialog.submitButton', description: 'Submit form' },
      { type: 'waitForToast', value: 'Contract created', description: 'Wait for success toast' },
    ];
  }

  /**
   * Get executed actions
   */
  getExecutedActions(): ActionResult[] {
    return [...this.executedActions];
  }

  /**
   * Get failed actions
   */
  getFailedActions(): ActionResult[] {
    return this.executedActions.filter(a => !a.success);
  }

  /**
   * Clear executed actions history
   */
  clearHistory(): void {
    this.executedActions = [];
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    total: number;
    successful: number;
    failed: number;
    totalDuration: number;
    averageDuration: number;
  } {
    const total = this.executedActions.length;
    const successful = this.executedActions.filter(a => a.success).length;
    const failed = total - successful;
    const totalDuration = this.executedActions.reduce((sum, a) => sum + a.duration, 0);

    return {
      total,
      successful,
      failed,
      totalDuration,
      averageDuration: total > 0 ? totalDuration / total : 0,
    };
  }
}

export default ActionPlanner;
