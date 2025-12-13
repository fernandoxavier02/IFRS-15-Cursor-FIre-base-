import type { BrowserState, PlaywrightController } from '../browser/playwright-controller.js';
import type { FirestoreClient } from '../data/firestore-client.js';

export interface TestState {
  // Authentication
  isAuthenticated: boolean;
  currentUser?: {
    email: string;
    tenantId: string;
    role: string;
  };

  // Created entities during tests
  createdCustomers: Array<{ id: string; name: string }>;
  createdContracts: Array<{ id: string; contractNumber: string; customerId: string }>;
  
  // Browser state
  currentPage: string;
  browserState?: BrowserState;

  // Test execution
  currentScenario?: string;
  currentStep?: number;
  stepStartTime?: number;
  
  // Errors and issues
  errors: string[];
  warnings: string[];
}

export class StateManager {
  private state: TestState;
  private browserController: PlaywrightController;
  private firestoreClient?: FirestoreClient;
  private snapshots: TestState[] = [];

  constructor(browserController: PlaywrightController, firestoreClient?: FirestoreClient) {
    this.browserController = browserController;
    this.firestoreClient = firestoreClient;
    this.state = this.createInitialState();
  }

  /**
   * Create initial empty state
   */
  private createInitialState(): TestState {
    return {
      isAuthenticated: false,
      createdCustomers: [],
      createdContracts: [],
      currentPage: '',
      errors: [],
      warnings: [],
    };
  }

  /**
   * Get current state
   */
  getState(): TestState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  updateState(updates: Partial<TestState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };
  }

  /**
   * Set authentication state
   */
  setAuthenticated(user: { email: string; tenantId: string; role: string }): void {
    this.state.isAuthenticated = true;
    this.state.currentUser = user;
  }

  /**
   * Clear authentication state
   */
  clearAuthentication(): void {
    this.state.isAuthenticated = false;
    this.state.currentUser = undefined;
  }

  /**
   * Track created customer
   */
  trackCreatedCustomer(id: string, name: string): void {
    this.state.createdCustomers.push({ id, name });
  }

  /**
   * Track created contract
   */
  trackCreatedContract(id: string, contractNumber: string, customerId: string): void {
    this.state.createdContracts.push({ id, contractNumber, customerId });
  }

  /**
   * Get created customer by name
   */
  getCreatedCustomer(name: string): { id: string; name: string } | undefined {
    return this.state.createdCustomers.find(c => c.name === name);
  }

  /**
   * Get created contract by number
   */
  getCreatedContract(contractNumber: string): { id: string; contractNumber: string; customerId: string } | undefined {
    return this.state.createdContracts.find(c => c.contractNumber === contractNumber);
  }

  /**
   * Update current page
   */
  setCurrentPage(page: string): void {
    this.state.currentPage = page;
  }

  /**
   * Set current scenario
   */
  setCurrentScenario(scenario: string): void {
    this.state.currentScenario = scenario;
    this.state.currentStep = 0;
    this.state.stepStartTime = Date.now();
  }

  /**
   * Advance to next step
   */
  nextStep(): void {
    if (this.state.currentStep !== undefined) {
      this.state.currentStep++;
      this.state.stepStartTime = Date.now();
    }
  }

  /**
   * Add error
   */
  addError(error: string): void {
    this.state.errors.push(error);
  }

  /**
   * Add warning
   */
  addWarning(warning: string): void {
    this.state.warnings.push(warning);
  }

  /**
   * Clear errors and warnings
   */
  clearIssues(): void {
    this.state.errors = [];
    this.state.warnings = [];
  }

  /**
   * Take a snapshot of current state
   */
  takeSnapshot(): void {
    this.snapshots.push({ ...this.state });
  }

  /**
   * Restore from last snapshot
   */
  restoreLastSnapshot(): void {
    const snapshot = this.snapshots.pop();
    if (snapshot) {
      this.state = snapshot;
    }
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): TestState[] {
    return [...this.snapshots];
  }

  /**
   * Capture current browser state
   */
  async captureBrowserState(): Promise<void> {
    try {
      this.state.browserState = await this.browserController.getBrowserState();
      this.state.currentPage = this.browserController.getCurrentUrl();
    } catch (error) {
      this.addWarning(`Failed to capture browser state: ${error}`);
    }
  }

  /**
   * Sync state with Firestore
   */
  async syncWithFirestore(): Promise<void> {
    if (!this.firestoreClient?.isInitialized() || !this.state.currentUser?.tenantId) {
      return;
    }

    try {
      // Verify created entities exist in Firestore
      for (const customer of this.state.createdCustomers) {
        const exists = await this.firestoreClient.getCustomer(
          this.state.currentUser.tenantId,
          customer.id
        );
        if (!exists) {
          this.addWarning(`Customer ${customer.name} (${customer.id}) not found in Firestore`);
        }
      }

      for (const contract of this.state.createdContracts) {
        const exists = await this.firestoreClient.getContract(
          this.state.currentUser.tenantId,
          contract.id
        );
        if (!exists) {
          this.addWarning(`Contract ${contract.contractNumber} (${contract.id}) not found in Firestore`);
        }
      }
    } catch (error) {
      this.addWarning(`Failed to sync with Firestore: ${error}`);
    }
  }

  /**
   * Get summary of current state
   */
  getSummary(): {
    authenticated: boolean;
    customersCreated: number;
    contractsCreated: number;
    currentPage: string;
    errorCount: number;
    warningCount: number;
  } {
    return {
      authenticated: this.state.isAuthenticated,
      customersCreated: this.state.createdCustomers.length,
      contractsCreated: this.state.createdContracts.length,
      currentPage: this.state.currentPage,
      errorCount: this.state.errors.length,
      warningCount: this.state.warnings.length,
    };
  }

  /**
   * Reset state to initial
   */
  reset(): void {
    this.state = this.createInitialState();
    this.snapshots = [];
  }

  /**
   * Check if precondition is met
   */
  checkPrecondition(precondition: string): boolean {
    switch (precondition) {
      case 'authenticated':
        return this.state.isAuthenticated;
      case 'customer_exists':
        return this.state.createdCustomers.length > 0;
      case 'contract_exists':
        return this.state.createdContracts.length > 0;
      case 'contract_with_po_exists':
        // This would need additional tracking
        return this.state.createdContracts.length > 0;
      default:
        this.addWarning(`Unknown precondition: ${precondition}`);
        return false;
    }
  }

  /**
   * Export state as JSON
   */
  toJSON(): object {
    return {
      state: this.state,
      snapshots: this.snapshots,
      summary: this.getSummary(),
    };
  }
}

export default StateManager;
