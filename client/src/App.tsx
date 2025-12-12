import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { I18nProvider } from "@/lib/i18n";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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

function MainRouter() {
  const [location] = useLocation();
  
  // Public routes without sidebar
  if (location === "/subscribe") {
    return <Subscribe />;
  }

  // Authenticated routes with sidebar layout
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/contracts" component={Contracts} />
        <Route path="/customers" component={Customers} />
        <Route path="/licenses" component={Licenses} />
        <Route path="/reports" component={Reports} />
        <Route path="/ifrs15" component={IFRS15Engine} />
        <Route path="/audit" component={AuditTrail} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin/licenses" component={AdminLicenses} />
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
          <TooltipProvider>
            <MainRouter />
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
