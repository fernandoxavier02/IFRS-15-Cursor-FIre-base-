import { PlaywrightController } from '../browser/playwright-controller.js';
import { appConfig } from '../config/app-config.js';
import { FirestoreClient } from '../data/firestore-client.js';
import { TestDataGenerator } from '../data/test-data-generator.js';
import { PageFactory } from '../pages/index.js';
import { ActionPlanner, type ActionResult, type TestAction } from './action-planner.js';
import { ResultValidator, type ValidationResult, type ValidationRule } from './result-validator.js';
import { StateManager } from './state-manager.js';

export interface TestScenario {
  name: string;
  description?: string;
  preconditions?: string[];
  steps: TestAction[];
  validations: ValidationRule[];
  cleanup?: TestAction[];
  tags?: string[];
}

export interface ScenarioResult {
  scenario: TestScenario;
  success: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  stepResults: ActionResult[];
  validationResults: ValidationResult[];
  cleanupResults?: ActionResult[];
  error?: string;
  screenshots: Buffer[];
}

export interface TestRunSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  results: ScenarioResult[];
}

export class TestOrchestrator {
  private controller: PlaywrightController;
  private stateManager: StateManager;
  private actionPlanner: ActionPlanner;
  private resultValidator: ResultValidator;
  private firestoreClient: FirestoreClient;
  private dataGenerator: TestDataGenerator;
  private pageFactory: PageFactory;
  
  private isInitialized: boolean = false;
  private scenarioResults: ScenarioResult[] = [];

  constructor() {
    this.controller = new PlaywrightController();
    this.firestoreClient = new FirestoreClient();
    this.stateManager = new StateManager(this.controller, this.firestoreClient);
    this.actionPlanner = new ActionPlanner(this.controller, this.stateManager);
    this.resultValidator = new ResultValidator(this.controller, this.stateManager, this.firestoreClient);
    this.dataGenerator = new TestDataGenerator();
    this.pageFactory = new PageFactory(this.controller);
  }

  /**
   * Initialize the orchestrator
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Initialize browser
    await this.controller.init();

    // Initialize Firestore (optional)
    try {
      await this.firestoreClient.init();
    } catch (error) {
      console.warn('Firestore initialization failed (validation features will be limited):', error);
    }

    this.isInitialized = true;
  }

  /**
   * Ensure orchestrator is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized. Call init() first.');
    }
  }

  /**
   * Check preconditions for a scenario
   */
  private async checkPreconditions(preconditions: string[]): Promise<{
    met: boolean;
    unmet: string[];
  }> {
    const unmet: string[] = [];

    for (const precondition of preconditions) {
      if (!this.stateManager.checkPrecondition(precondition)) {
        unmet.push(precondition);
      }
    }

    return {
      met: unmet.length === 0,
      unmet,
    };
  }

  /**
   * Setup authentication if needed
   */
  async authenticate(email?: string, password?: string): Promise<boolean> {
    this.ensureInitialized();

    // Check if already authenticated
    if (this.stateManager.getState().isAuthenticated) {
      // Verify authentication is still valid by checking current URL
      const currentUrl = this.controller.getCurrentUrl();
      // If we're on login page, we're not actually authenticated
      if (!currentUrl.includes('/login')) {
        return true; // Already authenticated and session is valid
      } else {
        // On login page but marked as authenticated - clear state
        this.stateManager.clearAuthentication();
      }
    }

    const credentials = {
      email: email || appConfig.testAdminEmail,
      password: password || appConfig.testAdminPassword,
    };

    const loginPage = this.pageFactory.login();
    await loginPage.goto();

    const result = await loginPage.loginAndWaitForDashboard(credentials);

    if (result.success) {
      // Get user info from the app (simplified - in production would need API call)
      this.stateManager.setAuthenticated({
        email: credentials.email,
        tenantId: 'default', // Would need to get from actual user data
        role: 'admin',
      });
    }

    return result.success;
  }

  /**
   * Run a single test scenario
   */
  async runScenario(scenario: TestScenario): Promise<ScenarioResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const screenshots: Buffer[] = [];
    let success = true;
    let error: string | undefined;

    // Set current scenario in state
    this.stateManager.setCurrentScenario(scenario.name);

    // Check preconditions
    if (scenario.preconditions && scenario.preconditions.length > 0) {
      const { met, unmet } = await this.checkPreconditions(scenario.preconditions);
      
      if (!met) {
        // Try to satisfy preconditions
        for (const precondition of unmet) {
          if (precondition === 'authenticated' && !this.stateManager.getState().isAuthenticated) {
            const authSuccess = await this.authenticate();
            if (!authSuccess) {
              return {
                scenario,
                success: false,
                startTime,
                endTime: Date.now(),
                duration: Date.now() - startTime,
                stepResults: [],
                validationResults: [],
                error: 'Failed to authenticate as required by preconditions',
                screenshots,
              };
            }
          }
          // Could add more precondition handling here
        }
      }
    }

    // Execute steps
    const stepResults = await this.actionPlanner.executeActions(scenario.steps, {}, true);
    
