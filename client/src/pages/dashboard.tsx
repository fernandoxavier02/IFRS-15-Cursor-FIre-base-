import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import {
  FileText,
  DollarSign,
  KeyRound,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardStats, RevenueByPeriod, ContractWithDetails, LicenseWithSession } from "@/lib/types";

export default function Dashboard() {
  const { t } = useI18n();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueByPeriod[]>({
    queryKey: ["/api/dashboard/revenue-trend"],
  });

  const { data: recentContracts, isLoading: contractsLoading } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/contracts/recent"],
  });

  const { data: activeLicenses, isLoading: licensesLoading } = useQuery<LicenseWithSession[]>({
    queryKey: ["/api/licenses/active"],
  });

  const contractColumns = [
    {
      key: "contractNumber",
      header: "Contract #",
      cell: (row: ContractWithDetails) => (
        <span className="font-medium">{row.contractNumber}</span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
    },
    {
      key: "status",
      header: "Status",
      cell: (row: ContractWithDetails) => <StatusBadge status={row.status} />,
    },
    {
      key: "totalValue",
      header: "Value",
      cell: (row: ContractWithDetails) => (
        <span className="tabular-nums">
          {row.currency} {Number(row.totalValue).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "recognizedRevenue",
      header: "Recognized",
      cell: (row: ContractWithDetails) => (
        <span className="tabular-nums text-muted-foreground">
          {Number(row.recognizedRevenue).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
  ];

  const licenseColumns = [
    {
      key: "licenseKey",
      header: "License Key",
      cell: (row: LicenseWithSession) => (
        <span className="font-mono text-xs">{row.licenseKey.substring(0, 16)}...</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: LicenseWithSession) => <StatusBadge status={row.status} />,
    },
    {
      key: "currentIp",
      header: "Current IP",
      cell: (row: LicenseWithSession) => (
        <span className="font-mono text-xs">
          {row.currentIp || "—"}
        </span>
      ),
    },
    {
      key: "lastSeenAt",
      header: "Last Activity",
      cell: (row: LicenseWithSession) => (
        <span className="text-xs text-muted-foreground">
          {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  const licenseUtilization = stats
    ? Math.round((stats.licensesInUse / Math.max(stats.activeLicenses, 1)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            IFRS 15 Revenue Recognition Overview
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t("dashboard.totalContracts")}
          value={stats?.totalContracts ?? 0}
          subtitle={`${stats?.activeContracts ?? 0} ${t("status.active").toLowerCase()}`}
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
          isLoading={statsLoading}
        />
        <MetricCard
          title={t("common.total") + " Revenue"}
          value={`$${Number(stats?.totalRevenue ?? 0).toLocaleString()}`}
          trend={{ value: 12.5, direction: "up" }}
          icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
          isLoading={statsLoading}
        />
        <MetricCard
          title={t("dashboard.recognizedRevenue")}
          value={`$${Number(stats?.recognizedRevenue ?? 0).toLocaleString()}`}
          subtitle="YTD"
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
          isLoading={statsLoading}
        />
        <MetricCard
          title={t("dashboard.deferredRevenue")}
          value={`$${Number(stats?.deferredRevenue ?? 0).toLocaleString()}`}
          subtitle={t("reports.remainingObligations")}
          icon={<Clock className="h-5 w-5 text-muted-foreground" />}
          isLoading={statsLoading}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">{t("dashboard.revenueTrend")}</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : revenueData && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRecognized" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDeferred" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="recognized"
                    stroke="hsl(var(--chart-1))"
                    fillOpacity={1}
                    fill="url(#colorRecognized)"
                    name="Recognized"
                  />
                  <Area
                    type="monotone"
                    dataKey="deferred"
                    stroke="hsl(var(--chart-2))"
                    fillOpacity={1}
                    fill="url(#colorDeferred)"
                    name="Deferred"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">License Usage</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-6">
            {statsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-20 rounded-full mx-auto" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <svg className="h-24 w-24 -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        fill="none"
                        strokeWidth="8"
                        className="stroke-muted"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        fill="none"
                        strokeWidth="8"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * licenseUtilization) / 100}
                        className="stroke-primary transition-all duration-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xl font-semibold">
                      {licenseUtilization}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Utilization</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Licenses</span>
                    <span className="font-medium">{stats?.activeLicenses ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Currently In Use</span>
                    <span className="font-medium">{stats?.licensesInUse ?? 0}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">{t("dashboard.recentContracts")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={contractColumns}
              data={recentContracts ?? []}
              isLoading={contractsLoading}
              emptyMessage={t("dashboard.noContracts")}
              testIdPrefix="contract-row"
              className="border-0"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">{t("dashboard.activeLicenses")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={licenseColumns}
              data={activeLicenses ?? []}
              isLoading={licensesLoading}
              emptyMessage={t("dashboard.noLicenses")}
              testIdPrefix="license-row"
              className="border-0"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Contract Assets"
          value={`$${Number(stats?.contractAssets ?? 0).toLocaleString()}`}
          subtitle="Unbilled revenue"
          isLoading={statsLoading}
        />
        <MetricCard
          title="Contract Liabilities"
          value={`$${Number(stats?.contractLiabilities ?? 0).toLocaleString()}`}
          subtitle="Deferred revenue"
          isLoading={statsLoading}
        />
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  Pending Reviews
                </p>
                <p className="text-2xl font-semibold">3</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contracts requiring IFRS 15 review
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
