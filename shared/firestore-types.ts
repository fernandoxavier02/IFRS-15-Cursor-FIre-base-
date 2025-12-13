// Firestore Types for IFRS 15 Revenue Manager
// Converted from Drizzle/PostgreSQL schema to Firestore-compatible types

import { Timestamp } from "firebase/firestore";
import { z } from "zod";

// ==================== ENUMS ====================

export const UserRole = {
  ADMIN: "admin",
  FINANCE: "finance",
  AUDITOR: "auditor",
  OPERATIONS: "operations",
  READONLY: "readonly",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ContractStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  MODIFIED: "modified",
  TERMINATED: "terminated",
  EXPIRED: "expired",
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const RecognitionMethod = {
  OVER_TIME: "over_time",
  POINT_IN_TIME: "point_in_time",
} as const;
export type RecognitionMethod = (typeof RecognitionMethod)[keyof typeof RecognitionMethod];

export const MeasurementMethod = {
  INPUT: "input",
  OUTPUT: "output",
} as const;
export type MeasurementMethod = (typeof MeasurementMethod)[keyof typeof MeasurementMethod];

export const LicenseStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
  EXPIRED: "expired",
} as const;
export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus];

export const SubscriptionStatus = {
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
  UNPAID: "unpaid",
  TRIALING: "trialing",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PlanType = {
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
} as const;
export type PlanType = (typeof PlanType)[keyof typeof PlanType];

export const AuditAction = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  APPROVE: "approve",
  REJECT: "reject",
  RECOGNIZE: "recognize",
  DEFER: "defer",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AiProvider = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  OPENROUTER: "openrouter",
  GOOGLE: "google",
} as const;
export type AiProvider = (typeof AiProvider)[keyof typeof AiProvider];

export const IngestionStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  AWAITING_REVIEW: "awaiting_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  FAILED: "failed",
} as const;
export type IngestionStatus = (typeof IngestionStatus)[keyof typeof IngestionStatus];

export const ReviewStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_CORRECTION: "needs_correction",
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const BillingFrequency = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  SEMI_ANNUAL: "semi_annual",
  ANNUAL: "annual",
  MILESTONE: "milestone",
  ONE_TIME: "one_time",
} as const;
export type BillingFrequency = (typeof BillingFrequency)[keyof typeof BillingFrequency];

export const BillingStatus = {
  SCHEDULED: "scheduled",
  INVOICED: "invoiced",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;
export type BillingStatus = (typeof BillingStatus)[keyof typeof BillingStatus];

export const LedgerEntryType = {
  REVENUE: "revenue",
  DEFERRED_REVENUE: "deferred_revenue",
  CONTRACT_ASSET: "contract_asset",
  CONTRACT_LIABILITY: "contract_liability",
  RECEIVABLE: "receivable",
  CASH: "cash",
  FINANCING_INCOME: "financing_income",
  COMMISSION_EXPENSE: "commission_expense",
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const CostType = {
  INCREMENTAL: "incremental",
  FULFILLMENT: "fulfillment",
} as const;
export type CostType = (typeof CostType)[keyof typeof CostType];

// ==================== FIRESTORE DOCUMENT INTERFACES ====================

// Helper type for Firestore timestamps
export type FirestoreTimestamp = Timestamp | Date;

// Helper function to convert Firestore timestamps to Date
export function toDate(timestamp: FirestoreTimestamp | undefined | null): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof (timestamp as Timestamp).toDate === "function") {
    return (timestamp as Timestamp).toDate();
  }
  return null;
}

// Helper function to convert to ISO string
export function toISOString(timestamp: FirestoreTimestamp | undefined | null): string {
  const date = toDate(timestamp);
  return date ? date.toISOString() : "";
}

// Base interface for all documents
interface BaseDocument {
  id: string;
  createdAt: FirestoreTimestamp;
}

// Tenant (Organization)
export interface Tenant extends BaseDocument {
  name: string;
  country: string;
  currency: string;
  taxId?: string;
  planType: PlanType;
  maxContracts: number;
  maxLicenses: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodStart?: FirestoreTimestamp;
  currentPeriodEnd?: FirestoreTimestamp;
  cancelAtPeriodEnd: boolean;
}

// User
export interface User extends BaseDocument {
  tenantId: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
  licenseKey?: string;
  licenseActivatedAt?: FirestoreTimestamp;
  lastLoginAt?: FirestoreTimestamp;
  lastLoginIp?: string;
  // Note: password is stored in Firebase Auth, not Firestore
}

