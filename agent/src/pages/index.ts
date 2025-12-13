export { BasePage, type PageValidation } from './base-page.js';
export { ContractsPage, type ContractFormData, type ContractRow, type ContractStatus } from './contracts-page.js';
export { CustomersPage, type CustomerFormData, type CustomerRow } from './customers-page.js';
export { DashboardPage, type DashboardMetrics, type RecentContract } from './dashboard-page.js';
export { IFRS15Page, type IFRS15Step, type PerformanceObligation, type StepStatus } from './ifrs15-page.js';
export { LoginPage, type LoginCredentials, type LoginResult } from './login-page.js';

// Page factory for easy instantiation
import { PlaywrightController } from '../browser/playwright-controller.js';
import { ContractsPage } from './contracts-page.js';
import { CustomersPage } from './customers-page.js';
import { DashboardPage } from './dashboard-page.js';
import { IFRS15Page } from './ifrs15-page.js';
import { LoginPage } from './login-page.js';

export class PageFactory {
  private controller: PlaywrightController;

  constructor(controller: PlaywrightController) {
    this.controller = controller;
  }

  login(): LoginPage {
    return new LoginPage(this.controller);
  }

  dashboard(): DashboardPage {
    return new DashboardPage(this.controller);
  }

  contracts(): ContractsPage {
    return new ContractsPage(this.controller);
  }

  customers(): CustomersPage {
    return new CustomersPage(this.controller);
  }

  ifrs15(): IFRS15Page {
    return new IFRS15Page(this.controller);
  }
}

export default PageFactory;
