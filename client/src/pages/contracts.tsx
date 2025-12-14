import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { contractService, customerService } from "@/lib/firestore-service";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import type { ContractWithDetails } from "@/lib/types";
import type { Contract, Customer } from "@shared/firestore-types";
import { ContractStatus, toISOString } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Timestamp } from "firebase/firestore";
import { Calendar, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export default function Contracts() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    contractNumber: "",
    title: "",
    startDate: "",
    endDate: "",
    totalValue: "",
    currency: "USD",
    paymentTerms: "",
  });

  // Fetch contracts directly from Firestore
  const { data: contracts, isLoading: contractsLoading, refetch: refetchContracts } = useQuery<Contract[]>({
    queryKey: ["contracts", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return contractService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Fetch customers directly from Firestore for the form dropdown
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return customerService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Create a lookup map for customer names
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers?.forEach((customer) => {
      map.set(customer.id, customer.name);
    });
    return map;
  }, [customers]);

  // Transform contracts to ContractWithDetails format
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
      recognizedRevenue: "0", // Will be calculated separately
      deferredRevenue: contract.totalValue?.toString() || "0",
    }));
  }, [contracts, customerMap]);

  // Create contract via Firestore service
  const createContractMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.tenantId) throw new Error("User tenant ID is required");
      if (!data.customerId) throw new Error("Customer is required");
      if (!data.startDate) throw new Error("Start date is required");
      
      return contractService.create(user.tenantId, {
        customerId: data.customerId,
        contractNumber: data.contractNumber,
        title: data.title,
        status: ContractStatus.DRAFT,
        startDate: Timestamp.fromDate(new Date(data.startDate)),
        endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : undefined,
        totalValue: parseFloat(data.totalValue) || 0,
        currency: data.currency,
        paymentTerms: data.paymentTerms || undefined,
      });
    },
    onSuccess: () => {
      // Invalidate query to refetch from Firestore
      queryClient.invalidateQueries({ queryKey: ["contracts", user?.tenantId] });
      refetchContracts();
      setDialogOpen(false);
      setFormData({
        customerId: "",
        contractNumber: "",
        title: "",
        startDate: "",
        endDate: "",
        totalValue: "",
        currency: "USD",
        paymentTerms: "",
      });
      toast({
        title: "Contract created",
        description: "The contract has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contract",
        variant: "destructive",
      });
    },
  });

  const filteredContracts = contractsWithDetails.filter((contract) => {
    const matchesSearch =
      contract.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: "contractNumber",
      header: "Contract #",
      cell: (row: ContractWithDetails) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.contractNumber}</span>
        </div>
      ),
    },
    {
      key: "title",
      header: "Title",
      cell: (row: ContractWithDetails) => (
        <span className="max-w-xs truncate">{row.title}</span>
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
      header: "Total Value",
      cell: (row: ContractWithDetails) => (
        <span className="tabular-nums font-medium">
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
    {
      key: "deferredRevenue",
      header: "Deferred",
      cell: (row: ContractWithDetails) => (
        <span className="tabular-nums text-muted-foreground">
          {Number(row.deferredRevenue).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "startDate",
      header: "Start Date",
      cell: (row: ContractWithDetails) => (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span className="text-sm">
            {row.startDate ? new Date(row.startDate).toLocaleDateString() : "-"}
          </span>
        </div>
      ),
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createContractMutation.mutate(formData);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer contracts and amendments
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-contract">
              <Plus className="h-4 w-4 mr-2" />
              New Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create New Contract</DialogTitle>
                <DialogDescription>
                  Enter the contract details. You can add line items and configure
                  IFRS 15 settings after creation.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerId">Customer</Label>
                    <Select
                      value={formData.customerId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, customerId: value })
                      }
                    >
                      <SelectTrigger id="customerId" data-testid="select-customer">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractNumber">Contract Number</Label>
                    <Input
                      id="contractNumber"
                      value={formData.contractNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, contractNumber: e.target.value })
                      }
                      placeholder="e.g., CTR-2024-001"
                      data-testid="input-contract-number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Contract Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Enter contract title"
                    data-testid="input-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalValue">Total Value</Label>
                    <Input
                      id="totalValue"
                      type="number"
                      step="0.01"
                      value={formData.totalValue}
                      onChange={(e) =>
                        setFormData({ ...formData, totalValue: e.target.value })
                      }
                      placeholder="0.00"
                      data-testid="input-total-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) =>
                        setFormData({ ...formData, currency: value })
                      }
                    >
                      <SelectTrigger id="currency" data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="BRL">BRL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Textarea
                    id="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentTerms: e.target.value })
                    }
                    placeholder="e.g., Net 30, 50% upfront"
                    className="resize-none"
                    data-testid="input-payment-terms"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createContractMutation.isPending}
                  data-testid="button-submit-contract"
                >
                  {createContractMutation.isPending ? "Creating..." : "Create Contract"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-contracts"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="modified">Modified</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredContracts}
        isLoading={contractsLoading}
        emptyMessage="No contracts found. Create your first contract to get started."
        onRowClick={(row) => setLocation(`/contracts/${row.id}`)}
        testIdPrefix="contract"
      />
    </div>
  );
}
