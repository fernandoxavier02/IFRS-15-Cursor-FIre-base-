import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { contractCostService, contractService, ifrs15Service, maintenanceService, revenueLedgerService } from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import type { LedgerEntryWithDetails } from "@/lib/types";
import type { Contract, RevenueLedgerEntry } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { BookOpen, CalendarDays, Gauge, Receipt, Scale } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BalanceSide = "debit" | "credit";

function isLedgerV2(entry: any): boolean {
  const ref = entry?.referenceNumber || entry?.id || "";
  return entry?.ledgerVersion === 2 || (typeof ref === "string" && ref.startsWith("V2-"));
}

function parseAccountLabel(label: string) {
  const match = (label || "").match(/^\s*(\d+)\s*-\s*(.+)\s*$/);
  if (!match) return { code: "", name: label || "", label: label || "" };
  return { code: match[1], name: match[2], label: `${match[1]} - ${match[2]}` };
}

function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    const d = (value as any).toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  return null;
}

function formatCurrency(amount: string | number | null | undefined, currency = "BRL") {
  const num = typeof amount === "string" ? parseFloat(amount) : typeof amount === "number" ? amount : 0;
  if (isNaN(num)) return `${currency} 0`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return isNaN(d.getTime()) ? "-" : format(d, "MMM dd, yyyy");
  } catch {
    return "-";
  }
}

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

