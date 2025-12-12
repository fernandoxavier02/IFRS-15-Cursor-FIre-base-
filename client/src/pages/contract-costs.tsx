import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Search, 
  DollarSign, 
  TrendingDown,
  FileText,
  Calendar,
  Percent,
  AlertCircle
} from "lucide-react";
import type { ContractCostWithDetails, ContractWithDetails } from "@/lib/types";
import { format, differenceInMonths } from "date-fns";

const costFormSchema = z.object({
  contractId: z.string().min(1, "Contract is required"),
  costType: z.enum(["incremental", "fulfillment"]),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("BRL"),
  incurredDate: z.string().min(1, "Incurred date is required"),
  amortizationStartDate: z.string().min(1, "Start date is required"),
  amortizationEndDate: z.string().min(1, "End date is required"),
  amortizationMethod: z.string().default("straight_line"),
}).refine((data) => {
  if (data.amortizationStartDate && data.amortizationEndDate) {
    return new Date(data.amortizationEndDate) > new Date(data.amortizationStartDate);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["amortizationEndDate"],
});

type CostFormValues = z.infer<typeof costFormSchema>;

export default function ContractCosts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<CostFormValues>({
    resolver: zodResolver(costFormSchema),
    defaultValues: {
      contractId: "",
      costType: "incremental",
      description: "",
      amount: 0,
      currency: "BRL",
      incurredDate: "",
      amortizationStartDate: "",
      amortizationEndDate: "",
      amortizationMethod: "straight_line",
    },
  });

  const { data: contractCosts, isLoading } = useQuery<ContractCostWithDetails[]>({
    queryKey: ["/api/contract-costs"],
  });

  const { data: contracts } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/contracts"],
  });

  const createCostMutation = useMutation({
    mutationFn: async (data: CostFormValues) => {
      return apiRequest("POST", "/api/contract-costs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-costs"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Cost recorded",
        description: "The contract cost has been recorded successfully.",
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

  const handleContractSelect = (contractId: string) => {
    form.setValue("contractId", contractId);
    const selectedContract = contracts?.find(c => c.id === contractId);
    if (selectedContract) {
      if (selectedContract.startDate) {
        const startDateStr = format(new Date(selectedContract.startDate), "yyyy-MM-dd");
        form.setValue("incurredDate", startDateStr);
        form.setValue("amortizationStartDate", startDateStr);
      } else {
        form.setValue("incurredDate", "");
        form.setValue("amortizationStartDate", "");
      }
      if (selectedContract.endDate) {
        const endDateStr = format(new Date(selectedContract.endDate), "yyyy-MM-dd");
        form.setValue("amortizationEndDate", endDateStr);
      } else {
        form.setValue("amortizationEndDate", "");
      }
      if (selectedContract.currency) {
        form.setValue("currency", selectedContract.currency);
      } else {
        form.setValue("currency", "BRL");
      }
    }
  };

  const filteredCosts = contractCosts?.filter((cost) => {
    const matchesSearch =
      cost.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cost.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cost.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || cost.costType === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalCosts = contractCosts?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
  const totalAmortized = contractCosts?.reduce((sum, c) => sum + Number(c.totalAmortized || 0), 0) || 0;
  const totalRemaining = contractCosts?.reduce((sum, c) => sum + Number(c.remainingBalance || 0), 0) || 0;
  const incrementalCosts = contractCosts?.filter(c => c.costType === "incremental").reduce((sum, c) => sum + Number(c.amount), 0) || 0;
  const fulfillmentCosts = contractCosts?.filter(c => c.costType === "fulfillment").reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const columns = [
    {
      key: "incurredDate",
      header: "Incurred Date",
      cell: (row: ContractCostWithDetails) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{format(new Date(row.incurredDate), "MMM dd, yyyy")}</span>
        </div>
      ),
    },
    {
      key: "contractNumber",
      header: "Contract",
      cell: (row: ContractCostWithDetails) => (
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
      key: "costType",
      header: "Type",
      cell: (row: ContractCostWithDetails) => (
        <StatusBadge status={row.costType} />
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (row: ContractCostWithDetails) => (
        <span className="text-sm text-muted-foreground truncate max-w-48 block">
          {row.description}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row: ContractCostWithDetails) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.amount).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "amortization",
      header: "Amortization",
      cell: (row: ContractCostWithDetails) => {
        const amortized = Number(row.totalAmortized || 0);
        const total = Number(row.amount);
        const percentage = total > 0 ? (amortized / total) * 100 : 0;
        return (
          <div className="flex flex-col gap-1 min-w-32">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
              <span className="tabular-nums">{row.currency} {amortized.toLocaleString()}</span>
            </div>
            <Progress value={percentage} className="h-1.5" />
          </div>
        );
      },
    },
    {
      key: "remainingBalance",
      header: "Remaining",
      cell: (row: ContractCostWithDetails) => (
        <span className="tabular-nums text-sm">
          {row.currency} {Number(row.remainingBalance || 0).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "period",
      header: "Amortization Period",
      cell: (row: ContractCostWithDetails) => {
        const start = new Date(row.amortizationStartDate);
        const end = new Date(row.amortizationEndDate);
        const months = differenceInMonths(end, start);
        return (
          <span className="text-xs text-muted-foreground">
            {format(start, "MMM yyyy")} - {format(end, "MMM yyyy")} ({months} mo)
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row: ContractCostWithDetails) => (
        <StatusBadge status={row.isFullyAmortized ? "fully_amortized" : "active"} />
      ),
    },
  ];

  const onSubmit = (data: CostFormValues) => {
    createCostMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Contract Costs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track acquisition costs and amortization per IFRS 15
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-cost">
              <Plus className="h-4 w-4 mr-2" />
              New Cost
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Record Contract Cost</DialogTitle>
                  <DialogDescription>
                    Record a new acquisition or fulfillment cost for a contract.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <FormField
                    control={form.control}
                    name="contractId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract</FormLabel>
                        <Select onValueChange={handleContractSelect} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contract">
                              <SelectValue placeholder="Select contract" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contracts?.map((contract) => (
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
                    name="costType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-cost-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="incremental">Incremental (Sales Commissions)</SelectItem>
                            <SelectItem value="fulfillment">Fulfillment (Setup/Implementation)</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Textarea
                            placeholder="e.g., Sales commission for deal closing"
                            className="resize-none"
                            {...field}
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                    name="incurredDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Incurred Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-incurred-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amortizationStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amortization Start</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-amort-start" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amortizationEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amortization End</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-amort-end" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="amortizationMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amortization Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-amort-method">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="straight_line">Straight Line</SelectItem>
                            <SelectItem value="revenue_pattern">Revenue Pattern</SelectItem>
                          </SelectContent>
                        </Select>
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
                    data-testid="button-cancel-cost"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCostMutation.isPending}
                    data-testid="button-submit-cost"
                  >
                    {createCostMutation.isPending ? "Recording..." : "Record Cost"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-costs">
              BRL {totalCosts.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {contractCosts?.length || 0} cost records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amortized</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-amortized">
              BRL {totalAmortized.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalCosts > 0 ? ((totalAmortized / totalCosts) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Balance</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-remaining-balance">
              BRL {totalRemaining.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              To be amortized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">By Type</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Incremental:</span>
                <span className="font-medium tabular-nums">BRL {incrementalCosts.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fulfillment:</span>
                <span className="font-medium tabular-nums">BRL {fulfillmentCosts.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search costs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-costs"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="incremental">Incremental</SelectItem>
            <SelectItem value="fulfillment">Fulfillment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            data={filteredCosts || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No contract costs recorded yet"
            testIdPrefix="cost-row"
          />
        </CardContent>
      </Card>
    </div>
  );
}
