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
}

export const storage = new DatabaseStorage();