    // If this was a login scenario and it succeeded, mark as authenticated
    if (scenario.name.toLowerCase().includes('login') && stepResults.every(s => s.success)) {
      const currentUrl = this.controller.getCurrentUrl();
      // If we're not on login page anymore, login was successful
      if (!currentUrl.includes('/login')) {
        this.stateManager.setAuthenticated({
          email: appConfig.testAdminEmail,
          tenantId: 'default',
          role: 'admin',
        });
      }
    }
    
    // Take screenshot after steps
    try {
      screenshots.push(await this.controller.screenshot({ fullPage: true }));
    } catch {
      // Ignore screenshot errors
    }

    // Check if steps succeeded
    const failedSteps = stepResults.filter(r => !r.success);
    if (failedSteps.length > 0) {
      success = false;
      error = `Step failed: ${failedSteps[0].error}`;
      
      // Add failed step screenshots
      for (const step of failedSteps) {
        if (step.screenshot) {
          screenshots.push(step.screenshot);
        }
      }
    }

    // Run validations
    const { results: validationResults } = await this.resultValidator.validateAll(scenario.validations);
    
    const failedValidations = validationResults.filter(r => !r.passed);
    if (failedValidations.length > 0) {
      success = false;
      if (!error) {
        error = `Validation failed: ${failedValidations[0].message}`;
      }
    }

    // Run cleanup if provided
    let cleanupResults: ActionResult[] | undefined;
    if (scenario.cleanup) {
      cleanupResults = await this.actionPlanner.executeActions(scenario.cleanup, {}, false);
    }

    const endTime = Date.now();

    const result: ScenarioResult = {
      scenario,
      success,
      startTime,
      endTime,
      duration: endTime - startTime,
      stepResults,
      validationResults,
      cleanupResults,
      error,
      screenshots,
    };

    this.scenarioResults.push(result);

    return result;
  }

  /**
   * Run multiple test scenarios
   */
  async runScenarios(scenarios: TestScenario[]): Promise<TestRunSummary> {
    this.ensureInitialized();

    const results: ScenarioResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const scenario of scenarios) {
      try {
        const result = await this.runScenario(scenario);
        results.push(result);

        if (result.success) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        // Scenario completely failed
        results.push({
          scenario,
          success: false,
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          stepResults: [],
          validationResults: [],
          error: `Scenario execution failed: ${error instanceof Error ? error.message : String(error)}`,
          screenshots: [],
        });
        failed++;
      }
    }

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalScenarios: scenarios.length,
      passed,
      failed,
      skipped,
      totalDuration,
      results,
    };
  }

  /**
   * Run a quick smoke test
   */
  async runSmokeTest(): Promise<TestRunSummary> {
    const smokeScenarios: TestScenario[] = [
      {
        name: 'Login Smoke Test',
        steps: this.actionPlanner.createLoginActions(
          appConfig.testAdminEmail,
          appConfig.testAdminPassword
        ),
        validations: [
          ResultValidator.createRules.urlIs('/'),
          ResultValidator.createRules.noConsoleErrors(),
        ],
      },
      {
        name: 'Dashboard Loads',
        preconditions: ['authenticated'],
        steps: [
          { type: 'navigate', target: '/' },
          { type: 'waitForElement', target: 'h1' },
        ],
        validations: [
          ResultValidator.createRules.elementVisible('h1'),
        ],
      },
      {
        name: 'Contracts Page Loads',
        preconditions: ['authenticated'],
        steps: [
          { type: 'navigate', target: '/contracts' },
          { type: 'waitForElement', target: '[data-testid="button-new-contract"]' },
        ],
        validations: [
          ResultValidator.createRules.elementVisible('[data-testid="button-new-contract"]'),
        ],
      },
      {
        name: 'Customers Page Loads',
        preconditions: ['authenticated'],
        steps: [
          { type: 'navigate', target: '/customers' },
          { type: 'waitForElement', target: '[data-testid="button-new-customer"]' },
        ],
        validations: [
          ResultValidator.createRules.elementVisible('[data-testid="button-new-customer"]'),
        ],
      },
    ];

    return await this.runScenarios(smokeScenarios);
  }

  /**
   * Get page factory
   */
  getPageFactory(): PageFactory {
    this.ensureInitialized();
    return this.pageFactory;
  }

  /**
   * Get data generator
   */
  getDataGenerator(): TestDataGenerator {
    return this.dataGenerator;
  }

  /**
   * Get state manager
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get browser controller
   */
  getBrowserController(): PlaywrightController {
    this.ensureInitialized();
    return this.controller;
  }

  /**
   * Get all scenario results
   */
  getResults(): ScenarioResult[] {
    return [...this.scenarioResults];
  }

  /**
   * Clear results
   */
  clearResults(): void {
    this.scenarioResults = [];
    this.actionPlanner.clearHistory();
    this.stateManager.reset();
    this.dataGenerator.reset();
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    if (this.controller) {
      await this.controller.close();
    }
    this.isInitialized = false;
  }
}

export default TestOrchestrator;
