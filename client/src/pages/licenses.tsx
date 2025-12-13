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
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-firebase";
import { licenseService } from "@/lib/firestore-service";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LicenseWithSession } from "@/lib/types";
import type { License } from "@shared/firestore-types";
import { toISOString } from "@shared/firestore-types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    Ban,
    Clock,
    KeyRound,
    MoreHorizontal,
    Power,
    RefreshCw,
    Search,
    Shield,
    Wifi,
    WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";

export default function Licenses() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLicense, setSelectedLicense] = useState<LicenseWithSession | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"release" | "suspend" | "revoke" | null>(null);

  // Fetch licenses from Firestore
  const { data: licenses, isLoading, refetch: refetchLicenses } = useQuery<License[]>({
    queryKey: ["licenses", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return [];
      return licenseService.getAll(user.tenantId);
    },
    enabled: !!user?.tenantId,
  });

  // Transform licenses to LicenseWithSession format
  const licensesWithSession: LicenseWithSession[] = useMemo(() => {
    return (licenses || []).map((license) => ({
      id: license.id,
      licenseKey: license.licenseKey,
      status: license.status as any,
      seatCount: license.seatCount,
      currentIp: license.currentIp || null,
      currentUserName: license.currentUserName || null,
      lockedAt: toISOString(license.lockedAt) || null,
      lastSeenAt: toISOString(license.lastSeenAt) || null,
      graceUntil: toISOString(license.graceUntil) || null,
    }));
  }, [licenses]);

  const releaseMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      return apiRequest("POST", `/api/licenses/${licenseId}/release`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses", user?.tenantId] });
      refetchLicenses();
      setActionDialogOpen(false);
      setSelectedLicense(null);
      toast({
        title: "License released",
        description: "The license session has been terminated.",
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

  const suspendMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      return apiRequest("POST", `/api/licenses/${licenseId}/suspend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses", user?.tenantId] });
      refetchLicenses();
      setActionDialogOpen(false);
      setSelectedLicense(null);
      toast({
        title: "License suspended",
        description: "The license has been suspended.",
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

  const revokeMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      return apiRequest("POST", `/api/licenses/${licenseId}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses", user?.tenantId] });
      refetchLicenses();
      setActionDialogOpen(false);
      setSelectedLicense(null);
      toast({
        title: "License revoked",
        description: "The license has been permanently revoked.",
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

  const filteredLicenses = licensesWithSession.filter((license) =>
    license.licenseKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    license.currentIp?.includes(searchQuery) ||
    license.currentUserName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLicenses = licensesWithSession.filter((l) => l.status === "active").length;
  const inUseLicenses = licensesWithSession.filter((l) => l.currentIp !== null).length;
  const suspendedLicenses = licensesWithSession.filter((l) => l.status === "suspended").length;

  const handleAction = (license: LicenseWithSession, action: "release" | "suspend" | "revoke") => {
    setSelectedLicense(license);
    setPendingAction(action);
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedLicense || !pendingAction) return;
    
    switch (pendingAction) {
      case "release":
        releaseMutation.mutate(selectedLicense.id);
        break;
      case "suspend":
        suspendMutation.mutate(selectedLicense.id);
        break;
      case "revoke":
        revokeMutation.mutate(selectedLicense.id);
        break;
    }
  };

  const columns = [
    {
      key: "licenseKey",
      header: "License Key",
      cell: (row: LicenseWithSession) => (
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs">{row.licenseKey}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: LicenseWithSession) => <StatusBadge status={row.status} />,
    },
    {
      key: "seatCount",
      header: "Seats",
      cell: (row: LicenseWithSession) => (
        <span className="tabular-nums">{row.seatCount}</span>
      ),
      className: "text-center",
    },
    {
      key: "connection",
      header: "Connection",
      cell: (row: LicenseWithSession) => (
        <div className="flex items-center gap-2">
          {row.currentIp ? (
            <>
              <Wifi className="h-4 w-4 text-chart-2" />
              <span className="font-mono text-xs">{row.currentIp}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm">Not connected</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: "currentUserName",
      header: "User",
      cell: (row: LicenseWithSession) => (
        <span className="text-sm">{row.currentUserName || "—"}</span>
      ),
    },
    {
      key: "lastSeenAt",
      header: "Last Activity",
      cell: (row: LicenseWithSession) => (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="text-xs">
            {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row: LicenseWithSession) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              data-testid={`button-license-actions-${row.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.currentIp && (
              <DropdownMenuItem
                onClick={() => handleAction(row, "release")}
                data-testid={`menu-release-${row.id}`}
              >
                <Power className="h-4 w-4 mr-2" />
                Force Release
              </DropdownMenuItem>
            )}
            {row.status === "active" && (
              <DropdownMenuItem
                onClick={() => handleAction(row, "suspend")}
                data-testid={`menu-suspend-${row.id}`}
              >
                <Shield className="h-4 w-4 mr-2" />
                Suspend License
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleAction(row, "revoke")}
              className="text-destructive focus:text-destructive"
              data-testid={`menu-revoke-${row.id}`}
            >
              <Ban className="h-4 w-4 mr-2" />
              Revoke License
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-12",
    },
  ];

  const getActionDetails = () => {
    switch (pendingAction) {
      case "release":
        return {
          title: "Force Release License",
          description: "This will terminate the current session and disconnect the user immediately.",
          confirmText: "Release",
          variant: "default" as const,
        };
      case "suspend":
        return {
          title: "Suspend License",
          description: "The license will be suspended and the user will not be able to use it until reactivated.",
          confirmText: "Suspend",
          variant: "secondary" as const,
        };
      case "revoke":
        return {
          title: "Revoke License",
          description: "This action is permanent. The license will be completely revoked and cannot be restored.",
          confirmText: "Revoke License",
          variant: "destructive" as const,
        };
      default:
        return null;
    }
  };

  const actionDetails = getActionDetails();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">License Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and control software licenses and active sessions
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetchLicenses()}
          data-testid="button-refresh-licenses"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Licenses
            </CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{activeLicenses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Currently In Use
            </CardTitle>
            <Wifi className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{inUseLicenses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suspended
            </CardTitle>
            <Shield className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{suspendedLicenses}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by key, IP, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-licenses"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredLicenses}
        isLoading={isLoading}
        emptyMessage="No licenses found."
        testIdPrefix="license"
      />

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDetails?.title}</DialogTitle>
            <DialogDescription>{actionDetails?.description}</DialogDescription>
          </DialogHeader>
          {selectedLicense && (
            <div className="py-4">
              <div className="rounded-md bg-muted p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">License Key</span>
                  <span className="font-mono text-xs">{selectedLicense.licenseKey}</span>
                </div>
                {selectedLicense.currentIp && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current IP</span>
                    <span className="font-mono">{selectedLicense.currentIp}</span>
                  </div>
                )}
                {selectedLicense.currentUserName && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">User</span>
                    <span>{selectedLicense.currentUserName}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionDetails?.variant}
              onClick={confirmAction}
              disabled={
                releaseMutation.isPending ||
                suspendMutation.isPending ||
                revokeMutation.isPending
              }
              data-testid="button-confirm-action"
            >
              {actionDetails?.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
