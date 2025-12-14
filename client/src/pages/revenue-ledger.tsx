import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { contractService, customerService, revenueLedgerService } from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import type { ContractWithDetails, LedgerEntryWithDetails } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Contract, Customer, RevenueLedgerEntry } from "@shared/firestore-types";
import { toISOString } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowRightLeft,
    BookOpen,
    CheckCircle,
    Clock,
    FileText,
    Plus,
    Search,
    Send
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const ledgerFormSchema = z.object({
  contractId: z.string().min(1, "Contract is required"),
  entryDate: z.string().min(1, "Entry date is required"),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  entryType: z.string().default("revenue_recognition"),
  debitAccount: z.string().min(1, "Debit account is required"),
  creditAccount: z.string().min(1, "Credit account is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("BRL"),
  description: z.string().optional(),
  referenceNumber: z.string().optional(),
});

type LedgerFormValues = z.infer<typeof ledgerFormSchema>;

export default function RevenueLedger() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [postedFilter, setPostedFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<LedgerFormValues>({
    resolver: zodResolver(ledgerFormSchema),
    defaultValues: {
      contractId: "",
      entryDate: "",
      periodStart: "",
      periodEnd: "",
      entryType: "revenue_recognition",
      debitAccount: "",
      creditAccount: "",
      amount: 0,
      currency: "BRL",
      description: "",
      referenceNumber: "",
    },
  });

  // Fetch ledger entries from Firestore
  const { data: ledgerEntries, isLoading, refetch: refetchLedger } = useQuery<RevenueLedgerEntry[]>({
    queryKey: ["ledger-entries", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return revenueLedgerService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Fetch unposted entries
  const { data: unpostedEntries } = useQuery<RevenueLedgerEntry[]>({
    queryKey: ["ledger-entries-unposted", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return revenueLedgerService.getUnposted(user.tenantId);
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

  // Contracts with details for dropdown
  const contractsWithDetails: ContractWithDetails[] = useMemo(() => {
    return (contracts || []).map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      title: contract.title,
      status: contract.status,
      customerName: customerMap.get(contract.customerId) || "Unknown",
      totalValue: contract.totalValue?.toString() || "0",
      currency: contract.currency,
      startDate: toISOString(contract.startDate),
      endDate: toISOString(contract.endDate) || null,
      recognizedRevenue: "0",
      deferredRevenue: contract.totalValue?.toString() || "0",
    }));
  }, [contracts, customerMap]);

  // Create entry via Firestore service
  const createEntryMutation = useMutation({
    mutationFn: async (data: LedgerFormValues) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      return revenueLedgerService.create(user.tenantId, {
        contractId: data.contractId,
        entryType: data.entryType,
        entryDate: data.entryDate,
        debitAccount: data.debitAccount,
        creditAccount: data.creditAccount,
        amount: data.amount.toString(),
        currency: data.currency,
        description: data.description,
        referenceNumber: data.referenceNumber,
        isPosted: false,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-entries", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["ledger-entries-unposted", user?.tenantId] });
      refetchLedger();
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Entry created",
        description: "The journal entry has been created successfully.",
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

  const postEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      return revenueLedgerService.update(user.tenantId, id, { isPosted: true, postedAt: new Date().toISOString() });
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
        unposted.map(entry => 
          revenueLedgerService.update(user.tenantId, entry.id, { 
            isPosted: true, 
            postedAt: new Date().toISOString() 
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

  const filteredEntries = entriesWithDetails.filter((entry) => {
    const matchesSearch =
      entry.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.debitAccount?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.creditAccount?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || entry.entryType === typeFilter;
    const matchesPosted = 
      postedFilter === "all" || 
      (postedFilter === "posted" && entry.isPosted) ||
      (postedFilter === "unposted" && !entry.isPosted);
    return matchesSearch && matchesType && matchesPosted;
  });

  const totalPosted = entriesWithDetails.filter(e => e.isPosted).length;
  const totalUnposted = unpostedEntriesWithDetails.length;
  const totalAmount = entriesWithDetails.reduce((sum, e) => sum + Number(e.amount), 0);

  const columns = [
    {
      key: "entryDate",
      header: "Entry Date",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{format(new Date(row.entryDate), "MMM dd, yyyy")}</span>
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
      key: "contractNumber",
      header: "Contract",
      cell: (row: LedgerEntryWithDetails) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{row.contractNumber}</span>
        </div>
      ),
    },
    {
      key: "entryType",
      header: "Type",
      cell: (row: LedgerEntryWithDetails) => {
        const typeLabels: Record<string, string> = {
          revenue_recognition: "Revenue Recognition",
          deferral: "Deferral",
          adjustment: "Adjustment",
          reversal: "Reversal",
        };
        return (
          <span className="text-sm">{typeLabels[row.entryType] || row.entryType}</span>
        );
      },
    },
    {
      key: "debitAccount",
      header: "Debit Account",
      cell: (row: LedgerEntryWithDetails) => (
        <span className="text-sm font-mono">{row.debitAccount}</span>
      ),
    },
    {
      key: "creditAccount",
      header: "Credit Account",
      cell: (row: LedgerEntryWithDetails) => (
        <span className="text-sm font-mono">{row.creditAccount}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: LedgerEntryWithDetails) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.amount).toLocaleString()}
        </span>
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

  const onSubmit = (data: LedgerFormValues) => {
    createEntryMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Revenue Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Journal entries for revenue recognition and deferrals
          </p>
        </div>

        <div className="flex items-center gap-2">
          {totalUnposted > 0 && (
            <Button
              variant="outline"
              onClick={() => postAllMutation.mutate()}
              disabled={postAllMutation.isPending}
              data-testid="button-post-all"
            >
              <Send className="h-4 w-4 mr-2" />
              Post All ({totalUnposted})
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-entry">
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Create Journal Entry</DialogTitle>
                    <DialogDescription>
                      Create a new revenue ledger entry.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <FormField
                      control={form.control}
                      name="contractId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-contract">
                                <SelectValue placeholder="Select contract" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {contractsWithDetails.map((contract) => (
                                <SelectItem key={contract.id} value={contract.id}>
                                  {contract.contractNumber} - {contract.customerName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="entryType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entry Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-entry-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="revenue_recognition">Revenue Recognition</SelectItem>
                              <SelectItem value="deferral">Deferral</SelectItem>
                              <SelectItem value="adjustment">Adjustment</SelectItem>
                              <SelectItem value="reversal">Reversal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="entryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entry Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-entry-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="periodStart"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Period Start</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-period-start" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="periodEnd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Period End</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-period-end" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="debitAccount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Debit Account</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 1200 - Accounts Receivable" {...field} data-testid="input-debit-account" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="creditAccount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credit Account</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 4000 - Revenue" {...field} data-testid="input-credit-account" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-currency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="BRL">BRL</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="referenceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional reference" {...field} data-testid="input-reference" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Entry description" className="resize-none" {...field} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      data-testid="button-cancel-entry"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createEntryMutation.isPending}
                      data-testid="button-submit-entry"
                    >
                      {createEntryMutation.isPending ? "Creating..." : "Create Entry"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
            <p className="text-xs text-muted-foreground">
              Entries in general ledger
            </p>
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
            <p className="text-xs text-muted-foreground">
              Entries awaiting posting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-amount">
              BRL {totalAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              All journal entries
            </p>
          </CardContent>
        </Card>
      </div>

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
            <SelectItem value="revenue_recognition">Revenue Recognition</SelectItem>
            <SelectItem value="deferral">Deferral</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
            <SelectItem value="reversal">Reversal</SelectItem>
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
      </div>

      <DataTable
        columns={columns}
        data={filteredEntries}
        isLoading={isLoading}
        emptyMessage="No journal entries found. Create your first entry to get started."
        testIdPrefix="ledger"
      />

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
                        {format(new Date(entry.entryDate), "MMM dd, yyyy")} - {entry.debitAccount} / {entry.creditAccount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">
                      {entry.currency} {Number(entry.amount).toLocaleString()}
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
