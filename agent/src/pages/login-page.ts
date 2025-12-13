import { PlaywrightController } from '../browser/playwright-controller.js';
import { SELECTORS } from '../config/selectors.js';
import { BasePage } from './base-page.js';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  redirectedTo?: string;
  errorMessage?: string;
}

export class LoginPage extends BasePage {
  readonly route = '/login';
  readonly expectedElements = [
    SELECTORS.login.email,
    SELECTORS.login.password,
    SELECTORS.login.submit,
  ];

  constructor(controller: PlaywrightController) {
    super(controller);
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string): Promise<void> {
    await this.controller.fill(SELECTORS.login.email, email);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string): Promise<void> {
    await this.controller.fill(SELECTORS.login.password, password);
  }

  /**
   * Click submit button
   */
  async clickSubmit(): Promise<void> {
    await this.controller.click(SELECTORS.login.submit);
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility(): Promise<void> {
    await this.controller.click(SELECTORS.login.togglePassword);
  }

  /**
   * Check if password is visible
   */
  async isPasswordVisible(): Promise<boolean> {
    const inputType = await this.controller.getAttribute(SELECTORS.login.password, 'type');
    return inputType === 'text';
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.controller.click(SELECTORS.login.forgotPassword);
  }

  /**
   * Click subscribe link
   */
  async clickSubscribe(): Promise<void> {
    await this.controller.click(SELECTORS.login.subscribeLink);
  }

  /**
   * Get email input value
   */
  async getEmail(): Promise<string> {
    return await this.controller.getInputValue(SELECTORS.login.email);
  }

  /**
   * Get password input value
   */
  async getPassword(): Promise<string> {
    return await this.controller.getInputValue(SELECTORS.login.password);
  }

  /**
   * Perform login with credentials
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    // Fill credentials
    await this.fillEmail(credentials.email);
    await this.fillPassword(credentials.password);
    
    // Submit form
    await this.clickSubmit();

    // Wait for response
    await this.controller.wait(1000);

    // Check result
    const currentUrl = this.controller.getCurrentUrl();
    
    // Check for error
    const hasError = await this.hasErrorMessage();
    if (hasError) {
      const errorMessage = await this.getErrorMessage();
      return {
        success: false,
        errorMessage: errorMessage || 'Login failed',
      };
    }

    // Check if redirected away from login
    if (!currentUrl.includes('/login')) {
      return {
        success: true,
        redirectedTo: currentUrl,
      };
    }

    // Still on login page, check for toast
    try {
      const toastText = await this.controller.getText(SELECTORS.common.toast);
      if (toastText.toLowerCase().includes('error') || toastText.toLowerCase().includes('failed')) {
        return {
          success: false,
          errorMessage: toastText,
        };
      }
    } catch {
      // No toast visible
    }

    // Wait a bit more for potential redirect
    await this.controller.wait(2000);
    
    const finalUrl = this.controller.getCurrentUrl();
    if (!finalUrl.includes('/login')) {
      return {
        success: true,
        redirectedTo: finalUrl,
      };
    }

    return {
      success: false,
      errorMessage: 'Login did not redirect',
    };
  }

  /**
   * Perform login and wait for dashboard
   */
  async loginAndWaitForDashboard(credentials: LoginCredentials): Promise<LoginResult> {
    const result = await this.login(credentials);
    
    if (result.success) {
      await this.controller.waitForNavigation('/');
      await this.controller.waitForNetworkIdle();
    }
    
    return result;
  }

  /**
   * Check if submit button is enabled
   */
  async isSubmitEnabled(): Promise<boolean> {
    const info = await this.controller.getElementInfo(SELECTORS.login.submit);
    return info?.isEnabled ?? false;
  }

  /**
   * Check if form is being submitted (loading state)
   */
  async isSubmitting(): Promise<boolean> {
    const buttonText = await this.controller.getText(SELECTORS.login.submit);
    return buttonText.toLowerCase().includes('signing') || 
           buttonText.toLowerCase().includes('loading');
  }

  /**
   * Clear form
   */
  async clearForm(): Promise<void> {
    await this.controller.clearAndFill(SELECTORS.login.email, '');
    await this.controller.clearAndFill(SELECTORS.login.password, '');
  }

  /**
   * Validate login form errors
   */
  async getFormErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    // Check for validation messages
    const errorElements = await this.controller.getElementCount('[role="alert"]');
    for (let i = 0; i < errorElements; i++) {
      const text = await this.controller.getText(`[role="alert"]:nth-child(${i + 1})`);
      if (text) errors.push(text);
    }
    
    return errors;
  }
}

export default LoginPage;
