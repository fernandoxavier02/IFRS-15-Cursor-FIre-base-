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
import { billingScheduleService, contractService, customerService } from "@/lib/firestore-service";
import { queryClient } from "@/lib/queryClient";
import type { BillingScheduleWithDetails, ContractWithDetails } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BillingSchedule, Contract, Customer } from "@shared/firestore-types";
import { toDate, toISOString } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth, subMonths } from "date-fns";
import {
    AlertTriangle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    DollarSign,
    FileText,
    Plus,
    Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const billingFormSchema = z.object({
  contractId: z.string().min(1, "Contract is required"),
  billingDate: z.string().min(1, "Billing date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("BRL"),
  frequency: z.string().default("monthly"),
  notes: z.string().optional(),
});

type BillingFormValues = z.infer<typeof billingFormSchema>;

export default function BillingSchedules() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedView, setSelectedView] = useState<"calendar" | "list">("list");
  
  // Validação de tenantId
  if (!user?.tenantId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Calendar className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">Perfil incompleto</p>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui um tenant associado. Por favor, reautentique ou contate o administrador.
          </p>
        </div>
      </div>
    );
  }

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      contractId: "",
      billingDate: "",
      dueDate: "",
      amount: 0,
      currency: "BRL",
      frequency: "monthly",
      notes: "",
    },
  });

  // Fetch billing schedules from Firestore
  const { data: billingSchedules, isLoading, refetch: refetchBillings } = useQuery<BillingSchedule[]>({
    queryKey: ["billing-schedules", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return billingScheduleService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Fetch upcoming billings
  const { data: upcomingBillings } = useQuery<BillingSchedule[]>({
    queryKey: ["billing-schedules-upcoming", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return billingScheduleService.getUpcoming(user.tenantId, 30);
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

  // Calculate overdue billings
  const overdueBillings = useMemo(() => {
    const now = new Date();
    return billingSchedules?.filter((billing) => {
      const dueDate = toDate(billing.dueDate);
      if (!dueDate || isNaN(dueDate.getTime())) return false;
      return billing.status === "scheduled" && dueDate < now;
    }) || [];
  }, [billingSchedules]);

  // Transform billing schedules with details
  const billingsWithDetails: BillingScheduleWithDetails[] = useMemo(() => {
    // Helper para converter timestamp de forma segura
    const safeToISOString = (ts: any): string => {
      if (!ts) return new Date().toISOString(); // Se null/undefined, usa data atual
      try {
        const iso = toISOString(ts);
        // Se toISOString retornar string vazia, usa data atual
        if (!iso || iso.trim() === "") {
          return new Date().toISOString();
        }
        // Valida se a string é uma data válida
        const testDate = new Date(iso);
        if (isNaN(testDate.getTime())) {
          return new Date().toISOString();
        }
        return iso;
      } catch (error) {
        return new Date().toISOString();
      }
    };
    
    return (billingSchedules || []).map((billing) => {
      const contract = contractMap.get(billing.contractId);
      const customerName = contract ? customerMap.get(contract.customerId) || "Unknown" : "Unknown";
      
      return {
        id: billing.id,
        tenantId: billing.tenantId || "",
        contractId: billing.contractId || "",
        performanceObligationId: billing.performanceObligationId || null,
        billingDate: safeToISOString(billing.billingDate),
        dueDate: safeToISOString(billing.dueDate),
        amount: billing.amount?.toString() || "0",
        currency: billing.currency || "BRL",
        frequency: billing.frequency as any || "one_time",
        status: billing.status as any || "scheduled",
        invoiceNumber: billing.invoiceNumber || null,
        invoicedAt: billing.invoicedAt ? safeToISOString(billing.invoicedAt) : null,
        paidAt: billing.paidAt ? safeToISOString(billing.paidAt) : null,
        paidAmount: billing.paidAmount?.toString() || null,
        notes: billing.notes || null,
        createdAt: safeToISOString(billing.createdAt),
        contractNumber: contract?.contractNumber || "Unknown",
        contractTitle: contract?.title || "Unknown",
        customerName: customerName || "Unknown",
      };
    });
  }, [billingSchedules, contractMap, customerMap]);

  // Contracts with details for dropdown
  const contractsWithDetails: ContractWithDetails[] = useMemo(() => {
    return (contracts || []).map((contract) => {
      // Helper seguro para converter datas
      const safeToISOString = (ts: any): string | null => {
        if (!ts) return null;
        const iso = toISOString(ts);
        return iso || null;
      };
      
      return {
        id: contract.id,
        contractNumber: contract.contractNumber || "Unknown",
        title: contract.title || "Untitled",
        status: contract.status || "draft",
        customerName: customerMap.get(contract.customerId) || "Unknown",
        totalValue: contract.totalValue?.toString() || "0",
        currency: contract.currency || "BRL",
        startDate: safeToISOString(contract.startDate) || new Date().toISOString(),
        endDate: safeToISOString(contract.endDate),
        recognizedRevenue: "0",
        deferredRevenue: contract.totalValue?.toString() || "0",
      };
    });
  }, [contracts, customerMap]);

  // Create billing via Firestore service
  const createBillingMutation = useMutation({
    mutationFn: async (data: BillingFormValues) => {
      if (!user?.tenantId) throw new Error("Perfil incompleto - tenantId ausente. Por favor, reautentique ou contate o administrador.");
      if (!data.contractId) throw new Error("Selecione um contrato para criar o faturamento");
      if (!data.billingDate || !data.dueDate) throw new Error("Preencha as datas de faturamento e vencimento");
      if (!data.amount || data.amount <= 0) throw new Error("O valor do faturamento deve ser maior que zero");
      
      return billingScheduleService.create(user.tenantId, {
        contractId: data.contractId,
        billingDate: data.billingDate,
        amount: data.amount.toString(),
        currency: data.currency,
        dueDate: data.dueDate,
        status: "scheduled",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-schedules", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["billing-schedules-upcoming", user?.tenantId] });
      refetchBillings();
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Billing scheduled",
        description: "The billing schedule has been created successfully.",
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, invoiceNumber }: { id: string; status: string; invoiceNumber?: string }) => {
      if (!user?.tenantId) throw new Error("No tenant ID");
      const updateData: Record<string, unknown> = { status };
      if (status === "invoiced") {
        updateData.invoicedAt = new Date().toISOString();
        if (invoiceNumber) updateData.invoiceNumber = invoiceNumber;
      } else if (status === "paid") {
        updateData.paidAt = new Date().toISOString();
      }
      return billingScheduleService.update(user.tenantId, id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-schedules", user?.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["billing-schedules-upcoming", user?.tenantId] });
      refetchBillings();
      toast({
        title: "Status updated",
        description: "The billing status has been updated.",
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

  const filteredBillings = billingsWithDetails.filter((billing) => {
    const searchLower = (searchQuery || "").toLowerCase();
    const matchesSearch = searchLower === "" || 
      (billing.contractNumber || "").toLowerCase().includes(searchLower) ||
      (billing.customerName || "").toLowerCase().includes(searchLower) ||
      (billing.invoiceNumber || "").toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || billing.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBillingsForDate = (date: Date) => {
    return billingsWithDetails.filter((billing) => {
      if (!billing.billingDate || billing.billingDate.trim() === "") return false;
      try {
        const billingDate = new Date(billing.billingDate);
        // Verificar se a data é válida antes de comparar
        if (isNaN(billingDate.getTime())) return false;
        return isSameDay(billingDate, date);
      } catch (error) {
        return false;
      }
    });
  };

  const columns = [
    {
      key: "billingDate",
      header: "Billing Date",
      cell: (row: BillingScheduleWithDetails) => {
        if (!row.billingDate || row.billingDate.trim() === "") {
          return (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">N/A</span>
            </div>
          );
        }
        try {
          const date = new Date(row.billingDate);
          const isValidDate = !isNaN(date.getTime());
          return (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {isValidDate ? format(date, "MMM dd, yyyy") : "Invalid date"}
              </span>
            </div>
          );
        } catch (error) {
          return (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">Invalid date</span>
            </div>
          );
        }
      },
    },
    {
      key: "contractNumber",
      header: "Contract",
      cell: (row: BillingScheduleWithDetails) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{row.contractNumber}</span>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: BillingScheduleWithDetails) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.amount).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (row: BillingScheduleWithDetails) => {
        if (!row.dueDate || row.dueDate.trim() === "") {
          return (
            <span className="text-sm text-muted-foreground">N/A</span>
          );
        }
        try {
          const date = new Date(row.dueDate);
          const isValidDate = !isNaN(date.getTime());
          return (
            <span className="text-sm text-muted-foreground">
              {isValidDate ? format(date, "MMM dd, yyyy") : "Invalid date"}
            </span>
          );
        } catch (error) {
          return (
            <span className="text-sm text-muted-foreground">Invalid date</span>
          );
        }
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row: BillingScheduleWithDetails) => <StatusBadge status={row.status} />,
    },
    {
      key: "invoiceNumber",
      header: "Invoice #",
      cell: (row: BillingScheduleWithDetails) => (
        <span className="text-sm text-muted-foreground">
          {row.invoiceNumber || "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row: BillingScheduleWithDetails) => (
        <div className="flex items-center gap-1">
          {row.status === "scheduled" && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({ id: row.id, status: "invoiced" });
              }}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-mark-invoiced-${row.id}`}
            >
              Mark Invoiced
            </Button>
          )}
          {row.status === "invoiced" && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({ id: row.id, status: "paid" });
              }}
              disabled={updateStatusMutation.isPending}
              data-testid={`button-mark-paid-${row.id}`}
            >
              Mark Paid
            </Button>
          )}
        </div>
      ),
    },
  ];

  const onSubmit = (data: BillingFormValues) => {
    createBillingMutation.mutate(data);
  };

  const totalUpcoming = upcomingBillings?.reduce((sum, b) => sum + Number(b.amount || 0), 0) || 0;
  const totalOverdue = overdueBillings.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Billing Schedules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage invoice schedules and track payment status
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              data-testid="button-new-billing"
              disabled={!user?.tenantId || !contracts?.length}
              title={
                !user?.tenantId 
                  ? "Perfil incompleto - tenantId ausente" 
                  : !contracts?.length 
                  ? "Cadastre um contrato antes de criar faturas"
                  : ""
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              New Billing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Create Billing Schedule</DialogTitle>
                  <DialogDescription>
                    Schedule a new invoice for a contract.
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
                              {contractsWithDetails.length > 0 ? (
                                contractsWithDetails.map((contract) => (
                                  <SelectItem key={contract.id} value={contract.id}>
                                    {contract.contractNumber} - {contract.customerName}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">
                                  Nenhum contrato disponível
                                </div>
                              )}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="billingDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-billing-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-due-date" />
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
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              data-testid="input-amount"
                            />
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
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="one_time">One Time</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="semi_annually">Semi-Annually</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Optional billing notes"
                            className="resize-none"
                            {...field}
                            data-testid="input-notes"
                          />
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
                    data-testid="button-cancel-billing"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createBillingMutation.isPending}
                    data-testid="button-submit-billing"
                  >
                    {createBillingMutation.isPending ? "Creating..." : "Create Billing"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming (30 days)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-upcoming-count">
              {upcomingBillings?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              BRL {totalUpcoming.toLocaleString()} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-count">
              {overdueBillings.length}
            </div>
            <p className="text-xs text-muted-foreground">
              BRL {totalOverdue.toLocaleString()} outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scheduled</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-count">
              {billingSchedules?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              All billing schedules
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={selectedView === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedView("list")}
            data-testid="button-view-list"
          >
            List View
          </Button>
          <Button
            variant={selectedView === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedView("calendar")}
            data-testid="button-view-calendar"
          >
            Calendar View
          </Button>
        </div>
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search billings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-billings"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedView === "calendar" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2" />
              ))}
              {daysInMonth.map((day) => {
                const dayBillings = getBillingsForDate(day);
                const isToday = isSameDay(day, new Date());
                const dayKey = day instanceof Date && !isNaN(day.getTime()) 
                  ? day.toISOString() 
                  : `day-${day.getTime()}`;
                return (
                  <div
                    key={dayKey}
                    className={`min-h-24 p-2 border rounded-md ${
                      isToday ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <div className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1 mt-1">
                      {dayBillings.slice(0, 2).map((billing) => (
                        <div
                          key={billing.id}
                          className={`text-xs p-1 rounded truncate ${
                            billing.status === "paid"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : billing.status === "overdue"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          }`}
                          title={`${billing.contractNumber}: ${billing.currency} ${Number(billing.amount).toLocaleString()}`}
                        >
                          {billing.currency} {Number(billing.amount).toLocaleString()}
                        </div>
                      ))}
                      {dayBillings.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayBillings.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={filteredBillings}
          isLoading={isLoading}
          emptyMessage="No billing schedules found. Create your first billing schedule to get started."
          testIdPrefix="billing"
        />
      )}

      {overdueBillings.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Overdue Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueBillings.map((billing) => {
                const contract = contractMap.get(billing.contractId);
                const customerName = contract ? customerMap.get(contract.customerId) || "Unknown" : "Unknown";
                const dueDateObj = toDate(billing.dueDate);
                const dueDate = dueDateObj || new Date();
                const isValidDueDate = dueDateObj && !isNaN(dueDate.getTime());
                const contractNumber = contract?.contractNumber || billing.contractNumber || "Unknown";
                const currency = billing.currency || "BRL";
                const amount = Number(billing.amount || 0);
                
                return (
                  <div
                    key={billing.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-md bg-destructive/5"
                    data-testid={`overdue-billing-${billing.id}`}
                  >
                    <div>
                      <p className="font-medium">{contractNumber}</p>
                      <p className="text-sm text-muted-foreground">{customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {currency} {amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-destructive">
                        Due: {isValidDueDate ? format(dueDate, "MMM dd, yyyy") : "Invalid date"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: billing.id, status: "paid" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-mark-paid-overdue-${billing.id}`}
                    >
                      Mark Paid
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