// Customer
export interface Customer extends BaseDocument {
  tenantId: string;
  name: string;
  country: string;
  currency: string;
  taxId?: string;
  creditRating?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: string;
}

// Contract (master)
export interface Contract extends BaseDocument {
  tenantId: string;
  customerId: string;
  contractNumber: string;
  title: string;
  status: ContractStatus;
  startDate: FirestoreTimestamp;
  endDate?: FirestoreTimestamp;
  totalValue: number;
  currency: string;
  paymentTerms?: string;
  currentVersionId?: string;
  updatedAt: FirestoreTimestamp;
}

// Contract Version (amendments)
export interface ContractVersion extends BaseDocument {
  contractId: string;
  versionNumber: number;
  effectiveDate: FirestoreTimestamp;
  description?: string;
  totalValue: number;
  modificationReason?: string;
  isProspective: boolean;
  createdBy?: string;
}

// Contract Line Item
export interface ContractLineItem extends BaseDocument {
  contractVersionId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  standaloneSelllingPrice?: number;
  isDistinct: boolean;
  distinctWithinContext: boolean;
  recognitionMethod: RecognitionMethod;
  measurementMethod?: MeasurementMethod;
  deliveryStartDate?: FirestoreTimestamp;
  deliveryEndDate?: FirestoreTimestamp;
}

// Performance Obligation (IFRS 15 Step 2)
export interface PerformanceObligation extends BaseDocument {
  contractVersionId: string;
  description: string;
  lineItemIds?: string[];
  allocatedPrice: number;
  recognitionMethod: RecognitionMethod;
  measurementMethod?: MeasurementMethod;
  percentComplete: number;
  recognizedAmount: number;
  deferredAmount: number;
  isSatisfied: boolean;
  satisfiedDate?: FirestoreTimestamp;
  justification?: string;
}

// Revenue Schedule (IFRS 15 Step 5)
export interface RevenueSchedule extends BaseDocument {
  performanceObligationId: string;
  periodStart: FirestoreTimestamp;
  periodEnd: FirestoreTimestamp;
  scheduledAmount: number;
  recognizedAmount: number;
  isRecognized: boolean;
  recognizedDate?: FirestoreTimestamp;
}

// Variable Consideration
export interface VariableConsideration extends BaseDocument {
  contractVersionId: string;
  type: string; // discount, rebate, refund, bonus, penalty
  estimatedAmount: number;
  constraintApplied: boolean;
  constraintReason?: string;
  probability?: number;
  estimationMethod?: string; // expected_value, most_likely
}

// Contract Balance
export interface ContractBalance extends BaseDocument {
  contractId: string;
  periodDate: FirestoreTimestamp;
  contractAsset: number;
  contractLiability: number;
  receivable: number;
  revenueRecognized: number;
  cashReceived: number;
}

// License
export interface License extends BaseDocument {
  tenantId: string;
  licenseKey: string;
  status: LicenseStatus;
  seatCount: number;
  currentIp?: string;
  currentUserId?: string;
  currentUserName?: string;
  lockedAt?: FirestoreTimestamp;
  lastSeenAt?: FirestoreTimestamp;
  graceUntil?: FirestoreTimestamp;
  activatedAt?: FirestoreTimestamp;
  activatedByUserId?: string;
  activationIp?: string;
}

// License Session
export interface LicenseSession extends BaseDocument {
  licenseId: string;
  ip: string;
  userId?: string;
  startedAt: FirestoreTimestamp;
  endedAt?: FirestoreTimestamp;
  endedReason?: string; // logout, timeout, force_release, ip_change
}

// Stripe Event (for idempotency)
export interface StripeEvent {
  id: string;
  eventType: string;
  processedAt: FirestoreTimestamp;
  data?: Record<string, unknown>;
}

// Subscription Plan
export interface SubscriptionPlan extends BaseDocument {
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  features?: string[];
  maxUsers: number;
  isActive: boolean;
}

// Checkout Session
export interface CheckoutSession extends BaseDocument {
  stripeSessionId: string;
  email: string;
  planId?: string;
  status: string; // pending, completed, expired
  tenantId?: string;
  completedAt?: FirestoreTimestamp;
}

// Email Queue
export interface EmailQueueItem extends BaseDocument {
  toEmail: string;
  subject: string;
  body: string;
  templateType: string; // welcome, credentials, subscription_active
  status: string; // pending, sent, failed
  attempts: number;
  lastError?: string;
  sentAt?: FirestoreTimestamp;
}

