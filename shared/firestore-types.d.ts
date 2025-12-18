import { Timestamp } from "firebase/firestore";
import { z } from "zod";
export declare const UserRole: {
    readonly ADMIN: "admin";
    readonly FINANCE: "finance";
    readonly AUDITOR: "auditor";
    readonly OPERATIONS: "operations";
    readonly READONLY: "readonly";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const ContractStatus: {
    readonly ACTIVE: "active";
    readonly MODIFIED: "modified";
    readonly TERMINATED: "terminated";
    readonly EXPIRED: "expired";
};
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];
export declare const RecognitionMethod: {
    readonly OVER_TIME: "over_time";
    readonly POINT_IN_TIME: "point_in_time";
};
export type RecognitionMethod = (typeof RecognitionMethod)[keyof typeof RecognitionMethod];
export declare const MeasurementMethod: {
    readonly INPUT: "input";
    readonly OUTPUT: "output";
};
export type MeasurementMethod = (typeof MeasurementMethod)[keyof typeof MeasurementMethod];
export declare const LicenseStatus: {
    readonly ACTIVE: "active";
    readonly SUSPENDED: "suspended";
    readonly REVOKED: "revoked";
    readonly EXPIRED: "expired";
};
export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus];
export declare const SubscriptionStatus: {
    readonly ACTIVE: "active";
    readonly PAST_DUE: "past_due";
    readonly CANCELED: "canceled";
    readonly UNPAID: "unpaid";
    readonly TRIALING: "trialing";
};
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export declare const PlanType: {
    readonly STARTER: "starter";
    readonly PROFESSIONAL: "professional";
    readonly ENTERPRISE: "enterprise";
};
export type PlanType = (typeof PlanType)[keyof typeof PlanType];
export declare const AuditAction: {
    readonly CREATE: "create";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly APPROVE: "approve";
    readonly REJECT: "reject";
    readonly RECOGNIZE: "recognize";
    readonly DEFER: "defer";
};
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
export declare const AiProvider: {
    readonly OPENAI: "openai";
    readonly ANTHROPIC: "anthropic";
    readonly OPENROUTER: "openrouter";
    readonly GOOGLE: "google";
};
export type AiProvider = (typeof AiProvider)[keyof typeof AiProvider];
export declare const IngestionStatus: {
    readonly PENDING: "pending";
    readonly PROCESSING: "processing";
    readonly AWAITING_REVIEW: "awaiting_review";
    readonly APPROVED: "approved";
    readonly REJECTED: "rejected";
    readonly FAILED: "failed";
};
export type IngestionStatus = (typeof IngestionStatus)[keyof typeof IngestionStatus];
export declare const ReviewStatus: {
    readonly PENDING: "pending";
    readonly APPROVED: "approved";
    readonly REJECTED: "rejected";
    readonly NEEDS_CORRECTION: "needs_correction";
};
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];
export declare const BillingFrequency: {
    readonly MONTHLY: "monthly";
    readonly QUARTERLY: "quarterly";
    readonly SEMI_ANNUAL: "semi_annual";
    readonly ANNUAL: "annual";
    readonly MILESTONE: "milestone";
    readonly ONE_TIME: "one_time";
};
export type BillingFrequency = (typeof BillingFrequency)[keyof typeof BillingFrequency];
export declare const BillingStatus: {
    readonly SCHEDULED: "scheduled";
    readonly INVOICED: "invoiced";
    readonly PAID: "paid";
    readonly OVERDUE: "overdue";
    readonly CANCELLED: "cancelled";
};
export type BillingStatus = (typeof BillingStatus)[keyof typeof BillingStatus];
export declare const LedgerEntryType: {
    readonly REVENUE: "revenue";
    readonly DEFERRED_REVENUE: "deferred_revenue";
    readonly CONTRACT_ASSET: "contract_asset";
    readonly CONTRACT_LIABILITY: "contract_liability";
    readonly RECEIVABLE: "receivable";
    readonly CASH: "cash";
    readonly FINANCING_INCOME: "financing_income";
    readonly COMMISSION_EXPENSE: "commission_expense";
};
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];
export declare const CostType: {
    readonly INCREMENTAL: "incremental";
    readonly FULFILLMENT: "fulfillment";
};
export type CostType = (typeof CostType)[keyof typeof CostType];
export type FirestoreTimestamp = Timestamp | Date;
export declare function toDate(timestamp: FirestoreTimestamp | undefined | null): Date | null;
export declare function toISOString(timestamp: FirestoreTimestamp | undefined | null): string;
interface BaseDocument {
    id: string;
    createdAt: FirestoreTimestamp;
}
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
}
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
export interface RevenueSchedule extends BaseDocument {
    performanceObligationId: string;
    periodStart: FirestoreTimestamp;
    periodEnd: FirestoreTimestamp;
    scheduledAmount: number;
    recognizedAmount: number;
    isRecognized: boolean;
    recognizedDate?: FirestoreTimestamp;
}
export interface VariableConsideration extends BaseDocument {
    contractVersionId: string;
    type: string;
    estimatedAmount: number;
    constraintApplied: boolean;
    constraintReason?: string;
    probability?: number;
    estimationMethod?: string;
}
export interface ContractBalance extends BaseDocument {
    contractId: string;
    periodDate: FirestoreTimestamp;
    contractAsset: number;
    contractLiability: number;
    receivable: number;
    revenueRecognized: number;
    cashReceived: number;
}
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
export interface LicenseSession extends BaseDocument {
    licenseId: string;
    ip: string;
    userId?: string;
    startedAt: FirestoreTimestamp;
    endedAt?: FirestoreTimestamp;
    endedReason?: string;
}
export interface StripeEvent {
    id: string;
    eventType: string;
    processedAt: FirestoreTimestamp;
    data?: Record<string, unknown>;
}
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
export interface CheckoutSession extends BaseDocument {
    stripeSessionId: string;
    email: string;
    planId?: string;
    status: string;
    tenantId?: string;
    completedAt?: FirestoreTimestamp;
}
export interface EmailQueueItem extends BaseDocument {
    toEmail: string;
    subject: string;
    body: string;
    templateType: string;
    status: string;
    attempts: number;
    lastError?: string;
    sentAt?: FirestoreTimestamp;
}
export interface AuditLog extends BaseDocument {
    tenantId?: string;
    userId?: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    justification?: string;
    ipAddress?: string;
}
export interface AiProviderConfig extends BaseDocument {
    tenantId: string;
    provider: AiProvider;
    name: string;
    apiKey: string;
    model: string;
    baseUrl?: string;
    isDefault: boolean;
    isActive: boolean;
    lastUsedAt?: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}
