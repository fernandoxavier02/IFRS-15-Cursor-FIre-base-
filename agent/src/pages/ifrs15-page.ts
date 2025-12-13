import { PlaywrightController } from '../browser/playwright-controller.js';
import { SELECTORS } from '../config/selectors.js';
import { BasePage } from './base-page.js';

export type StepStatus = 'completed' | 'in_progress' | 'pending';

export interface IFRS15Step {
  step: number;
  title: string;
  status: StepStatus;
  details?: string;
}

export interface PerformanceObligation {
  description: string;
  recognitionMethod: 'over_time' | 'point_in_time';
  allocatedPrice: string;
  percentComplete: number;
  recognizedAmount: string;
  deferredAmount: string;
  isSatisfied: boolean;
}

export class IFRS15Page extends BasePage {
  readonly route = '/ifrs15';
  readonly expectedElements = [
    'h1:has-text("IFRS 15")',
  ];

  constructor(controller: PlaywrightController) {
    super(controller);
  }

  /**
   * Select a contract
   */
  async selectContract(contractIdentifier: string): Promise<void> {
    await this.controller.click(SELECTORS.ifrs15.contractSelect);
    await this.controller.click(`[role="option"]:has-text("${contractIdentifier}")`);
    await this.controller.waitForNetworkIdle();
  }

  /**
   * Get selected contract
   */
  async getSelectedContract(): Promise<string | null> {
    try {
      return await this.controller.getText(SELECTORS.ifrs15.contractSelect);
    } catch {
      return null;
    }
  }

  /**
   * Run IFRS 15 engine
   */
  async runEngine(): Promise<void> {
    await this.controller.click(SELECTORS.ifrs15.runEngineButton);
    await this.controller.waitForNetworkIdle();
  }

  /**
   * Refresh data
   */
  async refresh(): Promise<void> {
    await this.controller.click(SELECTORS.ifrs15.refreshButton);
    await this.controller.waitForNetworkIdle();
  }

  /**
   * Get all 5 steps status
   */
  async getSteps(): Promise<IFRS15Step[]> {
    const steps: IFRS15Step[] = [];
    
    const stepTitles = [
      'Identify the Contract',
      'Identify Performance Obligations',
      'Determine Transaction Price',
      'Allocate Transaction Price',
      'Recognize Revenue',
    ];

    for (let i = 1; i <= 5; i++) {
      const stepSelector = `[data-testid="step-${i}"], .accordion-item:nth-child(${i})`;
      
      try {
        const text = await this.controller.getText(stepSelector);
        const hasCheckmark = await this.controller.isElementVisible(`${stepSelector} svg[class*="check"], ${stepSelector} .text-chart-2`);
        const hasClock = await this.controller.isElementVisible(`${stepSelector} svg[class*="clock"], ${stepSelector} .text-chart-4`);
        
        let status: StepStatus = 'pending';
        if (hasCheckmark) {
          status = 'completed';
        } else if (hasClock) {
          status = 'in_progress';
        }

        steps.push({
          step: i,
          title: stepTitles[i - 1],
          status,
          details: text,
        });
      } catch {
        steps.push({
          step: i,
          title: stepTitles[i - 1],
          status: 'pending',
        });
      }
    }

    return steps;
  }

  /**
   * Get step status
   */
  async getStepStatus(stepNumber: number): Promise<StepStatus> {
    const steps = await this.getSteps();
    const step = steps.find(s => s.step === stepNumber);
    return step?.status || 'pending';
  }

  /**
   * Check if all steps are completed
   */
  async areAllStepsCompleted(): Promise<boolean> {
    const steps = await this.getSteps();
    return steps.every(s => s.status === 'completed');
  }

  /**
   * Get completed steps count
   */
  async getCompletedStepsCount(): Promise<number> {
    const steps = await this.getSteps();
    return steps.filter(s => s.status === 'completed').length;
  }

