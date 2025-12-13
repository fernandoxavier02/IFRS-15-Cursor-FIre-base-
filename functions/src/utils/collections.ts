// Firestore Collection Paths
export const COLLECTIONS = {
  TENANTS: "tenants",
  USERS: "users",
  CUSTOMERS: "customers",
  CONTRACTS: "contracts",
  CONTRACT_VERSIONS: "versions",
  LINE_ITEMS: "lineItems",
  PERFORMANCE_OBLIGATIONS: "performanceObligations",
  REVENUE_SCHEDULES: "revenueSchedules",
  VARIABLE_CONSIDERATIONS: "variableConsiderations",
  CONTRACT_BALANCES: "balances",
  LICENSES: "licenses",
  LICENSE_SESSIONS: "sessions",
  STRIPE_EVENTS: "stripeEvents",
  SUBSCRIPTION_PLANS: "subscriptionPlans",
  CHECKOUT_SESSIONS: "checkoutSessions",
  EMAIL_QUEUE: "emailQueue",
  AUDIT_LOGS: "auditLogs",
  AI_PROVIDER_CONFIGS: "aiProviderConfigs",
  AI_INGESTION_JOBS: "aiIngestionJobs",
  AI_EXTRACTION_RESULTS: "aiExtractionResults",
  AI_REVIEW_TASKS: "aiReviewTasks",
  BILLING_SCHEDULES: "billingSchedules",
  REVENUE_LEDGER_ENTRIES: "revenueLedgerEntries",
  CONTRACT_COSTS: "contractCosts",
  EXCHANGE_RATES: "exchangeRates",
  FINANCING_COMPONENTS: "financingComponents",
  CONSOLIDATED_BALANCES: "consolidatedBalances",
  MAIL: "mail", // For Trigger Email extension
} as const;

// Helper function to get tenant-scoped collection path
export function tenantCollection(tenantId: string, collection: string): string {
  return `${COLLECTIONS.TENANTS}/${tenantId}/${collection}`;
}

// Helper function to get contract-scoped subcollection path
export function contractSubcollection(
  tenantId: string,
  contractId: string,
  subcollection: string
): string {
  return `${tenantCollection(tenantId, COLLECTIONS.CONTRACTS)}/${contractId}/${subcollection}`;
}

// Helper function to get version-scoped subcollection path
export function versionSubcollection(
  tenantId: string,
  contractId: string,
  versionId: string,
  subcollection: string
): string {
  return `${contractSubcollection(tenantId, contractId, COLLECTIONS.CONTRACT_VERSIONS)}/${versionId}/${subcollection}`;
}
