import {
  users,
  tenants,
  customers,
  contracts,
  contractVersions,
  contractLineItems,
  performanceObligations,
  revenueSchedules,
  variableConsiderations,
  contractBalances,
  licenses,
  licenseSessions,
  stripeEvents,
  auditLogs,
  subscriptionPlans,
  checkoutSessions,
  emailQueue,
  aiProviderConfigs,
  aiIngestionJobs,
  aiExtractionResults,
  aiReviewTasks,
  billingSchedules,
  revenueLedgerEntries,
  contractCosts,
  exchangeRates,
  financingComponents,
  consolidatedBalances,
  type User,
  type InsertUser,
  type Tenant,
  type InsertTenant,
  type Customer,
  type InsertCustomer,
  type Contract,
  type InsertContract,
  type ContractVersion,
  type InsertContractVersion,
  type ContractLineItem,
  type InsertContractLineItem,
  type PerformanceObligation,
  type InsertPerformanceObligation,
  type RevenueSchedule,
  type InsertRevenueSchedule,
  type License,
  type InsertLicense,
  type LicenseSession,
  type InsertLicenseSession,
  type AuditLog,
  type InsertAuditLog,
  type StripeEvent,
  type ContractBalance,
  type InsertContractBalance,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type CheckoutSession,
  type InsertCheckoutSession,
  type EmailQueueItem,
  type InsertEmailQueueItem,
  type AiProviderConfig,
  type InsertAiProviderConfig,
  type AiIngestionJob,
  type InsertAiIngestionJob,
  type AiExtractionResult,
  type InsertAiExtractionResult,
  type AiReviewTask,
  type InsertAiReviewTask,
  type BillingSchedule,
  type InsertBillingSchedule,
  type RevenueLedgerEntry,
  type InsertRevenueLedgerEntry,
  type ContractCost,
  type InsertContractCost,
  type ExchangeRate,
  type InsertExchangeRate,
  type FinancingComponent,
  type InsertFinancingComponent,
  type ConsolidatedBalance,
  type InsertConsolidatedBalance,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, isNotNull, lt, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(tenantId: string): Promise<User[]>;

  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined>;

  // Customers
  getCustomers(tenantId: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  // Contracts
  getContracts(tenantId: string): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined>;
  getRecentContracts(tenantId: string, limit?: number): Promise<Contract[]>;

  // Contract Versions
  getContractVersions(contractId: string): Promise<ContractVersion[]>;
  createContractVersion(version: InsertContractVersion): Promise<ContractVersion>;

  // Contract Line Items
  getLineItems(contractVersionId: string): Promise<ContractLineItem[]>;
  createLineItem(item: InsertContractLineItem): Promise<ContractLineItem>;

  // Performance Obligations
  getPerformanceObligations(contractVersionId: string): Promise<PerformanceObligation[]>;
  createPerformanceObligation(po: InsertPerformanceObligation): Promise<PerformanceObligation>;
  updatePerformanceObligation(id: string, data: Partial<InsertPerformanceObligation>): Promise<PerformanceObligation | undefined>;

  // Revenue Schedules
  getRevenueSchedules(poId: string): Promise<RevenueSchedule[]>;
  createRevenueSchedule(schedule: InsertRevenueSchedule): Promise<RevenueSchedule>;

  // Contract Balances
  getContractBalances(contractId: string): Promise<ContractBalance[]>;
  createContractBalance(balance: InsertContractBalance): Promise<ContractBalance>;

  // Licenses
  getLicenses(tenantId: string): Promise<License[]>;
  getLicense(id: string): Promise<License | undefined>;
  getLicenseByKey(key: string): Promise<License | undefined>;
  createLicense(license: InsertLicense): Promise<License>;
  updateLicense(id: string, data: Partial<InsertLicense>): Promise<License | undefined>;
  getActiveLicenses(tenantId: string): Promise<License[]>;
  getExpiredSessions(): Promise<License[]>;

  // License Sessions
  createLicenseSession(session: InsertLicenseSession): Promise<LicenseSession>;
  endLicenseSession(licenseId: string, reason: string): Promise<void>;

  // Stripe Events
  getStripeEvent(id: string): Promise<StripeEvent | undefined>;
  createStripeEvent(event: { id: string; eventType: string; data?: unknown }): Promise<StripeEvent>;

  // Audit Logs
  getAuditLogs(tenantId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Dashboard Stats
  getDashboardStats(tenantId: string): Promise<{
    totalContracts: number;
    activeContracts: number;
    totalRevenue: string;
    recognizedRevenue: string;
    deferredRevenue: string;
    activeLicenses: number;
    licensesInUse: number;
    contractAssets: string;
    contractLiabilities: string;
  }>;

  // Subscription Plans
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;

  // Checkout Sessions
  getCheckoutSession(stripeSessionId: string): Promise<CheckoutSession | undefined>;
  createCheckoutSession(session: InsertCheckoutSession): Promise<CheckoutSession>;
  updateCheckoutSession(id: string, data: Partial<InsertCheckoutSession>): Promise<CheckoutSession | undefined>;

  // Email Queue
  createEmailQueueItem(item: InsertEmailQueueItem): Promise<EmailQueueItem>;
  getPendingEmails(): Promise<EmailQueueItem[]>;
  updateEmailQueueItem(id: string, data: Partial<InsertEmailQueueItem>): Promise<EmailQueueItem | undefined>;

  // All Licenses (for admin)
  getAllLicenses(): Promise<License[]>;

  // Authentication
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  activateLicense(userId: string, licenseKey: string, ip: string): Promise<{ success: boolean; error?: string }>;

  // AI Provider Configs (BYOK)
  getAiProviderConfigs(tenantId: string): Promise<AiProviderConfig[]>;
  getAiProviderConfig(id: string): Promise<AiProviderConfig | undefined>;
  createAiProviderConfig(config: InsertAiProviderConfig): Promise<AiProviderConfig>;
  updateAiProviderConfig(id: string, data: Partial<InsertAiProviderConfig>): Promise<AiProviderConfig | undefined>;
  deleteAiProviderConfig(id: string): Promise<boolean>;
  getDefaultAiProviderConfig(tenantId: string): Promise<AiProviderConfig | undefined>;

  // AI Ingestion Jobs
  getAiIngestionJobs(tenantId: string): Promise<AiIngestionJob[]>;
  getAiIngestionJob(id: string): Promise<AiIngestionJob | undefined>;
  createAiIngestionJob(job: InsertAiIngestionJob): Promise<AiIngestionJob>;
  updateAiIngestionJob(id: string, data: Partial<InsertAiIngestionJob>): Promise<AiIngestionJob | undefined>;
  getPendingIngestionJobs(): Promise<AiIngestionJob[]>;

  // AI Extraction Results
  getAiExtractionResult(jobId: string): Promise<AiExtractionResult | undefined>;
  createAiExtractionResult(result: InsertAiExtractionResult): Promise<AiExtractionResult>;

  // AI Review Tasks
  getAiReviewTasks(tenantId: string): Promise<AiReviewTask[]>;
  getAiReviewTask(id: string): Promise<AiReviewTask | undefined>;
  getPendingReviewTasks(tenantId: string): Promise<AiReviewTask[]>;
  createAiReviewTask(task: InsertAiReviewTask): Promise<AiReviewTask>;
  updateAiReviewTask(id: string, data: Partial<InsertAiReviewTask>): Promise<AiReviewTask | undefined>;

  // ==================== ACCOUNTING METHODS (IFRS 15) ====================

  // Billing Schedules
  getBillingSchedules(tenantId: string): Promise<BillingSchedule[]>;
  getBillingSchedulesByContract(contractId: string): Promise<BillingSchedule[]>;
  getBillingSchedule(id: string): Promise<BillingSchedule | undefined>;
  createBillingSchedule(schedule: InsertBillingSchedule): Promise<BillingSchedule>;
  updateBillingSchedule(id: string, data: Partial<InsertBillingSchedule>): Promise<BillingSchedule | undefined>;
  getUpcomingBillings(tenantId: string, days: number): Promise<BillingSchedule[]>;
  getOverdueBillings(tenantId: string): Promise<BillingSchedule[]>;

  // Revenue Ledger Entries
  getRevenueLedgerEntries(tenantId: string): Promise<RevenueLedgerEntry[]>;
  getRevenueLedgerEntriesByContract(contractId: string): Promise<RevenueLedgerEntry[]>;
  getRevenueLedgerEntry(id: string): Promise<RevenueLedgerEntry | undefined>;
  createRevenueLedgerEntry(entry: InsertRevenueLedgerEntry): Promise<RevenueLedgerEntry>;
  updateRevenueLedgerEntry(id: string, data: Partial<InsertRevenueLedgerEntry>): Promise<RevenueLedgerEntry | undefined>;
  getUnpostedLedgerEntries(tenantId: string): Promise<RevenueLedgerEntry[]>;

  // Contract Costs
  getContractCosts(tenantId: string): Promise<ContractCost[]>;
  getContractCostsByContract(contractId: string): Promise<ContractCost[]>;
  getContractCost(id: string): Promise<ContractCost | undefined>;
  createContractCost(cost: InsertContractCost): Promise<ContractCost>;
  updateContractCost(id: string, data: Partial<InsertContractCost>): Promise<ContractCost | undefined>;

  // Exchange Rates
  getExchangeRates(tenantId: string): Promise<ExchangeRate[]>;
  getExchangeRate(tenantId: string, fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined>;
  createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate>;
  updateExchangeRate(id: string, data: Partial<InsertExchangeRate>): Promise<ExchangeRate | undefined>;

  // Financing Components
  getFinancingComponents(tenantId: string): Promise<FinancingComponent[]>;
  getFinancingComponentsByContract(contractId: string): Promise<FinancingComponent[]>;
  getFinancingComponent(id: string): Promise<FinancingComponent | undefined>;
  createFinancingComponent(component: InsertFinancingComponent): Promise<FinancingComponent>;
  updateFinancingComponent(id: string, data: Partial<InsertFinancingComponent>): Promise<FinancingComponent | undefined>;

  // Consolidated Balances
  getConsolidatedBalances(tenantId: string): Promise<ConsolidatedBalance[]>;
  getConsolidatedBalance(id: string): Promise<ConsolidatedBalance | undefined>;
  createConsolidatedBalance(balance: InsertConsolidatedBalance): Promise<ConsolidatedBalance>;
  getLatestConsolidatedBalance(tenantId: string): Promise<ConsolidatedBalance | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(tenantId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  // Tenants
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(tenants.createdAt);
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async updateTenant(id: string, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const [updated] = await db.update(tenants).set(data).where(eq(tenants.id, id)).returning();
    return updated || undefined;
  }

  // Customers
  async getCustomers(tenantId: string): Promise<Customer[]> {
    return db.select().from(customers).where(eq(customers.tenantId, tenantId));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  // Contracts
  async getContracts(tenantId: string): Promise<Contract[]> {
    return db.select().from(contracts).where(eq(contracts.tenantId, tenantId)).orderBy(desc(contracts.createdAt));
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [created] = await db.insert(contracts).values(contract).returning();
    return created;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract | undefined> {
    const [updated] = await db
      .update(contracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    return updated || undefined;
  }

  async getRecentContracts(tenantId: string, limit = 5): Promise<Contract[]> {
    return db
      .select()
      .from(contracts)
      .where(eq(contracts.tenantId, tenantId))
      .orderBy(desc(contracts.createdAt))
      .limit(limit);
  }

  // Contract Versions
  async getContractVersions(contractId: string): Promise<ContractVersion[]> {
    return db
      .select()
      .from(contractVersions)
      .where(eq(contractVersions.contractId, contractId))
      .orderBy(desc(contractVersions.versionNumber));
  }

  async createContractVersion(version: InsertContractVersion): Promise<ContractVersion> {
    const [created] = await db.insert(contractVersions).values(version).returning();
    return created;
  }

  // Contract Line Items
  async getLineItems(contractVersionId: string): Promise<ContractLineItem[]> {
    return db
      .select()
      .from(contractLineItems)
      .where(eq(contractLineItems.contractVersionId, contractVersionId));
  }

  async createLineItem(item: InsertContractLineItem): Promise<ContractLineItem> {
    const [created] = await db.insert(contractLineItems).values(item).returning();
    return created;
  }

  // Performance Obligations
  async getPerformanceObligations(contractVersionId: string): Promise<PerformanceObligation[]> {
    return db
      .select()
      .from(performanceObligations)
      .where(eq(performanceObligations.contractVersionId, contractVersionId));
  }

  async createPerformanceObligation(po: InsertPerformanceObligation): Promise<PerformanceObligation> {
    const [created] = await db.insert(performanceObligations).values(po).returning();
    return created;
  }

  async updatePerformanceObligation(
    id: string,
    data: Partial<InsertPerformanceObligation>
  ): Promise<PerformanceObligation | undefined> {
    const [updated] = await db
      .update(performanceObligations)
      .set(data)
      .where(eq(performanceObligations.id, id))
      .returning();
    return updated || undefined;
  }

  // Revenue Schedules
  async getRevenueSchedules(poId: string): Promise<RevenueSchedule[]> {
    return db
      .select()
      .from(revenueSchedules)
      .where(eq(revenueSchedules.performanceObligationId, poId));
  }

  async createRevenueSchedule(schedule: InsertRevenueSchedule): Promise<RevenueSchedule> {
    const [created] = await db.insert(revenueSchedules).values(schedule).returning();
    return created;
  }

  // Contract Balances
  async getContractBalances(contractId: string): Promise<ContractBalance[]> {
    return db
      .select()
      .from(contractBalances)
      .where(eq(contractBalances.contractId, contractId))
      .orderBy(desc(contractBalances.periodDate));
  }

  async createContractBalance(balance: InsertContractBalance): Promise<ContractBalance> {
    const [created] = await db.insert(contractBalances).values(balance).returning();
    return created;
  }

  // Licenses
  async getLicenses(tenantId: string): Promise<License[]> {
    return db.select().from(licenses).where(eq(licenses.tenantId, tenantId));
  }

  async getLicense(id: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    return license || undefined;
  }

  async getLicenseByKey(key: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.licenseKey, key));
    return license || undefined;
  }

  async createLicense(license: InsertLicense): Promise<License> {
    const [created] = await db.insert(licenses).values(license).returning();
    return created;
  }

  async updateLicense(id: string, data: Partial<InsertLicense>): Promise<License | undefined> {
    const [updated] = await db.update(licenses).set(data).where(eq(licenses.id, id)).returning();
    return updated || undefined;
  }

  async getActiveLicenses(tenantId: string): Promise<License[]> {
    return db
      .select()
      .from(licenses)
      .where(and(eq(licenses.tenantId, tenantId), eq(licenses.status, "active")));
  }

  async getExpiredSessions(): Promise<License[]> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return db
      .select()
      .from(licenses)
      .where(and(isNotNull(licenses.currentIp), lt(licenses.lastSeenAt, tenMinutesAgo)));
  }

  // License Sessions
  async createLicenseSession(session: InsertLicenseSession): Promise<LicenseSession> {
    const [created] = await db.insert(licenseSessions).values(session).returning();
    return created;
  }

  async endLicenseSession(licenseId: string, reason: string): Promise<void> {
    await db
      .update(licenseSessions)
      .set({ endedAt: new Date(), endedReason: reason })
      .where(and(eq(licenseSessions.licenseId, licenseId), sql`ended_at IS NULL`));
  }

  // Stripe Events
  async getStripeEvent(id: string): Promise<StripeEvent | undefined> {
    const [event] = await db.select().from(stripeEvents).where(eq(stripeEvents.id, id));
    return event || undefined;
  }

  async createStripeEvent(event: { id: string; eventType: string; data?: unknown }): Promise<StripeEvent> {
    const [created] = await db
      .insert(stripeEvents)
      .values({
        id: event.id,
        eventType: event.eventType,
        data: event.data,
      })
      .returning();
    return created;
  }

  // Audit Logs
  async getAuditLogs(tenantId: string): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Dashboard Stats
  async getDashboardStats(tenantId: string) {
    const contractsList = await this.getContracts(tenantId);
    const licensesList = await this.getLicenses(tenantId);

    const totalContracts = contractsList.length;
    const activeContracts = contractsList.filter((c) => c.status === "active").length;
    const totalRevenue = contractsList.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);

    const activeLicenses = licensesList.filter((l) => l.status === "active").length;
    const licensesInUse = licensesList.filter((l) => l.currentIp !== null).length;

    return {
      totalContracts,
      activeContracts,
      totalRevenue: totalRevenue.toFixed(2),
      recognizedRevenue: (totalRevenue * 0.6).toFixed(2),
      deferredRevenue: (totalRevenue * 0.4).toFixed(2),
      activeLicenses,
      licensesInUse,
      contractAssets: (totalRevenue * 0.15).toFixed(2),
      contractLiabilities: (totalRevenue * 0.25).toFixed(2),
    };
  }
  // Subscription Plans
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan || undefined;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db.insert(subscriptionPlans).values(plan).returning();
    return created;
  }

  async updateSubscriptionPlan(id: string, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, id)).returning();
    return updated || undefined;
  }

  // Checkout Sessions
  async getCheckoutSession(stripeSessionId: string): Promise<CheckoutSession | undefined> {
    const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.stripeSessionId, stripeSessionId));
    return session || undefined;
  }

  async createCheckoutSession(session: InsertCheckoutSession): Promise<CheckoutSession> {
    const [created] = await db.insert(checkoutSessions).values(session).returning();
    return created;
  }

  async updateCheckoutSession(id: string, data: Partial<InsertCheckoutSession>): Promise<CheckoutSession | undefined> {
    const [updated] = await db.update(checkoutSessions).set(data).where(eq(checkoutSessions.id, id)).returning();
    return updated || undefined;
  }

  // Email Queue
  async createEmailQueueItem(item: InsertEmailQueueItem): Promise<EmailQueueItem> {
    const [created] = await db.insert(emailQueue).values(item).returning();
    return created;
  }

  async getPendingEmails(): Promise<EmailQueueItem[]> {
    return db.select().from(emailQueue).where(eq(emailQueue.status, "pending")).limit(10);
  }

  async updateEmailQueueItem(id: string, data: Partial<InsertEmailQueueItem>): Promise<EmailQueueItem | undefined> {
    const [updated] = await db.update(emailQueue).set(data).where(eq(emailQueue.id, id)).returning();
    return updated || undefined;
  }

  // All Licenses (for admin)
  async getAllLicenses(): Promise<License[]> {
    return db.select().from(licenses).orderBy(desc(licenses.createdAt));
  }

  // Authentication
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  async activateLicense(userId: string, licenseKey: string, ip: string): Promise<{ success: boolean; error?: string }> {
    const license = await this.getLicenseByKey(licenseKey);
    
    if (!license) {
      return { success: false, error: "Invalid license key" };
    }

    if (license.status !== "active") {
      return { success: false, error: "License is not active" };
    }

    if (license.activatedByUserId && license.activatedByUserId !== userId) {
      return { success: false, error: "License already activated by another user" };
    }

    // Update license with activation info
    await db.update(licenses).set({
      activatedAt: new Date(),
      activatedByUserId: userId,
      activationIp: ip,
      currentUserId: userId,
      currentIp: ip,
      lockedAt: new Date(),
      lastSeenAt: new Date(),
    }).where(eq(licenses.id, license.id));

    // Update user with license info and activate
    await db.update(users).set({
      isActive: true,
      licenseKey: licenseKey,
      licenseActivatedAt: new Date(),
    }).where(eq(users.id, userId));

    // Create license session
    await this.createLicenseSession({
      licenseId: license.id,
      ip,
      userId,
    });

    return { success: true };
  }

  // AI Provider Configs (BYOK)
  async getAiProviderConfigs(tenantId: string): Promise<AiProviderConfig[]> {
    return db.select().from(aiProviderConfigs).where(eq(aiProviderConfigs.tenantId, tenantId)).orderBy(desc(aiProviderConfigs.createdAt));
  }

  async getAiProviderConfig(id: string): Promise<AiProviderConfig | undefined> {
    const [config] = await db.select().from(aiProviderConfigs).where(eq(aiProviderConfigs.id, id));
    return config || undefined;
  }

  async createAiProviderConfig(config: InsertAiProviderConfig): Promise<AiProviderConfig> {
    // If this is the first config or marked as default, ensure only one default
    if (config.isDefault) {
      await db.update(aiProviderConfigs).set({ isDefault: false }).where(eq(aiProviderConfigs.tenantId, config.tenantId));
    }
    const [created] = await db.insert(aiProviderConfigs).values(config).returning();
    return created;
  }

  async updateAiProviderConfig(id: string, data: Partial<InsertAiProviderConfig>): Promise<AiProviderConfig | undefined> {
    const existing = await this.getAiProviderConfig(id);
    if (existing && data.isDefault) {
      await db.update(aiProviderConfigs).set({ isDefault: false }).where(eq(aiProviderConfigs.tenantId, existing.tenantId));
    }
    const [updated] = await db.update(aiProviderConfigs).set({ ...data, updatedAt: new Date() }).where(eq(aiProviderConfigs.id, id)).returning();
    return updated || undefined;
  }

  async deleteAiProviderConfig(id: string): Promise<boolean> {
    const result = await db.delete(aiProviderConfigs).where(eq(aiProviderConfigs.id, id)).returning();
    return result.length > 0;
  }

  async getDefaultAiProviderConfig(tenantId: string): Promise<AiProviderConfig | undefined> {
    const [config] = await db.select().from(aiProviderConfigs).where(and(eq(aiProviderConfigs.tenantId, tenantId), eq(aiProviderConfigs.isDefault, true)));
    return config || undefined;
  }

  // AI Ingestion Jobs
  async getAiIngestionJobs(tenantId: string): Promise<AiIngestionJob[]> {
    return db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.tenantId, tenantId)).orderBy(desc(aiIngestionJobs.createdAt));
  }

  async getAiIngestionJob(id: string): Promise<AiIngestionJob | undefined> {
    const [job] = await db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.id, id));
    return job || undefined;
  }

  async createAiIngestionJob(job: InsertAiIngestionJob): Promise<AiIngestionJob> {
    const [created] = await db.insert(aiIngestionJobs).values(job).returning();
    return created;
  }

  async updateAiIngestionJob(id: string, data: Partial<InsertAiIngestionJob>): Promise<AiIngestionJob | undefined> {
    const [updated] = await db.update(aiIngestionJobs).set(data).where(eq(aiIngestionJobs.id, id)).returning();
    return updated || undefined;
  }

  async getPendingIngestionJobs(): Promise<AiIngestionJob[]> {
    return db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.status, "pending")).orderBy(aiIngestionJobs.createdAt);
  }

  // AI Extraction Results
  async getAiExtractionResult(jobId: string): Promise<AiExtractionResult | undefined> {
    const [result] = await db.select().from(aiExtractionResults).where(eq(aiExtractionResults.jobId, jobId));
    return result || undefined;
  }

  async createAiExtractionResult(result: InsertAiExtractionResult): Promise<AiExtractionResult> {
    const [created] = await db.insert(aiExtractionResults).values(result).returning();
    return created;
  }

  // AI Review Tasks
  async getAiReviewTasks(tenantId: string): Promise<AiReviewTask[]> {
    const jobs = await db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.tenantId, tenantId));
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length === 0) return [];
    const tasks = await db.select().from(aiReviewTasks);
    return tasks.filter(t => jobIds.includes(t.jobId));
  }

  async getAiReviewTask(id: string): Promise<AiReviewTask | undefined> {
    const [task] = await db.select().from(aiReviewTasks).where(eq(aiReviewTasks.id, id));
    return task || undefined;
  }

  async getPendingReviewTasks(tenantId: string): Promise<AiReviewTask[]> {
    const jobs = await db.select().from(aiIngestionJobs).where(eq(aiIngestionJobs.tenantId, tenantId));
    const jobIds = jobs.map(j => j.id);
    if (jobIds.length === 0) return [];
    const tasks = await db.select().from(aiReviewTasks).where(eq(aiReviewTasks.status, "pending"));
    return tasks.filter(t => jobIds.includes(t.jobId));
  }

  async createAiReviewTask(task: InsertAiReviewTask): Promise<AiReviewTask> {
    const [created] = await db.insert(aiReviewTasks).values(task).returning();
    return created;
  }

  async updateAiReviewTask(id: string, data: Partial<InsertAiReviewTask>): Promise<AiReviewTask | undefined> {
    const [updated] = await db.update(aiReviewTasks).set(data).where(eq(aiReviewTasks.id, id)).returning();
    return updated || undefined;
  }

  // ==================== ACCOUNTING METHODS (IFRS 15) ====================

  // Billing Schedules
  async getBillingSchedules(tenantId: string): Promise<BillingSchedule[]> {
    return db.select().from(billingSchedules).where(eq(billingSchedules.tenantId, tenantId)).orderBy(desc(billingSchedules.billingDate));
  }

  async getBillingSchedulesByContract(contractId: string): Promise<BillingSchedule[]> {
    return db.select().from(billingSchedules).where(eq(billingSchedules.contractId, contractId)).orderBy(billingSchedules.billingDate);
  }

  async getBillingSchedule(id: string): Promise<BillingSchedule | undefined> {
    const [schedule] = await db.select().from(billingSchedules).where(eq(billingSchedules.id, id));
    return schedule || undefined;
  }

  async createBillingSchedule(schedule: InsertBillingSchedule): Promise<BillingSchedule> {
    const [created] = await db.insert(billingSchedules).values(schedule).returning();
    return created;
  }

  async updateBillingSchedule(id: string, data: Partial<InsertBillingSchedule>): Promise<BillingSchedule | undefined> {
    const [updated] = await db.update(billingSchedules).set(data).where(eq(billingSchedules.id, id)).returning();
    return updated || undefined;
  }

  async getUpcomingBillings(tenantId: string, days: number): Promise<BillingSchedule[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);
    return db.select().from(billingSchedules)
      .where(and(
        eq(billingSchedules.tenantId, tenantId),
        eq(billingSchedules.status, "scheduled"),
        gte(billingSchedules.billingDate, now),
        lt(billingSchedules.billingDate, future)
      ))
      .orderBy(billingSchedules.billingDate);
  }

  async getOverdueBillings(tenantId: string): Promise<BillingSchedule[]> {
    const now = new Date();
    return db.select().from(billingSchedules)
      .where(and(
        eq(billingSchedules.tenantId, tenantId),
        eq(billingSchedules.status, "overdue")
      ))
      .orderBy(billingSchedules.dueDate);
  }

  // Revenue Ledger Entries
  async getRevenueLedgerEntries(tenantId: string): Promise<RevenueLedgerEntry[]> {
    return db.select().from(revenueLedgerEntries).where(eq(revenueLedgerEntries.tenantId, tenantId)).orderBy(desc(revenueLedgerEntries.entryDate));
  }

  async getRevenueLedgerEntriesByContract(contractId: string): Promise<RevenueLedgerEntry[]> {
    return db.select().from(revenueLedgerEntries).where(eq(revenueLedgerEntries.contractId, contractId)).orderBy(desc(revenueLedgerEntries.entryDate));
  }

  async getRevenueLedgerEntry(id: string): Promise<RevenueLedgerEntry | undefined> {
    const [entry] = await db.select().from(revenueLedgerEntries).where(eq(revenueLedgerEntries.id, id));
    return entry || undefined;
  }

  async createRevenueLedgerEntry(entry: InsertRevenueLedgerEntry): Promise<RevenueLedgerEntry> {
    const [created] = await db.insert(revenueLedgerEntries).values(entry).returning();
    return created;
  }

  async updateRevenueLedgerEntry(id: string, data: Partial<InsertRevenueLedgerEntry>): Promise<RevenueLedgerEntry | undefined> {
    const [updated] = await db.update(revenueLedgerEntries).set(data).where(eq(revenueLedgerEntries.id, id)).returning();
    return updated || undefined;
  }

  async getUnpostedLedgerEntries(tenantId: string): Promise<RevenueLedgerEntry[]> {
    return db.select().from(revenueLedgerEntries)
      .where(and(
        eq(revenueLedgerEntries.tenantId, tenantId),
        eq(revenueLedgerEntries.isPosted, false)
      ))
      .orderBy(revenueLedgerEntries.entryDate);
  }

  // Contract Costs
  async getContractCosts(tenantId: string): Promise<ContractCost[]> {
    return db.select().from(contractCosts).where(eq(contractCosts.tenantId, tenantId)).orderBy(desc(contractCosts.incurredDate));
  }

  async getContractCostsByContract(contractId: string): Promise<ContractCost[]> {
    return db.select().from(contractCosts).where(eq(contractCosts.contractId, contractId)).orderBy(contractCosts.incurredDate);
  }

  async getContractCost(id: string): Promise<ContractCost | undefined> {
    const [cost] = await db.select().from(contractCosts).where(eq(contractCosts.id, id));
    return cost || undefined;
  }

  async createContractCost(cost: InsertContractCost): Promise<ContractCost> {
    const [created] = await db.insert(contractCosts).values(cost).returning();
    return created;
  }

  async updateContractCost(id: string, data: Partial<InsertContractCost>): Promise<ContractCost | undefined> {
    const [updated] = await db.update(contractCosts).set(data).where(eq(contractCosts.id, id)).returning();
    return updated || undefined;
  }

  // Exchange Rates
  async getExchangeRates(tenantId: string): Promise<ExchangeRate[]> {
    return db.select().from(exchangeRates).where(eq(exchangeRates.tenantId, tenantId)).orderBy(desc(exchangeRates.effectiveDate));
  }

  async getExchangeRate(tenantId: string, fromCurrency: string, toCurrency: string): Promise<ExchangeRate | undefined> {
    const [rate] = await db.select().from(exchangeRates)
      .where(and(
        eq(exchangeRates.tenantId, tenantId),
        eq(exchangeRates.fromCurrency, fromCurrency),
        eq(exchangeRates.toCurrency, toCurrency)
      ))
      .orderBy(desc(exchangeRates.effectiveDate))
      .limit(1);
    return rate || undefined;
  }

  async createExchangeRate(rate: InsertExchangeRate): Promise<ExchangeRate> {
    const [created] = await db.insert(exchangeRates).values(rate).returning();
    return created;
  }

  async updateExchangeRate(id: string, data: Partial<InsertExchangeRate>): Promise<ExchangeRate | undefined> {
    const [updated] = await db.update(exchangeRates).set(data).where(eq(exchangeRates.id, id)).returning();
    return updated || undefined;
  }

  // Financing Components
  async getFinancingComponents(tenantId: string): Promise<FinancingComponent[]> {
    return db.select().from(financingComponents).where(eq(financingComponents.tenantId, tenantId)).orderBy(desc(financingComponents.createdAt));
  }

  async getFinancingComponentsByContract(contractId: string): Promise<FinancingComponent[]> {
    return db.select().from(financingComponents).where(eq(financingComponents.contractId, contractId));
  }

  async getFinancingComponent(id: string): Promise<FinancingComponent | undefined> {
    const [component] = await db.select().from(financingComponents).where(eq(financingComponents.id, id));
    return component || undefined;
  }

  async createFinancingComponent(component: InsertFinancingComponent): Promise<FinancingComponent> {
    const [created] = await db.insert(financingComponents).values(component).returning();
    return created;
  }

  async updateFinancingComponent(id: string, data: Partial<InsertFinancingComponent>): Promise<FinancingComponent | undefined> {
    const [updated] = await db.update(financingComponents).set(data).where(eq(financingComponents.id, id)).returning();
    return updated || undefined;
  }

  // Consolidated Balances
  async getConsolidatedBalances(tenantId: string): Promise<ConsolidatedBalance[]> {
    return db.select().from(consolidatedBalances).where(eq(consolidatedBalances.tenantId, tenantId)).orderBy(desc(consolidatedBalances.periodDate));
  }

  async getConsolidatedBalance(id: string): Promise<ConsolidatedBalance | undefined> {
    const [balance] = await db.select().from(consolidatedBalances).where(eq(consolidatedBalances.id, id));
    return balance || undefined;
  }

  async createConsolidatedBalance(balance: InsertConsolidatedBalance): Promise<ConsolidatedBalance> {
    const [created] = await db.insert(consolidatedBalances).values(balance).returning();
    return created;
  }

  async getLatestConsolidatedBalance(tenantId: string): Promise<ConsolidatedBalance | undefined> {
    const [balance] = await db.select().from(consolidatedBalances)
      .where(eq(consolidatedBalances.tenantId, tenantId))
      .orderBy(desc(consolidatedBalances.periodDate))
      .limit(1);
    return balance || undefined;
  }
}

export const storage = new DatabaseStorage();
