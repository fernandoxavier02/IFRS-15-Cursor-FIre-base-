"use strict";
// Firestore Types for IFRS 15 Revenue Manager
// Converted from Drizzle/PostgreSQL schema to Firestore-compatible types
Object.defineProperty(exports, "__esModule", { value: true });
exports.planLimits = exports.aiModels = exports.COLLECTIONS = exports.contractExtractionSchema = exports.createAiProviderConfigSchema = exports.createRevenueLedgerEntrySchema = exports.createBillingScheduleSchema = exports.createPerformanceObligationSchema = exports.createLineItemSchema = exports.createContractVersionSchema = exports.createContractSchema = exports.createCustomerSchema = exports.createUserSchema = exports.CostType = exports.LedgerEntryType = exports.BillingStatus = exports.BillingFrequency = exports.ReviewStatus = exports.IngestionStatus = exports.AiProvider = exports.AuditAction = exports.PlanType = exports.SubscriptionStatus = exports.LicenseStatus = exports.MeasurementMethod = exports.RecognitionMethod = exports.ContractStatus = exports.UserRole = void 0;
exports.toDate = toDate;
exports.toISOString = toISOString;
const zod_1 = require("zod");
// ==================== ENUMS ====================
exports.UserRole = {
    ADMIN: "admin",
    FINANCE: "finance",
    AUDITOR: "auditor",
    OPERATIONS: "operations",
    READONLY: "readonly",
};
exports.ContractStatus = {
    ACTIVE: "active",
    MODIFIED: "modified",
    TERMINATED: "terminated",
    EXPIRED: "expired",
};
exports.RecognitionMethod = {
    OVER_TIME: "over_time",
    POINT_IN_TIME: "point_in_time",
};
exports.MeasurementMethod = {
    INPUT: "input",
    OUTPUT: "output",
};
exports.LicenseStatus = {
    ACTIVE: "active",
    SUSPENDED: "suspended",
    REVOKED: "revoked",
    EXPIRED: "expired",
};
exports.SubscriptionStatus = {
    ACTIVE: "active",
    PAST_DUE: "past_due",
    CANCELED: "canceled",
    UNPAID: "unpaid",
    TRIALING: "trialing",
};
exports.PlanType = {
    STARTER: "starter",
    PROFESSIONAL: "professional",
    ENTERPRISE: "enterprise",
};
exports.AuditAction = {
    CREATE: "create",
    UPDATE: "update",
    DELETE: "delete",
    APPROVE: "approve",
    REJECT: "reject",
    RECOGNIZE: "recognize",
    DEFER: "defer",
};
exports.AiProvider = {
    OPENAI: "openai",
    ANTHROPIC: "anthropic",
    OPENROUTER: "openrouter",
    GOOGLE: "google",
};
exports.IngestionStatus = {
    PENDING: "pending",
    PROCESSING: "processing",
    AWAITING_REVIEW: "awaiting_review",
    APPROVED: "approved",
    REJECTED: "rejected",
    FAILED: "failed",
};
exports.ReviewStatus = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    NEEDS_CORRECTION: "needs_correction",
};
exports.BillingFrequency = {
    MONTHLY: "monthly",
    QUARTERLY: "quarterly",
    SEMI_ANNUAL: "semi_annual",
    ANNUAL: "annual",
    MILESTONE: "milestone",
    ONE_TIME: "one_time",
};
exports.BillingStatus = {
    SCHEDULED: "scheduled",
    INVOICED: "invoiced",
    PAID: "paid",
    OVERDUE: "overdue",
    CANCELLED: "cancelled",
};
exports.LedgerEntryType = {
    REVENUE: "revenue",
    DEFERRED_REVENUE: "deferred_revenue",
    CONTRACT_ASSET: "contract_asset",
    CONTRACT_LIABILITY: "contract_liability",
    RECEIVABLE: "receivable",
    CASH: "cash",
    FINANCING_INCOME: "financing_income",
    COMMISSION_EXPENSE: "commission_expense",
};
exports.CostType = {
    INCREMENTAL: "incremental",
    FULFILLMENT: "fulfillment",
};
// Helper function to convert Firestore timestamps to Date
function toDate(timestamp) {
    if (!timestamp)
        return null;
    if (timestamp instanceof Date)
        return timestamp;
    if (typeof timestamp.toDate === "function") {
        return timestamp.toDate();
    }
    return null;
}
// Helper function to convert to ISO string
function toISOString(timestamp) {
    const date = toDate(timestamp);
    return date ? date.toISOString() : "";
}
// ==================== ZOD VALIDATION SCHEMAS ====================
exports.createUserSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    username: zod_1.z.string().min(3),
    email: zod_1.z.string().email(),
    fullName: zod_1.z.string().min(2),
    role: zod_1.z.enum(["admin", "finance", "auditor", "operations", "readonly"]),
    mustChangePassword: zod_1.z.boolean().default(true),
    isActive: zod_1.z.boolean().default(false),
});
exports.createCustomerSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    name: zod_1.z.string().min(2),
    country: zod_1.z.string().default("BR"),
    currency: zod_1.z.string().default("BRL"),
    taxId: zod_1.z.string().optional(),
    creditRating: zod_1.z.string().optional(),
    contactEmail: zod_1.z.string().email().optional(),
    contactPhone: zod_1.z.string().optional(),
    billingAddress: zod_1.z.string().optional(),
});
exports.createContractSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    customerId: zod_1.z.string(),
    contractNumber: zod_1.z.string(),
    title: zod_1.z.string().min(3),
    status: zod_1.z.enum(["active", "modified", "terminated", "expired"]).default("active"),
    startDate: zod_1.z.date(),
    endDate: zod_1.z.date().optional(),
    totalValue: zod_1.z.number().positive(),
    currency: zod_1.z.string().default("BRL"),
    paymentTerms: zod_1.z.string().optional(),
});
exports.createContractVersionSchema = zod_1.z.object({
    contractId: zod_1.z.string(),
    versionNumber: zod_1.z.number().int().positive(),
    effectiveDate: zod_1.z.date(),
    description: zod_1.z.string().optional(),
    totalValue: zod_1.z.number().positive(),
    modificationReason: zod_1.z.string().optional(),
    isProspective: zod_1.z.boolean().default(true),
    createdBy: zod_1.z.string().optional(),
});
exports.createLineItemSchema = zod_1.z.object({
    contractVersionId: zod_1.z.string(),
    description: zod_1.z.string(),
    quantity: zod_1.z.number().positive().default(1),
    unitPrice: zod_1.z.number().positive(),
    totalPrice: zod_1.z.number().positive(),
    standaloneSelllingPrice: zod_1.z.number().optional(),
    isDistinct: zod_1.z.boolean().default(true),
    distinctWithinContext: zod_1.z.boolean().default(true),
    recognitionMethod: zod_1.z.enum(["over_time", "point_in_time"]),
    measurementMethod: zod_1.z.enum(["input", "output"]).optional(),
    deliveryStartDate: zod_1.z.date().optional(),
    deliveryEndDate: zod_1.z.date().optional(),
});
exports.createPerformanceObligationSchema = zod_1.z.object({
    contractVersionId: zod_1.z.string(),
    description: zod_1.z.string(),
    lineItemIds: zod_1.z.array(zod_1.z.string()).optional(),
    allocatedPrice: zod_1.z.number().positive(),
    recognitionMethod: zod_1.z.enum(["over_time", "point_in_time"]),
    measurementMethod: zod_1.z.enum(["input", "output"]).optional(),
    percentComplete: zod_1.z.number().min(0).max(100).default(0),
    recognizedAmount: zod_1.z.number().default(0),
    deferredAmount: zod_1.z.number().default(0),
    isSatisfied: zod_1.z.boolean().default(false),
    justification: zod_1.z.string().optional(),
});
exports.createBillingScheduleSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    contractId: zod_1.z.string(),
    performanceObligationId: zod_1.z.string().optional(),
    billingDate: zod_1.z.date(),
    dueDate: zod_1.z.date(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().default("BRL"),
    frequency: zod_1.z.enum(["monthly", "quarterly", "semi_annual", "annual", "milestone", "one_time"]),
    status: zod_1.z.enum(["scheduled", "invoiced", "paid", "overdue", "cancelled"]).default("scheduled"),
    invoiceNumber: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.createRevenueLedgerEntrySchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    contractId: zod_1.z.string(),
    performanceObligationId: zod_1.z.string().optional(),
    billingScheduleId: zod_1.z.string().optional(),
    ledgerVersion: zod_1.z.number().int().positive().optional(),
    source: zod_1.z.string().optional(),
    entryDate: zod_1.z.date(),
    periodStart: zod_1.z.date(),
    periodEnd: zod_1.z.date(),
    entryType: zod_1.z.enum([
        "revenue",
        "deferred_revenue",
        "contract_asset",
        "contract_liability",
        "receivable",
        "cash",
        "financing_income",
        "commission_expense",
    ]),
    debitAccount: zod_1.z.string(),
    creditAccount: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.string().default("BRL"),
    exchangeRate: zod_1.z.number().default(1),
    functionalAmount: zod_1.z.number().optional(),
    description: zod_1.z.string().optional(),
    referenceNumber: zod_1.z.string().optional(),
    isPosted: zod_1.z.boolean().default(false),
    isReversed: zod_1.z.boolean().default(false),
});
exports.createAiProviderConfigSchema = zod_1.z.object({
    tenantId: zod_1.z.string(),
    provider: zod_1.z.enum(["openai", "anthropic", "openrouter", "google"]),
    name: zod_1.z.string(),
    apiKey: zod_1.z.string(),
    model: zod_1.z.string(),
    baseUrl: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean().default(false),
    isActive: zod_1.z.boolean().default(true),
});
// Contract extraction schema for AI parsing
exports.contractExtractionSchema = zod_1.z.object({
    contractNumber: zod_1.z.string().optional(),
    title: zod_1.z.string(),
    customerName: zod_1.z.string(),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string().optional(),
    totalValue: zod_1.z.number(),
    currency: zod_1.z.string().default("BRL"),
    paymentTerms: zod_1.z.string().optional(),
    lineItems: zod_1.z.array(zod_1.z.object({
        description: zod_1.z.string(),
        quantity: zod_1.z.number().default(1),
        unitPrice: zod_1.z.number(),
        totalPrice: zod_1.z.number(),
        recognitionMethod: zod_1.z.enum(["over_time", "point_in_time"]).optional(),
        deliveryStartDate: zod_1.z.string().optional(),
        deliveryEndDate: zod_1.z.string().optional(),
    })),
    performanceObligations: zod_1.z
        .array(zod_1.z.object({
        description: zod_1.z.string(),
        allocatedPrice: zod_1.z.number(),
        recognitionMethod: zod_1.z.enum(["over_time", "point_in_time"]),
        justification: zod_1.z.string().optional(),
    }))
        .optional(),
});
// ==================== COLLECTION PATHS ====================
exports.COLLECTIONS = {
    TENANTS: "tenants",
    USERS: "users",
    CUSTOMERS: "customers",
    CONTRACTS: "contracts",
    CONTRACT_VERSIONS: "contractVersions",
    LINE_ITEMS: "lineItems",
    PERFORMANCE_OBLIGATIONS: "performanceObligations",
    REVENUE_SCHEDULES: "revenueSchedules",
    VARIABLE_CONSIDERATIONS: "variableConsiderations",
    CONTRACT_BALANCES: "contractBalances",
    LICENSES: "licenses",
    LICENSE_SESSIONS: "licenseSessions",
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
    // Firebase Extension collections
    MAIL: "mail", // For Trigger Email extension
};
// ==================== AI MODELS ====================
exports.aiModels = {
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
};
// Plan limits configuration
exports.planLimits = {
    starter: { contracts: 10, licenses: 1 },
    professional: { contracts: 30, licenses: 3 },
    enterprise: { contracts: -1, licenses: -1 }, // -1 = unlimited
};
//# sourceMappingURL=firestore-types.js.map