export interface AiIngestionJob extends BaseDocument {
    tenantId: string;
    userId: string;
    providerId: string;
    fileName: string;
    fileSize: number;
    filePath: string;
    status: IngestionStatus;
    progress: number;
    errorMessage?: string;
    processingStartedAt?: FirestoreTimestamp;
    processingCompletedAt?: FirestoreTimestamp;
}
export interface AiExtractionResult extends BaseDocument {
    jobId: string;
    extractedData: Record<string, unknown>;
    confidenceScores?: Record<string, number>;
    rawResponse?: Record<string, unknown>;
    tokensUsed?: number;
    processingTimeMs?: number;
}
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
    poSatisfiedAt?: FirestoreTimestamp;
    notes?: string;
}
export interface RevenueLedgerEntry extends BaseDocument {
    tenantId: string;
    contractId: string;
    performanceObligationId?: string;
    billingScheduleId?: string;
    ledgerVersion?: number;
    source?: string;
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
export interface ExchangeRate extends BaseDocument {
    tenantId: string;
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    effectiveDate: FirestoreTimestamp;
    source: string;
}
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
export declare const createUserSchema: z.ZodObject<{
    tenantId: z.ZodString;
    username: z.ZodString;
    email: z.ZodString;
    fullName: z.ZodString;
    role: z.ZodEnum<["admin", "finance", "auditor", "operations", "readonly"]>;
    mustChangePassword: z.ZodDefault<z.ZodBoolean>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    mustChangePassword: boolean;
    role: "readonly" | "admin" | "finance" | "auditor" | "operations";
    email: string;
    fullName: string;
    tenantId: string;
    username: string;
}, {
    role: "readonly" | "admin" | "finance" | "auditor" | "operations";
    email: string;
    fullName: string;
    tenantId: string;
    username: string;
    isActive?: boolean | undefined;
    mustChangePassword?: boolean | undefined;
}>;
export declare const createCustomerSchema: z.ZodObject<{
    tenantId: z.ZodString;
    name: z.ZodString;
    country: z.ZodDefault<z.ZodString>;
    currency: z.ZodDefault<z.ZodString>;
    taxId: z.ZodOptional<z.ZodString>;
    creditRating: z.ZodOptional<z.ZodString>;
    contactEmail: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
    billingAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    country: string;
    currency: string;
    name: string;
    taxId?: string | undefined;
    creditRating?: string | undefined;
    contactEmail?: string | undefined;
    contactPhone?: string | undefined;
    billingAddress?: string | undefined;
}, {
    tenantId: string;
    name: string;
    country?: string | undefined;
    currency?: string | undefined;
    taxId?: string | undefined;
    creditRating?: string | undefined;
    contactEmail?: string | undefined;
    contactPhone?: string | undefined;
    billingAddress?: string | undefined;
}>;
export declare const createContractSchema: z.ZodObject<{
    tenantId: z.ZodString;
    customerId: z.ZodString;
    contractNumber: z.ZodString;
    title: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["active", "modified", "terminated", "expired"]>>;
    startDate: z.ZodDate;
    endDate: z.ZodOptional<z.ZodDate>;
    totalValue: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    paymentTerms: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    status: "active" | "modified" | "terminated" | "expired";
    currency: string;
    contractNumber: string;
    title: string;
    startDate: Date;
    totalValue: number;
    customerId: string;
    endDate?: Date | undefined;
    paymentTerms?: string | undefined;
}, {
    tenantId: string;
    contractNumber: string;
    title: string;
    startDate: Date;
    totalValue: number;
    customerId: string;
    status?: "active" | "modified" | "terminated" | "expired" | undefined;
    currency?: string | undefined;
    endDate?: Date | undefined;
    paymentTerms?: string | undefined;
}>;
export declare const createContractVersionSchema: z.ZodObject<{
    contractId: z.ZodString;
    versionNumber: z.ZodNumber;
    effectiveDate: z.ZodDate;
    description: z.ZodOptional<z.ZodString>;
    totalValue: z.ZodNumber;
    modificationReason: z.ZodOptional<z.ZodString>;
    isProspective: z.ZodDefault<z.ZodBoolean>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    totalValue: number;
    contractId: string;
    versionNumber: number;
    isProspective: boolean;
    effectiveDate: Date;
    description?: string | undefined;
    createdBy?: string | undefined;
    modificationReason?: string | undefined;
}, {
    totalValue: number;
    contractId: string;
    versionNumber: number;
    effectiveDate: Date;
    description?: string | undefined;
    isProspective?: boolean | undefined;
    createdBy?: string | undefined;
    modificationReason?: string | undefined;
}>;
export declare const createLineItemSchema: z.ZodObject<{
    contractVersionId: z.ZodString;
    description: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    unitPrice: z.ZodNumber;
    totalPrice: z.ZodNumber;
    standaloneSelllingPrice: z.ZodOptional<z.ZodNumber>;
    isDistinct: z.ZodDefault<z.ZodBoolean>;
    distinctWithinContext: z.ZodDefault<z.ZodBoolean>;
    recognitionMethod: z.ZodEnum<["over_time", "point_in_time"]>;
    measurementMethod: z.ZodOptional<z.ZodEnum<["input", "output"]>>;
    deliveryStartDate: z.ZodOptional<z.ZodDate>;
    deliveryEndDate: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    recognitionMethod: "over_time" | "point_in_time";
    contractVersionId: string;
    isDistinct: boolean;
    distinctWithinContext: boolean;
    deliveryStartDate?: Date | undefined;
    deliveryEndDate?: Date | undefined;
    standaloneSelllingPrice?: number | undefined;
    measurementMethod?: "input" | "output" | undefined;
}, {
    description: string;
    unitPrice: number;
    totalPrice: number;
    recognitionMethod: "over_time" | "point_in_time";
    contractVersionId: string;
    quantity?: number | undefined;
    deliveryStartDate?: Date | undefined;
    deliveryEndDate?: Date | undefined;
    isDistinct?: boolean | undefined;
    distinctWithinContext?: boolean | undefined;
    standaloneSelllingPrice?: number | undefined;
    measurementMethod?: "input" | "output" | undefined;
}>;
export declare const createPerformanceObligationSchema: z.ZodObject<{
    contractVersionId: z.ZodString;
    description: z.ZodString;
    lineItemIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    allocatedPrice: z.ZodNumber;
    recognitionMethod: z.ZodEnum<["over_time", "point_in_time"]>;
    measurementMethod: z.ZodOptional<z.ZodEnum<["input", "output"]>>;
    percentComplete: z.ZodDefault<z.ZodNumber>;
    recognizedAmount: z.ZodDefault<z.ZodNumber>;
    deferredAmount: z.ZodDefault<z.ZodNumber>;
    isSatisfied: z.ZodDefault<z.ZodBoolean>;
    justification: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    recognitionMethod: "over_time" | "point_in_time";
    allocatedPrice: number;
    contractVersionId: string;
    percentComplete: number;
    recognizedAmount: number;
    deferredAmount: number;
    isSatisfied: boolean;
    justification?: string | undefined;
    measurementMethod?: "input" | "output" | undefined;
    lineItemIds?: string[] | undefined;
}, {
    description: string;
    recognitionMethod: "over_time" | "point_in_time";
    allocatedPrice: number;
    contractVersionId: string;
    justification?: string | undefined;
    percentComplete?: number | undefined;
    recognizedAmount?: number | undefined;
    deferredAmount?: number | undefined;
    isSatisfied?: boolean | undefined;
    measurementMethod?: "input" | "output" | undefined;
    lineItemIds?: string[] | undefined;
}>;
export declare const createBillingScheduleSchema: z.ZodObject<{
    tenantId: z.ZodString;
    contractId: z.ZodString;
    performanceObligationId: z.ZodOptional<z.ZodString>;
    billingDate: z.ZodDate;
    dueDate: z.ZodDate;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    frequency: z.ZodEnum<["monthly", "quarterly", "semi_annual", "annual", "milestone", "one_time"]>;
    status: z.ZodDefault<z.ZodEnum<["scheduled", "invoiced", "paid", "overdue", "cancelled"]>>;
    invoiceNumber: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    status: "cancelled" | "scheduled" | "invoiced" | "paid" | "overdue";
    currency: string;
    contractId: string;
    billingDate: Date;
    dueDate: Date;
    amount: number;
    frequency: "monthly" | "quarterly" | "semi_annual" | "annual" | "milestone" | "one_time";
    performanceObligationId?: string | undefined;
    invoiceNumber?: string | undefined;
    notes?: string | undefined;
}, {
    tenantId: string;
    contractId: string;
    billingDate: Date;
    dueDate: Date;
    amount: number;
    frequency: "monthly" | "quarterly" | "semi_annual" | "annual" | "milestone" | "one_time";
    status?: "cancelled" | "scheduled" | "invoiced" | "paid" | "overdue" | undefined;
    currency?: string | undefined;
    performanceObligationId?: string | undefined;
    invoiceNumber?: string | undefined;
    notes?: string | undefined;
}>;
export declare const createRevenueLedgerEntrySchema: z.ZodObject<{
    tenantId: z.ZodString;
    contractId: z.ZodString;
    performanceObligationId: z.ZodOptional<z.ZodString>;
    billingScheduleId: z.ZodOptional<z.ZodString>;
    ledgerVersion: z.ZodOptional<z.ZodNumber>;
    source: z.ZodOptional<z.ZodString>;
    entryDate: z.ZodDate;
    periodStart: z.ZodDate;
    periodEnd: z.ZodDate;
    entryType: z.ZodEnum<["revenue", "deferred_revenue", "contract_asset", "contract_liability", "receivable", "cash", "financing_income", "commission_expense"]>;
    debitAccount: z.ZodString;
    creditAccount: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    exchangeRate: z.ZodDefault<z.ZodNumber>;
    functionalAmount: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    referenceNumber: z.ZodOptional<z.ZodString>;
    isPosted: z.ZodDefault<z.ZodBoolean>;
    isReversed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    currency: string;
    contractId: string;
    amount: number;
    entryDate: Date;
    periodStart: Date;
    periodEnd: Date;
    entryType: "revenue" | "deferred_revenue" | "contract_asset" | "contract_liability" | "receivable" | "cash" | "financing_income" | "commission_expense";
    debitAccount: string;
    creditAccount: string;
    exchangeRate: number;
    isPosted: boolean;
    isReversed: boolean;
    description?: string | undefined;
    performanceObligationId?: string | undefined;
    billingScheduleId?: string | undefined;
    ledgerVersion?: number | undefined;
    source?: string | undefined;
    functionalAmount?: number | undefined;
    referenceNumber?: string | undefined;
}, {
    tenantId: string;
    contractId: string;
    amount: number;
    entryDate: Date;
    periodStart: Date;
    periodEnd: Date;
    entryType: "revenue" | "deferred_revenue" | "contract_asset" | "contract_liability" | "receivable" | "cash" | "financing_income" | "commission_expense";
    debitAccount: string;
    creditAccount: string;
    description?: string | undefined;
    currency?: string | undefined;
    performanceObligationId?: string | undefined;
    billingScheduleId?: string | undefined;
    ledgerVersion?: number | undefined;
    source?: string | undefined;
    exchangeRate?: number | undefined;
    functionalAmount?: number | undefined;
    referenceNumber?: string | undefined;
    isPosted?: boolean | undefined;
    isReversed?: boolean | undefined;
}>;
export declare const createAiProviderConfigSchema: z.ZodObject<{
    tenantId: z.ZodString;
    provider: z.ZodEnum<["openai", "anthropic", "openrouter", "google"]>;
    name: z.ZodString;
    apiKey: z.ZodString;
    model: z.ZodString;
    baseUrl: z.ZodOptional<z.ZodString>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    tenantId: string;
    name: string;
    provider: "openai" | "anthropic" | "google" | "openrouter";
    apiKey: string;
    model: string;
    isDefault: boolean;
    baseUrl?: string | undefined;
}, {
    tenantId: string;
    name: string;
    provider: "openai" | "anthropic" | "google" | "openrouter";
    apiKey: string;
    model: string;
    isActive?: boolean | undefined;
    baseUrl?: string | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const contractExtractionSchema: z.ZodObject<{
    contractNumber: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    customerName: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodOptional<z.ZodString>;
    totalValue: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    paymentTerms: z.ZodOptional<z.ZodString>;
    lineItems: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        quantity: z.ZodDefault<z.ZodNumber>;
        unitPrice: z.ZodNumber;
        totalPrice: z.ZodNumber;
        recognitionMethod: z.ZodOptional<z.ZodEnum<["over_time", "point_in_time"]>>;
        deliveryStartDate: z.ZodOptional<z.ZodString>;
        deliveryEndDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        recognitionMethod?: "over_time" | "point_in_time" | undefined;
        deliveryStartDate?: string | undefined;
        deliveryEndDate?: string | undefined;
    }, {
        description: string;
        unitPrice: number;
        totalPrice: number;
        quantity?: number | undefined;
        recognitionMethod?: "over_time" | "point_in_time" | undefined;
        deliveryStartDate?: string | undefined;
        deliveryEndDate?: string | undefined;
    }>, "many">;
    performanceObligations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        allocatedPrice: z.ZodNumber;
        recognitionMethod: z.ZodEnum<["over_time", "point_in_time"]>;
        justification: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        recognitionMethod: "over_time" | "point_in_time";
        allocatedPrice: number;
        justification?: string | undefined;
    }, {
        description: string;
        recognitionMethod: "over_time" | "point_in_time";
        allocatedPrice: number;
        justification?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    lineItems: {
        description: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        recognitionMethod?: "over_time" | "point_in_time" | undefined;
        deliveryStartDate?: string | undefined;
        deliveryEndDate?: string | undefined;
    }[];
    currency: string;
    title: string;
    customerName: string;
    startDate: string;
    totalValue: number;
    performanceObligations?: {
        description: string;
        recognitionMethod: "over_time" | "point_in_time";
        allocatedPrice: number;
        justification?: string | undefined;
    }[] | undefined;
    contractNumber?: string | undefined;
    endDate?: string | undefined;
    paymentTerms?: string | undefined;
}, {
    lineItems: {
        description: string;
        unitPrice: number;
        totalPrice: number;
        quantity?: number | undefined;
        recognitionMethod?: "over_time" | "point_in_time" | undefined;
        deliveryStartDate?: string | undefined;
        deliveryEndDate?: string | undefined;
    }[];
    title: string;
    customerName: string;
    startDate: string;
    totalValue: number;
    performanceObligations?: {
        description: string;
        recognitionMethod: "over_time" | "point_in_time";
        allocatedPrice: number;
        justification?: string | undefined;
    }[] | undefined;
    currency?: string | undefined;
    contractNumber?: string | undefined;
    endDate?: string | undefined;
    paymentTerms?: string | undefined;
}>;
export type ContractExtraction = z.infer<typeof contractExtractionSchema>;
export declare const COLLECTIONS: {
    readonly TENANTS: "tenants";
    readonly USERS: "users";
    readonly CUSTOMERS: "customers";
    readonly CONTRACTS: "contracts";
    readonly CONTRACT_VERSIONS: "contractVersions";
    readonly LINE_ITEMS: "lineItems";
    readonly PERFORMANCE_OBLIGATIONS: "performanceObligations";
    readonly REVENUE_SCHEDULES: "revenueSchedules";
    readonly VARIABLE_CONSIDERATIONS: "variableConsiderations";
    readonly CONTRACT_BALANCES: "contractBalances";
    readonly LICENSES: "licenses";
    readonly LICENSE_SESSIONS: "licenseSessions";
    readonly STRIPE_EVENTS: "stripeEvents";
    readonly SUBSCRIPTION_PLANS: "subscriptionPlans";
    readonly CHECKOUT_SESSIONS: "checkoutSessions";
    readonly EMAIL_QUEUE: "emailQueue";
    readonly AUDIT_LOGS: "auditLogs";
    readonly AI_PROVIDER_CONFIGS: "aiProviderConfigs";
    readonly AI_INGESTION_JOBS: "aiIngestionJobs";
    readonly AI_EXTRACTION_RESULTS: "aiExtractionResults";
    readonly AI_REVIEW_TASKS: "aiReviewTasks";
    readonly BILLING_SCHEDULES: "billingSchedules";
    readonly REVENUE_LEDGER_ENTRIES: "revenueLedgerEntries";
    readonly CONTRACT_COSTS: "contractCosts";
    readonly EXCHANGE_RATES: "exchangeRates";
    readonly FINANCING_COMPONENTS: "financingComponents";
    readonly CONSOLIDATED_BALANCES: "consolidatedBalances";
    readonly MAIL: "mail";
};
export declare const aiModels: {
    readonly openai: readonly [{
        readonly id: "gpt-4o";
        readonly name: "GPT-4o (Recomendado)";
    }, {
        readonly id: "gpt-4-turbo";
        readonly name: "GPT-4 Turbo";
    }, {
        readonly id: "gpt-4";
        readonly name: "GPT-4";
    }, {
        readonly id: "gpt-3.5-turbo";
        readonly name: "GPT-3.5 Turbo";
    }];
    readonly anthropic: readonly [{
        readonly id: "claude-3-opus-20240229";
        readonly name: "Claude 3 Opus (Mais Poderoso)";
    }, {
        readonly id: "claude-3-sonnet-20240229";
        readonly name: "Claude 3 Sonnet (Equilibrado)";
    }, {
        readonly id: "claude-3-haiku-20240307";
        readonly name: "Claude 3 Haiku (Mais Rápido)";
    }];
    readonly openrouter: readonly [{
        readonly id: "anthropic/claude-3-opus";
        readonly name: "Claude 3 Opus via OpenRouter";
    }, {
        readonly id: "openai/gpt-4o";
        readonly name: "GPT-4o via OpenRouter";
    }, {
        readonly id: "google/gemini-pro-1.5";
        readonly name: "Gemini Pro 1.5 via OpenRouter";
    }, {
        readonly id: "meta-llama/llama-3-70b-instruct";
        readonly name: "Llama 3 70B via OpenRouter";
    }, {
        readonly id: "mistralai/mixtral-8x22b-instruct";
        readonly name: "Mixtral 8x22B via OpenRouter";
    }];
    readonly google: readonly [{
        readonly id: "gemini-1.5-pro";
        readonly name: "Gemini 1.5 Pro (Recomendado)";
    }, {
        readonly id: "gemini-1.5-flash";
        readonly name: "Gemini 1.5 Flash (Mais Rápido)";
    }, {
        readonly id: "gemini-pro";
        readonly name: "Gemini Pro";
    }];
};
export declare const planLimits: {
    readonly starter: {
        readonly contracts: 10;
        readonly licenses: 1;
    };
    readonly professional: {
        readonly contracts: 30;
        readonly licenses: 3;
    };
    readonly enterprise: {
        readonly contracts: -1;
        readonly licenses: -1;
    };
};
export {};
//# sourceMappingURL=firestore-types.d.ts.map