import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Search, Building2, Mail, Phone, Globe } from "lucide-react";
import type { Customer } from "@shared/schema";

interface CustomerWithContracts extends Customer {
  contractCount: number;
  totalContractValue: string;
}

export default function Customers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    country: "",
    currency: "USD",
    taxId: "",
    creditRating: "",
    contactEmail: "",
    contactPhone: "",
    billingAddress: "",
  });

  const { data: customers, isLoading } = useQuery<CustomerWithContracts[]>({
    queryKey: ["/api/customers"],
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setDialogOpen(false);
      setFormData({
        name: "",
        country: "",
        currency: "USD",
        taxId: "",
        creditRating: "",
        contactEmail: "",
        contactPhone: "",
        billingAddress: "",
      });
      toast({
        title: "Customer created",
        description: "The customer has been added successfully.",
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

  const filteredCustomers = customers?.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      key: "name",
      header: "Customer Name",
      cell: (row: CustomerWithContracts) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: "country",
      header: "Country",
      cell: (row: CustomerWithContracts) => (
        <div className="flex items-center gap-1.5">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span>{row.country}</span>
        </div>
      ),
    },
    {
      key: "currency",
      header: "Currency",
    },
    {
      key: "contactEmail",
      header: "Email",
      cell: (row: CustomerWithContracts) =>
        row.contactEmail ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="text-sm">{row.contactEmail}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "creditRating",
      header: "Credit Rating",
      cell: (row: CustomerWithContracts) => (
        <span className="text-sm">{row.creditRating || "—"}</span>
      ),
    },
    {
      key: "contractCount",
      header: "Contracts",
      cell: (row: CustomerWithContracts) => (
        <span className="tabular-nums">{row.contractCount}</span>
      ),
      className: "text-center",
    },
    {
      key: "totalContractValue",
      header: "Total Value",
      cell: (row: CustomerWithContracts) => (
        <span className="tabular-nums font-medium">
          {row.currency} {Number(row.totalContractValue || 0).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCustomerMutation.mutate(formData);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer information and billing details
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-customer">
              <Plus className="h-4 w-4 mr-2" />
              New Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
                <DialogDescription>
                  Enter customer information for contract and billing purposes.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Customer Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Company name"
                      required
                      data-testid="input-customer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                      placeholder="e.g., United States"
                      required
                      data-testid="input-country"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="BRL">BRL - Brazilian Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxId">Tax ID</Label>
                    <Input
                      id="taxId"
                      value={formData.taxId}
                      onChange={(e) =>
                        setFormData({ ...formData, taxId: e.target.value })
                      }
                      placeholder="Tax identification number"
                      data-testid="input-tax-id"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, contactEmail: e.target.value })
                      }
                      placeholder="contact@company.com"
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, contactPhone: e.target.value })
                      }
                      placeholder="+1 (555) 000-0000"
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="creditRating">Credit Rating</Label>
                    <Select
                      value={formData.creditRating}
                      onValueChange={(value) =>
                        setFormData({ ...formData, creditRating: value })
                      }
                    >
                      <SelectTrigger id="creditRating" data-testid="select-credit-rating">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AAA">AAA - Excellent</SelectItem>
                        <SelectItem value="AA">AA - Very Good</SelectItem>
                        <SelectItem value="A">A - Good</SelectItem>
                        <SelectItem value="BBB">BBB - Adequate</SelectItem>
                        <SelectItem value="BB">BB - Below Average</SelectItem>
                        <SelectItem value="B">B - Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <Input
                    id="billingAddress"
                    value={formData.billingAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, billingAddress: e.target.value })
                    }
                    placeholder="Full billing address"
                    data-testid="input-billing-address"
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
                  disabled={createCustomerMutation.isPending}
                  data-testid="button-submit-customer"
                >
                  {createCustomerMutation.isPending ? "Adding..." : "Add Customer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-customers"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredCustomers ?? []}
        isLoading={isLoading}
        emptyMessage="No customers found. Add your first customer to get started."
        testIdPrefix="customer"
      />
    </div>
  );
}
