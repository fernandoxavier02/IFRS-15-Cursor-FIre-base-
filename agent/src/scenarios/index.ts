export { authScenarios } from './auth-scenarios.js';
export { crudScenarios } from './crud-scenarios.js';
export { ifrs15Scenarios } from './ifrs15-scenarios.js';

import { TestScenario } from '../core/orchestrator.js';
import { authScenarios } from './auth-scenarios.js';
import { crudScenarios } from './crud-scenarios.js';
import { ifrs15Scenarios } from './ifrs15-scenarios.js';

/**
 * Get all scenarios
 */
export function getAllScenarios(): TestScenario[] {
  return [
    ...authScenarios,
    ...crudScenarios,
    ...ifrs15Scenarios,
  ];
}

/**
 * Get scenarios by tag
 */
export function getScenariosByTag(tag: string): TestScenario[] {
  return getAllScenarios().filter(s => s.tags?.includes(tag));
}

/**
 * Get scenarios by name pattern
 */
export function getScenariosByName(pattern: string | RegExp): TestScenario[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return getAllScenarios().filter(s => regex.test(s.name));
}

/**
 * Get smoke test scenarios (quick, critical tests)
 */
export function getSmokeScenarios(): TestScenario[] {
  return getScenariosByTag('smoke');
}

/**
 * Get critical scenarios
 */
export function getCriticalScenarios(): TestScenario[] {
  return getScenariosByTag('critical');
}

/**
 * Available tags
 */
export const availableTags = [
  'auth',
  'smoke',
  'critical',
  'negative',
  'validation',
  'ui',
  'navigation',
  'redirect',
  'security',
  'public',
  'crud',
  'customer',
  'contract',
  'search',
  'filter',
  'details',
  'cancel',
  'complete',
  'e2e',
  'flow',
  'ifrs15',
  'billing',
  'ledger',
  'balances',
  'waterfall',
  'costs',
  'forex',
  'financing',
  'dashboard',
  'accounting',
  'reports',
  'po',
  'functionality',
] as const;

export type ScenarioTag = typeof availableTags[number];
