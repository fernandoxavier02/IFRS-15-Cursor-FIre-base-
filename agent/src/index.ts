#!/usr/bin/env node

import { Command } from 'commander';
import { ErrorAnalyzer } from './ai/error-analyzer.js';
import { TestOrchestrator } from './core/orchestrator.js';
import { logger, testLogger } from './reporting/logger.js';
import { ReportGenerator } from './reporting/report-generator.js';
import { availableTags, getAllScenarios, getScenariosByTag, getSmokeScenarios } from './scenarios/index.js';

const program = new Command();

program
  .name('ifrs15-test-agent')
  .description('AI-powered testing agent for IFRS 15 Revenue Manager')
  .version('1.0.0');

// Run command
program
  .command('run')
  .description('Run test scenarios')
  .option('-s, --scenario <name>', 'Run specific scenario by name pattern')
  .option('-t, --tag <tag>', 'Run scenarios with specific tag')
  .option('--smoke', 'Run smoke tests only')
  .option('--all', 'Run all scenarios')
  .option('--headless', 'Run in headless mode', true)
  .option('--no-headless', 'Run with browser visible')
  .option('-r, --report <format>', 'Report format (html, json, markdown)', 'html')
  .option('--no-report', 'Skip report generation')
  .option('--ai-analysis', 'Enable AI analysis for failures', false)
  .action(async (options) => {
    const orchestrator = new TestOrchestrator();
    const errorAnalyzer = new ErrorAnalyzer();
    
    try {
      logger.info('═'.repeat(50));
      logger.info('IFRS 15 Test Agent');
      logger.info('═'.repeat(50));

      // Set headless mode from options
      if (options.headless === false) {
        process.env.HEADLESS = 'false';
      }

      await orchestrator.init();
      logger.info('Browser initialized');

      // Determine which scenarios to run
      let scenarios;
      if (options.scenario) {
        scenarios = getAllScenarios().filter(s => 
          s.name.toLowerCase().includes(options.scenario.toLowerCase())
        );
        logger.info(`Running scenarios matching: "${options.scenario}"`);
      } else if (options.tag) {
        scenarios = getScenariosByTag(options.tag);
        logger.info(`Running scenarios with tag: "${options.tag}"`);
      } else if (options.smoke) {
        scenarios = getSmokeScenarios();
        logger.info('Running smoke tests');
      } else if (options.all) {
        scenarios = getAllScenarios();
        logger.info('Running all scenarios');
      } else {
        scenarios = getSmokeScenarios();
        logger.info('Running smoke tests (default)');
      }

      if (scenarios.length === 0) {
        logger.warn('No scenarios found matching criteria');
        await orchestrator.shutdown();
        process.exit(0);
      }

      logger.info(`Found ${scenarios.length} scenario(s) to run`);
      logger.info('');

      // Run scenarios
      const startTime = Date.now();
      
      for (const scenario of scenarios) {
        testLogger.scenarioStart(scenario.name, scenario.tags);
        const result = await orchestrator.runScenario(scenario);
        testLogger.scenarioEnd(scenario.name, result.success, result.duration);

        // Log steps
        result.stepResults.forEach((step, i) => {
          testLogger.step(i + 1, step.action.type, step.action.target, step.success);
        });

        // Log validations
        result.validationResults.forEach(v => {
          testLogger.validation(v.rule.type, v.passed, v.message);
        });

        logger.info('');
      }

      const results = orchestrator.getResults();
      const summary = {
        totalScenarios: results.length,
        passed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        skipped: 0,
        totalDuration: Date.now() - startTime,
        results,
      };

      // AI Analysis for failures
      const aiAnalyses = new Map();
      if (options.aiAnalysis && errorAnalyzer.isAvailable()) {
        const failedResults = results.filter(r => !r.success);
        if (failedResults.length > 0) {
          logger.info('Running AI analysis on failures...');
          
          for (const result of failedResults) {
            const analysis = await errorAnalyzer.analyzeFailure({
              scenarioName: result.scenario.name,
              failedStep: result.stepResults.find(s => !s.success),
              failedValidation: result.validationResults.find(v => !v.passed),
              consoleErrors: orchestrator.getBrowserController().consoleCapture.getErrors(),
              failedApiCalls: orchestrator.getBrowserController().networkMonitor.getFailedApiCalls(),
              currentUrl: orchestrator.getBrowserController().getCurrentUrl(),
              pageTitle: await orchestrator.getBrowserController().getTitle(),
            });
            
            aiAnalyses.set(result.scenario.name, analysis);
            testLogger.aiAnalysis(analysis);
          }
        }
      }

      // Print summary
      testLogger.summary(
        summary.totalScenarios,
        summary.passed,
        summary.failed,
        summary.skipped,
        summary.totalDuration
      );

      // Generate report
      if (options.report !== false) {
        const reportGenerator = new ReportGenerator({
          format: options.report as 'html' | 'json' | 'markdown',
        });
        const reportPath = await reportGenerator.generate(summary, aiAnalyses);
        logger.info(`Report generated: ${reportPath}`);
      }

      await orchestrator.shutdown();
      process.exit(summary.failed > 0 ? 1 : 0);

    } catch (error) {
      logger.error('Test execution failed', { error: String(error) });
      await orchestrator.shutdown();
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List available test scenarios')
  .option('-t, --tag <tag>', 'Filter by tag')
  .action((options) => {
    let scenarios = getAllScenarios();

    if (options.tag) {
      scenarios = getScenariosByTag(options.tag);
    }

    console.log('\nAvailable Test Scenarios:\n');
    console.log('─'.repeat(60));

    for (const scenario of scenarios) {
      console.log(`\n📋 ${scenario.name}`);
      if (scenario.description) {
        console.log(`   ${scenario.description}`);
      }
      if (scenario.tags && scenario.tags.length > 0) {
        console.log(`   Tags: ${scenario.tags.join(', ')}`);
      }
      if (scenario.preconditions && scenario.preconditions.length > 0) {
        console.log(`   Preconditions: ${scenario.preconditions.join(', ')}`);
      }
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${scenarios.length} scenario(s)\n`);
  });

// Tags command
program
  .command('tags')
  .description('List available tags')
  .action(() => {
    console.log('\nAvailable Tags:\n');
    
    const tagCounts: Record<string, number> = {};
    for (const scenario of getAllScenarios()) {
      for (const tag of scenario.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    for (const tag of availableTags) {
      const count = tagCounts[tag] || 0;
      console.log(`  ${tag.padEnd(20)} (${count} scenario${count !== 1 ? 's' : ''})`);
    }

    console.log('');
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze the application structure')
  .action(async () => {
    const orchestrator = new TestOrchestrator();
    
    try {
      await orchestrator.init();
      logger.info('Analyzing application structure...');

      // Navigate to various pages and collect structure info
      const pages = [
        { name: 'Dashboard', route: '/' },
        { name: 'Contracts', route: '/contracts' },
        { name: 'Customers', route: '/customers' },
        { name: 'IFRS 15', route: '/ifrs15' },
      ];

      // First authenticate
      const authenticated = await orchestrator.authenticate();
      if (!authenticated) {
        logger.error('Authentication failed. Cannot analyze protected pages.');
        await orchestrator.shutdown();
        process.exit(1);
      }

      console.log('\nApplication Structure Analysis:\n');
      console.log('═'.repeat(60));

      for (const page of pages) {
        const controller = orchestrator.getBrowserController();
        await controller.navigate(page.route);
        await controller.waitForNetworkIdle();

        const title = await controller.getTitle();
        const consoleErrors = controller.consoleCapture.getErrors();
        const apiCalls = controller.networkMonitor.getApiCalls();

        console.log(`\n📄 ${page.name} (${page.route})`);
        console.log(`   Title: ${title}`);
        console.log(`   Console Errors: ${consoleErrors.length}`);
        console.log(`   API Calls: ${apiCalls.length}`);
      }

      console.log('\n' + '═'.repeat(60) + '\n');

      await orchestrator.shutdown();

    } catch (error) {
      logger.error('Analysis failed', { error: String(error) });
      await orchestrator.shutdown();
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate report from last test run')
  .option('-f, --format <type>', 'Report format (html, json, markdown)', 'html')
  .option('-i, --input <file>', 'Input JSON file with test results')
  .action(async (options) => {
    const reportGenerator = new ReportGenerator({
      format: options.format as 'html' | 'json' | 'markdown',
    });

    if (options.input) {
      // Load from file and generate report
      const fs = await import('fs/promises');
      const data = await fs.readFile(options.input, 'utf-8');
      const results = JSON.parse(data);
      
      const reportPath = await reportGenerator.generate(results);
      console.log(`Report generated: ${reportPath}`);
    } else {
      console.log('No input file specified. Run tests first with: npm run run:tests');
    }
  });

program.parse();
