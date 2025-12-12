import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp,
  DollarSign,
  ArrowRight,
  FileText,
  CreditCard,
  Clock,
  CheckCircle
} from "lucide-react";
import type { ConsolidatedBalanceData, ContractWithDetails } from "@/lib/types";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, AreaChart, Area, ComposedChart, ReferenceLine } from "recharts";

export default function RevenueWaterfall() {
  const [periodFilter, setPeriodFilter] = useState<string>("all_time");

  const { data: balances, isLoading: balancesLoading } = useQuery<ConsolidatedBalanceData[]>({
    queryKey: ["/api/consolidated-balances"],
  });

  const { data: contracts, isLoading: contractsLoading } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/contracts"],
  });

  const isLoading = balancesLoading || contractsLoading;

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodFilter) {
      case "current_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "current_quarter":
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case "current_year":
        return { start: startOfYear(now), end: endOfYear(now) };
      default:
        return null;
    }
  }, [periodFilter]);

  const { filteredContracts, aggregatedBalance } = useMemo(() => {
    if (!contracts || !balances) {
      return { filteredContracts: [], aggregatedBalance: null };
    }

    let contractsInRange = contracts;
    let balancesInRange = balances;

    if (dateRange) {
      contractsInRange = contracts.filter(c => {
        const startDate = parseISO(c.startDate);
        const endDate = c.endDate ? parseISO(c.endDate) : new Date();
        return isWithinInterval(dateRange.start, { start: startDate, end: endDate }) ||
               isWithinInterval(startDate, { start: dateRange.start, end: dateRange.end });
      });

      balancesInRange = balances.filter(b => {
        const periodDate = parseISO(b.periodDate);
        return isWithinInterval(periodDate, { start: dateRange.start, end: dateRange.end });
      });
    }

    const aggregated = balancesInRange.length > 0 ? {
      totalBilledAmount: balancesInRange.reduce((sum, b) => sum + Number(b.totalBilledAmount), 0),
      totalDeferredRevenue: balancesInRange[0] ? Number(balancesInRange[0].totalDeferredRevenue) : 0,
      totalRecognizedRevenue: balancesInRange.reduce((sum, b) => sum + Number(b.totalRecognizedRevenue), 0),
      totalReceivables: balancesInRange[0] ? Number(balancesInRange[0].totalReceivables) : 0,
      totalCashReceived: balancesInRange.reduce((sum, b) => sum + Number(b.totalCashReceived), 0),
      totalContractAssets: balancesInRange[0] ? Number(balancesInRange[0].totalContractAssets) : 0,
      totalContractLiabilities: balancesInRange[0] ? Number(balancesInRange[0].totalContractLiabilities) : 0,
    } : null;

    return { filteredContracts: contractsInRange, aggregatedBalance: aggregated };
  }, [contracts, balances, dateRange]);

  const totalBookings = filteredContracts?.reduce((sum, c) => sum + Number(c.totalValue), 0) || 0;
  const totalBilled = aggregatedBalance?.totalBilledAmount || 0;
  const totalDeferred = aggregatedBalance?.totalDeferredRevenue || 0;
  const totalRecognized = aggregatedBalance?.totalRecognizedRevenue || 0;
  const totalReceivables = aggregatedBalance?.totalReceivables || 0;
  const totalCashReceived = aggregatedBalance?.totalCashReceived || 0;
  const totalAssets = aggregatedBalance?.totalContractAssets || 0;
  const totalLiabilities = aggregatedBalance?.totalContractLiabilities || 0;

  const unbilledAmount = Math.max(0, totalBookings - totalBilled);

  const waterfallData = [
    {
      name: "Bookings",
      base: 0,
      value: totalBookings,
      total: totalBookings,
      fill: "#3b82f6",
      label: "Contract value signed"
    },
    {
      name: "Less: Unbilled",
      base: totalBookings - unbilledAmount,
      value: unbilledAmount,
      total: totalBookings - unbilledAmount,
      fill: "#94a3b8",
      label: "Not yet invoiced",
      isNegative: true
    },
    {
      name: "= Billed",
      base: 0,
      value: totalBilled,
      total: totalBilled,
      fill: "#8b5cf6",
      label: "Invoiced amount"
    },
    {
      name: "Less: Deferred",
      base: totalBilled > totalDeferred ? totalBilled - totalDeferred : 0,
      value: Math.min(totalDeferred, totalBilled),
      total: totalBilled - totalDeferred,
      fill: "#f59e0b",
      label: "Awaiting recognition",
      isNegative: true
    },
    {
      name: "= Recognized",
      base: 0,
      value: totalRecognized,
      total: totalRecognized,
      fill: "#10b981",
      label: "Revenue earned"
    },
  ];

  const flowData = [
    { 
      stage: "Contract Value",
      amount: totalBookings,
      percentage: 100
    },
    { 
      stage: "Billed Amount",
      amount: totalBilled,
      percentage: totalBookings > 0 ? (totalBilled / totalBookings) * 100 : 0
    },
    { 
      stage: "Cash Received",
      amount: totalCashReceived,
      percentage: totalBookings > 0 ? (totalCashReceived / totalBookings) * 100 : 0
    },
    { 
      stage: "Revenue Recognized",
      amount: totalRecognized,
      percentage: totalBookings > 0 ? (totalRecognized / totalBookings) * 100 : 0
    },
  ];

  const chartData = (balances || [])
    .slice()
    .reverse()
    .map((balance) => ({
      period: format(new Date(balance.periodDate), "MMM yyyy"),
      billed: Number(balance.totalBilledAmount),
      deferred: Number(balance.totalDeferredRevenue),
      recognized: Number(balance.totalRecognizedRevenue),
      cash: Number(balance.totalCashReceived),
    }));

  const formatCurrency = (value: number) => `BRL ${value.toLocaleString()}`;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="loading-skeleton">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="revenue-waterfall-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="page-title">Revenue Waterfall</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track the flow from bookings to recognized revenue
          </p>
        </div>

        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-48" data-testid="select-period-filter">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_month" data-testid="option-current-month">Current Month</SelectItem>
            <SelectItem value="current_quarter" data-testid="option-current-quarter">Current Quarter</SelectItem>
            <SelectItem value="current_year" data-testid="option-current-year">Current Year</SelectItem>
            <SelectItem value="all_time" data-testid="option-all-time">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-bookings">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-bookings">
              {formatCurrency(totalBookings)}
            </div>
            <p className="text-xs text-muted-foreground">
              Contract values signed
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-billed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-total-billed">
              {formatCurrency(totalBilled)}
            </div>
            <p className="text-xs text-muted-foreground">
              Invoices issued
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-deferred-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deferred Revenue</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-deferred-revenue">
              {formatCurrency(totalDeferred)}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting recognition
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-recognized-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recognized Revenue</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-recognized-revenue">
              {formatCurrency(totalRecognized)}
            </div>
            <p className="text-xs text-muted-foreground">
              IFRS 15 compliant
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-waterfall-chart">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Revenue Flow Waterfall
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Visual representation of the booking-to-revenue conversion flow
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={waterfallData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  className="text-xs"
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  className="text-xs"
                  width={110}
                />
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => {
                    const total = props?.payload?.total ?? value;
                    return [formatCurrency(total), props?.payload?.label || "Amount"];
                  }}
                  labelClassName="font-medium"
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                />
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="value" stackId="a" radius={[0, 4, 4, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fill} 
                      opacity={entry.isNegative ? 0.7 : 1}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-conversion-flow">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Conversion Flow</CardTitle>
            <p className="text-sm text-muted-foreground">
              Step-by-step conversion from contracts to recognized revenue
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {flowData.map((item, index) => (
                <div key={item.stage} className="space-y-2" data-testid={`flow-step-${index}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {index > 0 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{item.stage}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold tabular-nums" data-testid={`text-flow-${item.stage.toLowerCase().replace(/\s/g, '-')}`}>
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        index === 0 ? "bg-blue-500" :
                        index === 1 ? "bg-purple-500" :
                        index === 2 ? "bg-amber-500" :
                        "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-key-metrics">
          <CardHeader>
            <CardTitle className="text-lg">Key Metrics</CardTitle>
            <p className="text-sm text-muted-foreground">
              Important revenue recognition indicators
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="metric-unbilled">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Unbilled Amount</p>
                    <p className="text-xs text-muted-foreground">Contract value not yet invoiced</p>
                  </div>
                </div>
                <span className="text-lg font-semibold tabular-nums" data-testid="text-unbilled-amount">
                  {formatCurrency(unbilledAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="metric-remaining">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Remaining to Recognize</p>
                    <p className="text-xs text-muted-foreground">Deferred revenue balance</p>
                  </div>
                </div>
                <span className="text-lg font-semibold tabular-nums" data-testid="text-remaining-to-recognize">
                  {formatCurrency(totalDeferred)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="metric-cash">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Cash Received</p>
                    <p className="text-xs text-muted-foreground">Total payments collected</p>
                  </div>
                </div>
                <span className="text-lg font-semibold tabular-nums" data-testid="text-cash-received">
                  {formatCurrency(totalCashReceived)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="metric-receivables">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Accounts Receivable</p>
                    <p className="text-xs text-muted-foreground">Outstanding customer balances</p>
                  </div>
                </div>
                <span className="text-lg font-semibold tabular-nums" data-testid="text-receivables">
                  {formatCurrency(totalReceivables)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card data-testid="card-revenue-over-time">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Flow Over Time</CardTitle>
            <p className="text-sm text-muted-foreground">
              Historical view of revenue stages
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis 
                    className="text-xs" 
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()} 
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), ""]}
                    labelClassName="font-medium"
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="billed"
                    name="Billed"
                    stackId="1"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="deferred"
                    name="Deferred"
                    stackId="2"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="recognized"
                    name="Recognized"
                    stackId="3"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-balance-summary">
        <CardHeader>
          <CardTitle className="text-lg">Contract Balance Summary</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current contract assets and liabilities status
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg border" data-testid="summary-assets">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <h3 className="font-medium">Contract Assets</h3>
              </div>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-contract-assets">
                {formatCurrency(totalAssets)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Revenue recognized but not yet billed
              </p>
            </div>

            <div className="p-4 rounded-lg border" data-testid="summary-liabilities">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-red-500" />
                <h3 className="font-medium">Contract Liabilities</h3>
              </div>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="text-contract-liabilities">
                {formatCurrency(totalLiabilities)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Cash received but not yet earned
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
