import { useLocation, Link } from "wouter";
import { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  Users,
  KeyRound,
  BarChart3,
  Settings,
  Calculator,
  Shield,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  titleKey: string;
  url: string;
  icon: LucideIcon;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { t } = useI18n();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "admin";

  const mainNavItems: NavItem[] = [
    {
      titleKey: "nav.dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      titleKey: "nav.contracts",
      url: "/contracts",
      icon: FileText,
    },
    {
      titleKey: "nav.customers",
      url: "/customers",
      icon: Users,
    },
  ];

  const ifrs15Items: NavItem[] = [
    {
      titleKey: "nav.ifrs15",
      url: "/ifrs15",
      icon: Calculator,
    },
    {
      titleKey: "nav.reports",
      url: "/reports",
      icon: BarChart3,
    },
  ];

  const adminItems: NavItem[] = [
    {
      titleKey: "nav.licenses",
      url: "/licenses",
      icon: KeyRound,
    },
    {
      titleKey: "nav.audit",
      url: "/audit",
      icon: Shield,
    },
    {
      titleKey: "nav.settings",
      url: "/settings",
      icon: Settings,
    },
  ];

  const superAdminItems: NavItem[] = [
    {
      titleKey: "nav.adminLicenses",
      url: "/admin/licenses",
      icon: ShieldCheck,
    },
  ];

  const NavButton = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
    const Icon = item.icon;
    const translationKey = item.titleKey as keyof typeof import("@/lib/i18n").translations["en"];
    return (
      <Link href={item.url} data-testid={`nav-${item.titleKey.split(".")[1]}`}>
        <Button
          variant={isActive ? "default" : "ghost"}
          className={cn(
            "w-full justify-start gap-3 h-10",
            isActive && "bg-primary text-primary-foreground shadow-md"
          )}
        >
          <div className={cn(
            "flex items-center justify-center rounded-md p-1.5",
            isActive ? "bg-primary-foreground/20" : "bg-primary/10"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              isActive ? "text-primary-foreground" : "text-primary"
            )} />
          </div>
          <span className="font-medium">{t(translationKey)}</span>
        </Button>
      </Link>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary shadow-lg">
            <Calculator className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-primary">IFRS 15</span>
            <span className="text-xs text-muted-foreground">Revenue Manager</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup className="space-y-1">
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <NavButton item={item} isActive={location === item.url} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="space-y-1 mt-6">
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
            IFRS 15
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {ifrs15Items.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <NavButton 
                    item={item} 
                    isActive={location === item.url || location.startsWith(item.url + "/")} 
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="space-y-1 mt-6">
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <NavButton item={item} isActive={location === item.url} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup className="space-y-1 mt-6">
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
              Super Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <NavButton item={item} isActive={location === item.url} />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-3">
        {user && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">{user.fullName || user.email}</span>
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              data-testid="button-logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
            {isAdmin ? "Admin" : "Enterprise"}
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">v1.0.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
