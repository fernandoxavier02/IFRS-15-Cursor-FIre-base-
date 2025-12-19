import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { contractService, customerService, ifrs15Service, revenueLedgerService } from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import type { LedgerEntryWithDetails } from "@/lib/types";
import type { Contract, Customer, RevenueLedgerEntry } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowRightLeft,
    BookOpen,
    Calendar,
    CheckCircle,
    Clock,
    FileText,
    Search,
    Send,
} from "lucide-react";
import { useMemo, useState } from "react";
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

export default function RevenueLedger() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [postedFilter, setPostedFilter] = useState<string>("all");
  const [contractFilter, setContractFilter] = useState<string>("all");

  // Fetch ledger entries from Firestore
  const {
    data: ledgerEntries,
    isLoading,
    error: ledgerEntriesError,
    refetch: refetchLedger,
  } = useQuery<RevenueLedgerEntry[]>({
    queryKey: ["ledger-entries", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) {
        console.log("[revenue-ledger] tenantId ausente, retornando array vazio");
        return [];
      }
      console.log(`[revenue-ledger] Buscando ledger entries para tenant: ${user.tenantId}`);
      const entries = await revenueLedgerService.getAll(user.tenantId);
      console.log(`[revenue-ledger] Total entries retornados: ${entries.length}`);

      // Filtro V2 opcional para diagnóstico
      const v2Entries = (entries || []).filter((e: any) => {
        const ref = e?.referenceNumber || e?.id || "";
        return e?.ledgerVersion === 2 || (typeof ref === "string" && ref.startsWith("V2-"));
      });
      console.log(`[revenue-ledger] Entries V2: ${v2Entries.length}, Total: ${entries.length}`);

      return entries; // Retorna TODOS os entries agora
    },
    enabled: !!user?.tenantId,
  });

  // Fetch unposted entries
  const { data: unpostedEntries, error: unpostedEntriesError } = useQuery<RevenueLedgerEntry[]>({
    queryKey: ["ledger-entries-unposted", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      const entries = await revenueLedgerService.getUnposted(user.tenantId);
      // Retorna todos os entries sem filtro V2
      return entries || [];
    },
    enabled: !!user?.tenantId,
  });

  // Fetch contracts for dropdown
  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["contracts", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return contractService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Fetch customers for name lookup
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return customerService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Create lookup maps
  const contractMap = useMemo(() => {
    const map = new Map<string, Contract>();
    contracts?.forEach((contract) => {
      map.set(contract.id, contract);
    });
    return map;
  }, [contracts]);

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers?.forEach((customer) => {
      map.set(customer.id, customer.name);
    });
    return map;
  }, [customers]);

  // Transform ledger entries with details
  const entriesWithDetails: LedgerEntryWithDetails[] = useMemo(() => {
    console.log(`[revenue-ledger] Transformando entries: ${ledgerEntries?.length || 0} entries`);
    if (!ledgerEntries || ledgerEntries.length === 0) {
      console.log(`[revenue-ledger] ⚠️ Nenhum ledger entry encontrado para transformar`);
      return [];
    }
    return (ledgerEntries || []).map((entry) => {
      const contract = contractMap.get(entry.contractId);
      const customerName = contract ? customerMap.get(contract.customerId) || "Unknown" : "Unknown";

      return {
        id: entry.id,
        tenantId: entry.tenantId,
        contractId: entry.contractId,
        performanceObligationId: entry.performanceObligationId || null,
        billingScheduleId: entry.billingScheduleId || null,
        entryDate: toISOString(entry.entryDate),
        periodStart: toISOString(entry.periodStart),
        periodEnd: toISOString(entry.periodEnd),
        entryType: entry.entryType as any,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount: entry.amount?.toString() || "0",
        currency: entry.currency,
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
        customerName,
      };
    });
  }, [ledgerEntries, contractMap, customerMap]);

  // Unposted entries with details
  const unpostedEntriesWithDetails: LedgerEntryWithDetails[] = useMemo(() => {
    return (unpostedEntries || []).map((entry) => {
      const contract = contractMap.get(entry.contractId);
      const customerName = contract ? customerMap.get(contract.customerId) || "Unknown" : "Unknown";

      return {
        id: entry.id,
        tenantId: entry.tenantId,
        contractId: entry.contractId,
        performanceObligationId: entry.performanceObligationId || null,
        billingScheduleId: entry.billingScheduleId || null,
        entryDate: toISOString(entry.entryDate),
        periodStart: toISOString(entry.periodStart),
        periodEnd: toISOString(entry.periodEnd),
        entryType: entry.entryType as any,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount: entry.amount?.toString() || "0",
        currency: entry.currency,
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
        customerName,
      };
    });
  }, [unpostedEntries, contractMap, customerMap]);

  // Guards after hooks to keep hook order stable
  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-6 w-48 rounded bg-muted animate-pulse" />
        <div className="h-40 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!user?.tenantId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <BookOpen className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">Perfil incompleto</p>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui um tenant associado. Por favor, reautentique ou contate o administrador.
          </p>
        </div>
      </div>
    );
  }

  // Mutations
  const postEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      return revenueLedgerService.update(user.tenantId, id, {
        isPosted: true,
        postedAt: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-entries", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries-unposted", user?.tenantId] });
      refetchLedger();
      toast({
        title: "Entry posted",
        description: "The journal entry has been posted to the general ledger.",
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

  const postAllMutation = useMutation({
    mutationFn: async () => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      const unposted = await revenueLedgerService.getUnposted(user.tenantId);
      await Promise.all(
        unposted.map((entry) =>
          revenueLedgerService.update(user.tenantId, entry.id, {
            isPosted: true,
            postedAt: new Date(),
          })
        )
      );
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-entries", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries-unposted", user?.tenantId] });
      refetchLedger();
      toast({
        title: "All entries posted",
        description: "All unposted journal entries have been posted to the general ledger.",
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

  const deleteAllLedgerEntriesMutation = useMutation({
    mutationFn: async () => {
      if (!confirm("⚠️ ATENÇÃO: Esta ação irá apagar TODOS os lançamentos contábeis do seu tenant. Esta ação é irreversível. Deseja continuar?")) {
        throw new Error("Operação cancelada pelo usuário");
      }
      return ifrs15Service.deleteAllLedgerEntries();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ledger-entries", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries-unposted", user?.tenantId] });
      refetchLedger();
      toast({
        title: "Lançamentos apagados!",
        description: result.message || `${result.deleted} lançamentos foram deletados`,
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao apagar lançamentos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter entries
  console.log(`[revenue-ledger] Filtrando entries: ${entriesWithDetails.length} entries, filtros:`, {
    searchQuery,
    typeFilter,
    postedFilter,
    contractFilter,
  });
  const filteredEntries = entriesWithDetails.filter((entry) => {
    const matchesSearch =
      entry.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.debitAccount?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.creditAccount?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || entry.entryType === typeFilter;
    const matchesPosted =
      postedFilter === "all" ||
      (postedFilter === "posted" && entry.isPosted) ||
      (postedFilter === "unposted" && !entry.isPosted);
    const matchesContract = contractFilter === "all" || entry.contractId === contractFilter;
    const result = matchesSearch && matchesType && matchesPosted && matchesContract;
    if (!result) {
      console.log(`[revenue-ledger] Entry ${entry.id} filtrado:`, {
        matchesSearch,
        matchesType,
        matchesPosted,
        matchesContract,
        entryType: entry.entryType,
        isPosted: entry.isPosted,
        contractId: entry.contractId,
      });
    }
    return result;
  });
  console.log(`[revenue-ledger] Entries após filtro: ${filteredEntries.length} de ${entriesWithDetails.length}`);

  // Statistics
  const totalPosted = entriesWithDetails.filter((e) => e.isPosted).length;
  const totalUnposted = unpostedEntriesWithDetails.length;
  const totalAmount = entriesWithDetails.reduce((sum, e) => sum + Number(e.amount), 0);

  // Format currency helper
  const formatCurrency = (amount: string | number, currency: string = "BRL") => {
    const num = typeof amount === "string" ? Number(amount) : amount;
    return `${currency} ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? "-" : format(date, "MMM dd, yyyy");
    } catch {
      return "-";
    }
  };

  // Table columns
  const columns = [
    {
      key: "entryDate",
      header: "Entry Date",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{formatDate(row.entryDate)}</span>
        </div>
      ),
    },
    {
      key: "referenceNumber",
      header: "Reference",
      cell: (row: LedgerEntryWithDetails) => (
        <span className="text-sm font-mono">{row.referenceNumber || "-"}</span>
      ),
    },
    {
      key: "entryType",
      header: "Type",
      cell: (row: LedgerEntryWithDetails) => {
        const typeLabels: Record<string, string> = {
          [LedgerEntryType.REVENUE]: "Revenue",
          [LedgerEntryType.DEFERRED_REVENUE]: "Deferred Revenue",
          [LedgerEntryType.CONTRACT_ASSET]: "Contract Asset",
          [LedgerEntryType.CONTRACT_LIABILITY]: "Contract Liability",
          [LedgerEntryType.RECEIVABLE]: "Accounts Receivable",
          [LedgerEntryType.CASH]: "Cash",
          [LedgerEntryType.FINANCING_INCOME]: "Financing Income",
          [LedgerEntryType.COMMISSION_EXPENSE]: "Commission Expense",
        };
        return <span className="text-sm">{typeLabels[row.entryType] || row.entryType}</span>;
      },
    },
    {
      key: "contractNumber",
      header: "Contract",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{row.contractNumber}</div>
            <div className="text-xs text-muted-foreground">{row.customerName}</div>
          </div>
        </div>
      ),
    },
    {
      key: "accounts",
      header: "Accounts",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="text-sm">
          <div className="font-mono text-emerald-600 dark:text-emerald-400">
            Dr: {row.debitAccount}
          </div>
          <div className="font-mono text-red-600 dark:text-red-400">
            Cr: {row.creditAccount}
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: LedgerEntryWithDetails) => (
        <span className="tabular-nums font-medium">{formatCurrency(row.amount, row.currency)}</span>
      ),
      className: "text-right",
    },
    {
      key: "isPosted",
      header: "Status",
      cell: (row: LedgerEntryWithDetails) => (
        <StatusBadge status={row.isPosted ? "posted" : "unposted"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="flex items-center gap-1">
          {!row.isPosted && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                postEntryMutation.mutate(row.id);
              }}
              disabled={postEntryMutation.isPending}
              data-testid={`button-post-entry-${row.id}`}
            >
              <Send className="h-3 w-3 mr-1" />
              Post
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Revenue Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Journal entries for revenue recognition and deferrals
          </p>
        </div>
        {totalUnposted > 0 && (
          <Button
            variant="default"
            onClick={() => postAllMutation.mutate()}
            disabled={postAllMutation.isPending}
            data-testid="button-post-all"
          >
            <Send className="h-4 w-4 mr-2" />
            Post All ({totalUnposted})
          </Button>
        )}
        <Button
          variant="destructive"
          onClick={() => deleteAllLedgerEntriesMutation.mutate()}
          disabled={deleteAllLedgerEntriesMutation.isPending}
          data-testid="button-delete-all-ledger-entries"
          title="⚠️ ATENÇÃO: Apaga TODOS os lançamentos contábeis. Use apenas para limpar dados incorretos."
        >
          {deleteAllLedgerEntriesMutation.isPending ? "Apagando..." : "🗑️ Apagar Todos os Lançamentos"}
        </Button>
      </div>

      {/* Error Alert */}
      {(ledgerEntriesError || unpostedEntriesError) && (
        <Alert variant="destructive">
          <AlertTitle>❌ ERRO ao consultar lançamentos</AlertTitle>
          <AlertDescription className="space-y-2">
            <div>
              <strong>Erro principal:</strong>{" "}
              {(ledgerEntriesError as any)?.message ||
                (unpostedEntriesError as any)?.message ||
                String(ledgerEntriesError || unpostedEntriesError)}
            </div>
            <div>
              <strong>Código do erro:</strong>{" "}
              {(ledgerEntriesError as any)?.code || (unpostedEntriesError as any)?.code || "N/A"}
            </div>
            <div>
              <strong>Tenant ID:</strong> {user?.tenantId || "N/A"}
            </div>
            <div className="mt-2 text-xs">
              💡 <strong>Dica:</strong> Verifique o console do navegador (F12) para mais detalhes.
              Se o erro mencionar "index", você precisa criar um índice composto no Firestore
              Console.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posted Entries</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-posted-count">
              {totalPosted}
            </div>
            <p className="text-xs text-muted-foreground">Entries in general ledger</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-unposted-count">
              {totalUnposted}
            </div>
            <p className="text-xs text-muted-foreground">Entries awaiting posting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-amount">
              {formatCurrency(totalAmount, "BRL")}
            </div>
            <p className="text-xs text-muted-foreground">All journal entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-entries"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48" data-testid="select-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value={LedgerEntryType.REVENUE}>Revenue</SelectItem>
            <SelectItem value={LedgerEntryType.DEFERRED_REVENUE}>Deferred Revenue</SelectItem>
            <SelectItem value={LedgerEntryType.CONTRACT_ASSET}>Contract Asset</SelectItem>
            <SelectItem value={LedgerEntryType.CONTRACT_LIABILITY}>Contract Liability</SelectItem>
            <SelectItem value={LedgerEntryType.RECEIVABLE}>Accounts Receivable</SelectItem>
            <SelectItem value={LedgerEntryType.CASH}>Cash</SelectItem>
            <SelectItem value={LedgerEntryType.FINANCING_INCOME}>Financing Income</SelectItem>
            <SelectItem value={LedgerEntryType.COMMISSION_EXPENSE}>Commission Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={postedFilter} onValueChange={setPostedFilter}>
          <SelectTrigger className="w-40" data-testid="select-posted-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="unposted">Unposted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-48" data-testid="select-contract-filter">
            <SelectValue placeholder="All contracts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contracts</SelectItem>
            {contracts?.map((contract) => (
              <SelectItem key={contract.id} value={contract.id}>
                {contract.contractNumber} - {contract.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredEntries}
        isLoading={isLoading}
        emptyMessage={
          ledgerEntriesError
            ? `❌ ERRO: ${(ledgerEntriesError as any)?.message || String(ledgerEntriesError)}. Verifique o console (F12) para detalhes.`
            : isLoading
            ? "Carregando lançamentos..."
            : `Nenhum lançamento encontrado para o tenant "${user?.tenantId}". 

Para gerar lançamentos (Ledger v2):
1. Execute o Motor IFRS 15 em um contrato (gera schedules e lançamentos v2 quando aplicável)
2. Marque billings como "invoiced" (Dr AR / Cr Contract Liability ou reclass CA→AR)
3. Marque billings como "paid" (Dr Cash / Cr AR; adiantamentos podem ir para Contract Liability)
4. Para receita: over_time reconhece por período; point_in_time requer PO como "satisfied"

Nota: "Receita diferida / Contract Liability" não nasce apenas por existir contrato; depende de faturamento/adiantamento.

Verifique o console do navegador (F12) para logs detalhados.`
        }
        testIdPrefix="ledger"
      />

      {/* Unposted Entries Section */}
      {unpostedEntriesWithDetails.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Pending Entries</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Entries waiting to be posted to the general ledger
              </p>
            </div>
            <Button
              variant="default"
              onClick={() => postAllMutation.mutate()}
              disabled={postAllMutation.isPending}
              data-testid="button-post-all-section"
            >
              <Send className="h-4 w-4 mr-2" />
              Post All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unpostedEntriesWithDetails.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`pending-entry-${entry.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{entry.contractNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(entry.entryDate)} - {entry.debitAccount} / {entry.creditAccount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">
                      {formatCurrency(entry.amount, entry.currency)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => postEntryMutation.mutate(entry.id)}
                      disabled={postEntryMutation.isPending}
                      data-testid={`button-post-pending-${entry.id}`}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Post
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
