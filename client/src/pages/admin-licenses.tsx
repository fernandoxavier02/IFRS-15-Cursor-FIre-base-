import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import {
  Plus,
  MoreHorizontal,
  KeyRound,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Shield,
  Users,
  Monitor,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

interface AdminLicense {
  id: string;
  licenseKey: string;
  status: string;
  seatCount: number;
  currentIp: string | null;
  currentUserName: string | null;
  tenantName: string | null;
  email: string | null;
  lockedAt: string | null;
  lastSeenAt: string | null;
  graceUntil: string | null;
  createdAt: string;
}

interface CreatedCredentials {
  email: string;
  password: string;
  licenseKey: string;
  emailSent: boolean;
}

export default function AdminLicenses() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newLicense, setNewLicense] = useState({
    email: "",
    seatCount: "1",
    planType: "professional",
  });
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: licenses, isLoading } = useQuery<AdminLicense[]>({
    queryKey: ["/api/admin/licenses"],
  });

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard. Please select and copy the text manually.",
        variant: "destructive",
      });
    }
  };

  const createLicenseMutation = useMutation({
    mutationFn: async (data: { email: string; seatCount: number; planType: string }) => {
      const response = await apiRequest("POST", "/api/admin/licenses", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/licenses"] });
      setIsCreateOpen(false);
      setNewLicense({ email: "", seatCount: "1", planType: "professional" });
      
      if (data.credentials) {
        setCreatedCredentials({
          email: data.credentials.email,
          password: data.credentials.password,
          licenseKey: data.credentials.licenseKey,
          emailSent: data.emailSent,
        });
      }
      
      toast({
        title: "License created",
        description: data.emailSent 
          ? "The license has been created and credentials sent via email."
          : "License created but email could not be sent. Please share the credentials manually.",
        variant: data.emailSent ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      return apiRequest("POST", `/api/admin/licenses/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/licenses"] });
      toast({
        title: "Action completed",
        description: "The license has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const stats = {
    total: licenses?.length || 0,
    active: licenses?.filter((l) => l.status === "active").length || 0,
    suspended: licenses?.filter((l) => l.status === "suspended").length || 0,
    inUse: licenses?.filter((l) => l.currentIp !== null).length || 0,
  };

  const columns = [
    {
      key: "licenseKey",
      header: "License Key",
      cell: (row: AdminLicense) => (
        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{row.licenseKey}</code>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (row: AdminLicense) => row.email || "-",
    },
    {
      key: "status",
      header: "Status",
      cell: (row: AdminLicense) => <StatusBadge status={row.status as "active" | "suspended" | "revoked" | "expired" | "draft" | "modified" | "terminated"} />,
    },
    {
      key: "seatCount",
      header: "Seats",
      cell: (row: AdminLicense) => row.seatCount,
    },
    {
      key: "currentIp",
      header: "Current IP",
      cell: (row: AdminLicense) =>
        row.currentIp ? (
          <Badge variant="outline" className="font-mono text-xs">
            {row.currentIp}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "lastSeenAt",
      header: "Last Seen",
      cell: (row: AdminLicense) =>
        row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "-",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row: AdminLicense) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-${row.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.currentIp && (
              <DropdownMenuItem
                onClick={() => actionMutation.mutate({ id: row.id, action: "release" })}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Release Session
              </DropdownMenuItem>
            )}
            {row.status === "active" ? (
              <DropdownMenuItem
                onClick={() => actionMutation.mutate({ id: row.id, action: "suspend" })}
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspend
              </DropdownMenuItem>
            ) : row.status === "suspended" ? (
              <DropdownMenuItem
                onClick={() => actionMutation.mutate({ id: row.id, action: "activate" })}
              >
                <Play className="h-4 w-4 mr-2" />
                Activate
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => actionMutation.mutate({ id: row.id, action: "revoke" })}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleCreate = () => {
    createLicenseMutation.mutate({
      email: newLicense.email,
      seatCount: parseInt(newLicense.seatCount),
      planType: newLicense.planType,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Admin License Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all licenses across tenants. Create, suspend, and revoke access.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-license">
              <Plus className="h-4 w-4 mr-2" />
              Create License
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New License</DialogTitle>
              <DialogDescription>
                Create a license and send credentials to the user via email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">User Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newLicense.email}
                  onChange={(e) => setNewLicense({ ...newLicense, email: e.target.value })}
                  placeholder="user@company.com"
                  data-testid="input-license-email"
                />
              </div>
              <div>
                <Label htmlFor="planType">Plan Type</Label>
                <Select
                  value={newLicense.planType}
                  onValueChange={(v) => setNewLicense({ ...newLicense, planType: v })}
                >
                  <SelectTrigger data-testid="select-plan-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="seatCount">Number of Seats</Label>
                <Input
                  id="seatCount"
                  type="number"
                  min="1"
                  value={newLicense.seatCount}
                  onChange={(e) => setNewLicense({ ...newLicense, seatCount: e.target.value })}
                  data-testid="input-seat-count"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createLicenseMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createLicenseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create & Send Credentials"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Play className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <Pause className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-4">{stats.suspended}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently In Use</CardTitle>
            <Monitor className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-1">{stats.inUse}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Licenses</CardTitle>
          <CardDescription>
            View and manage all licenses across all tenants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={licenses || []} />
        </CardContent>
      </Card>

      <Dialog open={!!createdCredentials} onOpenChange={(open) => !open && setCreatedCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {createdCredentials?.emailSent ? (
                <Check className="h-5 w-5 text-chart-2" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-chart-4" />
              )}
              License Created
            </DialogTitle>
            <DialogDescription>
              {createdCredentials?.emailSent
                ? "Credentials have been sent to the user via email. You can also copy them below."
                : "Email could not be sent. Please copy and share these credentials manually with the user."}
            </DialogDescription>
          </DialogHeader>
          
          {createdCredentials && (
            <div className="space-y-4" data-testid="credentials-container">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Email</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all" data-testid="text-credential-email">
                    {createdCredentials.email}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(createdCredentials.email, "email")}
                    data-testid="button-copy-email"
                  >
                    {copiedField === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Temporary Password</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all" data-testid="text-credential-password">
                    {createdCredentials.password}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(createdCredentials.password, "password")}
                    data-testid="button-copy-password"
                  >
                    {copiedField === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">License Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all" data-testid="text-credential-license-key">
                    {createdCredentials.licenseKey}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(createdCredentials.licenseKey, "licenseKey")}
                    data-testid="button-copy-license-key"
                  >
                    {copiedField === "licenseKey" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  const allText = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nLicense Key: ${createdCredentials.licenseKey}`;
                  copyToClipboard(allText, "all");
                }}
                data-testid="button-copy-all"
              >
                {copiedField === "all" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy All Credentials
              </Button>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setCreatedCredentials(null)} data-testid="button-close-credentials">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
