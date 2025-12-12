import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  TrendingUp,
  TrendingDown,
  ArrowDownUp,
  Calendar,
  FileText,
  RefreshCw,
  BarChart3
} from "lucide-react";
import type { ConsolidatedBalanceData } from "@/lib/types";
import { format } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ConsolidatedBalances() {
  const { toast } = useToast();
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  const { data: balances, isLoading } = useQuery<ConsolidatedBalanceData[]>({
    queryKey: ["/api/consolidated-balances"],
  });

  const { data: latestBalance } = useQuery<ConsolidatedBalanceData>({
    queryKey: ["/api/consolidated-balances/latest"],
  });

  const generateBalanceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/consolidated-balances/generate", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consolidated-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consolidated-balances/latest"] });
      toast({
        title: "Balance generated",
        description: "A new consolidated balance snapshot has been created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredBalances = balances?.filter((balance) => {
    if (periodFilter === "all") return true;
    return balance.periodType === periodFilter;
  });

  const chartData = filteredBalances?.slice().reverse().map((balance) => ({
    period: format(new Date(balance.periodDate), "MMM yyyy"),
    assets: Number(balance.totalContractAssets),
    liabilities: Number(balance.totalContractLiabilities),
    recognized: Number(balance.totalRecognizedRevenue),
    deferred: Number(balance.totalDeferredRevenue),
  })) || [];

  const columns = [
    {
      key: "periodDate",
      header: "Period",
      cell: (row: ConsolidatedBalanceData) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{format(new Date(row.periodDate), "MMM yyyy")}</span>
        </div>
      ),
    },
    {
      key: "periodType",
      header: "Type",
      cell: (row: ConsolidatedBalanceData) => (
        <span className="text-sm capitalize">{row.periodType}</span>
      ),
    },
    {
      key: "contractCount",
      header: "Contracts",
      cell: (row: ConsolidatedBalanceData) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{row.contractCount}</span>
        </div>
      ),
    },
    {
      key: "totalContractAssets",
      header: "Contract Assets",
      cell: (row: ConsolidatedBalanceData) => (
        <span className="tabular-nums font-medium text-green-600 dark:text-green-400">
          {row.currency} {Number(row.totalContractAssets).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "totalContractLiabilities",
      header: "Contract Liabilities",
      cell: (row: ConsolidatedBalanceData) => (
        <span className="tabular-nums font-medium text-red-600 dark:text-red-400">
          {row.currency} {Number(row.totalContractLiabilities).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "totalRecognizedRevenue",
      header: "Recognized Revenue",
      cell: (row: ConsolidatedBalanceData) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.totalRecognizedRevenue).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "totalDeferredRevenue",
      header: "Deferred Revenue",
      cell: (row: ConsolidatedBalanceData) => (
        <span className="tabular-nums font-medium text-muted-foreground">
          {row.currency} {Number(row.totalDeferredRevenue).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "totalRemainingObligations",
      header: "Remaining Obligations",
      cell: (row: ConsolidatedBalanceData) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.totalRemainingObligations).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
  ];

  const totalAssets = Number(latestBalance?.totalContractAssets || 0);
  const totalLiabilities = Number(latestBalance?.totalContractLiabilities || 0);
  const totalRecognized = Number(latestBalance?.totalRecognizedRevenue || 0);
  const totalDeferred = Number(latestBalance?.totalDeferredRevenue || 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Consolidated Balances</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contract assets, liabilities, and revenue overview
          </p>
        </div>

        <Button
          onClick={() => generateBalanceMutation.mutate()}
          disabled={generateBalanceMutation.isPending}
          data-testid="button-generate-snapshot"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${generateBalanceMutation.isPending ? "animate-spin" : ""}`} />
          Generate Snapshot
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contract Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-assets">
              BRL {totalAssets.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Unbilled receivables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contract Liabilities</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-total-liabilities">
              BRL {totalLiabilities.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Deferred revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recognized Revenue</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-recognized">
              BRL {totalRecognized.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue recognized YTD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deferred Revenue</CardTitle>
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-deferred">
              BRL {totalDeferred.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Remaining to recognize
            </p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Balance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => [`BRL ${value.toLocaleString()}`, ""]}
                    labelClassName="font-medium"
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="assets"
                    name="Contract Assets"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="recognized"
                    name="Recognized Revenue"
                    stackId="2"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="deferred"
                    name="Deferred Revenue"
                    stackId="3"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40" data-testid="select-period-filter">
            <SelectValue placeholder="All periods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annually">Annually</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredBalances ?? []}
        isLoading={isLoading}
        emptyMessage="No consolidated balances found. Generate a snapshot to get started."
        testIdPrefix="balance"
      />

      {latestBalance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest Balance Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Snapshot from {format(new Date(latestBalance.periodDate), "MMMM yyyy")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Receivables</p>
                <p className="text-lg font-semibold tabular-nums" data-testid="text-receivables">
                  BRL {Number(latestBalance.totalReceivables).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Billed</p>
                <p className="text-lg font-semibold tabular-nums" data-testid="text-billed">
                  BRL {Number(latestBalance.totalBilledAmount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Received</p>
                <p className="text-lg font-semibold tabular-nums" data-testid="text-cash-received">
                  BRL {Number(latestBalance.totalCashReceived).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining Obligations</p>
                <p className="text-lg font-semibold tabular-nums" data-testid="text-remaining">
                  BRL {Number(latestBalance.totalRemainingObligations).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
