import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "finance", "auditor", "operations", "readonly"]);
export const contractStatusEnum = pgEnum("contract_status", ["draft", "active", "modified", "terminated", "expired"]);
export const recognitionMethodEnum = pgEnum("recognition_method", ["over_time", "point_in_time"]);
export const measurementMethodEnum = pgEnum("measurement_method", ["input", "output"]);
export const licenseStatusEnum = pgEnum("license_status", ["active", "suspended", "revoked", "expired"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "past_due", "canceled", "unpaid", "trialing"]);
export const planTypeEnum = pgEnum("plan_type", ["starter", "professional", "enterprise"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "approve", "reject", "recognize", "defer"]);
export const aiProviderEnum = pgEnum("ai_provider", ["openai", "anthropic", "openrouter", "google"]);
export const ingestionStatusEnum = pgEnum("ingestion_status", ["pending", "processing", "awaiting_review", "approved", "rejected", "failed"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected", "needs_correction"]);

// Accounting Enums for IFRS 15
export const billingFrequencyEnum = pgEnum("billing_frequency", ["monthly", "quarterly", "semi_annual", "annual", "milestone", "one_time"]);
export const billingStatusEnum = pgEnum("billing_status", ["scheduled", "invoiced", "paid", "overdue", "cancelled"]);
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", ["revenue", "deferred_revenue", "contract_asset", "contract_liability", "receivable", "cash", "financing_income", "commission_expense"]);
export const costTypeEnum = pgEnum("cost_type", ["incremental", "fulfillment"]);

// Users table with RBAC
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default("readonly"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  mustChangePassword: boolean("must_change_password").default(true),
  isActive: boolean("is_active").default(false),
  licenseKey: text("license_key"),
  licenseActivatedAt: timestamp("license_activated_at"),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tenants (organizations)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull().default("USD"),
  taxId: text("tax_id"),
  planType: planTypeEnum("plan_type").default("starter"),
  maxContracts: integer("max_contracts").default(10),
  maxLicenses: integer("max_licenses").default(1),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Plan limits configuration
export const planLimits = {
  starter: { contracts: 10, licenses: 1 },
  professional: { contracts: 30, licenses: 3 },
  enterprise: { contracts: -1, licenses: -1 }, // -1 = unlimited
} as const;

export type PlanType = "starter" | "professional" | "enterprise";

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  country: text("country").default("BR"),
  currency: text("currency").notNull().default("USD"),
  taxId: text("tax_id"),
  creditRating: text("credit_rating"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  billingAddress: text("billing_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contracts (master)
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  contractNumber: text("contract_number").notNull(),
  title: text("title").notNull(),
  status: contractStatusEnum("status").notNull().default("draft"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  paymentTerms: text("payment_terms"),
  currentVersionId: varchar("current_version_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contract Versions (amendments)
export const contractVersions = pgTable("contract_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  description: text("description"),
  totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
  modificationReason: text("modification_reason"),
  isProspective: boolean("is_prospective").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Contract Line Items (promised goods/services)
export const contractLineItems = pgTable("contract_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractVersionId: varchar("contract_version_id").references(() => contractVersions.id).notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 4 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 18, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 18, scale: 2 }).notNull(),
  standaloneSelllingPrice: decimal("standalone_selling_price", { precision: 18, scale: 2 }),
  isDistinct: boolean("is_distinct").notNull().default(true),
  distinctWithinContext: boolean("distinct_within_context").notNull().default(true),
  recognitionMethod: recognitionMethodEnum("recognition_method").notNull(),
  measurementMethod: measurementMethodEnum("measurement_method"),
  deliveryStartDate: timestamp("delivery_start_date"),
  deliveryEndDate: timestamp("delivery_end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Performance Obligations (IFRS 15 Step 2)
export const performanceObligations = pgTable("performance_obligations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractVersionId: varchar("contract_version_id").references(() => contractVersions.id).notNull(),
  description: text("description").notNull(),
  lineItemIds: text("line_item_ids").array(),
  allocatedPrice: decimal("allocated_price", { precision: 18, scale: 2 }).notNull(),
  recognitionMethod: recognitionMethodEnum("recognition_method").notNull(),
  measurementMethod: measurementMethodEnum("measurement_method"),
  percentComplete: decimal("percent_complete", { precision: 5, scale: 2 }).default("0"),
  recognizedAmount: decimal("recognized_amount", { precision: 18, scale: 2 }).default("0"),
  deferredAmount: decimal("deferred_amount", { precision: 18, scale: 2 }).default("0"),
  isSatisfied: boolean("is_satisfied").default(false),
  satisfiedDate: timestamp("satisfied_date"),
  justification: text("justification"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Revenue Schedules (IFRS 15 Step 5)
export const revenueSchedules = pgTable("revenue_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  performanceObligationId: varchar("performance_obligation_id").references(() => performanceObligations.id).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  scheduledAmount: decimal("scheduled_amount", { precision: 18, scale: 2 }).notNull(),
  recognizedAmount: decimal("recognized_amount", { precision: 18, scale: 2 }).default("0"),
  isRecognized: boolean("is_recognized").default(false),
  recognizedDate: timestamp("recognized_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Variable Consideration
export const variableConsiderations = pgTable("variable_considerations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractVersionId: varchar("contract_version_id").references(() => contractVersions.id).notNull(),
  type: text("type").notNull(), // discount, rebate, refund, bonus, penalty
  estimatedAmount: decimal("estimated_amount", { precision: 18, scale: 2 }).notNull(),
  constraintApplied: boolean("constraint_applied").default(false),
  constraintReason: text("constraint_reason"),
  probability: decimal("probability", { precision: 5, scale: 2 }),
  estimationMethod: text("estimation_method"), // expected_value, most_likely
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contract Assets & Liabilities
export const contractBalances = pgTable("contract_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  periodDate: timestamp("period_date").notNull(),
  contractAsset: decimal("contract_asset", { precision: 18, scale: 2 }).default("0"),
  contractLiability: decimal("contract_liability", { precision: 18, scale: 2 }).default("0"),
  receivable: decimal("receivable", { precision: 18, scale: 2 }).default("0"),
  revenueRecognized: decimal("revenue_recognized", { precision: 18, scale: 2 }).default("0"),
  cashReceived: decimal("cash_received", { precision: 18, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Licenses
export const licenses = pgTable("licenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  licenseKey: text("license_key").notNull().unique(),
  status: licenseStatusEnum("status").notNull().default("active"),
  seatCount: integer("seat_count").notNull().default(1),
  currentIp: text("current_ip"),
  currentUserId: varchar("current_user_id").references(() => users.id),
  lockedAt: timestamp("locked_at"),
  lastSeenAt: timestamp("last_seen_at"),
  graceUntil: timestamp("grace_until"),
  activatedAt: timestamp("activated_at"),
  activatedByUserId: varchar("activated_by_user_id").references(() => users.id),
  activationIp: text("activation_ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// License Sessions (audit)
export const licenseSessions = pgTable("license_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  licenseId: varchar("license_id").references(() => licenses.id).notNull(),
  ip: text("ip").notNull(),
  userId: varchar("user_id").references(() => users.id),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  endedReason: text("ended_reason"), // logout, timeout, force_release, ip_change
});

// Stripe Webhook Events (for idempotency)
export const stripeEvents = pgTable("stripe_events", {
  id: varchar("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  data: jsonb("data"),
});

// Subscription Plans
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  features: text("features").array(),
  maxUsers: integer("max_users").default(1),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Checkout Sessions tracking
export const checkoutSessions = pgTable("checkout_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  email: text("email").notNull(),
  planId: varchar("plan_id").references(() => subscriptionPlans.id),
  status: text("status").notNull().default("pending"), // pending, completed, expired
  tenantId: varchar("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Email Credentials Queue
export const emailQueue = pgTable("email_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  templateType: text("template_type").notNull(), // welcome, credentials, subscription_active
  status: text("status").notNull().default("pending"), // pending, sent, failed
  attempts: integer("attempts").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});

// Audit Trail
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  entityType: text("entity_type").notNull(), // contract, license, performance_obligation, etc.
  entityId: varchar("entity_id").notNull(),
  action: auditActionEnum("action").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  justification: text("justification"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Provider Configurations (BYOK - Bring Your Own Key)
export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  provider: aiProviderEnum("provider").notNull(),
  name: text("name").notNull(), // User-friendly name
  apiKey: text("api_key").notNull(), // Encrypted API key
  model: text("model").notNull(), // e.g., gpt-4, claude-3-opus, etc.
  baseUrl: text("base_url"), // For OpenRouter or custom endpoints
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Ingestion Jobs
export const aiIngestionJobs = pgTable("ai_ingestion_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  providerId: varchar("provider_id").references(() => aiProviderConfigs.id).notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(), // Base64 or file reference
  status: ingestionStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").default(0), // 0-100
  errorMessage: text("error_message"),
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Extraction Results (normalized contract data)
export const aiExtractionResults = pgTable("ai_extraction_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => aiIngestionJobs.id).notNull(),
  extractedData: jsonb("extracted_data").notNull(), // Normalized contract structure
  confidenceScores: jsonb("confidence_scores"), // Per-field confidence
  rawResponse: jsonb("raw_response"), // Original AI response
  tokensUsed: integer("tokens_used"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Review Tasks (Human in the Loop)
export const aiReviewTasks = pgTable("ai_review_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => aiIngestionJobs.id).notNull(),
  extractionResultId: varchar("extraction_result_id").references(() => aiExtractionResults.id).notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: reviewStatusEnum("status").notNull().default("pending"),
  reviewedData: jsonb("reviewed_data"), // Human-corrected data
  reviewNotes: text("review_notes"),
  contractId: varchar("contract_id").references(() => contracts.id), // Created contract after approval
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== ACCOUNTING TABLES (IFRS 15) ====================

// Billing Schedules - tracks when invoices are due/sent
export const billingSchedules = pgTable("billing_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  performanceObligationId: varchar("performance_obligation_id").references(() => performanceObligations.id),
  billingDate: timestamp("billing_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BRL"),
  frequency: billingFrequencyEnum("frequency").notNull(),
  status: billingStatusEnum("status").notNull().default("scheduled"),
  invoiceNumber: text("invoice_number"),
  invoicedAt: timestamp("invoiced_at"),
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 18, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Revenue Ledger Entries (Journal Entries for double-entry accounting)
export const revenueLedgerEntries = pgTable("revenue_ledger_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  performanceObligationId: varchar("performance_obligation_id").references(() => performanceObligations.id),
  billingScheduleId: varchar("billing_schedule_id").references(() => billingSchedules.id),
  entryDate: timestamp("entry_date").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  entryType: ledgerEntryTypeEnum("entry_type").notNull(),
  debitAccount: text("debit_account").notNull(),
  creditAccount: text("credit_account").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BRL"),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 6 }).default("1"),
  functionalAmount: decimal("functional_amount", { precision: 18, scale: 2 }),
  description: text("description"),
  referenceNumber: text("reference_number"),
  isPosted: boolean("is_posted").default(false),
  postedAt: timestamp("posted_at"),
  postedBy: varchar("posted_by").references(() => users.id),
  isReversed: boolean("is_reversed").default(false),
  reversedEntryId: varchar("reversed_entry_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contract Costs (ASC 340-40 / IFRS 15 incremental/fulfillment costs)
export const contractCosts = pgTable("contract_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  costType: costTypeEnum("cost_type").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BRL"),
  incurredDate: timestamp("incurred_date").notNull(),
  amortizationStartDate: timestamp("amortization_start_date").notNull(),
  amortizationEndDate: timestamp("amortization_end_date").notNull(),
  amortizationMethod: text("amortization_method").default("straight_line"),
  totalAmortized: decimal("total_amortized", { precision: 18, scale: 2 }).default("0"),
  remainingBalance: decimal("remaining_balance", { precision: 18, scale: 2 }),
  isFullyAmortized: boolean("is_fully_amortized").default(false),
  impairmentLoss: decimal("impairment_loss", { precision: 18, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Currency Exchange Rates
export const exchangeRates = pgTable("exchange_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  rate: decimal("rate", { precision: 18, scale: 6 }).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  source: text("source").default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Significant Financing Component (when payment terms > 12 months)
export const financingComponents = pgTable("financing_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  contractId: varchar("contract_id").references(() => contracts.id).notNull(),
  nominalAmount: decimal("nominal_amount", { precision: 18, scale: 2 }).notNull(),
  presentValue: decimal("present_value", { precision: 18, scale: 2 }).notNull(),
  discountRate: decimal("discount_rate", { precision: 8, scale: 4 }).notNull(),
  financingPeriodMonths: integer("financing_period_months").notNull(),
  totalInterest: decimal("total_interest", { precision: 18, scale: 2 }).notNull(),
  recognizedInterest: decimal("recognized_interest", { precision: 18, scale: 2 }).default("0"),
  currency: text("currency").notNull().default("BRL"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Consolidated Period Balances (monthly/quarterly snapshots for reporting)
export const consolidatedBalances = pgTable("consolidated_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  periodDate: timestamp("period_date").notNull(),
  periodType: text("period_type").notNull().default("monthly"),
  totalContractAssets: decimal("total_contract_assets", { precision: 18, scale: 2 }).default("0"),
  totalContractLiabilities: decimal("total_contract_liabilities", { precision: 18, scale: 2 }).default("0"),
  totalReceivables: decimal("total_receivables", { precision: 18, scale: 2 }).default("0"),
  totalDeferredRevenue: decimal("total_deferred_revenue", { precision: 18, scale: 2 }).default("0"),
  totalRecognizedRevenue: decimal("total_recognized_revenue", { precision: 18, scale: 2 }).default("0"),
  totalBilledAmount: decimal("total_billed_amount", { precision: 18, scale: 2 }).default("0"),
  totalCashReceived: decimal("total_cash_received", { precision: 18, scale: 2 }).default("0"),
  totalRemainingObligations: decimal("total_remaining_obligations", { precision: 18, scale: 2 }).default("0"),
  contractCount: integer("contract_count").default(0),
  currency: text("currency").notNull().default("BRL"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  contracts: many(contracts),
  licenses: many(licenses),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  contracts: many(contracts),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contracts.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [contracts.customerId],
    references: [customers.id],
  }),
  versions: many(contractVersions),
  balances: many(contractBalances),
}));

export const contractVersionsRelations = relations(contractVersions, ({ one, many }) => ({
  contract: one(contracts, {
    fields: [contractVersions.contractId],
    references: [contracts.id],
  }),
  createdByUser: one(users, {
    fields: [contractVersions.createdBy],
    references: [users.id],
  }),
  lineItems: many(contractLineItems),
  performanceObligations: many(performanceObligations),
  variableConsiderations: many(variableConsiderations),
}));

export const contractLineItemsRelations = relations(contractLineItems, ({ one }) => ({
  contractVersion: one(contractVersions, {
    fields: [contractLineItems.contractVersionId],
    references: [contractVersions.id],
  }),
}));

export const performanceObligationsRelations = relations(performanceObligations, ({ one, many }) => ({
  contractVersion: one(contractVersions, {
    fields: [performanceObligations.contractVersionId],
    references: [contractVersions.id],
  }),
  revenueSchedules: many(revenueSchedules),
}));

export const revenueSchedulesRelations = relations(revenueSchedules, ({ one }) => ({
  performanceObligation: one(performanceObligations, {
    fields: [revenueSchedules.performanceObligationId],
    references: [performanceObligations.id],
  }),
}));

export const licensesRelations = relations(licenses, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [licenses.tenantId],
    references: [tenants.id],
  }),
  currentUser: one(users, {
    fields: [licenses.currentUserId],
    references: [users.id],
  }),
  sessions: many(licenseSessions),
}));

export const licenseSessionsRelations = relations(licenseSessions, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseSessions.licenseId],
    references: [licenses.id],
  }),
  user: one(users, {
    fields: [licenseSessions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractVersionSchema = createInsertSchema(contractVersions).omit({ id: true, createdAt: true });
export const insertContractLineItemSchema = createInsertSchema(contractLineItems).omit({ id: true, createdAt: true });
export const insertPerformanceObligationSchema = createInsertSchema(performanceObligations).omit({ id: true, createdAt: true });
export const insertRevenueScheduleSchema = createInsertSchema(revenueSchedules).omit({ id: true, createdAt: true });
export const insertVariableConsiderationSchema = createInsertSchema(variableConsiderations).omit({ id: true, createdAt: true });
export const insertContractBalanceSchema = createInsertSchema(contractBalances).omit({ id: true, createdAt: true });
export const insertLicenseSchema = createInsertSchema(licenses).omit({ id: true, createdAt: true });
export const insertLicenseSessionSchema = createInsertSchema(licenseSessions).omit({ id: true, startedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true });
export const insertCheckoutSessionSchema = createInsertSchema(checkoutSessions).omit({ id: true, createdAt: true });
export const insertEmailQueueSchema = createInsertSchema(emailQueue).omit({ id: true, createdAt: true });
export const insertAiProviderConfigSchema = createInsertSchema(aiProviderConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiIngestionJobSchema = createInsertSchema(aiIngestionJobs).omit({ id: true, createdAt: true });
export const insertAiExtractionResultSchema = createInsertSchema(aiExtractionResults).omit({ id: true, createdAt: true });
export const insertAiReviewTaskSchema = createInsertSchema(aiReviewTasks).omit({ id: true, createdAt: true });

// Accounting Insert Schemas
export const insertBillingScheduleSchema = createInsertSchema(billingSchedules).omit({ id: true, createdAt: true });
export const insertRevenueLedgerEntrySchema = createInsertSchema(revenueLedgerEntries).omit({ id: true, createdAt: true });
export const insertContractCostSchema = createInsertSchema(contractCosts).omit({ id: true, createdAt: true });
export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({ id: true, createdAt: true });
export const insertFinancingComponentSchema = createInsertSchema(financingComponents).omit({ id: true, createdAt: true, calculatedAt: true });
export const insertConsolidatedBalanceSchema = createInsertSchema(consolidatedBalances).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type ContractVersion = typeof contractVersions.$inferSelect;
export type InsertContractVersion = z.infer<typeof insertContractVersionSchema>;
export type ContractLineItem = typeof contractLineItems.$inferSelect;
export type InsertContractLineItem = z.infer<typeof insertContractLineItemSchema>;
export type PerformanceObligation = typeof performanceObligations.$inferSelect;
export type InsertPerformanceObligation = z.infer<typeof insertPerformanceObligationSchema>;
export type RevenueSchedule = typeof revenueSchedules.$inferSelect;
export type InsertRevenueSchedule = z.infer<typeof insertRevenueScheduleSchema>;
export type VariableConsideration = typeof variableConsiderations.$inferSelect;
export type InsertVariableConsideration = z.infer<typeof insertVariableConsiderationSchema>;
export type ContractBalance = typeof contractBalances.$inferSelect;
export type InsertContractBalance = z.infer<typeof insertContractBalanceSchema>;
export type License = typeof licenses.$inferSelect;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type LicenseSession = typeof licenseSessions.$inferSelect;
export type InsertLicenseSession = z.infer<typeof insertLicenseSessionSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type StripeEvent = typeof stripeEvents.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type CheckoutSession = typeof checkoutSessions.$inferSelect;
export type InsertCheckoutSession = z.infer<typeof insertCheckoutSessionSchema>;
export type EmailQueueItem = typeof emailQueue.$inferSelect;
export type InsertEmailQueueItem = z.infer<typeof insertEmailQueueSchema>;
export type AiProviderConfig = typeof aiProviderConfigs.$inferSelect;
export type InsertAiProviderConfig = z.infer<typeof insertAiProviderConfigSchema>;
export type AiIngestionJob = typeof aiIngestionJobs.$inferSelect;
export type InsertAiIngestionJob = z.infer<typeof insertAiIngestionJobSchema>;
export type AiExtractionResult = typeof aiExtractionResults.$inferSelect;
export type InsertAiExtractionResult = z.infer<typeof insertAiExtractionResultSchema>;
export type AiReviewTask = typeof aiReviewTasks.$inferSelect;
export type InsertAiReviewTask = z.infer<typeof insertAiReviewTaskSchema>;

// Accounting Types
export type BillingSchedule = typeof billingSchedules.$inferSelect;
export type InsertBillingSchedule = z.infer<typeof insertBillingScheduleSchema>;
export type RevenueLedgerEntry = typeof revenueLedgerEntries.$inferSelect;
export type InsertRevenueLedgerEntry = z.infer<typeof insertRevenueLedgerEntrySchema>;
export type ContractCost = typeof contractCosts.$inferSelect;
export type InsertContractCost = z.infer<typeof insertContractCostSchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type FinancingComponent = typeof financingComponents.$inferSelect;
export type InsertFinancingComponent = z.infer<typeof insertFinancingComponentSchema>;
export type ConsolidatedBalance = typeof consolidatedBalances.$inferSelect;
export type InsertConsolidatedBalance = z.infer<typeof insertConsolidatedBalanceSchema>;

// AI Models available per provider
export const aiModels = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o (Recomendado)" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-4", name: "GPT-4" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus (Mais Poderoso)" },
    { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet (Equilibrado)" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (Mais Rápido)" },
  ],
  openrouter: [
    { id: "anthropic/claude-3-opus", name: "Claude 3 Opus via OpenRouter" },
    { id: "openai/gpt-4o", name: "GPT-4o via OpenRouter" },
    { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5 via OpenRouter" },
    { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B via OpenRouter" },
    { id: "mistralai/mixtral-8x22b-instruct", name: "Mixtral 8x22B via OpenRouter" },
  ],
  google: [
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Recomendado)" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Mais Rápido)" },
    { id: "gemini-pro", name: "Gemini Pro" },
  ],
} as const;

// Contract extraction schema for AI parsing
export const contractExtractionSchema = z.object({
  contractNumber: z.string().optional(),
  title: z.string(),
  customerName: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  totalValue: z.number(),
  currency: z.string().default("BRL"),
  paymentTerms: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().default(1),
    unitPrice: z.number(),
    totalPrice: z.number(),
    recognitionMethod: z.enum(["over_time", "point_in_time"]).optional(),
    deliveryStartDate: z.string().optional(),
    deliveryEndDate: z.string().optional(),
  })),
  performanceObligations: z.array(z.object({
    description: z.string(),
    allocatedPrice: z.number(),
    recognitionMethod: z.enum(["over_time", "point_in_time"]),
    justification: z.string().optional(),
  })).optional(),
});

export type ContractExtraction = z.infer<typeof contractExtractionSchema>;
