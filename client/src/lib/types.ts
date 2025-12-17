// Frontend types for API responses and UI state

export interface DashboardStats {
  totalContracts: number;
  activeContracts: number;
  totalRevenue: string;
  recognizedRevenue: string;
  deferredRevenue: string;
  activeLicenses: number;
  licensesInUse: number;
  contractAssets: string;
  contractLiabilities: string;
}

export interface RevenueByPeriod {
  period: string;
  recognized: number;
  deferred: number;
}

export interface ContractWithDetails {
  id: string;
  contractNumber: string;
  title: string;
  status: "active" | "modified" | "terminated" | "expired";
  customerName: string;
  totalValue: string;
  currency: string;
  startDate: string;
  endDate: string | null;
  recognizedRevenue: string;
  deferredRevenue: string;
}

export interface LicenseWithSession {
  id: string;
  licenseKey: string;
  status: "active" | "suspended" | "revoked" | "expired";
  seatCount: number;
  currentIp: string | null;
  currentUserName: string | null;
  lockedAt: string | null;
  lastSeenAt: string | null;
  graceUntil: string | null;
}

export interface PerformanceObligationSummary {
  id: string;
  description: string;
  allocatedPrice: string;
  recognitionMethod: "over_time" | "point_in_time";
  percentComplete: string;
  recognizedAmount: string;
  deferredAmount: string;
  isSatisfied: boolean;
}

export interface DisaggregatedRevenue {
  category: string;
  overTime: number;
  pointInTime: number;
  total: number;
}

export interface ContractBalanceSummary {
  period: string;
  openingAsset: number;
  openingLiability: number;
  revenueRecognized: number;
  cashReceived: number;
  closingAsset: number;
  closingLiability: number;
}

export interface RemainingObligations {
  period: string;
  amount: number;
}

export interface BillingScheduleWithDetails {
  id: string;
  tenantId: string;
  contractId: string;
  performanceObligationId: string | null;
  billingDate: string;
  dueDate: string;
  amount: string;
  currency: string;
  frequency: "one_time" | "monthly" | "quarterly" | "semi_annual" | "annual";
  status: "scheduled" | "invoiced" | "paid" | "overdue" | "cancelled";
  invoiceNumber: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
  paidAmount: string | null;
  poSatisfiedAt?: string | null;
  notes: string | null;
  createdAt: string;
  contractNumber: string;
  contractTitle: string;
  customerName: string;
}

import type { LedgerEntryType } from "@shared/firestore-types";

export interface LedgerEntryWithDetails {
  id: string;
  tenantId: string;
  contractId: string;
  performanceObligationId: string | null;
  billingScheduleId: string | null;
  entryDate: string;
  periodStart: string;
  periodEnd: string;
  entryType: LedgerEntryType;
  debitAccount: string;
  creditAccount: string;
  amount: string;
  currency: string;
  exchangeRate: string | null;
  functionalAmount: string | null;
  description: string | null;
  referenceNumber: string | null;
  isPosted: boolean;
  postedAt: string | null;
  postedBy: string | null;
  isReversed: boolean;
  reversedEntryId: string | null;
  createdAt: string;
  contractNumber: string;
  contractTitle: string;
  customerName: string;
}

export interface ConsolidatedBalanceData {
  id: string;
  tenantId: string;
  periodDate: string;
  periodType: string;
  totalContractAssets: string;
  totalContractLiabilities: string;
  totalReceivables: string;
  totalDeferredRevenue: string;
  totalRecognizedRevenue: string;
  totalBilledAmount: string;
  totalCashReceived: string;
  totalRemainingObligations: string;
  contractCount: number;
  currency: string;
  createdAt: string;
}

export interface ContractCostWithDetails {
  id: string;
  tenantId: string;
  contractId: string;
  costType: "incremental" | "fulfillment";
  description: string;
  amount: string;
  currency: string;
  incurredDate: string;
  amortizationStartDate: string;
  amortizationEndDate: string;
  amortizationMethod: string;
  totalAmortized: string;
  remainingBalance: string;
  isFullyAmortized: boolean;
  impairmentLoss: string;
  createdAt: string;
  contractNumber: string;
  contractTitle: string;
  customerName: string;
}

export interface SignificantJudgment {
  area: string;
  description: string;
  impact: string;
  methodology: string;
}

export interface DisclosureReportData {
  reportPeriod: string;
  generatedAt: string;
  disaggregatedRevenue: DisaggregatedRevenue[];
  contractBalances: ContractBalanceSummary[];
  remainingObligations: RemainingObligations[];
  significantJudgments: SignificantJudgment[];
  accountingPolicies: string[];
  totalRecognizedRevenue: number;
  totalDeferredRevenue: number;
  totalContractAssets: number;
  totalContractLiabilities: number;
}

export interface ExchangeRate {
  id: string;
  tenantId: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: string;
  source: string | null;
  createdAt: string;
}

export interface FinancingComponent {
  id: string;
  tenantId: string;
  contractId: string;
  nominalAmount: string;
  presentValue: string;
  discountRate: string;
  financingPeriodMonths: number;
  totalInterest: string;
  recognizedInterest: string | null;
  currency: string;
  calculatedAt: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  tenantId: string;
  customerId: string;
  contractNumber: string;
  title: string;
  status: "active" | "modified" | "terminated" | "expired";
  startDate: string;
  endDate: string | null;
  totalValue: string;
  currency: string;
  paymentTerms: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
