import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  FileText,
  Calendar,
  CurrencyDollar,
  TrendUp,
  ClockCounterClockwise,
  Receipt,
  Target,
  ChartLineUp,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import type { ContractWithDetails, PerformanceObligationSummary, BillingScheduleWithDetails, LedgerEntryWithDetails } from "@/lib/types";

interface ContractFullDetails extends ContractWithDetails {
  customerId: string;
  paymentTerms: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ContractDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  const { data: contract, isLoading: contractLoading } = useQuery<ContractFullDetails>({
    queryKey: [`/api/contracts/${id}`],
    enabled: !!id,
  });

  const { data: performanceObligations, isLoading: poLoading } = useQuery<PerformanceObligationSummary[]>({
    queryKey: [`/api/contracts/${id}/performance-obligations`],
    enabled: !!id,
  });

  const { data: billingSchedules, isLoading: billingLoading } = useQuery<BillingScheduleWithDetails[]>({
    queryKey: [`/api/contracts/${id}/billing-schedules`],
    enabled: !!id,
  });

  const { data: ledgerEntries, isLoading: ledgerLoading } = useQuery<LedgerEntryWithDetails[]>({
    queryKey: [`/api/contracts/${id}/ledger-entries`],
    enabled: !!id,
  });

  const formatCurrency = (amount: string | number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(typeof amount === "string" ? parseFloat(amount) : amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "MMM dd, yyyy");
    } catch {
      return "-";
    }
  };

  if (contractLoading) {
    return (
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FileText weight="duotone" className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">Contract not found</p>
          <Button variant="outline" onClick={() => setLocation("/contracts")} data-testid="button-back-contracts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contracts
          </Button>
        </div>
      </div>
    );
  }

  const poColumns = [
    {
      key: "description",
      header: "Description",
      cell: (row: PerformanceObligationSummary) => (
        <span className="font-medium">{row.description}</span>
      ),
    },
    {
      key: "recognitionMethod",
      header: "Recognition",
      cell: (row: PerformanceObligationSummary) => (
        <Badge variant="outline" className="text-xs">
          {row.recognitionMethod === "over_time" ? "Over Time" : "Point in Time"}
        </Badge>
      ),
    },
    {
      key: "allocatedPrice",
      header: "Allocated Price",
      cell: (row: PerformanceObligationSummary) => formatCurrency(row.allocatedPrice, contract.currency),
    },
    {
      key: "percentComplete",
      header: "Progress",
      cell: (row: PerformanceObligationSummary) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full" 
              style={{ width: `${parseFloat(row.percentComplete)}%` }} 
            />
          </div>
          <span className="text-sm tabular-nums">{parseFloat(row.percentComplete).toFixed(0)}%</span>
        </div>
      ),
    },
    {
      key: "recognizedAmount",
      header: "Recognized",
      cell: (row: PerformanceObligationSummary) => formatCurrency(row.recognizedAmount, contract.currency),
    },
    {
      key: "isSatisfied",
      header: "Status",
      cell: (row: PerformanceObligationSummary) => (
        <Badge variant={row.isSatisfied ? "default" : "secondary"}>
          {row.isSatisfied ? "Satisfied" : "In Progress"}
        </Badge>
      ),
    },
  ];

  const billingColumns = [
    {
      key: "billingDate",
      header: "Billing Date",
      cell: (row: BillingScheduleWithDetails) => formatDate(row.billingDate),
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (row: BillingScheduleWithDetails) => formatDate(row.dueDate),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: BillingScheduleWithDetails) => formatCurrency(row.amount, row.currency),
    },
    {
      key: "frequency",
      header: "Frequency",
      cell: (row: BillingScheduleWithDetails) => (
        <Badge variant="outline" className="capitalize text-xs">
          {row.frequency.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: BillingScheduleWithDetails) => <StatusBadge status={row.status} />,
    },
    {
      key: "invoiceNumber",
      header: "Invoice #",
      cell: (row: BillingScheduleWithDetails) => row.invoiceNumber || "-",
    },
  ];

  const ledgerColumns = [
    {
      key: "entryDate",
      header: "Date",
      cell: (row: LedgerEntryWithDetails) => formatDate(row.entryDate),
    },
    {
      key: "entryType",
      header: "Type",
      cell: (row: LedgerEntryWithDetails) => (
        <Badge variant="outline" className="capitalize text-xs">
          {row.entryType.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "debitAccount",
      header: "Debit",
    },
    {
      key: "creditAccount",
      header: "Credit",
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: LedgerEntryWithDetails) => formatCurrency(row.amount, row.currency),
    },
    {
      key: "isPosted",
      header: "Posted",
      cell: (row: LedgerEntryWithDetails) => (
        <Badge variant={row.isPosted ? "default" : "secondary"}>
          {row.isPosted ? "Posted" : "Pending"}
        </Badge>
      ),
    },
  ];

  const recognitionProgress = contract.totalValue !== "0" 
    ? (parseFloat(contract.recognizedRevenue) / parseFloat(contract.totalValue)) * 100 
    : 0;

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/contracts")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <FileText weight="fill" className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight" data-testid="text-contract-number">
                    {contract.contractNumber}
                  </h1>
                  <StatusBadge status={contract.status} />
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-contract-title">
                  {contract.title}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/10">
                <CurrencyDollar weight="duotone" className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums" data-testid="text-total-value">
                {formatCurrency(contract.totalValue, contract.currency)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total Contract Value</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                <TrendUp weight="duotone" className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums" data-testid="text-recognized">
                {formatCurrency(contract.recognizedRevenue, contract.currency)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Recognized Revenue</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all" 
                    style={{ width: `${Math.min(recognitionProgress, 100)}%` }} 
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {recognitionProgress.toFixed(0)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                <ClockCounterClockwise weight="duotone" className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums" data-testid="text-deferred">
                {formatCurrency(contract.deferredRevenue, contract.currency)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Deferred Revenue</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                <Calendar weight="duotone" className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold" data-testid="text-dates">
                {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Contract Period</p>
              <p className="text-xs text-muted-foreground mt-2">
                Customer: <span className="font-medium">{contract.customerName}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="obligations" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="obligations" data-testid="tab-obligations" className="gap-2">
            <Target className="h-4 w-4" />
            Obligations
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing" className="gap-2">
            <Receipt className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger" className="gap-2">
            <ChartLineUp className="h-4 w-4" />
            Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="obligations" className="mt-6">
          <Card className="card-premium border-0">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                  <Target weight="duotone" className="h-4 w-4 text-purple-500" />
                </div>
                <CardTitle className="text-base font-semibold">Performance Obligations</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {performanceObligations?.length ?? 0} obligations
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {poLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : performanceObligations && performanceObligations.length > 0 ? (
                <DataTable columns={poColumns} data={performanceObligations} />
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Target weight="duotone" className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm">No performance obligations found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <Card className="card-premium border-0">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/10 to-cyan-500/10">
                  <Receipt weight="duotone" className="h-4 w-4 text-teal-500" />
                </div>
                <CardTitle className="text-base font-semibold">Billing Schedule</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {billingSchedules?.length ?? 0} entries
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {billingLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : billingSchedules && billingSchedules.length > 0 ? (
                <DataTable columns={billingColumns} data={billingSchedules} />
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Receipt weight="duotone" className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm">No billing schedules found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="mt-6">
          <Card className="card-premium border-0">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
                  <ChartLineUp weight="duotone" className="h-4 w-4 text-indigo-500" />
                </div>
                <CardTitle className="text-base font-semibold">Revenue Ledger Entries</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {ledgerEntries?.length ?? 0} entries
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {ledgerLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : ledgerEntries && ledgerEntries.length > 0 ? (
                <DataTable columns={ledgerColumns} data={ledgerEntries} />
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ChartLineUp weight="duotone" className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm">No ledger entries found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
