import type { ConsoleMessage } from '../browser/console-capture.js';
import type { ApiCall } from '../browser/network-monitor.js';
import type { ActionResult } from '../core/action-planner.js';
import type { ValidationResult } from '../core/result-validator.js';
import { LLMEngine } from './llm-engine.js';

export interface ErrorAnalysis {
  summary: string;
  rootCause: string;
  category: 'ui' | 'api' | 'validation' | 'timeout' | 'auth' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestedFix: string;
  relatedElements?: string[];
  confidence: number; // 0-1
}

export interface TestFailureContext {
  scenarioName: string;
  failedStep?: ActionResult;
  failedValidation?: ValidationResult;
  consoleErrors: ConsoleMessage[];
  failedApiCalls: ApiCall[];
  currentUrl: string;
  pageTitle: string;
}

export class ErrorAnalyzer {
  private llm: LLMEngine;

  constructor(llm?: LLMEngine) {
    this.llm = llm || new LLMEngine();
  }

  /**
   * Check if error analysis is available (AI configured)
   */
  isAvailable(): boolean {
    return this.llm.isAvailable();
  }

  /**
   * Analyze a test failure
   */
  async analyzeFailure(context: TestFailureContext): Promise<ErrorAnalysis> {
    if (!this.isAvailable()) {
      return this.createFallbackAnalysis(context);
    }

    const prompt = this.buildAnalysisPrompt(context);
    
    try {
      const response = await this.llm.complete(prompt, this.getSystemPrompt());
      return this.parseAnalysisResponse(response, context);
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.createFallbackAnalysis(context);
    }
  }

  /**
   * Analyze console errors
   */
  async analyzeConsoleErrors(errors: ConsoleMessage[]): Promise<string[]> {
    if (!this.isAvailable() || errors.length === 0) {
      return [];
    }

    const prompt = `Analyze these JavaScript console errors and provide a brief explanation for each:

${errors.map((e, i) => `${i + 1}. ${e.text}${e.stack ? `\n   Stack: ${e.stack.substring(0, 200)}...` : ''}`).join('\n')}

Provide insights in JSON array format: ["explanation1", "explanation2", ...]`;

    try {
      const response = await this.llm.complete(prompt, 'You are a JavaScript debugging expert.');
      const insights = JSON.parse(response);
      return Array.isArray(insights) ? insights : [];
    } catch {
      return [];
    }
  }

  /**
   * Suggest test improvements
   */
  async suggestTestImprovements(
    scenarioName: string,
    stepResults: ActionResult[],
    validationResults: ValidationResult[]
  ): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    const failedSteps = stepResults.filter(s => !s.success);
    const failedValidations = validationResults.filter(v => !v.passed);

    if (failedSteps.length === 0 && failedValidations.length === 0) {
      return ['All tests passed - no improvements needed'];
    }

    const prompt = `Analyze this test scenario and suggest improvements:

Scenario: ${scenarioName}

Failed Steps (${failedSteps.length}):
${failedSteps.map(s => `- ${s.action.type} ${s.action.target || ''}: ${s.error}`).join('\n')}

Failed Validations (${failedValidations.length}):
${failedValidations.map(v => `- ${v.rule.type}: ${v.message}`).join('\n')}

Suggest specific improvements in JSON array format: ["suggestion1", "suggestion2", ...]`;

