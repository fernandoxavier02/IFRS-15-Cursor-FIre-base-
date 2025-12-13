import path from 'path';
import winston from 'winston';
import { testConfig } from '../config/test-config.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  let metaStr = '';
  if (Object.keys(meta).length > 0) {
    metaStr = ` ${JSON.stringify(meta)}`;
  }
  return `${timestamp} [${level}]: ${message}${metaStr}`;
});

// Create logs directory path
const logsDir = testConfig.paths.logs;

// Logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'ifrs15-test-agent' },
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// Test-specific logging functions
export const testLogger = {
  /**
   * Log scenario start
   */
  scenarioStart: (name: string, tags?: string[]) => {
    logger.info(`▶ Starting scenario: ${name}`, { 
      type: 'scenario_start',
      scenario: name,
      tags,
    });
  },

  /**
   * Log scenario end
   */
  scenarioEnd: (name: string, success: boolean, duration: number) => {
    const icon = success ? '✓' : '✗';
    const level = success ? 'info' : 'error';
    logger.log(level, `${icon} Scenario completed: ${name} (${duration}ms)`, {
      type: 'scenario_end',
      scenario: name,
      success,
      duration,
    });
  },

  /**
   * Log step execution
   */
  step: (stepNumber: number, action: string, target?: string, success?: boolean) => {
    const icon = success === undefined ? '→' : success ? '✓' : '✗';
    const level = success === false ? 'warn' : 'info';
    logger.log(level, `  ${icon} Step ${stepNumber}: ${action}${target ? ` (${target})` : ''}`, {
      type: 'step',
      stepNumber,
      action,
      target,
      success,
    });
  },

  /**
   * Log validation result
   */
  validation: (type: string, passed: boolean, message: string) => {
    const icon = passed ? '✓' : '✗';
    const level = passed ? 'info' : 'warn';
    logger.log(level, `  ${icon} Validation [${type}]: ${message}`, {
      type: 'validation',
      validationType: type,
      passed,
      message,
    });
  },

  /**
   * Log error with context
   */
  error: (message: string, context?: Record<string, unknown>) => {
    logger.error(`✗ Error: ${message}`, {
      type: 'error',
      ...context,
    });
  },

  /**
   * Log warning
   */
  warn: (message: string, context?: Record<string, unknown>) => {
    logger.warn(`⚠ Warning: ${message}`, {
      type: 'warning',
      ...context,
    });
  },

  /**
   * Log debug information
   */
  debug: (message: string, data?: unknown) => {
    logger.debug(message, { type: 'debug', data });
  },

  /**
   * Log test run summary
   */
  summary: (total: number, passed: number, failed: number, skipped: number, duration: number) => {
    const passRate = Math.round((passed / total) * 100);
    logger.info('═'.repeat(50));
    logger.info(`Test Run Summary:`);
    logger.info(`  Total:    ${total}`);
    logger.info(`  Passed:   ${passed} (${passRate}%)`);
    logger.info(`  Failed:   ${failed}`);
    logger.info(`  Skipped:  ${skipped}`);
    logger.info(`  Duration: ${Math.round(duration / 1000)}s`);
    logger.info('═'.repeat(50));
  },

  /**
   * Log console capture summary
   */
  consoleSummary: (errors: number, warnings: number) => {
    if (errors > 0 || warnings > 0) {
      logger.warn(`Browser Console: ${errors} error(s), ${warnings} warning(s)`, {
        type: 'console_summary',
        errors,
        warnings,
      });
    }
  },

  /**
   * Log network summary
   */
  networkSummary: (totalRequests: number, failedRequests: number) => {
    if (failedRequests > 0) {
      logger.warn(`Network: ${failedRequests}/${totalRequests} requests failed`, {
        type: 'network_summary',
        totalRequests,
        failedRequests,
      });
    }
  },

  /**
   * Log AI analysis result
   */
  aiAnalysis: (analysis: {
    summary: string;
    rootCause: string;
    suggestedFix: string;
    confidence: number;
  }) => {
    logger.info('AI Analysis:', {
      type: 'ai_analysis',
      ...analysis,
    });
    logger.info(`  Summary: ${analysis.summary}`);
    logger.info(`  Root Cause: ${analysis.rootCause}`);
    logger.info(`  Suggested Fix: ${analysis.suggestedFix}`);
    logger.info(`  Confidence: ${Math.round(analysis.confidence * 100)}%`);
  },

  /**
   * Create a child logger for a specific scenario
   */
  child: (scenario: string) => {
    return logger.child({ scenario });
  },
};

export default logger;
