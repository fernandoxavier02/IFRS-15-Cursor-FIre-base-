import type { BrowserContextOptions, LaunchOptions } from 'playwright';
import appConfig from './app-config.js';

export interface TestConfig {
  // Browser launch options
  launchOptions: LaunchOptions;
  
  // Browser context options
  contextOptions: BrowserContextOptions;
  
  // Test timeouts
  timeouts: {
    navigation: number;
    action: number;
    assertion: number;
    test: number;
  };
  
  // Retry settings
  retries: {
    actionRetries: number;
    testRetries: number;
    retryDelay: number;
  };
  
  // Paths
  paths: {
    screenshots: string;
    videos: string;
    reports: string;
    logs: string;
  };
}

export const testConfig: TestConfig = {
  launchOptions: {
    headless: appConfig.headless,
    slowMo: appConfig.slowMo,
  },
  
  contextOptions: {
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/Sao_Paulo',
    recordVideo: appConfig.videoOnFailure ? {
      dir: './videos',
      size: { width: 1920, height: 1080 },
    } : undefined,
  },
  
  timeouts: {
    navigation: 30000,
    action: 10000,
    assertion: 5000,
    test: 120000,
  },
  
  retries: {
    actionRetries: 3,
    testRetries: 2,
    retryDelay: 1000,
  },
  
  paths: {
    screenshots: './screenshots',
    videos: './videos',
    reports: './reports',
    logs: './logs',
  },
};

export default testConfig;