// Audit Log
export interface AuditLog extends BaseDocument {
  tenantId?: string;
  userId?: string;
  entityType: string; // contract, license, performance_obligation, etc.
  entityId: string;
  action: AuditAction;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  justification?: string;
  ipAddress?: string;
}

// AI Provider Config (BYOK)
export interface AiProviderConfig extends BaseDocument {
  tenantId: string;
  provider: AiProvider;
  name: string;
  apiKey: string; // Encrypted
  model: string;
  baseUrl?: string;
  isDefault: boolean;
  isActive: boolean;
  lastUsedAt?: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// AI Ingestion Job
export interface AiIngestionJob extends BaseDocument {
  tenantId: string;
  userId: string;
  providerId: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  status: IngestionStatus;
  progress: number; // 0-100
  errorMessage?: string;
  processingStartedAt?: FirestoreTimestamp;
  processingCompletedAt?: FirestoreTimestamp;
}

// AI Extraction Result
export interface AiExtractionResult extends BaseDocument {
  jobId: string;
  extractedData: Record<string, unknown>;
  confidenceScores?: Record<string, number>;
  rawResponse?: Record<string, unknown>;
  tokensUsed?: number;
  processingTimeMs?: number;
}

// AI Review Task
export interface AiReviewTask extends BaseDocument {
  jobId: string;
  extractionResultId: string;
  assignedTo?: string;
  status: ReviewStatus;
  reviewedData?: Record<string, unknown>;
  reviewNotes?: string;
  contractId?: string;
  reviewedAt?: FirestoreTimestamp;
  reviewedBy?: string;
}

// ==================== ACCOUNTING INTERFACES (IFRS 15) ====================

// Billing Schedule
export interface BillingSchedule extends BaseDocument {
  tenantId: string;
  contractId: string;
  performanceObligationId?: string;
  billingDate: FirestoreTimestamp;
  dueDate: FirestoreTimestamp;
  amount: number;
  currency: string;
  frequency: BillingFrequency;
  status: BillingStatus;
  invoiceNumber?: string;
  invoicedAt?: FirestoreTimestamp;
  paidAt?: FirestoreTimestamp;
  paidAmount?: number;
  notes?: string;
}

// Revenue Ledger Entry
export interface RevenueLedgerEntry extends BaseDocument {
  tenantId: string;
  contractId: string;
  performanceObligationId?: string;
  billingScheduleId?: string;
  entryDate: FirestoreTimestamp;
  periodStart: FirestoreTimestamp;
  periodEnd: FirestoreTimestamp;
  entryType: LedgerEntryType;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  functionalAmount?: number;
  description?: string;
  referenceNumber?: string;
  isPosted: boolean;
  postedAt?: FirestoreTimestamp;
  postedBy?: string;
  isReversed: boolean;
  reversedEntryId?: string;
}

// Contract Cost (ASC 340-40 / IFRS 15)
export interface ContractCost extends BaseDocument {
  tenantId: string;
  contractId: string;
  costType: CostType;
  description: string;
  amount: number;
  currency: string;
  incurredDate: FirestoreTimestamp;
  amortizationStartDate: FirestoreTimestamp;
  amortizationEndDate: FirestoreTimestamp;
  amortizationMethod: string;
  totalAmortized: number;
  remainingBalance?: number;
  isFullyAmortized: boolean;
  impairmentLoss: number;
}

// Exchange Rate
export interface ExchangeRate extends BaseDocument {
  tenantId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: FirestoreTimestamp;
  source: string;
}

// Financing Component (Significant Financing Component)
export interface FinancingComponent extends BaseDocument {
  tenantId: string;
  contractId: string;
  nominalAmount: number;
  presentValue: number;
  discountRate: number;
  financingPeriodMonths: number;
  totalInterest: number;
  recognizedInterest: number;
  currency: string;
  calculatedAt: FirestoreTimestamp;
}

// Consolidated Balance
export interface ConsolidatedBalance extends BaseDocument {
  tenantId: string;
  periodDate: FirestoreTimestamp;
  periodType: string;
  totalContractAssets: number;
  totalContractLiabilities: number;
  totalReceivables: number;
  totalDeferredRevenue: number;
  totalRecognizedRevenue: number;
  totalBilledAmount: number;
  totalCashReceived: number;
  totalRemainingObligations: number;
  contractCount: number;
  currency: string;
}

// ==================== ZOD VALIDATION SCHEMAS ====================

export const createUserSchema = z.object({
  tenantId: z.string(),
  username: z.string().min(3),
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(["admin", "finance", "auditor", "operations", "readonly"]),
  mustChangePassword: z.boolean().default(true),
  isActive: z.boolean().default(false),
});

export const createCustomerSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(2),
  country: z.string().default("BR"),
  currency: z.string().default("BRL"),
  taxId: z.string().optional(),
  creditRating: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
});