    try {
      const response = await this.llm.complete(prompt, 'You are a test automation expert.');
      const suggestions = JSON.parse(response);
      return Array.isArray(suggestions) ? suggestions : [];
    } catch {
      return ['Review failed selectors', 'Add explicit waits', 'Check API endpoints'];
    }
  }

  /**
   * Generate human-readable test report summary
   */
  async generateReportSummary(
    totalTests: number,
    passed: number,
    failed: number,
    duration: number,
    criticalFailures: string[]
  ): Promise<string> {
    if (!this.isAvailable()) {
      return this.createFallbackSummary(totalTests, passed, failed, duration);
    }

    const prompt = `Generate a concise executive summary for this test run:

Total Tests: ${totalTests}
Passed: ${passed}
Failed: ${failed}
Duration: ${Math.round(duration / 1000)}s
Pass Rate: ${Math.round((passed / totalTests) * 100)}%

Critical Failures:
${criticalFailures.length > 0 ? criticalFailures.join('\n') : 'None'}

Write 2-3 sentences summarizing the results and any concerns.`;

    try {
      return await this.llm.complete(prompt, 'You are a QA manager writing a test report summary.');
    } catch {
      return this.createFallbackSummary(totalTests, passed, failed, duration);
    }
  }

  /**
   * Build analysis prompt from context
   */
  private buildAnalysisPrompt(context: TestFailureContext): string {
    let prompt = `Analyze this test failure:

Scenario: ${context.scenarioName}
Current URL: ${context.currentUrl}
Page Title: ${context.pageTitle}

`;

    if (context.failedStep) {
      prompt += `Failed Step:
- Action: ${context.failedStep.action.type}
- Target: ${context.failedStep.action.target || 'N/A'}
- Value: ${context.failedStep.action.value || 'N/A'}
- Error: ${context.failedStep.error}
- Duration: ${context.failedStep.duration}ms

`;
    }

    if (context.failedValidation) {
      prompt += `Failed Validation:
- Type: ${context.failedValidation.rule.type}
- Expected: ${JSON.stringify(context.failedValidation.rule.expected)}
- Actual: ${JSON.stringify(context.failedValidation.actual)}
- Message: ${context.failedValidation.message}

`;
    }

    if (context.consoleErrors.length > 0) {
      prompt += `Console Errors (${context.consoleErrors.length}):
${context.consoleErrors.slice(0, 5).map(e => `- ${e.text}`).join('\n')}

`;
    }

    if (context.failedApiCalls.length > 0) {
      prompt += `Failed API Calls (${context.failedApiCalls.length}):
${context.failedApiCalls.slice(0, 5).map(c => 
  `- ${c.request.method} ${c.request.url}: ${c.response?.status || 'failed'}`
).join('\n')}

`;
    }

    prompt += `Provide analysis in the following JSON format:
{
  "summary": "brief one-line summary",
  "rootCause": "likely root cause",
  "category": "ui|api|validation|timeout|auth|unknown",
  "severity": "critical|high|medium|low",
  "suggestedFix": "specific fix suggestion",
  "relatedElements": ["element1", "element2"],
  "confidence": 0.8
}`;

    return prompt;
  }

  /**
   * Get system prompt for error analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert test automation engineer specializing in web application testing.
Analyze test failures and provide actionable insights.
Always respond with valid JSON matching the requested format.
Focus on the most likely root cause and practical solutions.
Consider common issues like:
- Element not found/timing issues
- API failures or slow responses
- Authentication/session problems
- Invalid test data
- Application bugs vs test issues`;
  }

  /**
   * Parse AI response into ErrorAnalysis
   */
  private parseAnalysisResponse(response: string, context: TestFailureContext): ErrorAnalysis {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Analysis completed',
          rootCause: parsed.rootCause || 'Unknown',
          category: parsed.category || 'unknown',
          severity: parsed.severity || 'medium',
          suggestedFix: parsed.suggestedFix || 'Review test logs',
          relatedElements: parsed.relatedElements || [],
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch {
      // Fall through to fallback
    }

    return this.createFallbackAnalysis(context);
  }

  /**
   * Create fallback analysis when AI is not available
   */
  private createFallbackAnalysis(context: TestFailureContext): ErrorAnalysis {
    let category: ErrorAnalysis['category'] = 'unknown';
    let severity: ErrorAnalysis['severity'] = 'medium';
    let rootCause = 'Unable to determine root cause';
    let suggestedFix = 'Review test logs and screenshots';

    if (context.failedStep) {
      const error = context.failedStep.error || '';
      
      if (error.includes('timeout') || error.includes('Timeout')) {
        category = 'timeout';
        rootCause = 'Element or navigation timeout';
        suggestedFix = 'Increase timeout or add explicit waits';
      } else if (error.includes('not found') || error.includes('No element')) {
        category = 'ui';
        rootCause = 'Element not found on page';
        suggestedFix = 'Verify selector is correct and element exists';
      } else if (error.includes('auth') || error.includes('401') || error.includes('403')) {
        category = 'auth';
        severity = 'critical';
        rootCause = 'Authentication or authorization failure';
        suggestedFix = 'Check credentials and session state';
      }
    }

    if (context.failedApiCalls.length > 0) {
      category = 'api';
      severity = 'high';
      const firstFail = context.failedApiCalls[0];
      rootCause = `API call failed: ${firstFail.request.method} ${firstFail.request.url}`;
      suggestedFix = 'Check API endpoint and request data';
    }

    if (context.consoleErrors.length > 0) {
      severity = context.consoleErrors.length > 3 ? 'high' : 'medium';
    }

    return {
      summary: `Test failed: ${context.failedStep?.error || context.failedValidation?.message || 'Unknown error'}`,
      rootCause,
      category,
      severity,
      suggestedFix,
      relatedElements: context.failedStep?.action.target ? [context.failedStep.action.target] : [],
      confidence: 0.3,
    };
  }

  /**
   * Create fallback summary
   */
  private createFallbackSummary(
    totalTests: number,
    passed: number,
    failed: number,
    duration: number
  ): string {
    const passRate = Math.round((passed / totalTests) * 100);
    const durationSec = Math.round(duration / 1000);

    if (failed === 0) {
      return `All ${totalTests} tests passed successfully in ${durationSec}s. The application appears to be functioning correctly.`;
    }

    return `Test run completed with ${passed}/${totalTests} tests passing (${passRate}% pass rate) in ${durationSec}s. ${failed} test(s) failed and require investigation.`;
  }
}

export default ErrorAnalyzer;
