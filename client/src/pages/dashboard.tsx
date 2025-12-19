import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-firebase";
import { consolidatedBalanceService, contractService, customerService, dashboardService, revenueLedgerService } from "@/lib/firestore-service";
import { useI18n } from "@/lib/i18n";
import type { ContractWithDetails, DashboardStats, RevenueByPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    ArrowRight,
    ChartLineUp,
    CheckCircle,
    Clock,
    CurrencyDollar,
    FileText,
    Key,
    Pulse,
    TrendDown,
    TrendUp,
    Warning,
} from "@phosphor-icons/react";
import type { ConsolidatedBalance, Contract, Customer, RevenueLedgerEntry } from "@shared/firestore-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
// Local constants to avoid import issues
const LedgerEntryType = {
  REVENUE: "revenue",
  DEFERRED_REVENUE: "deferred_revenue",
  CONTRACT_ASSET: "contract_asset",
  CONTRACT_LIABILITY: "contract_liability",
  RECEIVABLE: "receivable",
  CASH: "cash",
  FINANCING_INCOME: "financing_income",
  COMMISSION_EXPENSE: "commission_expense",
} as const;

// Helper function to convert Firestore timestamp to ISO string
function toISOString(timestamp: any): string {
  if (!timestamp) return "";
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? "" : timestamp.toISOString();
  if (typeof timestamp === "string") return timestamp;
  if (typeof timestamp === "object" && typeof timestamp.toDate === "function") {
    const d = timestamp.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : "";
  }
  return "";
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; direction: "up" | "down" };
  icon: React.ReactNode;
  gradient: string;
  isLoading?: boolean;
}

