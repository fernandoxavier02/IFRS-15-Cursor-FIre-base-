import { format } from 'date-fns';
import fs from 'fs/promises';
import path from 'path';
import type { ErrorAnalysis } from '../ai/error-analyzer.js';
import { testConfig } from '../config/test-config.js';
import type { ScenarioResult, TestRunSummary } from '../core/orchestrator.js';

export interface ReportOptions {
  format: 'html' | 'json' | 'markdown';
  includeScreenshots: boolean;
  includeConsoleLog: boolean;
  includeNetworkLog: boolean;
  outputPath?: string;
}

export interface ReportMetadata {
  title: string;
  runDate: string;
  duration: string;
  environment: string;
  browser: string;
}

export class ReportGenerator {
  private options: ReportOptions;
  private reportsDir: string;

  constructor(options?: Partial<ReportOptions>) {
    this.options = {
      format: options?.format || 'html',
      includeScreenshots: options?.includeScreenshots ?? true,
      includeConsoleLog: options?.includeConsoleLog ?? true,
      includeNetworkLog: options?.includeNetworkLog ?? false,
      outputPath: options?.outputPath,
    };
    this.reportsDir = testConfig.paths.reports;
  }

  /**
   * Generate a full test report
   */
  async generate(
    summary: TestRunSummary,
    aiAnalyses?: Map<string, ErrorAnalysis>
  ): Promise<string> {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const filename = `test-report_${timestamp}.${this.options.format === 'markdown' ? 'md' : this.options.format}`;
    const outputPath = this.options.outputPath || path.join(this.reportsDir, filename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const metadata: ReportMetadata = {
      title: 'IFRS 15 Test Agent Report',
      runDate: format(new Date(), 'PPpp'),
      duration: this.formatDuration(summary.totalDuration),
      environment: process.env.APP_ENV || 'production',
      browser: process.env.BROWSER || 'chromium',
    };

    let content: string;

    switch (this.options.format) {
      case 'html':
        content = this.generateHTML(summary, metadata, aiAnalyses);
        break;
      case 'markdown':
        content = this.generateMarkdown(summary, metadata, aiAnalyses);
        break;
      case 'json':
      default:
        content = this.generateJSON(summary, metadata, aiAnalyses);
        break;
    }

    await fs.writeFile(outputPath, content, 'utf-8');
    return outputPath;
  }

  /**
   * Generate HTML report
   */
  private generateHTML(
    summary: TestRunSummary,
    metadata: ReportMetadata,
    aiAnalyses?: Map<string, ErrorAnalysis>
  ): string {
    const passRate = Math.round((summary.passed / summary.totalScenarios) * 100);
    const statusColor = passRate === 100 ? '#4caf50' : passRate >= 80 ? '#ff9800' : '#f44336';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #1a237e, #3949ab); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .card h3 { color: #666; font-size: 14px; text-transform: uppercase; margin-bottom: 5px; }
    .card .value { font-size: 36px; font-weight: bold; }
    .card .value.pass { color: #4caf50; }
    .card .value.fail { color: #f44336; }
    .card .value.skip { color: #ff9800; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-top: 10px; }
    .progress-fill { height: 100%; background: ${statusColor}; width: ${passRate}%; }
    .scenarios { background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
    .scenarios h2 { padding: 20px; border-bottom: 1px solid #eee; }
    .scenario { border-bottom: 1px solid #eee; }
    .scenario:last-child { border-bottom: none; }
    .scenario-header { padding: 15px 20px; display: flex; align-items: center; cursor: pointer; }
    .scenario-header:hover { background: #f9f9f9; }
    .scenario-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; margin-right: 15px; font-size: 14px; }
    .scenario-icon.pass { background: #4caf50; }
    .scenario-icon.fail { background: #f44336; }
    .scenario-name { flex: 1; font-weight: 500; }
    .scenario-duration { color: #999; font-size: 14px; }
    .scenario-details { padding: 15px 20px; background: #f9f9f9; display: none; }
    .scenario.expanded .scenario-details { display: block; }
    .step { padding: 8px 0; display: flex; align-items: center; font-size: 14px; }
    .step-icon { margin-right: 10px; }
    .step-icon.pass { color: #4caf50; }
    .step-icon.fail { color: #f44336; }
    .validation { padding: 8px 0; display: flex; align-items: center; font-size: 14px; }
    .validation-icon { margin-right: 10px; }
    .error-box { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin-top: 10px; border-radius: 4px; }
    .error-box h4 { color: #c62828; margin-bottom: 10px; }
    .ai-analysis { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin-top: 10px; border-radius: 4px; }
    .ai-analysis h4 { color: #1565c0; margin-bottom: 10px; }
    .tags { display: flex; gap: 5px; margin-top: 5px; }
    .tag { background: #e0e0e0; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${metadata.title}</h1>
      <div class="meta">
        <div>Run Date: ${metadata.runDate}</div>
        <div>Environment: ${metadata.environment} | Browser: ${metadata.browser}</div>
      </div>
    </div>

    <div class="summary-cards">
      <div class="card">
        <h3>Total Tests</h3>
        <div class="value">${summary.totalScenarios}</div>
      </div>
      <div class="card">
        <h3>Passed</h3>
        <div class="value pass">${summary.passed}</div>
      </div>
      <div class="card">
        <h3>Failed</h3>
        <div class="value fail">${summary.failed}</div>
      </div>
      <div class="card">
        <h3>Pass Rate</h3>
        <div class="value">${passRate}%</div>
        <div class="progress-bar"><div class="progress-fill"></div></div>
      </div>
      <div class="card">
        <h3>Duration</h3>
        <div class="value">${metadata.duration}</div>
      </div>
    </div>

    <div class="scenarios">
      <h2>Test Scenarios (${summary.results.length})</h2>
      ${summary.results.map(result => this.generateScenarioHTML(result, aiAnalyses?.get(result.scenario.name))).join('')}
    </div>

    <div class="footer">
      Generated by IFRS 15 Test Agent
    </div>
  </div>

  <script>
    document.querySelectorAll('.scenario-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('expanded');
      });
    });
  </script>
</body>
</html>`;
  }

  /**
   * Generate HTML for a single scenario
   */
  private generateScenarioHTML(result: ScenarioResult, analysis?: ErrorAnalysis): string {
    const iconClass = result.success ? 'pass' : 'fail';
    const icon = result.success ? '✓' : '✗';

    return `
      <div class="scenario ${result.success ? '' : 'expanded'}">
        <div class="scenario-header">
          <div class="scenario-icon ${iconClass}">${icon}</div>
          <div class="scenario-name">
            ${result.scenario.name}
            ${result.scenario.tags ? `<div class="tags">${result.scenario.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
          </div>
          <div class="scenario-duration">${result.duration}ms</div>
        </div>
        <div class="scenario-details">
          <h4>Steps (${result.stepResults.length})</h4>
          ${result.stepResults.map((step, i) => `
            <div class="step">
              <span class="step-icon ${step.success ? 'pass' : 'fail'}">${step.success ? '✓' : '✗'}</span>
              ${i + 1}. ${step.action.type}${step.action.target ? ` → ${step.action.target}` : ''} (${step.duration}ms)
            </div>
          `).join('')}
          
          <h4 style="margin-top: 15px;">Validations (${result.validationResults.length})</h4>
          ${result.validationResults.map(v => `
            <div class="validation">
              <span class="validation-icon ${v.passed ? 'pass' : 'fail'}">${v.passed ? '✓' : '✗'}</span>
              [${v.rule.type}] ${v.message}
            </div>
          `).join('')}
          
          ${result.error ? `
            <div class="error-box">
              <h4>Error</h4>
              <p>${result.error}</p>
            </div>
          ` : ''}
          
          ${analysis ? `
            <div class="ai-analysis">
              <h4>🤖 AI Analysis (${Math.round(analysis.confidence * 100)}% confidence)</h4>
              <p><strong>Summary:</strong> ${analysis.summary}</p>
              <p><strong>Root Cause:</strong> ${analysis.rootCause}</p>
              <p><strong>Suggested Fix:</strong> ${analysis.suggestedFix}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(
    summary: TestRunSummary,
    metadata: ReportMetadata,
    aiAnalyses?: Map<string, ErrorAnalysis>
  ): string {
    const passRate = Math.round((summary.passed / summary.totalScenarios) * 100);

    let md = `# ${metadata.title}

**Run Date:** ${metadata.runDate}  
**Duration:** ${metadata.duration}  
**Environment:** ${metadata.environment}  
**Browser:** ${metadata.browser}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${summary.totalScenarios} |
| Passed | ${summary.passed} |
| Failed | ${summary.failed} |
| Skipped | ${summary.skipped} |
| Pass Rate | ${passRate}% |

## Test Scenarios

`;

    for (const result of summary.results) {
      const icon = result.success ? '✅' : '❌';
      const analysis = aiAnalyses?.get(result.scenario.name);

      md += `### ${icon} ${result.scenario.name}

**Duration:** ${result.duration}ms  
**Tags:** ${result.scenario.tags?.join(', ') || 'none'}

#### Steps

`;

      for (let i = 0; i < result.stepResults.length; i++) {
        const step = result.stepResults[i];
        const stepIcon = step.success ? '✓' : '✗';
        md += `${i + 1}. ${stepIcon} ${step.action.type}${step.action.target ? ` → \`${step.action.target}\`` : ''} (${step.duration}ms)\n`;
      }

      md += `\n#### Validations\n\n`;

      for (const v of result.validationResults) {
        const vIcon = v.passed ? '✓' : '✗';
        md += `- ${vIcon} [${v.rule.type}] ${v.message}\n`;
      }

      if (result.error) {
        md += `\n> ⚠️ **Error:** ${result.error}\n`;
      }

      if (analysis) {
        md += `\n#### 🤖 AI Analysis (${Math.round(analysis.confidence * 100)}% confidence)

- **Summary:** ${analysis.summary}
- **Root Cause:** ${analysis.rootCause}
- **Suggested Fix:** ${analysis.suggestedFix}
`;
      }

      md += '\n---\n\n';
    }

    md += `\n*Generated by IFRS 15 Test Agent*`;

    return md;
  }

  /**
   * Generate JSON report
   */
  private generateJSON(
    summary: TestRunSummary,
    metadata: ReportMetadata,
    aiAnalyses?: Map<string, ErrorAnalysis>
  ): string {
    const report = {
      metadata,
      summary: {
        totalScenarios: summary.totalScenarios,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        passRate: Math.round((summary.passed / summary.totalScenarios) * 100),
        totalDuration: summary.totalDuration,
      },
      scenarios: summary.results.map(result => ({
        name: result.scenario.name,
        description: result.scenario.description,
        tags: result.scenario.tags,
        success: result.success,
        duration: result.duration,
        error: result.error,
        steps: result.stepResults.map(s => ({
          action: s.action.type,
          target: s.action.target,
          value: s.action.value,
          success: s.success,
          duration: s.duration,
          error: s.error,
        })),
        validations: result.validationResults.map(v => ({
          type: v.rule.type,
          passed: v.passed,
          message: v.message,
          expected: v.expected,
          actual: v.actual,
        })),
        aiAnalysis: aiAnalyses?.get(result.scenario.name),
      })),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

export default ReportGenerator;