export default function AccountingReconciliation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [periodStart, setPeriodStart] = useState<Date>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(endOfMonth(new Date()));
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "posted" | "unposted">("all");
  const [recalcProgress, setRecalcProgress] = useState<{
    phase: "idle" | "fixing" | "running" | "done";
    total: number;
    done: number;
    errors: number;
  }>({ phase: "idle", total: 0, done: 0, errors: 0 });

  const tenantId = user?.tenantId;

  const { data: ledgerEntries, isLoading: ledgerLoading } = useQuery<RevenueLedgerEntry[]>({
    queryKey: ["ledger-entries", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      console.log("[accounting-reconciliation] Buscando ledger entries", { tenantId });
      const entries = await revenueLedgerService.getAll(tenantId);
      console.log(`[accounting-reconciliation] Total entries: ${entries.length}, V2: ${entries.filter(isLedgerV2).length}`);
      // Retorna TODOS os entries agora para diagnóstico
      return entries;
    },
    enabled: !!tenantId,
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["contracts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return contractService.getAll(tenantId);
    },
    enabled: !!tenantId,
  });

  const recalcAllMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant ID");

      setRecalcProgress({ phase: "fixing", total: 0, done: 0, errors: 0 });
      const fixResult = await maintenanceService.fixContractVersions();

      const allContracts = await contractService.getAll(tenantId);
      setRecalcProgress({ phase: "running", total: allContracts.length, done: 0, errors: 0 });

      let done = 0;
      let errors = 0;

      for (const contract of allContracts) {
        try {
          await ifrs15Service.runEngine(contract.id, (contract as any).currentVersionId);
        } catch (e: any) {
          errors++;
          console.error("[accounting-reconciliation] runIFRS15Engine failed", {
            contractId: contract.id,
            error: e?.message || String(e),
          });
        } finally {
          done++;
          setRecalcProgress((prev) => ({ ...prev, phase: "running", done, errors }));
        }
      }

      return { fixResult, processed: allContracts.length, errors };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["ledger-entries", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries-unposted", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["contracts", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["consolidated-balances", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["contract-costs", tenantId] });

      setRecalcProgress((prev) => ({ ...prev, phase: "done" }));
      toast({
        title: "Recalculo concluído",
        description: `Processados ${result?.processed ?? 0} contratos. Erros: ${result?.errors ?? 0}.`,
      });
    },
    onError: (error: Error) => {
      setRecalcProgress((prev) => ({ ...prev, phase: "idle" }));
      toast({
        title: "Erro ao recalcular",
        description: error.message || "Falha ao executar saneamento e motor IFRS 15",
        variant: "destructive",
      });
    },
  });

  const { data: contractCosts } = useQuery<any[]>({
    queryKey: ["contract-costs", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return contractCostService.getAll(tenantId);
    },
    enabled: !!tenantId,
  });

  const contractMap = useMemo(() => {
    const map = new Map<string, Contract>();
    contracts?.forEach((c) => map.set(c.id, c));
    return map;
  }, [contracts]);

  const entriesWithDetails: LedgerEntryWithDetails[] = useMemo(() => {
    return (ledgerEntries || []).map((entry) => {
      const contract = contractMap.get(entry.contractId);
      return {
        id: entry.id,
        tenantId: entry.tenantId,
        contractId: entry.contractId,
        performanceObligationId: entry.performanceObligationId || null,
        billingScheduleId: entry.billingScheduleId || null,
        entryDate: toISOString(entry.entryDate),
        periodStart: toISOString(entry.periodStart),
        periodEnd: toISOString(entry.periodEnd),
        entryType: entry.entryType,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount: entry.amount?.toString() || "0",
        currency: entry.currency || "BRL",
        exchangeRate: entry.exchangeRate?.toString() || null,
        functionalAmount: entry.functionalAmount?.toString() || null,
        description: entry.description || null,
        referenceNumber: entry.referenceNumber || null,
        isPosted: entry.isPosted,
        postedAt: toISOString(entry.postedAt) || null,
        postedBy: entry.postedBy || null,
        isReversed: entry.isReversed || false,
        reversedEntryId: entry.reversedEntryId || null,
        createdAt: toISOString(entry.createdAt),
        contractNumber: contract?.contractNumber || "Unknown",
        contractTitle: contract?.title || "Unknown",
        customerName: contract?.customerId || "Unknown",
      };
    });
  }, [ledgerEntries, contractMap]);

  // Se existirem lançamentos fora do período atual, ajustar o período para cobrir todos
  useEffect(() => {
    if (!ledgerEntries || ledgerEntries.length === 0) return;
    // Se o filtro atual retornou vazio, expandir para cobrir todo o range disponível
    const dates = ledgerEntries
      .map((e) => toDateSafe(e.entryDate))
      .filter((d): d is Date => !!d)
      .map((d) => d.getTime());
    if (dates.length === 0) return;
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const currentFiltered = entriesWithDetails.filter((entry) => {
      const d = toDateSafe(entry.entryDate);
      return d && d >= periodStart && d <= periodEnd;
    });
    if (currentFiltered.length === 0) {
      setPeriodStart(startOfMonth(minDate));
      setPeriodEnd(endOfMonth(maxDate));
    }
  }, [ledgerEntries, entriesWithDetails, periodStart, periodEnd]);

  const scopeEntries = useMemo(() => {
    if (ledgerFilter === "posted") return entriesWithDetails.filter((e) => e.isPosted);
    if (ledgerFilter === "unposted") return entriesWithDetails.filter((e) => !e.isPosted);
    return entriesWithDetails;
  }, [entriesWithDetails, ledgerFilter]);

  const periodEntries = useMemo(() => {
    return scopeEntries.filter((entry) => {
      const dt = toDateSafe(entry.entryDate);
      if (!dt) return false;
      return dt >= periodStart && dt <= periodEnd;
    });
  }, [scopeEntries, periodEnd, periodStart]);

  const openingNetByAccount = useMemo(() => {
    const map = new Map<string, number>();
    scopeEntries.forEach((entry) => {
      const dt = toDateSafe(entry.entryDate);
      if (!dt || dt >= periodStart) return;
      const amount = Number(entry.amount || 0);
      if (!amount) return;
      map.set(entry.debitAccount, (map.get(entry.debitAccount) || 0) + amount);
      map.set(entry.creditAccount, (map.get(entry.creditAccount) || 0) - amount);
    });
    return map;
  }, [periodStart, scopeEntries]);

  const reconciliationRows = useMemo(() => {
    const debitByAccount = new Map<string, number>();
    const creditByAccount = new Map<string, number>();

    periodEntries.forEach((entry) => {
      const amount = Number(entry.amount || 0);
      if (!amount) return;
      debitByAccount.set(entry.debitAccount, (debitByAccount.get(entry.debitAccount) || 0) + amount);
      creditByAccount.set(entry.creditAccount, (creditByAccount.get(entry.creditAccount) || 0) + amount);
    });

    const accounts = new Set<string>([
      ...Array.from(openingNetByAccount.keys()),
      ...Array.from(debitByAccount.keys()),
      ...Array.from(creditByAccount.keys()),
    ]);

    return Array.from(accounts)
      .map((account) => {
        const openingNet = openingNetByAccount.get(account) || 0;
        const debit = debitByAccount.get(account) || 0;
        const credit = creditByAccount.get(account) || 0;
        const closingNet = openingNet + debit - credit;
        const nature: BalanceSide = closingNet >= 0 ? "debit" : "credit";
        const parsed = parseAccountLabel(account);

        return {
          key: account,
          account: parsed.label,
          code: parsed.code,
          name: parsed.name,
          openingNet,
          opening: Math.abs(openingNet),
          debit,
          credit,
          closingNet,
          closing: Math.abs(closingNet),
          nature,
          description: "",
        };
      })
      .sort((a, b) => {
        const na = Number(a.code || 0);
        const nb = Number(b.code || 0);
        if (na !== nb) return na - nb;
        return a.account.localeCompare(b.account);
      });
  }, [openingNetByAccount, periodEntries]);

  const totals = useMemo(() => {
    const netByCode = (code: string) =>
      reconciliationRows
        .filter((r) => r.code === code)
        .reduce((sum, r) => sum + Number(r.closingNet || 0), 0);

    const revenueNet = netByCode("4000");
    const arNet = netByCode("1200");
    const caNet = netByCode("1300");
    const clNet = netByCode("2600") + netByCode("2500");

    return {
      revenue: Math.abs(Math.min(0, revenueNet)),
      contractLiability: Math.abs(Math.min(0, clNet)),
      receivable: Math.max(0, arNet),
      contractAsset: Math.max(0, caNet),
    };
  }, [reconciliationRows]);

  const periodCostSummary = useMemo(() => {
    const base = { capitalized: 0, amortized: 0, count: 0 };
    if (!contractCosts) return base;
    const filtered = contractCosts.filter((cost) => {
      const d = toDateSafe(cost.incurredDate || cost.createdAt);
      if (!d) return false;
      return d >= periodStart && d <= periodEnd;
    });
    const capitalized = filtered.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const amortized = filtered.reduce((sum, c) => sum + Number(c.totalAmortized || 0), 0);
    return { capitalized, amortized, count: filtered.length };
  }, [contractCosts, periodEnd, periodStart]);

  const contractBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        contractNumber: string;
        contractTitle: string;
        customerName: string;
        invoiced: number;
        cash: number;
        revenue: number;
        contractAssetNet: number;
        contractLiabilityNet: number;
        arNet: number;
      }
    >();

    periodEntries.forEach((entry) => {
      const key = entry.contractId;
      if (!map.has(key)) {
        const contract = contractMap.get(entry.contractId);
        map.set(key, {
          contractNumber: contract?.contractNumber || entry.contractId,
          contractTitle: contract?.title || "",
          customerName: contract?.customerId || "",
          invoiced: 0,
          cash: 0,
          revenue: 0,
          contractAssetNet: 0,
          contractLiabilityNet: 0,
          arNet: 0,
        });
      }

      const bucket = map.get(key)!;
      const amount = Number(entry.amount || 0);
      if (!amount) return;

      const debit = parseAccountLabel(entry.debitAccount).code;
      const credit = parseAccountLabel(entry.creditAccount).code;

      if (debit === "1200") bucket.invoiced += amount;
      if (debit === "1000") bucket.cash += amount;
      if (credit === "4000") bucket.revenue += amount;

      if (debit === "1300") bucket.contractAssetNet += amount;
      if (credit === "1300") bucket.contractAssetNet -= amount;

      if (credit === "2600" || credit === "2500") bucket.contractLiabilityNet += amount;
      if (debit === "2600" || debit === "2500") bucket.contractLiabilityNet -= amount;

      if (debit === "1200") bucket.arNet += amount;
      if (credit === "1200") bucket.arNet -= amount;
    });

    return Array.from(map.entries()).map(([contractId, data]) => ({
      contractId,
      ...data,
    }));
  }, [contractMap, periodEntries]);

  const ledgerColumns = [
    {
      key: "entryDate",
      header: "Data",
      cell: (row: LedgerEntryWithDetails) => formatDate(row.entryDate),
    },
    {
      key: "contract",
      header: "Contrato",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.contractNumber}</span>
          <span className="text-xs text-muted-foreground">{row.contractTitle}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      cell: (row: LedgerEntryWithDetails) => (
        <Badge variant="outline" className="text-xs">
          {row.entryType.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "accounts",
      header: "Débito / Crédito",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium">D: {row.debitAccount}</span>
          <span className="text-muted-foreground">C: {row.creditAccount}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Valor",
      cell: (row: LedgerEntryWithDetails) => (
        <span className="tabular-nums font-medium">{formatCurrency(row.amount, row.currency)}</span>
      ),
    },
    {
      key: "description",
      header: "Descrição",
      cell: (row: LedgerEntryWithDetails) => row.description || "-",
    },
    {
      key: "status",
      header: "Status",
      cell: (row: LedgerEntryWithDetails) => <StatusBadge status={row.isPosted ? "posted" : "unposted"} />,
    },
  ];

  const contractColumns = [
    {
      key: "contractNumber",
      header: "Contrato",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.contractNumber}</span>
          <span className="text-xs text-muted-foreground">{row.contractTitle}</span>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Cliente",
      cell: (row: any) => row.customerName || "-",
    },
    {
      key: "invoiced",
      header: "Faturado (AR)",
      cell: (row: any) => formatCurrency(row.invoiced || 0),
    },
    {
      key: "cash",
      header: "Recebido (Caixa)",
      cell: (row: any) => formatCurrency(row.cash || 0),
    },
    {
      key: "revenue",
      header: "Receita",
      cell: (row: any) => formatCurrency(row.revenue || 0),
    },
    {
      key: "contractLiabilityNet",
      header: "Contract Liability (Δ)",
      cell: (row: any) => formatCurrency(row.contractLiabilityNet || 0),
    },
    {
      key: "contractAssetNet",
      header: "Contract Asset (Δ)",
      cell: (row: any) => formatCurrency(row.contractAssetNet || 0),
    },
  ];

  const changePeriod = (months: number) => {
    const newStart = startOfMonth(addMonths(periodStart, months));
    const newEnd = endOfMonth(newStart);
    setPeriodStart(newStart);
    setPeriodEnd(newEnd);
  };

  if (!tenantId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium text-muted-foreground">Perfil incompleto</p>
          <p className="text-sm text-muted-foreground">Nenhum tenant associado. Reautentique ou contate o administrador.</p>
        </div>
      </div>
    );
  }

  const isLoadingAny = ledgerLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Accounting Reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Fechamento contábil IFRS 15: abertura, movimentos e saldos por conta e por contrato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => recalcAllMutation.mutate()}
            disabled={recalcAllMutation.isPending}
            data-testid="button-recalc-ifrs15-all"
          >
            {recalcAllMutation.isPending
              ? `Recalculando... (${recalcProgress.done}/${recalcProgress.total || 0})`
              : "Calcular IFRS 15 (Gerar Ledger)"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => changePeriod(-1)}>
            Mês anterior
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Início</span>
              <Input
                type="date"
                value={format(periodStart, "yyyy-MM-dd")}
                onChange={(e) => setPeriodStart(startOfMonth(parseISO(e.target.value)))}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Fim</span>
              <Input
                type="date"
                value={format(periodEnd, "yyyy-MM-dd")}
                onChange={(e) => setPeriodEnd(endOfMonth(parseISO(e.target.value)))}
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => changePeriod(1)}>
            Próximo mês
          </Button>
        </div>
      </div>

      {!isLoadingAny && (ledgerEntries?.length ?? 0) === 0 && (
        <Alert>
          <AlertTitle>Sem lançamentos no tenant</AlertTitle>
          <AlertDescription>
            Esta página é alimentada por `revenueLedgerEntries`. Clique em “Calcular IFRS 15 (Gerar Ledger)” para saneamento
            (versões/line items) e execução do motor em todos os contratos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita (encerramento)</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingAny ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>}
            <p className="text-xs text-muted-foreground">Reconhecida no período selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contract Liability</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingAny ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{formatCurrency(totals.contractLiability)}</div>}
            <p className="text-xs text-muted-foreground">Faturamento/caixa acima da receita reconhecida</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingAny ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{formatCurrency(totals.receivable)}</div>}
            <p className="text-xs text-muted-foreground">Faturado e ainda não recebido</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contract Assets</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingAny ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{formatCurrency(totals.contractAsset)}</div>}
            <p className="text-xs text-muted-foreground">Receita reconhecida acima do faturamento</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Reconciliação por conta</CardTitle>
            <p className="text-sm text-muted-foreground">Abertura, débitos, créditos e encerramento no período.</p>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Conta</th>
                <th className="py-2 pr-4">Abertura</th>
                <th className="py-2 pr-4">Débitos</th>
                <th className="py-2 pr-4">Créditos</th>
                <th className="py-2 pr-4">Encerramento</th>
                <th className="py-2 pr-4">Natureza</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingAny ? (
                <tr>
                  <td colSpan={6}>
                    <Skeleton className="h-10 w-full" />
                  </td>
                </tr>
              ) : (
                reconciliationRows.map((row) => (
                  <tr key={row.key} className="border-t">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{row.account}</div>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{formatCurrency(row.opening)}</td>
                    <td className="py-2 pr-4 tabular-nums text-red-500">{formatCurrency(row.debit)}</td>
                    <td className="py-2 pr-4 tabular-nums text-green-600">{formatCurrency(row.credit)}</td>
                    <td className="py-2 pr-4 tabular-nums font-semibold">{formatCurrency(row.closing)}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline">{row.nature === "debit" ? "Devedor" : "Credor"}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Custos de Contrato</CardTitle>
            <Badge variant="secondary">{periodCostSummary.count} itens</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingAny ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Capitalizado no período</span>
                  <span className="font-medium tabular-nums">{formatCurrency(periodCostSummary.capitalized)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amortizado no período</span>
                  <span className="font-medium tabular-nums">{formatCurrency(periodCostSummary.amortized)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Quebra por contrato</CardTitle>
            <Badge variant="outline">Período selecionado</Badge>
          </CardHeader>
          <CardContent>
            {isLoadingAny ? (
              <Skeleton className="h-24 w-full" />
            ) : contractBreakdown.length > 0 ? (
              <DataTable columns={contractColumns} data={contractBreakdown} />
            ) : (
              <div className="text-sm text-muted-foreground">Nenhum movimento para o período.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Razão do mês</CardTitle>
            <p className="text-sm text-muted-foreground">Entradas contábeis detalhadas no período selecionado.</p>
          </div>
          <Tabs value={ledgerFilter} onValueChange={(val) => setLedgerFilter(val as any)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="posted">Postados</TabsTrigger>
              <TabsTrigger value="unposted">Pendentes</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : periodEntries.length > 0 ? (
            <DataTable columns={ledgerColumns} data={periodEntries} />
          ) : (
            <div className="h-24 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm">Nenhum lançamento encontrado no período.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
