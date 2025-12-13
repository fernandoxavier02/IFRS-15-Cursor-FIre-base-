import type { Page, ConsoleMessage as PlaywrightConsoleMessage } from 'playwright';

export interface ConsoleMessage {
  type: 'log' | 'debug' | 'info' | 'warning' | 'error' | 'trace' | 'dir' | 'dirxml' | 'table' | 'count' | 'assert' | 'profile' | 'profileEnd' | 'time' | 'timeEnd' | 'timeStamp' | 'group' | 'groupCollapsed' | 'groupEnd' | 'clear';
  text: string;
  timestamp: number;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  args?: string[];
  stack?: string;
}

export interface PageError {
  message: string;
  stack?: string;
  timestamp: number;
  url: string;
}

export class ConsoleCapture {
  private logs: ConsoleMessage[] = [];
  private errors: PageError[] = [];
  private attached: boolean = false;

  /**
   * Attach console capture to a Playwright page
   */
  attach(page: Page): void {
    if (this.attached) {
      console.warn('ConsoleCapture already attached to a page');
      return;
    }

    // Capture console messages
    page.on('console', (msg: PlaywrightConsoleMessage) => {
      const location = msg.location();
      
      this.logs.push({
        type: msg.type() as ConsoleMessage['type'],
        text: msg.text(),
        timestamp: Date.now(),
        location: location ? {
          url: location.url,
          lineNumber: location.lineNumber,
          columnNumber: location.columnNumber,
        } : undefined,
        args: msg.args().map(arg => arg.toString()),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error: Error) => {
      this.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        url: page.url(),
      });

      // Also add to logs as error type
      this.logs.push({
        type: 'error',
        text: error.message,
        timestamp: Date.now(),
        stack: error.stack,
        location: {
          url: page.url(),
          lineNumber: 0,
          columnNumber: 0,
        },
      });
    });

    this.attached = true;
  }

  /**
   * Get all captured logs
   */
  getLogs(): ConsoleMessage[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by type
   */
  getLogsByType(type: ConsoleMessage['type']): ConsoleMessage[] {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * Get all error-level logs
   */
  getErrors(): ConsoleMessage[] {
    return this.logs.filter(log => log.type === 'error');
  }

  /**
   * Get all warning-level logs
   */
  getWarnings(): ConsoleMessage[] {
    return this.logs.filter(log => log.type === 'warning');
  }

  /**
   * Get page errors (uncaught exceptions)
   */
  getPageErrors(): PageError[] {
    return [...this.errors];
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.getErrors().length > 0 || this.errors.length > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings(): boolean {
    return this.getWarnings().length > 0;
  }

  /**
   * Get logs since a specific timestamp
   */
  getLogsSince(timestamp: number): ConsoleMessage[] {
    return this.logs.filter(log => log.timestamp >= timestamp);
  }

  /**
   * Search logs by text content
   */
  searchLogs(query: string, caseSensitive: boolean = false): ConsoleMessage[] {
    const searchText = caseSensitive ? query : query.toLowerCase();
    return this.logs.filter(log => {
      const text = caseSensitive ? log.text : log.text.toLowerCase();
      return text.includes(searchText);
    });
  }

  /**
   * Get a summary of captured logs
   */
  getSummary(): {
    total: number;
    byType: Record<string, number>;
    errorCount: number;
    warningCount: number;
    pageErrors: number;
  } {
    const byType: Record<string, number> = {};
    
    for (const log of this.logs) {
      byType[log.type] = (byType[log.type] || 0) + 1;
    }

    return {
      total: this.logs.length,
      byType,
      errorCount: this.getErrors().length,
      warningCount: this.getWarnings().length,
      pageErrors: this.errors.length,
    };
  }

  /**
   * Clear all captured logs
   */
  clear(): void {
    this.logs = [];
    this.errors = [];
  }

  /**
   * Export logs as JSON
   */
  toJSON(): {
    logs: ConsoleMessage[];
    pageErrors: PageError[];
    summary: ReturnType<ConsoleCapture['getSummary']>;
  } {
    return {
      logs: this.getLogs(),
      pageErrors: this.getPageErrors(),
      summary: this.getSummary(),
    };
  }

  /**
   * Format logs for human-readable output
   */
  format(): string {
    const lines: string[] = [];
    
    for (const log of this.logs) {
      const timestamp = new Date(log.timestamp).toISOString();
      const type = log.type.toUpperCase().padEnd(8);
      const location = log.location 
        ? ` (${log.location.url}:${log.location.lineNumber}:${log.location.columnNumber})`
        : '';
      
      lines.push(`[${timestamp}] ${type} ${log.text}${location}`);
      
      if (log.stack) {
        lines.push(`  Stack: ${log.stack}`);
      }
    }

    return lines.join('\n');
  }
}

export default ConsoleCapture;
