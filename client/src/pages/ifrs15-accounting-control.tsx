import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
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
  TrendingDown,
  Calendar,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface AccountingControlRow {
  id: string;
  contractId: string;
  contractNumber: string;
  customerName: string;
  currency: string;
  openingBalance: number;
  debits: number;
  credits: number;
  movement: number;
  closingBalance: number;
  type: "asset" | "liability";
}

interface AccountingControlData {
  period: string;
  contractAssets: AccountingControlRow[];
  contractLiabilities: AccountingControlRow[];
  totalAssetOpening: number;
  totalAssetDebits: number;
  totalAssetCredits: number;
  totalAssetMovement: number;
  totalAssetClosing: number;
  totalLiabilityOpening: number;
  totalLiabilityDebits: number;
  totalLiabilityCredits: number;
  totalLiabilityMovement: number;
  totalLiabilityClosing: number;
}

export default function IFRS15AccountingControl() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, "0"));

  const { data, isLoading } = useQuery<AccountingControlData>({
    queryKey: ["/api/ifrs15-accounting-control", selectedYear, selectedMonth],
  });

  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const years = [2023, 2024, 2025, 2026].map(y => y.toString());

  const assetColumns = [
    {
      key: "contractNumber",
      header: "Contract",
      cell: (row: AccountingControlRow) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.contractNumber}</span>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
    },
    {
      key: "openingBalance",
      header: "Opening Balance",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums">
          {row.currency} {row.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "debits",
      header: "Debits",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums text-green-600 dark:text-green-400">
          {row.currency} {row.debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "credits",
      header: "Credits",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums text-red-600 dark:text-red-400">
          ({row.currency} {row.credits.toLocaleString(undefined, { minimumFractionDigits: 2 })})
        </span>
      ),
      className: "text-right",
    },
    {
      key: "movement",
      header: "Net Movement",
      cell: (row: AccountingControlRow) => (
        <span className={`tabular-nums font-medium ${row.movement >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {row.currency} {row.movement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "closingBalance",
      header: "Closing Balance",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums font-semibold">
          {row.currency} {row.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
  ];

  const liabilityColumns = [
    {
      key: "contractNumber",
      header: "Contract",
      cell: (row: AccountingControlRow) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.contractNumber}</span>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
    },
    {
      key: "openingBalance",
      header: "Opening Balance",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums">
          {row.currency} {row.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "debits",
      header: "Debits",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums text-red-600 dark:text-red-400">
          ({row.currency} {row.debits.toLocaleString(undefined, { minimumFractionDigits: 2 })})
        </span>
      ),
      className: "text-right",
    },
    {
      key: "credits",
      header: "Credits",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums text-green-600 dark:text-green-400">
          {row.currency} {row.credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "movement",
      header: "Net Movement",
      cell: (row: AccountingControlRow) => (
        <span className={`tabular-nums font-medium ${row.movement >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {row.currency} {row.movement.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "closingBalance",
      header: "Closing Balance",
      cell: (row: AccountingControlRow) => (
        <span className="tabular-nums font-semibold">
          {row.currency} {row.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
      className: "text-right",
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">IFRS 15 Accounting Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contract Assets (Unbilled Revenue) and Contract Liabilities (Deferred Revenue)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-32" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contract Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-assets">
              BRL {(data?.totalAssetClosing || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Unbilled Revenue (Revenue Recognized &gt; Invoiced)
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
              BRL {(data?.totalLiabilityClosing || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Deferred Revenue (Invoiced &gt; Revenue Recognized)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asset Movement</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.totalAssetMovement || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              BRL {(data?.totalAssetMovement || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Net change in period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liability Movement</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.totalLiabilityMovement || 0) >= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              BRL {(data?.totalLiabilityMovement || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Net change in period
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Contract Assets (Unbilled Revenue)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Revenue recognized but not yet invoiced - Debit balance
          </p>
        </CardHeader>
        <CardContent>
          {data?.contractAssets && data.contractAssets.length > 0 ? (
            <>
              <DataTable
                data={data.contractAssets}
                columns={assetColumns}
                
              />
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-7 gap-4 text-sm font-semibold">
                  <div className="col-span-2">Total</div>
                  <div className="text-right tabular-nums">BRL {(data.totalAssetOpening || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-right tabular-nums text-green-600 dark:text-green-400">BRL {(data.totalAssetDebits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-right tabular-nums text-red-600 dark:text-red-400">(BRL {(data.totalAssetCredits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})</div>
                  <div className="text-right tabular-nums">BRL {(data.totalAssetMovement || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-right tabular-nums">BRL {(data.totalAssetClosing || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contract assets for this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Contract Liabilities (Deferred Revenue)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Invoiced but not yet recognized as revenue - Credit balance
          </p>
        </CardHeader>
        <CardContent>
          {data?.contractLiabilities && data.contractLiabilities.length > 0 ? (
            <>
              <DataTable
                data={data.contractLiabilities}
                columns={liabilityColumns}
                
              />
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-7 gap-4 text-sm font-semibold">
                  <div className="col-span-2">Total</div>
                  <div className="text-right tabular-nums">BRL {(data.totalLiabilityOpening || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-right tabular-nums text-red-600 dark:text-red-400">(BRL {(data.totalLiabilityDebits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})</div>
                  <div className="text-right tabular-nums text-green-600 dark:text-green-400">BRL {(data.totalLiabilityCredits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-right tabular-nums">BRL {(data.totalLiabilityMovement || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  <div className="text-right tabular-nums">BRL {(data.totalLiabilityClosing || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contract liabilities for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
