import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  FileText,
  Users,
  KeyRound,
  BarChart3,
  Settings,
  Calculator,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export function AppSidebar() {
  const [location] = useLocation();
  const { t } = useI18n();

  const mainNavItems = [
    {
      titleKey: "nav.dashboard" as const,
      url: "/",
      icon: LayoutDashboard,
    },
    {
      titleKey: "nav.contracts" as const,
      url: "/contracts",
      icon: FileText,
    },
    {
      titleKey: "nav.customers" as const,
      url: "/customers",
      icon: Users,
    },
  ];

  const ifrs15Items = [
    {
      titleKey: "nav.ifrs15" as const,
      url: "/ifrs15",
      icon: Calculator,
    },
    {
      titleKey: "nav.reports" as const,
      url: "/reports",
      icon: BarChart3,
    },
  ];

  const adminItems = [
    {
      titleKey: "nav.licenses" as const,
      url: "/licenses",
      icon: KeyRound,
    },
    {
      titleKey: "nav.audit" as const,
      url: "/audit",
      icon: Shield,
    },
    {
      titleKey: "nav.settings" as const,
      url: "/settings",
      icon: Settings,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Calculator className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">IFRS 15</span>
            <span className="text-xs text-muted-foreground">Revenue Manager</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    className="w-full"
                  >
                    <Link href={item.url} data-testid={`nav-${item.titleKey.split(".")[1]}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-2">
            IFRS 15
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ifrs15Items.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url || location.startsWith(item.url + "/")}
                    className="w-full"
                  >
                    <Link href={item.url} data-testid={`nav-${item.titleKey.split(".")[1]}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-2">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    className="w-full"
                  >
                    <Link href={item.url} data-testid={`nav-${item.titleKey.split(".")[1]}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Enterprise
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">v1.0.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