export const createContractSchema = z.object({
  tenantId: z.string(),
  customerId: z.string(),
  contractNumber: z.string(),
  title: z.string().min(3),
  status: z.enum(["draft", "active", "modified", "terminated", "expired"]).default("draft"),
  startDate: z.date(),
  endDate: z.date().optional(),
  totalValue: z.number().positive(),
  currency: z.string().default("BRL"),
  paymentTerms: z.string().optional(),
});

export const createContractVersionSchema = z.object({
  contractId: z.string(),
  versionNumber: z.number().int().positive(),
  effectiveDate: z.date(),
  description: z.string().optional(),
  totalValue: z.number().positive(),
  modificationReason: z.string().optional(),
  isProspective: z.boolean().default(true),
  createdBy: z.string().optional(),
});

export const createLineItemSchema = z.object({
  contractVersionId: z.string(),
  description: z.string(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
  standaloneSelllingPrice: z.number().optional(),
  isDistinct: z.boolean().default(true),
  distinctWithinContext: z.boolean().default(true),
  recognitionMethod: z.enum(["over_time", "point_in_time"]),
  measurementMethod: z.enum(["input", "output"]).optional(),
  deliveryStartDate: z.date().optional(),
  deliveryEndDate: z.date().optional(),
});

export const createPerformanceObligationSchema = z.object({
  contractVersionId: z.string(),
  description: z.string(),
  lineItemIds: z.array(z.string()).optional(),
  allocatedPrice: z.number().positive(),
  recognitionMethod: z.enum(["over_time", "point_in_time"]),
  measurementMethod: z.enum(["input", "output"]).optional(),
  percentComplete: z.number().min(0).max(100).default(0),
  recognizedAmount: z.number().default(0),
  deferredAmount: z.number().default(0),
  isSatisfied: z.boolean().default(false),
  justification: z.string().optional(),
});

export const createBillingScheduleSchema = z.object({
  tenantId: z.string(),
  contractId: z.string(),
  performanceObligationId: z.string().optional(),
  billingDate: z.date(),
  dueDate: z.date(),
  amount: z.number().positive(),
  currency: z.string().default("BRL"),
  frequency: z.enum(["monthly", "quarterly", "semi_annual", "annual", "milestone", "one_time"]),
  status: z.enum(["scheduled", "invoiced", "paid", "overdue", "cancelled"]).default("scheduled"),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const createRevenueLedgerEntrySchema = z.object({
  tenantId: z.string(),
  contractId: z.string(),
  performanceObligationId: z.string().optional(),
  billingScheduleId: z.string().optional(),
  entryDate: z.date(),
  periodStart: z.date(),
  periodEnd: z.date(),
  entryType: z.enum([
    "revenue",
    "deferred_revenue",
    "contract_asset",
    "contract_liability",
    "receivable",
    "cash",
    "financing_income",
    "commission_expense",
  ]),
  debitAccount: z.string(),
  creditAccount: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("BRL"),
  exchangeRate: z.number().default(1),
  functionalAmount: z.number().optional(),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
  isPosted: z.boolean().default(false),
  isReversed: z.boolean().default(false),
});

export const createAiProviderConfigSchema = z.object({
  tenantId: z.string(),
  provider: z.enum(["openai", "anthropic", "openrouter", "google"]),
  name: z.string(),
  apiKey: z.string(),
  model: z.string(),
  baseUrl: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

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
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().default(1),
      unitPrice: z.number(),
      totalPrice: z.number(),
      recognitionMethod: z.enum(["over_time", "point_in_time"]).optional(),
      deliveryStartDate: z.string().optional(),
      deliveryEndDate: z.string().optional(),
    })
  ),
  performanceObligations: z
    .array(
      z.object({
        description: z.string(),
        allocatedPrice: z.number(),
        recognitionMethod: z.enum(["over_time", "point_in_time"]),
        justification: z.string().optional(),
      })
    )
    .optional(),
});

export type ContractExtraction = z.infer<typeof contractExtractionSchema>;

// ==================== COLLECTION PATHS ====================

export const COLLECTIONS = {
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
} as const;

// ==================== AI MODELS ====================

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

// Plan limits configuration
export const planLimits = {
  starter: { contracts: 10, licenses: 1 },
  professional: { contracts: 30, licenses: 3 },
  enterprise: { contracts: -1, licenses: -1 }, // -1 = unlimited
} as const;