  /**
   * Get performance obligations
   */
  async getPerformanceObligations(): Promise<PerformanceObligation[]> {
    const obligations: PerformanceObligation[] = [];
    
    const rowCount = await this.controller.getElementCount('table tbody tr');
    
    for (let i = 0; i < rowCount; i++) {
      const rowSelector = `table tbody tr:nth-child(${i + 1})`;
      
      try {
        const description = await this.controller.getText(`${rowSelector} td:nth-child(1)`);
        const recognitionText = await this.controller.getText(`${rowSelector} td:nth-child(2)`);
        const allocatedPrice = await this.controller.getText(`${rowSelector} td:nth-child(3)`);
        const progressText = await this.controller.getText(`${rowSelector} td:nth-child(4)`);
        const recognizedAmount = await this.controller.getText(`${rowSelector} td:nth-child(5)`);
        const deferredAmount = await this.controller.getText(`${rowSelector} td:nth-child(6)`);
        const statusText = await this.controller.getText(`${rowSelector} td:nth-child(7)`);

        obligations.push({
          description,
          recognitionMethod: recognitionText.includes('Over Time') ? 'over_time' : 'point_in_time',
          allocatedPrice,
          percentComplete: parseInt(progressText.replace('%', ''), 10) || 0,
          recognizedAmount,
          deferredAmount,
          isSatisfied: statusText.toLowerCase().includes('satisfied'),
        });
      } catch {
        // Row might not have expected structure
      }
    }

    return obligations;
  }

  /**
   * Get total recognized amount
   */
  async getTotalRecognizedAmount(): Promise<string> {
    const obligations = await this.getPerformanceObligations();
    const total = obligations.reduce((sum, o) => {
      const amount = parseFloat(o.recognizedAmount.replace(/[^0-9.-]/g, '')) || 0;
      return sum + amount;
    }, 0);
    return total.toLocaleString();
  }

  /**
   * Get total deferred amount
   */
  async getTotalDeferredAmount(): Promise<string> {
    const obligations = await this.getPerformanceObligations();
    const total = obligations.reduce((sum, o) => {
      const amount = parseFloat(o.deferredAmount.replace(/[^0-9.-]/g, '')) || 0;
      return sum + amount;
    }, 0);
    return total.toLocaleString();
  }

  /**
   * Run full IFRS 15 flow for a contract
   */
  async runFullFlow(contractIdentifier: string): Promise<{
    success: boolean;
    stepsCompleted: number;
    obligations: PerformanceObligation[];
    message?: string;
  }> {
    // Select contract
    await this.selectContract(contractIdentifier);
    await this.controller.wait(1000);

    // Run engine
    await this.runEngine();
    await this.controller.wait(2000);

    // Get results
    const stepsCompleted = await this.getCompletedStepsCount();
    const obligations = await this.getPerformanceObligations();
    const allCompleted = await this.areAllStepsCompleted();

    // Check for success toast
    let message: string | undefined;
    try {
      message = await this.waitForToast();
    } catch {
      // No toast
    }

    return {
      success: allCompleted,
      stepsCompleted,
      obligations,
      message,
    };
  }

  /**
   * Wait for engine to complete processing
   */
  async waitForEngineComplete(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.areAllStepsCompleted()) {
        return true;
      }
      await this.controller.wait(500);
    }

    return false;
  }

  /**
   * Expand step accordion
   */
  async expandStep(stepNumber: number): Promise<void> {
    const stepSelector = `[data-testid="step-${stepNumber}"], .accordion-item:nth-child(${stepNumber}) button`;
    await this.controller.click(stepSelector);
  }

  /**
   * Get contract list for dropdown
   */
  async getAvailableContracts(): Promise<string[]> {
    await this.controller.click(SELECTORS.ifrs15.contractSelect);
    
    const options: string[] = [];
    const optionCount = await this.controller.getElementCount('[role="option"]');
    
    for (let i = 0; i < optionCount; i++) {
      const text = await this.controller.getText(`[role="option"]:nth-child(${i + 1})`);
      options.push(text);
    }
    
    // Close dropdown
    await this.controller.press('Escape');
    
    return options;
  }
}

export default IFRS15Page;
