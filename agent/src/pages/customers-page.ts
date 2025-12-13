import { PlaywrightController } from '../browser/playwright-controller.js';
import { SELECTORS } from '../config/selectors.js';
import { BasePage } from './base-page.js';

export interface CustomerFormData {
  name: string;
  country: string;
  currency: string;
  taxId?: string;
  contactEmail?: string;
  contactPhone?: string;
  creditRating?: string;
  billingAddress?: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  country: string;
  currency: string;
  contactEmail?: string;
  creditRating?: string;
  contractCount: number;
  totalContractValue: string;
}

export class CustomersPage extends BasePage {
  readonly route = '/customers';
  readonly expectedElements = [
    SELECTORS.customers.newButton,
    SELECTORS.customers.searchInput,
  ];

  constructor(controller: PlaywrightController) {
    super(controller);
  }

  /**
   * Click new customer button
   */
  async clickNewCustomer(): Promise<void> {
    await this.controller.click(SELECTORS.customers.newButton);
    await this.controller.waitForDialog();
  }

  /**
   * Search customers
   */
  async search(query: string): Promise<void> {
    await this.controller.clearAndFill(SELECTORS.customers.searchInput, query);
    await this.controller.wait(500); // Wait for debounce
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.controller.clearAndFill(SELECTORS.customers.searchInput, '');
  }

  /**
   * Get current search value
   */
  async getSearchValue(): Promise<string> {
    return await this.controller.getInputValue(SELECTORS.customers.searchInput);
  }

  /**
   * Fill customer form in dialog
   */
  async fillCustomerForm(data: CustomerFormData): Promise<void> {
    const dialog = SELECTORS.customers.dialog;

    // Fill required fields
    await this.controller.fill(dialog.name, data.name);
    await this.controller.fill(dialog.country, data.country);

    // Select currency
    await this.controller.click(dialog.currency);
    await this.controller.click(`[role="option"][data-value="${data.currency}"], [role="option"]:has-text("${data.currency}")`);

    // Fill optional fields
    if (data.taxId) {
      await this.controller.fill(dialog.taxId, data.taxId);
    }

    if (data.contactEmail) {
      await this.controller.fill(dialog.email, data.contactEmail);
    }

    if (data.contactPhone) {
      await this.controller.fill(dialog.phone, data.contactPhone);
    }

    if (data.creditRating) {
      await this.controller.click(dialog.creditRating);
      await this.controller.click(`[role="option"]:has-text("${data.creditRating}")`);
    }

    if (data.billingAddress) {
      await this.controller.fill(dialog.billingAddress, data.billingAddress);
    }
  }

  /**
   * Submit customer form
   */
  async submitCustomerForm(): Promise<void> {
    await this.controller.click(SELECTORS.customers.dialog.submitButton);
  }

  /**
   * Cancel customer form
   */
  async cancelCustomerForm(): Promise<void> {
    await this.controller.click(SELECTORS.customers.dialog.cancelButton);
    await this.controller.waitForElementHidden(SELECTORS.common.dialog);
  }

  /**
   * Create a new customer (full flow)
   */
  async createCustomer(data: CustomerFormData): Promise<{
    success: boolean;
    message?: string;
  }> {
    await this.clickNewCustomer();
    await this.fillCustomerForm(data);
    await this.submitCustomerForm();

    // Wait for response
    await this.controller.wait(1000);

    // Check for success toast
    try {
      const toastText = await this.waitForToast('Customer created');
      return { success: true, message: toastText };
    } catch {
      // Check for error
      const error = await this.getErrorMessage();
      return { success: false, message: error || 'Failed to create customer' };
    }
  }

