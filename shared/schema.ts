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
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "approve", "reject", "recognize", "defer"]);

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
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  country: text("country").notNull(),
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
