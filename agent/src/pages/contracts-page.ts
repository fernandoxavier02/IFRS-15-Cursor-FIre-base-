import { PlaywrightController } from '../browser/playwright-controller.js';
import { SELECTORS } from '../config/selectors.js';
import { BasePage } from './base-page.js';

export interface ContractFormData {
  customerId: string;
  contractNumber: string;
  title: string;
  startDate: string;
  endDate?: string;
  totalValue: string;
  currency: string;
  paymentTerms?: string;
}

export interface ContractRow {
  id: string;
  contractNumber: string;
  title: string;
  customerName: string;
  status: string;
  totalValue: string;
  currency: string;
}

export type ContractStatus = 'all' | 'draft' | 'active' | 'modified' | 'terminated' | 'expired';

export class ContractsPage extends BasePage {
  readonly route = '/contracts';
  readonly expectedElements = [
    SELECTORS.contracts.newButton,
    SELECTORS.contracts.searchInput,
  ];

  constructor(controller: PlaywrightController) {
    super(controller);
  }

  /**
   * Click new contract button
   */
  async clickNewContract(): Promise<void> {
    await this.controller.click(SELECTORS.contracts.newButton);
    await this.controller.waitForDialog();
  }

  /**
   * Search contracts
   */
  async search(query: string): Promise<void> {
    await this.controller.clearAndFill(SELECTORS.contracts.searchInput, query);
    await this.controller.wait(500); // Wait for debounce
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.controller.clearAndFill(SELECTORS.contracts.searchInput, '');
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: ContractStatus): Promise<void> {
    await this.controller.click(SELECTORS.contracts.statusFilter);
    await this.controller.click(`[role="option"]:has-text("${status === 'all' ? 'All' : status}")`);
    await this.controller.wait(500);
  }

  /**
   * Get current search value
   */
  async getSearchValue(): Promise<string> {
    return await this.controller.getInputValue(SELECTORS.contracts.searchInput);
  }

  /**
   * Fill contract form in dialog
   */
  async fillContractForm(data: ContractFormData): Promise<void> {
    const dialog = SELECTORS.contracts.dialog;

    // Select customer
    await this.controller.click(dialog.customer);
    await this.controller.click(`[role="option"][data-value="${data.customerId}"], [role="option"]:has-text("${data.customerId}")`);

    // Fill text fields
    await this.controller.fill(dialog.contractNumber, data.contractNumber);
    await this.controller.fill(dialog.title, data.title);
    await this.controller.fill(dialog.startDate, data.startDate);
    
    if (data.endDate) {
      await this.controller.fill(dialog.endDate, data.endDate);
    }
    
    await this.controller.fill(dialog.totalValue, data.totalValue);

    // Select currency
    await this.controller.click(dialog.currency);
    await this.controller.click(`[role="option"][data-value="${data.currency}"], [role="option"]:has-text("${data.currency}")`);

    if (data.paymentTerms) {
      await this.controller.fill(dialog.paymentTerms, data.paymentTerms);
    }
  }

  /**
   * Submit contract form
   */
  async submitContractForm(): Promise<void> {
    await this.controller.click(SELECTORS.contracts.dialog.submitButton);
  }

  /**
   * Cancel contract form
   */
  async cancelContractForm(): Promise<void> {
    await this.controller.click(SELECTORS.contracts.dialog.cancelButton);
    await this.controller.waitForElementHidden(SELECTORS.common.dialog);
  }

  /**
   * Create a new contract (full flow)
   */
  async createContract(data: ContractFormData): Promise<{
    success: boolean;
    message?: string;
  }> {
    await this.clickNewContract();
    await this.fillContractForm(data);
    await this.submitContractForm();

    // Wait for response
    await this.controller.wait(1000);

    // Check for success toast
    try {
      const toastText = await this.waitForToast('Contract created');
      return { success: true, message: toastText };
    } catch {
      // Check for error
      const error = await this.getErrorMessage();
      return { success: false, message: error || 'Failed to create contract' };
    }
  }

  /**
   * Get contracts from table
   */
  async getContracts(): Promise<ContractRow[]> {
    const contracts: ContractRow[] = [];
    
    const rowCount = await this.controller.getElementCount('table tbody tr');
    
    for (let i = 0; i < rowCount; i++) {
      const rowSelector = `table tbody tr:nth-child(${i + 1})`;
      
      try {
        const cells = await this.controller.getElementCount(`${rowSelector} td`);
        if (cells === 0) continue;

        const row: ContractRow = {
          id: '',
          contractNumber: '',
          title: '',
          customerName: '',
          status: '',
          totalValue: '',
          currency: '',
        };

        // Get contract number (first column)
        row.contractNumber = await this.controller.getText(`${rowSelector} td:nth-child(1)`);
        
        // Get title (second column)
        row.title = await this.controller.getText(`${rowSelector} td:nth-child(2)`);
        
        // Get customer name (third column)
        row.customerName = await this.controller.getText(`${rowSelector} td:nth-child(3)`);
        
        // Get status (fourth column)
        row.status = await this.controller.getText(`${rowSelector} td:nth-child(4)`);
        
        // Get total value (fifth column)
        const valueText = await this.controller.getText(`${rowSelector} td:nth-child(5)`);
        const [currency, ...valueParts] = valueText.trim().split(' ');
        row.currency = currency;
        row.totalValue = valueParts.join(' ');

        // Get ID from data attribute if available
        const dataTestId = await this.controller.getAttribute(rowSelector, 'data-testid');
        if (dataTestId) {
          row.id = dataTestId.replace('contract-row-', '');
        }

        contracts.push(row);
      } catch {
        // Row might not have expected structure
      }
    }

    return contracts;
  }

  /**
   * Get contract count
   */
  async getContractCount(): Promise<number> {
    return await this.controller.getElementCount('table tbody tr');
  }

  /**
   * Check if contracts table is empty
   */
  async isTableEmpty(): Promise<boolean> {
    const emptyMessage = await this.controller.isElementVisible('text=No contracts found');
    return emptyMessage || (await this.getContractCount()) === 0;
  }

  /**
   * Click on a contract row to view details
   */
  async clickContract(contractNumber: string): Promise<void> {
    await this.controller.click(`table tbody tr:has-text("${contractNumber}")`);
  }

  /**
   * Click on a contract by index
   */
  async clickContractByIndex(index: number): Promise<void> {
    await this.controller.click(`table tbody tr:nth-child(${index + 1})`);
  }

  /**
   * Find contract by number
   */
  async findContract(contractNumber: string): Promise<ContractRow | null> {
    const contracts = await this.getContracts();
    return contracts.find(c => c.contractNumber === contractNumber) || null;
  }

  /**
   * Verify contract exists in table
   */
  async contractExists(contractNumber: string): Promise<boolean> {
    await this.search(contractNumber);
    await this.controller.wait(500);
    const contract = await this.findContract(contractNumber);
    return contract !== null;
  }

  /**
   * Get available customers for dropdown
   */
  async getAvailableCustomers(): Promise<string[]> {
    await this.clickNewContract();
    
    await this.controller.click(SELECTORS.contracts.dialog.customer);
    
    const options: string[] = [];
    const optionCount = await this.controller.getElementCount('[role="option"]');
    
    for (let i = 0; i < optionCount; i++) {
      const text = await this.controller.getText(`[role="option"]:nth-child(${i + 1})`);
      options.push(text);
    }
    
    await this.cancelContractForm();
    
    return options;
  }
}

export default ContractsPage;