  /**
   * Get customers from table
   */
  async getCustomers(): Promise<CustomerRow[]> {
    const customers: CustomerRow[] = [];
    
    const rowCount = await this.controller.getElementCount('table tbody tr');
    
    for (let i = 0; i < rowCount; i++) {
      const rowSelector = `table tbody tr:nth-child(${i + 1})`;
      
      try {
        const cells = await this.controller.getElementCount(`${rowSelector} td`);
        if (cells === 0) continue;

        const row: CustomerRow = {
          id: '',
          name: '',
          country: '',
          currency: '',
          contactEmail: undefined,
          creditRating: undefined,
          contractCount: 0,
          totalContractValue: '',
        };

        // Get name (first column)
        row.name = await this.controller.getText(`${rowSelector} td:nth-child(1)`);
        
        // Get country (second column)
        row.country = await this.controller.getText(`${rowSelector} td:nth-child(2)`);
        
        // Get currency (third column)
        row.currency = await this.controller.getText(`${rowSelector} td:nth-child(3)`);
        
        // Get email (fourth column)
        const email = await this.controller.getText(`${rowSelector} td:nth-child(4)`);
        row.contactEmail = email !== '—' ? email : undefined;
        
        // Get credit rating (fifth column)
        const rating = await this.controller.getText(`${rowSelector} td:nth-child(5)`);
        row.creditRating = rating !== '—' ? rating : undefined;
        
        // Get contract count (sixth column)
        const countText = await this.controller.getText(`${rowSelector} td:nth-child(6)`);
        row.contractCount = parseInt(countText, 10) || 0;
        
        // Get total value (seventh column)
        row.totalContractValue = await this.controller.getText(`${rowSelector} td:nth-child(7)`);

        // Get ID from data attribute if available
        const dataTestId = await this.controller.getAttribute(rowSelector, 'data-testid');
        if (dataTestId) {
          row.id = dataTestId.replace('customer-row-', '');
        }

        customers.push(row);
      } catch {
        // Row might not have expected structure
      }
    }

    return customers;
  }

  /**
   * Get customer count
   */
  async getCustomerCount(): Promise<number> {
    return await this.controller.getElementCount('table tbody tr');
  }

  /**
   * Check if customers table is empty
   */
  async isTableEmpty(): Promise<boolean> {
    const emptyMessage = await this.controller.isElementVisible('text=No customers found');
    return emptyMessage || (await this.getCustomerCount()) === 0;
  }

  /**
   * Click on a customer row
   */
  async clickCustomer(customerName: string): Promise<void> {
    await this.controller.click(`table tbody tr:has-text("${customerName}")`);
  }

  /**
   * Click on a customer by index
   */
  async clickCustomerByIndex(index: number): Promise<void> {
    await this.controller.click(`table tbody tr:nth-child(${index + 1})`);
  }

  /**
   * Find customer by name
   */
  async findCustomer(customerName: string): Promise<CustomerRow | null> {
    const customers = await this.getCustomers();
    return customers.find(c => c.name.includes(customerName)) || null;
  }

  /**
   * Verify customer exists in table
   */
  async customerExists(customerName: string): Promise<boolean> {
    await this.search(customerName);
    await this.controller.wait(500);
    const customer = await this.findCustomer(customerName);
    return customer !== null;
  }

  /**
   * Get available currencies from form
   */
  async getAvailableCurrencies(): Promise<string[]> {
    await this.clickNewCustomer();
    
    await this.controller.click(SELECTORS.customers.dialog.currency);
    
    const options: string[] = [];
    const optionCount = await this.controller.getElementCount('[role="option"]');
    
    for (let i = 0; i < optionCount; i++) {
      const text = await this.controller.getText(`[role="option"]:nth-child(${i + 1})`);
      options.push(text);
    }
    
    await this.cancelCustomerForm();
    
    return options;
  }

  /**
   * Get available credit ratings from form
   */
  async getAvailableCreditRatings(): Promise<string[]> {
    await this.clickNewCustomer();
    
    await this.controller.click(SELECTORS.customers.dialog.creditRating);
    
    const options: string[] = [];
    const optionCount = await this.controller.getElementCount('[role="option"]');
    
    for (let i = 0; i < optionCount; i++) {
      const text = await this.controller.getText(`[role="option"]:nth-child(${i + 1})`);
      options.push(text);
    }
    
    await this.cancelCustomerForm();
    
    return options;
  }
}

export default CustomersPage;
