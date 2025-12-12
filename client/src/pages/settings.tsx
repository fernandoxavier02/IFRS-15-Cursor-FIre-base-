import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Building2,
  CreditCard,
  Users,
  Shield,
  Bell,
  Palette,
  ExternalLink,
  Check,
} from "lucide-react";
import type { Tenant, User } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();

  const { data: tenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const [tenantForm, setTenantForm] = useState({
    name: tenant?.name || "",
    country: tenant?.country || "",
    currency: tenant?.currency || "USD",
    taxId: tenant?.taxId || "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailAlerts: true,
    contractExpiry: true,
    paymentReminders: true,
    licenseWarnings: true,
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data: typeof tenantForm) => {
      return apiRequest("PATCH", "/api/tenant", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant"] });
      toast({
        title: "Settings updated",
        description: "Organization settings have been saved.",
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

  const roleColors: Record<string, string> = {
    admin: "bg-destructive/10 text-destructive",
    finance: "bg-chart-1/10 text-chart-1",
    auditor: "bg-chart-3/10 text-chart-3",
    operations: "bg-chart-4/10 text-chart-4",
    readonly: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage organization settings and preferences
        </p>
      </div>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList>
          <TabsTrigger value="organization" data-testid="tab-organization">
            <Building2 className="h-4 w-4 mr-2" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Organization Details</CardTitle>
              <CardDescription>
                Update your organization information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenantLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={tenantForm.name || tenant?.name || ""}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, name: e.target.value })
                      }
                      placeholder="Your organization name"
                      data-testid="input-org-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={tenantForm.country || tenant?.country || ""}
                      onChange={(e) =>
                        setTenantForm({ ...tenantForm, country: e.target.value })
                      }
                      placeholder="Country"
                      data-testid="input-country"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Default Currency</Label>
                      <Select
                        value={tenantForm.currency || tenant?.currency || "USD"}
                        onValueChange={(value) =>
                          setTenantForm({ ...tenantForm, currency: value })
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
                        value={tenantForm.taxId || tenant?.taxId || ""}
                        onChange={(e) =>
                          setTenantForm({ ...tenantForm, taxId: e.target.value })
                        }
                        placeholder="Tax identification number"
                        data-testid="input-tax-id"
                      />
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button
                      onClick={() => updateTenantMutation.mutate(tenantForm)}
                      disabled={updateTenantMutation.isPending}
                      data-testid="button-save-org"
                    >
                      {updateTenantMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Subscription</CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tenantLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-md bg-muted">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Enterprise Plan</span>
                        <Badge variant="default" className="text-xs">
                          {tenant?.subscriptionStatus || "active"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Full access to all IFRS 15 features
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold">$299</p>
                      <p className="text-sm text-muted-foreground">/month</p>
                    </div>
                  </div>

                  {tenant?.currentPeriodEnd && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current period ends</span>
                      <span>{new Date(tenant.currentPeriodEnd).toLocaleDateString()}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center gap-3">
                    <Button variant="outline" data-testid="button-manage-billing">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage Billing
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                    <Button variant="outline" data-testid="button-view-invoices">
                      View Invoices
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-medium">Team Members</CardTitle>
                <CardDescription>
                  Manage user access and roles
                </CardDescription>
              </div>
              <Button data-testid="button-invite-user">
                <Users className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center gap-4 p-3 rounded-md hover-elevate">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                        {user.fullName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${roleColors[user.role] || ""} border-0`}
                      >
                        {user.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Role Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-5 gap-2 font-medium text-muted-foreground pb-2 border-b">
                  <span>Role</span>
                  <span className="text-center">View</span>
                  <span className="text-center">Create</span>
                  <span className="text-center">Edit</span>
                  <span className="text-center">Admin</span>
                </div>
                {[
                  { role: "Admin", view: true, create: true, edit: true, admin: true },
                  { role: "Finance", view: true, create: true, edit: true, admin: false },
                  { role: "Auditor", view: true, create: false, edit: false, admin: false },
                  { role: "Operations", view: true, create: true, edit: false, admin: false },
                  { role: "Read-only", view: true, create: false, edit: false, admin: false },
                ].map((perm) => (
                  <div key={perm.role} className="grid grid-cols-5 gap-2 items-center">
                    <span>{perm.role}</span>
                    <div className="flex justify-center">
                      {perm.view && <Check className="h-4 w-4 text-chart-2" />}
                    </div>
                    <div className="flex justify-center">
                      {perm.create && <Check className="h-4 w-4 text-chart-2" />}
                    </div>
                    <div className="flex justify-center">
                      {perm.edit && <Check className="h-4 w-4 text-chart-2" />}
                    </div>
                    <div className="flex justify-center">
                      {perm.admin && <Check className="h-4 w-4 text-chart-2" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Email Notifications</CardTitle>
              <CardDescription>
                Configure when you receive email alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for important events
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.emailAlerts}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, emailAlerts: checked })
                  }
                  data-testid="switch-email-alerts"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Contract Expiry Reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified 30 days before contracts expire
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.contractExpiry}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, contractExpiry: checked })
                  }
                  data-testid="switch-contract-expiry"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for upcoming and failed payments
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.paymentReminders}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, paymentReminders: checked })
                  }
                  data-testid="switch-payment-reminders"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">License Warnings</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified about license issues and suspensions
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.licenseWarnings}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, licenseWarnings: checked })
                  }
                  data-testid="switch-license-warnings"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
