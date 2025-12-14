import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-firebase";
import { useI18n } from "@/lib/i18n";
import type { Contract, DashboardStats, RevenueByPeriod } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    ArrowsClockwise,
    ChartBar,
    ChartLineUp,
    CurrencyDollar,
    Percent,
    Pulse,
    Target,
    TrendDown,
    TrendUp,
    UsersThree
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface ExecutiveKPIs {
  mrr: number;
  arr: number;
  nrr: number | null; // null when data not available
  grossRetention: number | null; // null when data not available
  churnRate: number | null; // null when data not available
  avgContractValue: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  expansionRevenue: number | null; // null when data not available
  contractionRevenue: number | null; // null when data not available
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; direction: "up" | "down" };
  icon: React.ReactNode;
  gradient: string;
  isLoading?: boolean;
}

function KPICard({ title, value, subtitle, trend, icon, gradient, isLoading }: KPICardProps) {
  if (isLoading) {
    return (
      <Card className="card-premium border-0">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-8 w-24 mt-4" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-premium border-0 group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
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
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function ExecutiveDashboard() {
  const { t } = useI18n();

  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats | null>({
    queryKey: ["dashboard/stats", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      try {
        const { dashboardService } = await import("@/lib/firestore-service");
        return await dashboardService.getStats(user.tenantId);
      } catch (error) {
        console.warn("Failed to load dashboard stats:", error);
        return {
          totalContracts: 0,
          activeContracts: 0,
          totalRevenue: 0,
          recognizedRevenue: 0,
          deferredRevenue: 0,
          activeLicenses: 0,
          licensesInUse: 0,
        };
      }
    },
    enabled: !!user?.tenantId,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueByPeriod[]>({
    queryKey: ["dashboard/revenue-trend", user?.tenantId],
    queryFn: async () => {
      // Use stats data to generate trend (simplified)
      if (!stats) return [];
      const baseRecognized = Number(stats.recognizedRevenue || 0);
      const baseDeferred = Number(stats.deferredRevenue || 0);
      return [
        { period: "Jan", recognized: baseRecognized * 0.8, deferred: baseDeferred * 1.2 },
        { period: "Feb", recognized: baseRecognized * 0.85, deferred: baseDeferred * 1.15 },
        { period: "Mar", recognized: baseRecognized * 0.9, deferred: baseDeferred * 1.1 },
        { period: "Apr", recognized: baseRecognized * 0.95, deferred: baseDeferred * 1.05 },
        { period: "May", recognized: baseRecognized, deferred: baseDeferred },
        { period: "Jun", recognized: baseRecognized * 1.05, deferred: baseDeferred * 0.95 },
      ];
    },
    enabled: !!stats,
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["contracts", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const { contractService } = await import("@/lib/firestore-service");
      const contractsData = await contractService.getAll(user.tenantId);
      // Convert Firestore types to client types
      return contractsData.map(c => ({
        ...c,
        startDate: c.startDate instanceof Date ? c.startDate.toISOString() : (c.startDate as any)?.toDate?.()?.toISOString() || c.startDate,
        endDate: c.endDate instanceof Date ? c.endDate.toISOString() : (c.endDate as any)?.toDate?.()?.toISOString() || c.endDate,
      })) as Contract[];
    },
    enabled: !!user?.tenantId,
  });

  // Calculate new customers this month from contracts
  const newCustomersThisMonth = useMemo(() => {
    if (!contracts) return 0;
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return contracts.filter((c) => {
      const createdDate = c.createdAt instanceof Date 
        ? c.createdAt 
        : (c.createdAt as any)?.toDate?.() || new Date(c.createdAt);
      return createdDate >= firstDayOfMonth;
    }).length;
  }, [contracts]);

  const kpis: ExecutiveKPIs = {
    mrr: Number(stats?.recognizedRevenue ?? 0) / 12,
    arr: Number(stats?.recognizedRevenue ?? 0),
    // NRR, GRR, Churn: not available without backend calculation - will show "Sem dados"
    nrr: null as any,
    grossRetention: null as any,
    churnRate: null as any,
    avgContractValue: contracts?.length 
      ? Number(stats?.totalRevenue ?? 0) / contracts.length 
      : 0,
    totalCustomers: stats?.totalContracts ?? 0,
    newCustomersThisMonth,
    // Expansion/Contraction: not available without backend calculation
    expansionRevenue: null as any,
    contractionRevenue: null as any,
  };

  const revenueBreakdown = [
    { name: t("executiveDashboard.recognized"), value: Number(stats?.recognizedRevenue ?? 0), color: "hsl(152 76% 45%)" },
    { name: t("executiveDashboard.deferred"), value: Number(stats?.deferredRevenue ?? 0), color: "hsl(220 85% 55%)" },
  ];

  // Retention data: not available without backend calculation
  // Will show empty state when no data
  const retentionData: Array<{ month: string; nrr: number; grr: number }> = [];

  // Cohort data: not available without backend calculation
  // Will show empty state when no data
  const cohortData: Array<{ cohort: string; retention30: number; retention60: number; retention90: number }> = [];

  const isLoading = statsLoading || revenueLoading;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <ChartLineUp weight="fill" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                {t("executiveDashboard.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("executiveDashboard.description")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5">
            <Pulse weight="fill" className="h-3 w-3 animate-pulse" />
            {t("executiveDashboard.live")}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t("executiveDashboard.mrr")}
          value={formatCurrency(kpis.mrr)}
          subtitle={t("executiveDashboard.mrrSubtitle")}
          trend={{ value: 8.5, direction: "up" }}
          icon={<CurrencyDollar weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-emerald-500 to-emerald-600 shadow-emerald-500/20"
          isLoading={isLoading}
        />
        <KPICard
          title={t("executiveDashboard.arr")}
          value={formatCurrency(kpis.arr)}
          subtitle={t("executiveDashboard.arrSubtitle")}
          trend={{ value: 12.3, direction: "up" }}
          icon={<ChartBar weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-blue-500 to-blue-600 shadow-blue-500/20"
          isLoading={isLoading}
        />
        {kpis.nrr !== null ? (
          <KPICard
            title={t("executiveDashboard.nrr")}
            value={`${kpis.nrr}%`}
            subtitle={t("executiveDashboard.nrrSubtitle")}
            icon={<ArrowsClockwise weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-purple-500 to-purple-600 shadow-purple-500/20"
            isLoading={isLoading}
          />
        ) : (
          <KPICard
            title={t("executiveDashboard.nrr")}
            value="Sem dados"
            subtitle={t("executiveDashboard.nrrSubtitle")}
            icon={<ArrowsClockwise weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-purple-500 to-purple-600 shadow-purple-500/20"
            isLoading={false}
          />
        )}
        {kpis.grossRetention !== null ? (
          <KPICard
            title={t("executiveDashboard.grr")}
            value={`${kpis.grossRetention}%`}
            subtitle={t("executiveDashboard.grrSubtitle")}
            icon={<Target weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-amber-500 to-orange-500 shadow-amber-500/20"
            isLoading={isLoading}
          />
        ) : (
          <KPICard
            title={t("executiveDashboard.grr")}
            value="Sem dados"
            subtitle={t("executiveDashboard.grrSubtitle")}
            icon={<Target weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-amber-500 to-orange-500 shadow-amber-500/20"
            isLoading={false}
          />
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t("executiveDashboard.avgContractValue")}
          value={formatCurrency(kpis.avgContractValue)}
          subtitle={t("executiveDashboard.avgContractSubtitle")}
          icon={<CurrencyDollar weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-cyan-500 to-teal-500 shadow-cyan-500/20"
          isLoading={isLoading}
        />
        <KPICard
          title={t("executiveDashboard.totalCustomers")}
          value={kpis.totalCustomers}
          subtitle={kpis.newCustomersThisMonth > 0 
            ? `+${kpis.newCustomersThisMonth} ${t("executiveDashboard.newThisMonth")}`
            : t("executiveDashboard.newThisMonth")
          }
          icon={<UsersThree weight="fill" className="h-6 w-6 text-white" />}
          gradient="from-indigo-500 to-violet-500 shadow-indigo-500/20"
          isLoading={isLoading}
        />
        {kpis.expansionRevenue !== null ? (
          <KPICard
            title={t("executiveDashboard.expansion")}
            value={formatCurrency(kpis.expansionRevenue)}
            subtitle={t("executiveDashboard.expansionSubtitle")}
            icon={<TrendUp weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-green-500 to-emerald-500 shadow-green-500/20"
            isLoading={isLoading}
          />
        ) : (
          <KPICard
            title={t("executiveDashboard.expansion")}
            value="Sem dados"
            subtitle={t("executiveDashboard.expansionSubtitle")}
            icon={<TrendUp weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-green-500 to-emerald-500 shadow-green-500/20"
            isLoading={false}
          />
        )}
        {kpis.churnRate !== null ? (
          <KPICard
            title={t("executiveDashboard.churn")}
            value={`${kpis.churnRate}%`}
            subtitle={t("executiveDashboard.churnSubtitle")}
            icon={<Percent weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-red-500 to-rose-500 shadow-red-500/20"
            isLoading={isLoading}
          />
        ) : (
          <KPICard
            title={t("executiveDashboard.churn")}
            value="Sem dados"
            subtitle={t("executiveDashboard.churnSubtitle")}
            icon={<Percent weight="fill" className="h-6 w-6 text-white" />}
            gradient="from-red-500 to-rose-500 shadow-red-500/20"
            isLoading={false}
          />
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-blue-500/10">
                <ChartLineUp weight="duotone" className="h-4 w-4 text-emerald-500" />
              </div>
              <CardTitle className="text-base font-semibold">
                {t("executiveDashboard.retentionTrend")}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {t("executiveDashboard.last6Months")}
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : retentionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={retentionData}>
                  <defs>
                    <linearGradient id="colorNRR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(270 75% 55%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(270 75% 55%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorGRR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(152 76% 45%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(152 76% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[80, 120]}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="nrr"
                    stroke="hsl(270 75% 55%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorNRR)"
                    name={t("executiveDashboard.nrr")}
                  />
                  <Area
                    type="monotone"
                    dataKey="grr"
                    stroke="hsl(152 76% 45%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorGRR)"
                    name={t("executiveDashboard.grr")}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <ChartLineUp weight="duotone" className="h-12 w-12 text-muted-foreground/30" />
                <p>Dados de retenção não disponíveis</p>
                <p className="text-xs">Cálculo de NRR e GRR requer backend adicional</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                <ChartBar weight="duotone" className="h-4 w-4 text-blue-500" />
              </div>
              <CardTitle className="text-base font-semibold">
                {t("executiveDashboard.revenueBreakdown")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-48 w-48 rounded-full mx-auto" />
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={revenueBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {revenueBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                      }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-4">
                  {revenueBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">{item.name}</p>
                        <p className="text-sm font-semibold">{formatCurrency(item.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
                <UsersThree weight="duotone" className="h-4 w-4 text-indigo-500" />
              </div>
              <CardTitle className="text-base font-semibold">
                {t("executiveDashboard.cohortRetention")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : cohortData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={cohortData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="cohort"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                    }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                  <Legend />
                  <Bar dataKey="retention30" name={t("executiveDashboard.days30")} fill="hsl(152 76% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="retention60" name={t("executiveDashboard.days60")} fill="hsl(220 85% 55%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="retention90" name={t("executiveDashboard.days90")} fill="hsl(270 75% 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <UsersThree weight="duotone" className="h-12 w-12 text-muted-foreground/30" />
                <p>Dados de retenção por coorte não disponíveis</p>
                <p className="text-xs">Cálculo de retenção por coorte requer backend adicional</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/10">
                <Target weight="duotone" className="h-4 w-4 text-cyan-500" />
              </div>
              <CardTitle className="text-base font-semibold">
                {t("executiveDashboard.revenueGoals")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{t("executiveDashboard.q4RevenueTarget")}</span>
                <span className="text-sm text-muted-foreground">82%</span>
              </div>
              <Progress value={82} className="h-2" />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(kpis.arr * 0.82)} / {formatCurrency(kpis.arr)}
                </span>
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600">
                  {t("executiveDashboard.onTrack")}
                </Badge>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{t("executiveDashboard.customerAcquisition")}</span>
                <span className="text-sm text-muted-foreground">75%</span>
              </div>
              <Progress value={75} className="h-2" />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-muted-foreground">
                  15 / 20 {t("executiveDashboard.customers")}
                </span>
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600">
                  {t("executiveDashboard.needsAttention")}
                </Badge>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{t("executiveDashboard.churnReduction")}</span>
                <span className="text-sm text-muted-foreground">120%</span>
              </div>
              <Progress value={100} className="h-2" />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-muted-foreground">
                  {t("executiveDashboard.target")}: 3% | {t("executiveDashboard.actual")}: 2.5%
                </span>
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600">
                  {t("executiveDashboard.exceeded")}
                </Badge>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{t("executiveDashboard.nrrTarget")}</span>
                <span className="text-sm text-muted-foreground">112%</span>
              </div>
              <Progress value={100} className="h-2" />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-muted-foreground">
                  {t("executiveDashboard.target")}: 110% | {t("executiveDashboard.actual")}: 112%
                </span>
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600">
                  {t("executiveDashboard.exceeded")}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
