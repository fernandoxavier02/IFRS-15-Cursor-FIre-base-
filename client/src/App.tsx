import { AppSidebar } from "@/components/app-sidebar";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-firebase";
import { I18nProvider } from "@/lib/i18n";
import AccountingReconciliation from "@/pages/accounting-reconciliation";
import ActivateLicense from "@/pages/activate-license";
import AdminLicenses from "@/pages/admin-licenses";
import AiSettings from "@/pages/ai-settings";
import AuditTrail from "@/pages/audit";
import BillingSchedules from "@/pages/billing-schedules";
import ChangePassword from "@/pages/change-password";
import ConsolidatedBalances from "@/pages/consolidated-balances";
import ContractCosts from "@/pages/contract-costs";
import ContractDetails from "@/pages/contract-details";
import ContractIngestion from "@/pages/contract-ingestion";
import Contracts from "@/pages/contracts";
import CustomerArea from "@/pages/customer-area";
import Customers from "@/pages/customers";
import Dashboard from "@/pages/dashboard";
import DeleteManagement from "@/pages/delete-management";
import ExchangeRates from "@/pages/exchange-rates";
import ExecutiveDashboard from "@/pages/executive-dashboard";
import FinancingComponents from "@/pages/financing-components";
import IFRS15Engine from "@/pages/ifrs15";
import IFRS15AccountingControl from "@/pages/ifrs15-accounting-control";
import Landing from "@/pages/landing-new";
import Licenses from "@/pages/licenses";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import Reports from "@/pages/reports";
import RevenueLedger from "@/pages/revenue-ledger";
import RevenueWaterfall from "@/pages/revenue-waterfall";
import Settings from "@/pages/settings";
import Showcase from "@/pages/showcase";
import Subscribe from "@/pages/subscribe";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function MainRouter() {
  const [location] = useLocation();
  const { isLoading, isAuthenticated, needsPasswordChange, needsLicenseActivation, user } = useAuth();
  
  // Check subscription status for authenticated users
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-subscription", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      const { tenantService } = await import("@/lib/firestore-service");
      return tenantService.get(user.tenantId);
    },
    enabled: !!user?.tenantId && isAuthenticated && !needsPasswordChange && !needsLicenseActivation,
  });

  const subscriptionStatus = (tenant as any)?.subscriptionStatus;
  // Only block if subscriptionStatus is explicitly set and not "active"
  // If undefined/null, allow access (for backward compatibility with existing tenants)
  const needsPayment = subscriptionStatus !== undefined && subscriptionStatus !== null && subscriptionStatus !== "active";

  // Public routes that don't require auth check (static pages)
  const publicRoutes = ["/landing", "/showcase", "/subscribe"];
  
  if (publicRoutes.includes(location)) {
    if (location === "/landing") return <Landing />;
    if (location === "/showcase") return <Showcase />;
    if (location === "/subscribe") return <Subscribe />;
  }

  // Customer area - requires authentication but no payment
  if (location === "/customer-area") {
    if (isLoading) return <LoadingSpinner />;
    if (!isAuthenticated) return <Redirect to="/login" />;
    return <CustomerArea />;
  }

  // Login page - redirect if already authenticated
  if (location === "/login") {
    if (isLoading) return <LoadingSpinner />;
    if (isAuthenticated) return <Redirect to="/" />;
    return <Login />;
  }

  // Show loading while checking auth for protected routes
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Root path - show showcase if not authenticated
  if (location === "/" && !isAuthenticated) {
    return <Showcase />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Authenticated but needs password change
  if (needsPasswordChange) {
    if (location !== "/change-password") {
      return <Redirect to="/change-password" />;
    }
    return <ChangePassword />;
  }

  // Authenticated, password changed, but needs license activation
  if (needsLicenseActivation) {
    if (location !== "/activate-license") {
      return <Redirect to="/activate-license" />;
    }
    return <ActivateLicense />;
  }

  // Check if payment is required (subscription status is not active)
  if (isAuthenticated && user?.tenantId && !tenantLoading && needsPayment) {
    // Allow access to customer-area, but redirect other routes
    if (location !== "/customer-area" && location !== "/change-password") {
      return <Redirect to="/customer-area" />;
    }
    // If already on customer-area, show it
    if (location === "/customer-area") {
      return <CustomerArea />;
    }
  }

  // Fully authenticated and paid - show main app with sidebar
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contracts" component={Contracts} />
        <Route path="/contracts/:id" component={ContractDetails} />
        <Route path="/customers" component={Customers} />
        <Route path="/delete-management" component={DeleteManagement} />
        <Route path="/licenses" component={Licenses} />
        <Route path="/reports" component={Reports} />
        <Route path="/ifrs15" component={IFRS15Engine} />
        <Route path="/billing-schedules" component={BillingSchedules} />
        <Route path="/revenue-ledger" component={RevenueLedger} />
        <Route path="/accounting-reconciliation" component={AccountingReconciliation} />
        <Route path="/consolidated-balances" component={ConsolidatedBalances} />
        <Route path="/revenue-waterfall" component={RevenueWaterfall} />
        <Route path="/contract-costs" component={ContractCosts} />
        <Route path="/exchange-rates" component={ExchangeRates} />
        <Route path="/financing-components" component={FinancingComponents} />
        <Route path="/executive-dashboard" component={ExecutiveDashboard} />
        <Route path="/ifrs15-accounting-control" component={IFRS15AccountingControl} />
        <Route path="/audit" component={AuditTrail} />
        <Route path="/settings" component={Settings} />
        <Route path="/ai-settings" component={AiSettings} />
        <Route path="/contract-ingestion" component={ContractIngestion} />
        {user?.email === "fernandocostaxavier@gmail.com" && (
          <Route path="/admin/licenses" component={AdminLicenses} />
        )}
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-4 h-14 border-b bg-background shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="ifrs15-theme">
        <I18nProvider>
          <AuthProvider>
            <TooltipProvider>
              <MainRouter />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
