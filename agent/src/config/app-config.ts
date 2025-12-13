import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

const configSchema = z.object({
  // Application
  appUrl: z.string().url().default('https://ifrs15-revenue-manager.web.app'),
  appEnv: z.enum(['development', 'staging', 'production']).default('production'),
  
  // Test Credentials
  testAdminEmail: z.string().email(),
  testAdminPassword: z.string().min(1),
  
  // Firebase
  firebaseProjectId: z.string().optional(),
  firebaseClientEmail: z.string().email().optional(),
  firebasePrivateKey: z.string().optional(),
  
  // AI Providers
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  
  // Browser
  headless: z.boolean().default(true),
  slowMo: z.number().default(0),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  
  // Reporting
  screenshotsOnFailure: z.boolean().default(true),
  videoOnFailure: z.boolean().default(true),
  reportFormat: z.enum(['html', 'json', 'markdown']).default('html'),
});

export type AppConfig = z.infer<typeof configSchema>;

function loadConfig(): AppConfig {
  const rawConfig = {
    appUrl: process.env.APP_URL,
    appEnv: process.env.APP_ENV,
    testAdminEmail: process.env.TEST_ADMIN_EMAIL || 'test@example.com',
    testAdminPassword: process.env.TEST_ADMIN_PASSWORD || 'password',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    headless: process.env.HEADLESS === 'true',
    slowMo: parseInt(process.env.SLOW_MO || '0', 10),
    browser: process.env.BROWSER as 'chromium' | 'firefox' | 'webkit',
    screenshotsOnFailure: process.env.SCREENSHOTS_ON_FAILURE !== 'false',
    videoOnFailure: process.env.VIDEO_ON_FAILURE !== 'false',
    reportFormat: process.env.REPORT_FORMAT as 'html' | 'json' | 'markdown',
  };

  const result = configSchema.safeParse(rawConfig);
  
  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid configuration');
  }
  
  return result.data;
}

export const appConfig = loadConfig();

export default appConfig;
