import { useLocation, Link } from "wouter";
import {
  ChartLineUp,
  FileText,
  Users,
  Key,
  ChartBar,
  Gear,
  Calculator,
  ShieldCheck,
  SignOut,
  CurrencyDollar,
  TrendUp,
  ClockCounterClockwise,
  Brain,
  FileArrowUp,
} from "@phosphor-icons/react";
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
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/hooks/use-plan";
import { cn } from "@/lib/utils";

interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ElementType;
  gradient?: string;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { features } = usePlan();

  const isAdmin = user?.role === "admin";
  const hasAiIngestion = features.hasCustomIntegrations;

  const mainNavItems: NavItem[] = [
    {
      titleKey: "nav.dashboard",
      url: "/",
      icon: ChartLineUp,
      gradient: "from-emerald-500 to-emerald-600",
    },
    {
      titleKey: "nav.contracts",
      url: "/contracts",
      icon: FileText,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      titleKey: "nav.customers",
      url: "/customers",
      icon: Users,
      gradient: "from-purple-500 to-purple-600",
    },
  ];

  const ifrs15Items: NavItem[] = [
    {
      titleKey: "nav.ifrs15",
      url: "/ifrs15",
      icon: Calculator,
      gradient: "from-emerald-500 to-blue-500",
    },
    {
      titleKey: "nav.reports",
      url: "/reports",
      icon: ChartBar,
      gradient: "from-blue-500 to-purple-500",
    },
  ];

  const aiItems: NavItem[] = [
    {
      titleKey: "nav.contractIngestion",
      url: "/contract-ingestion",
      icon: FileArrowUp,
      gradient: "from-blue-500 to-purple-600",
    },
    {
      titleKey: "nav.aiSettings",
      url: "/ai-settings",
      icon: Brain,
      gradient: "from-purple-500 to-pink-500",
    },
  ];

  const adminItems: NavItem[] = [
    {
      titleKey: "nav.licenses",
      url: "/licenses",
      icon: Key,
      gradient: "from-amber-500 to-orange-500",
    },
    {
      titleKey: "nav.audit",
      url: "/audit",
      icon: ClockCounterClockwise,
      gradient: "from-slate-500 to-slate-600",
    },
    {
      titleKey: "nav.settings",
      url: "/settings",
      icon: Gear,
      gradient: "from-slate-400 to-slate-500",
    },
  ];

  const superAdminItems: NavItem[] = [
    {
      titleKey: "nav.adminLicenses",
      url: "/admin/licenses",
      icon: ShieldCheck,
      gradient: "from-rose-500 to-pink-500",
    },
  ];

  const NavButton = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
    const Icon = item.icon;
    const translationKey = item.titleKey as keyof typeof import("@/lib/i18n").translations["en"];
    const testId = `nav-${item.titleKey.split(".")[1]}`;
    
    return (
      <SidebarMenuButton 
        asChild 
        isActive={isActive}
        className={cn(
          "group flex items-center gap-3 px-3 py-2.5 h-auto rounded-lg transition-all duration-200",
          isActive 
            ? "sidebar-item-active bg-white/10" 
            : "hover:bg-white/5"
        )}
        data-testid={testId}
      >
        <Link href={item.url}>
          <div className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
            isActive 
              ? `bg-gradient-to-br ${item.gradient} shadow-lg` 
              : "bg-white/10 group-hover:bg-white/15"
          )}>
            <Icon 
              weight={isActive ? "fill" : "duotone"}
              className={cn(
                "w-5 h-5 transition-colors",
                isActive ? "text-white" : "text-white/70 group-hover:text-white/90"
              )} 
            />
          </div>
          <span className={cn(
            "text-sm font-medium transition-colors",
            isActive ? "text-white" : "text-white/70 group-hover:text-white/90"
          )}>
            {t(translationKey)}
          </span>
        </Link>
      </SidebarMenuButton>
    );
  };

  return (
    <Sidebar className="border-r-0">
      <div className="h-full flex flex-col sidebar-premium">
        <SidebarHeader className="p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                <CurrencyDollar weight="fill" className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-tight">IFRS 15</span>
              <span className="text-xs text-white/50 font-medium">Revenue Manager</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4 flex-1 overflow-y-auto">
          <SidebarGroup className="space-y-1">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-2">
              Overview
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
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-2">
              Revenue Recognition
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

          {hasAiIngestion && (
            <SidebarGroup className="space-y-1 mt-6">
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-2 flex items-center gap-1.5">
                AI Ingestion
                <span className="px-1.5 py-0.5 text-[8px] rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold">
                  NEW
                </span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {aiItems.map((item) => (
                    <SidebarMenuItem key={item.titleKey}>
                      <NavButton item={item} isActive={location === item.url} />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <SidebarGroup className="space-y-1 mt-6">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-2">
              Administration
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
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-2">
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

        <SidebarFooter className="p-4 border-t border-white/10 flex-shrink-0 mt-auto">
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10">
                <span className="text-sm font-semibold text-white">
                  {user.fullName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-white truncate">
                  {user.fullName || user.email.split("@")[0]}
                </span>
                <span className="text-xs text-white/50 truncate">{user.email}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                data-testid="button-logout"
                className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
              >
                <SignOut weight="bold" className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-2">
              <TrendUp weight="fill" className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                {isAdmin ? "Admin" : "Enterprise"}
              </span>
            </div>
            <span className="text-[10px] text-white/30 font-medium">v1.0.0</span>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
