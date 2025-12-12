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
  status: "draft" | "active" | "modified" | "terminated" | "expired";
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
