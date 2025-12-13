import { PlaywrightController } from '../browser/playwright-controller.js';
import { appConfig, testConfig } from '../config/index.js';
import { SELECTORS } from '../config/selectors.js';

export interface PageValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export abstract class BasePage {
  protected controller: PlaywrightController;
  protected baseUrl: string;
  
  // Each page must define its route
  abstract readonly route: string;
  
  // Each page must define expected elements for validation
  abstract readonly expectedElements: string[];

  constructor(controller: PlaywrightController) {
    this.controller = controller;
    this.baseUrl = appConfig.appUrl;
  }

  /**
   * Navigate to this page
   */
  async navigate(): Promise<void> {
    await this.controller.navigate(this.route);
  }

  /**
   * Check if currently on this page
   */
  async isCurrentPage(): Promise<boolean> {
    const currentUrl = this.controller.getCurrentUrl();
    const expectedUrl = `${this.baseUrl}${this.route}`;
    
    // Handle route parameters
    if (this.route.includes(':')) {
      const pattern = this.route.replace(/:[^/]+/g, '[^/]+');
      const regex = new RegExp(`${this.baseUrl}${pattern}$`);
      return regex.test(currentUrl);
    }
    
    return currentUrl === expectedUrl || currentUrl === `${expectedUrl}/`;
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.controller.waitForNetworkIdle();
    
    // Wait for at least one expected element
    if (this.expectedElements.length > 0) {
      await this.controller.waitForElement(this.expectedElements[0], {
        timeout: testConfig.timeouts.navigation,
      });
    }
  }

  /**
   * Navigate to page and wait for load
   */
  async goto(): Promise<void> {
    await this.navigate();
    await this.waitForLoad();
  }

  /**
   * Validate page structure
   */
  async validate(): Promise<PageValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if on correct page
    if (!(await this.isCurrentPage())) {
      errors.push(`Not on expected page. Expected: ${this.route}, Current: ${this.controller.getCurrentUrl()}`);
    }

    // Check expected elements
    for (const selector of this.expectedElements) {
      const isVisible = await this.controller.isElementVisible(selector);
      if (!isVisible) {
        errors.push(`Expected element not visible: ${selector}`);
      }
    }

    // Check for console errors
    const consoleErrors = this.controller.consoleCapture.getErrors();
    if (consoleErrors.length > 0) {
      warnings.push(`Page has ${consoleErrors.length} console error(s)`);
    }

    // Check for failed API calls
    const failedCalls = this.controller.networkMonitor.getFailedApiCalls();
    if (failedCalls.length > 0) {
      for (const call of failedCalls) {
        const status = call.response?.status || 'failed';
        errors.push(`API call failed: ${call.request.method} ${call.request.url} (${status})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Take a screenshot of the page
   */
  async screenshot(name: string): Promise<Buffer> {
    const path = `${testConfig.paths.screenshots}/${name}_${Date.now()}.png`;
    return await this.controller.screenshot({ path, fullPage: true });
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.controller.getTitle();
  }

  /**
   * Wait for toast notification
   */
  async waitForToast(expectedText?: string): Promise<string> {
    return await this.controller.waitForToast(expectedText);
  }

  /**
   * Check if loading spinner is visible
   */
  async isLoading(): Promise<boolean> {
    return await this.controller.isElementVisible(SELECTORS.common.loadingSpinner);
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    try {
      await this.controller.waitForElementHidden(
        SELECTORS.common.loadingSpinner,
        testConfig.timeouts.assertion
      );
    } catch {
      // Loading spinner might not appear for fast operations
    }
  }

  /**
   * Check for error messages on page
   */
  async hasErrorMessage(): Promise<boolean> {
    return await this.controller.isElementVisible(SELECTORS.common.errorMessage);
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.hasErrorMessage()) {
      return await this.controller.getText(SELECTORS.common.errorMessage);
    }
    return null;
  }

  /**
   * Click sidebar navigation
   */
  protected async navigateViaSidebar(menuItem: keyof typeof SELECTORS.sidebar): Promise<void> {
    const selector = SELECTORS.sidebar[menuItem];
    await this.controller.click(selector);
    await this.controller.waitForNetworkIdle();
  }
}

export default BasePage;
