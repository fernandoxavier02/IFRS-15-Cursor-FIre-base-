import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Contracts from "@/pages/contracts";
import Customers from "@/pages/customers";
import Licenses from "@/pages/licenses";
import Reports from "@/pages/reports";
import IFRS15Engine from "@/pages/ifrs15";
import AuditTrail from "@/pages/audit";
import Settings from "@/pages/settings";
import Subscribe from "@/pages/subscribe";
import AdminLicenses from "@/pages/admin-licenses";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import Showcase from "@/pages/showcase";
import ChangePassword from "@/pages/change-password";
import ActivateLicense from "@/pages/activate-license";
import AiSettings from "@/pages/ai-settings";
import ContractIngestion from "@/pages/contract-ingestion";
import BillingSchedules from "@/pages/billing-schedules";
import RevenueLedger from "@/pages/revenue-ledger";
import ConsolidatedBalances from "@/pages/consolidated-balances";

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

  // Public routes without sidebar
  if (location === "/" && !isAuthenticated) {
    return <Showcase />;
  }

  if (location === "/landing") {
    return <Landing />;
  }

  if (location === "/showcase") {
    return <Showcase />;
  }

  if (location === "/subscribe") {
    return <Subscribe />;
  }

  if (location === "/login") {
    if (isAuthenticated) {
      return <Redirect to="/" />;
    }
    return <Login />;
  }

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingSpinner />;
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

  // Fully authenticated - show main app with sidebar
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contracts" component={Contracts} />
        <Route path="/customers" component={Customers} />
        <Route path="/licenses" component={Licenses} />
        <Route path="/reports" component={Reports} />
        <Route path="/ifrs15" component={IFRS15Engine} />
        <Route path="/billing-schedules" component={BillingSchedules} />
        <Route path="/revenue-ledger" component={RevenueLedger} />
        <Route path="/consolidated-balances" component={ConsolidatedBalances} />
        <Route path="/audit" component={AuditTrail} />
        <Route path="/settings" component={Settings} />
        <Route path="/ai-settings" component={AiSettings} />
        <Route path="/contract-ingestion" component={ContractIngestion} />
        {user?.role === "admin" && (
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