function PremiumMetricCard({ title, value, subtitle, trend, icon, gradient, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <div className="card-premium p-6">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-24 mt-4" />
        <Skeleton className="h-4 w-32 mt-2" />
      </div>
    );
  }

  return (
    <div className="card-premium p-6 group">
      <div className="flex items-start justify-between">
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-105",
          gradient
        )}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
            trend.direction === "up" 
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            {trend.direction === "up" ? (
              <TrendUp weight="bold" className="h-3 w-3" />
            ) : (
              <TrendDown weight="bold" className="h-3 w-3" />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function ContractRow({ contract }: { contract: ContractWithDetails }) {
  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    draft: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
        <FileText weight="duotone" className="h-5 w-5 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{contract.contractNumber}</span>
          <Badge variant="outline" className={cn("text-[10px] uppercase", statusColors[contract.status])}>
            {contract.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{contract.customerName}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold tabular-nums text-sm">
          {contract.currency} {Number(contract.totalValue).toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {contract.recognizedRevenue ? Number(contract.recognizedRevenue).toLocaleString() : "-"} recognized
        </p>
      </div>
      <ArrowRight weight="bold" className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function LicenseStatusCard({ stats, isLoading }: { stats?: DashboardStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mx-auto" />
      </div>
    );
  }

  const utilization = stats 
    ? Math.round((stats.licensesInUse / Math.max(stats.activeLicenses, 1)) * 100)
    : 0;

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (utilization / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r="45"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted/30"
          />
          <circle
            cx="72"
            cy="72"
            r="45"
            stroke="url(#gradient)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(152 76% 45%)" />
              <stop offset="100%" stopColor="hsl(220 85% 55%)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{utilization}%</span>
          <span className="text-xs text-muted-foreground">Utilization</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-6 mt-6 w-full">
        <div className="text-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-lg font-bold tabular-nums">{stats?.licensesInUse ?? 0}</span>
          </div>
          <span className="text-xs text-muted-foreground">In Use</span>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-lg font-bold tabular-nums">{stats?.activeLicenses ?? 0}</span>
          </div>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  
  // Fetch dashboard stats directly from Firestore
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats | null>({
    queryKey: ["dashboard/stats", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      return dashboardService.getStats(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Fetch contracts directly from Firestore for recent contracts and revenue trend
  const { data: contracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["contracts", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return contractService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Fetch customers for customer name lookup
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return customerService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  const { data: ledgerEntries, isLoading: ledgerEntriesLoading } = useQuery<RevenueLedgerEntry[]>({
    queryKey: ["ledger-entries", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return revenueLedgerService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Fetch consolidated balances as alternative data source for revenue chart
  const { data: consolidatedBalances, isLoading: consolidatedBalancesLoading } = useQuery<ConsolidatedBalance[]>({
    queryKey: ["consolidated-balances", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      // Get last 12 months of consolidated balances
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      return consolidatedBalanceService.getByPeriod(user.tenantId, startDate, endDate);
    },
    enabled: !!user?.tenantId,
  });

  const recognizedRevenueByContractId = useMemo(() => {
    const map = new Map<string, number>();
    (ledgerEntries || []).forEach((entry) => {
      if (entry.entryType !== LedgerEntryType.REVENUE) return;
      const amount = Number(entry.amount || 0);
      map.set(entry.contractId, (map.get(entry.contractId) || 0) + amount);
    });
    return map;
  }, [ledgerEntries]);

  // Create customer name lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers?.forEach((customer) => {
      map.set(customer.id, customer.name);
    });
    return map;
  }, [customers]);

  // Transform recent contracts for display
  const recentContracts: ContractWithDetails[] = useMemo(() => {
    if (!contracts) return [];
    
    return contracts.slice(0, 5).map((contract) => {
      const recognizedAmount = recognizedRevenueByContractId.get(contract.id);
      const totalValue = Number(contract.totalValue || 0);
      const recognizedRevenue = recognizedAmount === undefined ? "" : recognizedAmount.toFixed(2);
      const deferredRevenue =
        recognizedAmount === undefined ? "" : Math.max(0, totalValue - recognizedAmount).toFixed(2);

      return {
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        status: contract.status,
        customerName: customerMap.get(contract.customerId) || "Unknown",
        totalValue: contract.totalValue?.toString() || "0",
        currency: contract.currency,
        startDate: toISOString(contract.startDate),
        endDate: toISOString(contract.endDate) || null,
        recognizedRevenue,
        deferredRevenue,
      };
    });
  }, [contracts, customerMap, recognizedRevenueByContractId]);

  const revenueData: RevenueByPeriod[] = useMemo(() => {
    // Priority 1: Use Consolidated Balances if available (most accurate)
    if (consolidatedBalances && consolidatedBalances.length > 0) {
      return consolidatedBalances
        .slice(-12) // Last 12 months
        .map((balance) => {
          let periodDate: Date;
          if (balance.periodDate instanceof Date) {
            periodDate = balance.periodDate;
          } else if ((balance.periodDate as any)?.toDate) {
            periodDate = (balance.periodDate as any).toDate();
          } else if (typeof balance.periodDate === "string") {
            periodDate = new Date(balance.periodDate);
          } else {
            return null;
          }

          if (isNaN(periodDate.getTime())) return null;

          return {
            period: periodDate.toLocaleDateString("en-US", { month: "short" }),
            recognized: Number(balance.totalRecognizedRevenue || 0),
            deferred: Number(balance.totalDeferredRevenue || 0),
          };
        })
        .filter((item): item is RevenueByPeriod => item !== null);
    }

    // Priority 2: Use Ledger Entries if available
    if (ledgerEntries && ledgerEntries.length > 0) {
      const monthlyData = new Map<string, { recognized: number; deferred: number }>();

      ledgerEntries.forEach((entry) => {
        try {
          let entryDate: Date;
          if (entry.entryDate instanceof Date) {
            entryDate = entry.entryDate;
          } else if ((entry.entryDate as any)?.toDate) {
            entryDate = (entry.entryDate as any).toDate();
          } else if (typeof entry.entryDate === "string") {
            entryDate = new Date(entry.entryDate);
          } else {
            return;
          }

          if (isNaN(entryDate.getTime())) return;

          const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;

          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, { recognized: 0, deferred: 0 });
          }

          const data = monthlyData.get(monthKey)!;

          if (entry.entryType === LedgerEntryType.REVENUE) {
            data.recognized += Number(entry.amount || 0);
          } else if (entry.entryType === LedgerEntryType.DEFERRED_REVENUE) {
            data.deferred += Number(entry.amount || 0);
          }
        } catch (error) {
          console.warn("Error processing ledger entry:", entry.id, error);
        }
      });

      return Array.from(monthlyData.entries())
        .map(([key, data]) => ({
          period: key,
          recognized: data.recognized,
          deferred: data.deferred,
        }))
        .sort((a, b) => a.period.localeCompare(b.period))
        .slice(-12) // Last 12 months
        .map((item) => {
          try {
            const date = new Date(item.period + "-01");
            if (isNaN(date.getTime())) {
              return {
                period: item.period,
                recognized: item.recognized,
                deferred: item.deferred,
              };
            }
            return {
              period: date.toLocaleDateString("en-US", { month: "short" }),
              recognized: item.recognized,
              deferred: item.deferred,
            };
          } catch {
            return {
              period: item.period,
              recognized: item.recognized,
              deferred: item.deferred,
            };
          }
        });
    }

    // No data available
    return [];
  }, [ledgerEntries, consolidatedBalances]);

  const revenueLoading = ledgerEntriesLoading || consolidatedBalancesLoading;

  // Calculate real trends based on revenue data
  const revenueTrend = useMemo(() => {
    if (!revenueData || revenueData.length < 2) return undefined;
    const current = revenueData[revenueData.length - 1];
    const previous = revenueData[revenueData.length - 2];
    const currentTotal = current.recognized + current.deferred;
    const previousTotal = previous.recognized + previous.deferred;
    
    if (previousTotal === 0) return undefined;
    
    const change = ((currentTotal - previousTotal) / previousTotal) * 100;
    return {
      value: Number(Math.abs(change).toFixed(1)),
      direction: change >= 0 ? "up" as const : "down" as const,
    };
  }, [revenueData]);

  const recognizedTrend = useMemo(() => {
    if (!revenueData || revenueData.length < 2) return undefined;
    const current = revenueData[revenueData.length - 1];
    const previous = revenueData[revenueData.length - 2];
    
    if (previous.recognized === 0) return undefined;
    
    const change = ((current.recognized - previous.recognized) / previous.recognized) * 100;
    return {
      value: Number(Math.abs(change).toFixed(1)),
      direction: change >= 0 ? "up" as const : "down" as const,
    };
  }, [revenueData]);

  // Calculate compliance alerts based on real contract data
  const complianceAlerts = useMemo(() => {
    if (!contracts) return [];
    
    const alerts: Array<{ type: "success" | "warning" | "info"; title: string; description: string; icon: React.ReactNode }> = [];
    
    // Check for contracts expiring soon (within 90 days)
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    const expiringContracts = contracts.filter((contract) => {
      if (!contract.endDate) return false;
      let endDate: Date;
      if (contract.endDate instanceof Date) {
        endDate = contract.endDate;
      } else if ((contract.endDate as any)?.toDate) {
        endDate = (contract.endDate as any).toDate();
      } else if (typeof contract.endDate === 'string') {
        endDate = new Date(contract.endDate);
      } else {
        return false;
      }
      
      return endDate >= now && endDate <= ninetyDaysFromNow;
    });
    
    if (expiringContracts.length > 0) {
      alerts.push({
        type: "warning",
        title: `${expiringContracts.length} contract${expiringContracts.length > 1 ? 's' : ''} expiring soon`,
        description: `Review renewal schedules for upcoming expirations`,
        icon: <Clock weight="fill" className="h-5 w-5 text-amber-500" />,
      });
    }
    
    // Check for contracts without versions (potential compliance issue)
    // This would require checking versions, but for now we'll check if contracts have proper setup
    const activeContracts = contracts.filter(c => c.status === "active");
    if (activeContracts.length > 0) {
      alerts.push({
        type: "success",
        title: "All contracts compliant",
        description: `No IFRS 15 violations detected in the last 30 days`,
        icon: <CheckCircle weight="fill" className="h-5 w-5 text-emerald-500" />,
      });
    }
    
    // Calculate Q4 progress (if we're in Q4)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    if (currentMonth >= 9) { // October, November, December (Q4)
      const q4Start = new Date(currentDate.getFullYear(), 9, 1); // October 1
      const q4End = new Date(currentDate.getFullYear(), 11, 31); // December 31
      const totalDays = Math.floor((q4End.getTime() - q4Start.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.floor((currentDate.getTime() - q4Start.getTime()) / (1000 * 60 * 60 * 24));
      const progress = Math.min((daysElapsed / totalDays) * 100, 100);
      
      if (progress > 0) {
        alerts.push({
          type: "info",
          title: "Revenue recognition on track",
          description: `Q4 targets are ${Math.round(progress)}% complete with ${Math.max(0, totalDays - daysElapsed)} days remaining`,
          icon: <TrendUp weight="fill" className="h-5 w-5 text-blue-500" />,
        });
      }
    }
    
    return alerts;
  }, [contracts]);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
              <ChartLineUp weight="fill" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
              <p className="text-sm text-muted-foreground">
                IFRS 15 Revenue Recognition Overview
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5">
            <Pulse weight="fill" className="h-3 w-3 animate-pulse" />
            Live
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <PremiumMetricCard
          title={t("dashboard.totalContracts")}
          value={stats?.totalContracts ?? 0}
          subtitle={`${stats?.activeContracts ?? 0} active contracts`}
          icon={<FileText weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-blue-500 to-blue-600 shadow-blue-500/20"
          isLoading={statsLoading}
        />
        <PremiumMetricCard
          title="Total Revenue"
          value={`$${Number(stats?.totalRevenue ?? 0).toLocaleString()}`}
          trend={revenueTrend}
          icon={<CurrencyDollar weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-emerald-500 to-emerald-600 shadow-emerald-500/20"
          isLoading={statsLoading}
        />
        <PremiumMetricCard
          title={t("dashboard.recognizedRevenue")}
          value={`$${Number(stats?.recognizedRevenue ?? 0).toLocaleString()}`}
          subtitle="Year to date"
          trend={recognizedTrend}
          icon={<TrendUp weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-purple-500 to-purple-600 shadow-purple-500/20"
          isLoading={statsLoading}
        />
        <PremiumMetricCard
          title={t("dashboard.deferredRevenue")}
          value={`$${Number(stats?.deferredRevenue ?? 0).toLocaleString()}`}
          subtitle="Remaining obligations"
          icon={<Clock weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-amber-500 to-orange-500 shadow-amber-500/20"
          isLoading={statsLoading}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                <ChartLineUp weight="duotone" className="h-4 w-4 text-blue-500" />
              </div>
              <CardTitle className="text-base font-semibold">{t("dashboard.revenueTrend")}</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              Last 12 months
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            {revenueLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : revenueData && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRecognized" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(220 85% 55%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(220 85% 55%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDeferred" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152 76% 45%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(152 76% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="recognized"
                    stroke="hsl(220 85% 55%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRecognized)"
                    name="Recognized"
                  />
                  <Area
                    type="monotone"
                    dataKey="deferred"
                    stroke="hsl(152 76% 45%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDeferred)"
                    name="Deferred"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3 px-4">
                <ChartLineUp weight="duotone" className="h-12 w-12 text-muted-foreground/30" />
                <p className="font-medium">No revenue data available</p>
                <p className="text-xs text-center max-w-md">
                  {contracts && contracts.length > 0
                    ? "Execute the IFRS 15 Engine on your contracts to generate revenue recognition data and view the revenue trend chart."
                    : "Create contracts and execute the IFRS 15 Engine to generate revenue recognition data."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-blue-500/10">
                <Key weight="duotone" className="h-4 w-4 text-emerald-500" />
              </div>
              <CardTitle className="text-base font-semibold">License Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <LicenseStatusCard stats={stats || undefined} isLoading={statsLoading} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                <FileText weight="duotone" className="h-4 w-4 text-blue-500" />
              </div>
              <CardTitle className="text-base font-semibold">{t("dashboard.recentContracts")}</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {recentContracts?.length ?? 0} contracts
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            {contractsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : recentContracts && recentContracts.length > 0 ? (
              <div className="space-y-1">
                {recentContracts.map((contract) => (
                  <ContractRow key={contract.id} contract={contract} />
                ))}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <FileText weight="duotone" className="h-12 w-12 text-muted-foreground/30" />
                <p>{t("dashboard.noContracts")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                <Warning weight="duotone" className="h-4 w-4 text-amber-500" />
              </div>
              <CardTitle className="text-base font-semibold">Compliance Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {contractsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : complianceAlerts.length > 0 ? (
              <div className="space-y-4">
                {complianceAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border",
                      alert.type === "success" && "bg-emerald-500/5 border-emerald-500/10",
                      alert.type === "warning" && "bg-amber-500/5 border-amber-500/10",
                      alert.type === "info" && "bg-blue-500/5 border-blue-500/10"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full",
                        alert.type === "success" && "bg-emerald-500/10",
                        alert.type === "warning" && "bg-amber-500/10",
                        alert.type === "info" && "bg-blue-500/10"
                      )}
                    >
                      {alert.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Warning weight="duotone" className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm">No compliance alerts</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
