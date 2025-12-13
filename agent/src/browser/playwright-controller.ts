import {
    chromium,
    firefox,
    webkit,
    type Browser,
    type BrowserContext,
    type Locator,
    type Page
} from 'playwright';
import { appConfig, SELECTORS, testConfig } from '../config/index.js';
import { ConsoleCapture } from './console-capture.js';
import { NetworkMonitor } from './network-monitor.js';

export interface BrowserState {
  url: string;
  title: string;
  cookies: Array<{ name: string; value: string; domain: string }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface ElementInfo {
  tagName: string;
  id?: string;
  classes: string[];
  text: string;
  isVisible: boolean;
  isEnabled: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
  attributes: Record<string, string>;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  path?: string;
  type?: 'png' | 'jpeg';
  quality?: number;
}

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  
  public consoleCapture: ConsoleCapture;
  public networkMonitor: NetworkMonitor;

  constructor() {
    this.consoleCapture = new ConsoleCapture();
    this.networkMonitor = new NetworkMonitor();
  }

  /**
   * Initialize browser and create a new page
   */
  async init(): Promise<void> {
    const browserType = appConfig.browser;
    const launcher = browserType === 'firefox' 
      ? firefox 
      : browserType === 'webkit' 
        ? webkit 
        : chromium;

    this.browser = await launcher.launch(testConfig.launchOptions);
    this.context = await this.browser.newContext(testConfig.contextOptions);
    this.page = await this.context.newPage();

    // Set default timeout
    this.page.setDefaultTimeout(testConfig.timeouts.action);
    this.page.setDefaultNavigationTimeout(testConfig.timeouts.navigation);

    // Attach console capture and network monitor
    this.consoleCapture.attach(this.page);
    this.networkMonitor.attach(this.page, { 
      captureResponseBody: true,
      apiPatterns: [/\/api\//, /cloudfunctions\.net/, /firestore/],
    });
  }

  /**
   * Get the current page
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }
    return this.page;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    const fullUrl = url.startsWith('http') ? url : `${appConfig.appUrl}${url}`;
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.getPage().url();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.getPage().title();
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(url?: string): Promise<void> {
    const page = this.getPage();
    if (url) {
      await page.waitForURL(url.startsWith('http') ? url : `${appConfig.appUrl}${url}`);
    } else {
      await page.waitForLoadState('networkidle');
    }
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' | 'detached' }): Promise<Locator> {
    const page = this.getPage();
    const locator = page.locator(selector);
    await locator.waitFor({ 
      state: options?.state || 'visible',
      timeout: options?.timeout || testConfig.timeouts.assertion,
    });
    return locator;
  }

  /**
   * Wait for element to be hidden or removed
   */
  async waitForElementHidden(selector: string, timeout?: number): Promise<void> {
    const page = this.getPage();
    await page.locator(selector).waitFor({ 
      state: 'hidden',
      timeout: timeout || testConfig.timeouts.assertion,
    });
  }

  /**
   * Check if element exists and is visible
   */
  async isElementVisible(selector: string): Promise<boolean> {
    const page = this.getPage();
    try {
      return await page.locator(selector).isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Click on an element
   */
  async click(selector: string, options?: { force?: boolean; delay?: number }): Promise<void> {
    const page = this.getPage();
    await page.click(selector, {
      force: options?.force,
      delay: options?.delay,
    });
  }

  /**
   * Double click on an element
   */
  async doubleClick(selector: string): Promise<void> {
    const page = this.getPage();
    await page.dblclick(selector);
  }

  /**
   * Fill an input field
   */
  async fill(selector: string, value: string): Promise<void> {
    const page = this.getPage();
    await page.fill(selector, value);
  }

  /**
   * Clear and fill an input field
   */
  async clearAndFill(selector: string, value: string): Promise<void> {
    const page = this.getPage();
    await page.locator(selector).clear();
    await page.fill(selector, value);
  }

  /**
   * Type text with delay (simulates human typing)
   */
  async type(selector: string, value: string, delay: number = 50): Promise<void> {
    const page = this.getPage();
    await page.locator(selector).pressSequentially(value, { delay });
  }

  /**
   * Select an option from a dropdown
   */
  async select(selector: string, value: string): Promise<void> {
    const page = this.getPage();
    await page.selectOption(selector, value);
  }

  /**
   * Select option by label
   */
  async selectByLabel(selector: string, label: string): Promise<void> {
    const page = this.getPage();
    await page.selectOption(selector, { label });
  }

  /**
   * Check a checkbox
   */
  async check(selector: string): Promise<void> {
    const page = this.getPage();
    await page.check(selector);
  }

  /**
   * Uncheck a checkbox
   */
  async uncheck(selector: string): Promise<void> {
    const page = this.getPage();
    await page.uncheck(selector);
  }

  /**
   * Press a keyboard key
   */
  async press(key: string): Promise<void> {
    const page = this.getPage();
    await page.keyboard.press(key);
  }

  /**
   * Hover over an element
   */
  async hover(selector: string): Promise<void> {
    const page = this.getPage();
    await page.hover(selector);
  }

  /**
   * Get text content of an element
   */
  async getText(selector: string): Promise<string> {
    const page = this.getPage();
    return await page.locator(selector).textContent() || '';
  }

  /**
   * Get inner text of an element
   */
  async getInnerText(selector: string): Promise<string> {
    const page = this.getPage();
    return await page.locator(selector).innerText();
  }

  /**
   * Get attribute value
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const page = this.getPage();
    return await page.locator(selector).getAttribute(attribute);
  }

  /**
   * Get input value
   */
  async getInputValue(selector: string): Promise<string> {
    const page = this.getPage();
    return await page.locator(selector).inputValue();
  }

  /**
   * Get element count
   */
  async getElementCount(selector: string): Promise<number> {
    const page = this.getPage();
    return await page.locator(selector).count();
  }

  /**
   * Get detailed element information
   */
  async getElementInfo(selector: string): Promise<ElementInfo | null> {
    const page = this.getPage();
    const locator = page.locator(selector);
    
    if (!(await locator.count())) {
      return null;
    }

    const element = await locator.elementHandle();
    if (!element) return null;

    const info = await element.evaluate((el: Element) => ({
      tagName: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: Array.from(el.classList),
      text: el.textContent || '',
      isVisible: (el as HTMLElement).offsetParent !== null,
      isEnabled: !(el as HTMLInputElement).disabled,
      attributes: Object.fromEntries(
        Array.from(el.attributes).map(attr => [attr.name, attr.value])
      ),
    }));

    const boundingBox = await element.boundingBox();

    return {
      ...info,
      boundingBox: boundingBox || undefined,
    };
  }

  /**
   * Take a screenshot
   */
  async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
    const page = this.getPage();
    return await page.screenshot({
      fullPage: options?.fullPage,
      path: options?.path,
      type: options?.type || 'png',
      quality: options?.quality,
    });
  }

  /**
   * Take element screenshot
   */
  async screenshotElement(selector: string, path?: string): Promise<Buffer> {
    const page = this.getPage();
    return await page.locator(selector).screenshot({ path });
  }

  /**
   * Wait for a specific amount of time
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(): Promise<void> {
    const page = this.getPage();
    await page.waitForLoadState('networkidle');
  }

  /**
   * Wait for toast notification
   */
  async waitForToast(text?: string, timeout?: number): Promise<string> {
    const page = this.getPage();
    const toastSelector = SELECTORS.common.toast;
    
    await this.waitForElement(toastSelector, { timeout });
    
    const toastText = await this.getText(toastSelector);
    
    if (text && !toastText.includes(text)) {
      throw new Error(`Expected toast to contain "${text}" but got "${toastText}"`);
    }
    
    return toastText;
  }

  /**
   * Wait for dialog to open
   */
  async waitForDialog(): Promise<void> {
    await this.waitForElement(SELECTORS.common.dialog);
  }

  /**
   * Close dialog
   */
  async closeDialog(): Promise<void> {
    const closeButton = SELECTORS.common.dialogClose;
    if (await this.isElementVisible(closeButton)) {
      await this.click(closeButton);
    } else {
      await this.press('Escape');
    }
    await this.waitForElementHidden(SELECTORS.common.dialog);
  }

  /**
   * Get browser state (cookies, storage)
   */
  async getBrowserState(): Promise<BrowserState> {
    const page = this.getPage();
    const context = this.context!;

    const cookies = await context.cookies();
    
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          items[key] = window.localStorage.getItem(key) || '';
        }
      }
      return items;
    });

    const sessionStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          items[key] = window.sessionStorage.getItem(key) || '';
        }
      }
      return items;
    });

    return {
      url: page.url(),
      title: await page.title(),
      cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
      localStorage,
      sessionStorage,
    };
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    const page = this.getPage();
    return await page.evaluate(fn);
  }

  /**
   * Upload a file
   */
  async uploadFile(selector: string, filePath: string): Promise<void> {
    const page = this.getPage();
    await page.setInputFiles(selector, filePath);
  }

  /**
   * Scroll to element
   */
  async scrollToElement(selector: string): Promise<void> {
    const page = this.getPage();
    await page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Scroll page by pixels
   */
  async scroll(x: number, y: number): Promise<void> {
    const page = this.getPage();
    await page.evaluate(({ x, y }) => window.scrollBy(x, y), { x, y });
  }

  /**
   * Focus on an element
   */
  async focus(selector: string): Promise<void> {
    const page = this.getPage();
    await page.focus(selector);
  }

  /**
   * Blur current element
   */
  async blur(selector: string): Promise<void> {
    const page = this.getPage();
    await page.locator(selector).blur();
  }

  /**
   * Reload the page
   */
  async reload(): Promise<void> {
    const page = this.getPage();
    await page.reload({ waitUntil: 'networkidle' });
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<void> {
    const page = this.getPage();
    await page.goBack({ waitUntil: 'networkidle' });
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<void> {
    const page = this.getPage();
    await page.goForward({ waitUntil: 'networkidle' });
  }

  /**
   * Clear browser data (cookies, storage)
   */
  async clearBrowserData(): Promise<void> {
    const page = this.getPage();
    const context = this.context!;
    
    await context.clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Create a new page in the same context
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }
    return await this.context.newPage();
  }

  /**
   * Get all pages in context
   */
  getPages(): Page[] {
    if (!this.context) {
      return [];
    }
    return this.context.pages();
  }
}

export default PlaywrightController;
