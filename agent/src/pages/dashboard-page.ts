import { PlaywrightController } from '../browser/playwright-controller.js';
import { SELECTORS } from '../config/selectors.js';
import { BasePage } from './base-page.js';

export interface DashboardMetrics {
  totalContracts?: number;
  totalRevenue?: string;
  recognizedRevenue?: string;
  deferredRevenue?: string;
}

export interface RecentContract {
  contractNumber: string;
  customerName: string;
  totalValue: string;
  status: string;
}

export class DashboardPage extends BasePage {
  readonly route = '/';
  readonly expectedElements = [
    SELECTORS.layout.sidebar,
    SELECTORS.layout.header,
  ];

  constructor(controller: PlaywrightController) {
    super(controller);
  }

  /**
   * Wait for dashboard data to load
   */
  async waitForDataLoad(): Promise<void> {
    await this.waitForLoadingComplete();
    await this.controller.waitForNetworkIdle();
  }

  /**
   * Get dashboard metrics
   */
  async getMetrics(): Promise<DashboardMetrics> {
    const metrics: DashboardMetrics = {};

    try {
      // Try to get total contracts
      const contractsText = await this.controller.getText('.card:has-text("Total Contracts") .text-2xl, [data-testid="metric-total-contracts"]');
      metrics.totalContracts = parseInt(contractsText.replace(/[^0-9]/g, ''), 10);
    } catch {
      // Metric card might not exist
    }

    try {
      // Try to get total revenue
      const revenueText = await this.controller.getText('.card:has-text("Total Revenue") .text-2xl');
      metrics.totalRevenue = revenueText;
    } catch {
      // Metric card might not exist
    }

    try {
      // Try to get recognized revenue
      const recognizedText = await this.controller.getText('.card:has-text("Recognized") .text-2xl');
      metrics.recognizedRevenue = recognizedText;
    } catch {
      // Metric card might not exist
    }

    try {
      // Try to get deferred revenue
      const deferredText = await this.controller.getText('.card:has-text("Deferred") .text-2xl');
      metrics.deferredRevenue = deferredText;
    } catch {
      // Metric card might not exist
    }

    return metrics;
  }

  /**
   * Get recent contracts from dashboard
   */
  async getRecentContracts(): Promise<RecentContract[]> {
    const contracts: RecentContract[] = [];
    
    try {
      const contractRows = await this.controller.getElementCount('.card:has-text("Recent Contracts") [class*="contract-row"], .card:has-text("Recent Contracts") .flex.items-center.gap-4.p-4');
      
      for (let i = 0; i < contractRows; i++) {
        const rowSelector = `.card:has-text("Recent Contracts") .flex.items-center.gap-4.p-4:nth-child(${i + 1})`;
        
        try {
          const text = await this.controller.getText(rowSelector);
          // Parse the text - this is simplified and might need adjustment
          contracts.push({
            contractNumber: text.split('\n')[0] || '',
            customerName: text.split('\n')[1] || '',
            totalValue: text.split('\n')[2] || '',
            status: text.split('\n')[3] || '',
          });
        } catch {
          // Row might not be accessible
        }
      }
    } catch {
      // Recent contracts section might not exist
    }

    return contracts;
  }

  /**
   * Check if revenue chart is visible
   */
  async isRevenueChartVisible(): Promise<boolean> {
    return await this.controller.isElementVisible('.recharts-wrapper, [data-testid="chart-revenue-trend"]');
  }

  /**
   * Check if license usage card is visible
   */
  async isLicenseUsageVisible(): Promise<boolean> {
    return await this.controller.isElementVisible('.card:has-text("License Usage")');
  }

  /**
   * Check if compliance alerts are visible
   */
  async isComplianceAlertsVisible(): Promise<boolean> {
    return await this.controller.isElementVisible('.card:has-text("Compliance Alerts")');
  }

  /**
   * Navigate to contracts via sidebar
   */
  async goToContracts(): Promise<void> {
    await this.navigateViaSidebar('contracts');
  }

  /**
   * Navigate to customers via sidebar
   */
  async goToCustomers(): Promise<void> {
    await this.navigateViaSidebar('customers');
  }

  /**
   * Navigate to IFRS 15 Engine via sidebar
   */
  async goToIFRS15Engine(): Promise<void> {
    await this.navigateViaSidebar('ifrs15Engine');
  }

  /**
   * Toggle sidebar
   */
  async toggleSidebar(): Promise<void> {
    await this.controller.click(SELECTORS.layout.sidebarToggle);
  }

  /**
   * Check if sidebar is expanded
   */
  async isSidebarExpanded(): Promise<boolean> {
    // Check sidebar width or data attribute
    const sidebar = await this.controller.getElementInfo(SELECTORS.layout.sidebar);
    if (sidebar?.boundingBox) {
      return sidebar.boundingBox.width > 100;
    }
    return true;
  }

  /**
   * Change theme
   */
  async toggleTheme(): Promise<void> {
    await this.controller.click(SELECTORS.layout.themeToggle);
  }

  /**
   * Get current theme
   */
  async getCurrentTheme(): Promise<'light' | 'dark'> {
    const html = await this.controller.evaluate(() => 
      document.documentElement.classList.contains('dark')
    );
    return html ? 'dark' : 'light';
  }

  /**
   * Click on a recent contract to view details
   */
  async clickRecentContract(index: number = 0): Promise<void> {
    const selector = `.card:has-text("Recent Contracts") .flex.items-center.gap-4.p-4:nth-child(${index + 1})`;
    await this.controller.click(selector);
  }

  /**
   * Verify dashboard displays expected data
   */
  async verifyDashboardLoaded(): Promise<{
    metricsLoaded: boolean;
    chartLoaded: boolean;
    recentContractsLoaded: boolean;
  }> {
    await this.waitForDataLoad();

    const metrics = await this.getMetrics();
    const chartVisible = await this.isRevenueChartVisible();
    const contracts = await this.getRecentContracts();

    return {
      metricsLoaded: metrics.totalContracts !== undefined || metrics.totalRevenue !== undefined,
      chartLoaded: chartVisible,
      recentContractsLoaded: contracts.length > 0 || await this.controller.isElementVisible('.card:has-text("No contracts")'),
    };
  }
}

export default DashboardPage;
