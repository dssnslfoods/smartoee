import {
  LayoutDashboard,
  Factory,
  Settings,
  BarChart3,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CompanySwitcher } from "./CompanySwitcher";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ("STAFF" | "SUPERVISOR" | "EXECUTIVE" | "ADMIN")[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Shopfloor",
    href: "/shopfloor",
    icon: Factory,
  },
  {
    title: "Supervisor",
    href: "/supervisor",
    icon: ClipboardCheck,
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    title: "Executive",
    href: "/executive",
    icon: BarChart3,
    roles: ["EXECUTIVE", "ADMIN"],
  },
  {
    title: "Recent Activity",
    href: "/recent-activity",
    icon: ScrollText,
  },
  {
    title: "Activity Log",
    href: "/activity-log",
    icon: ScrollText,
    roles: ["ADMIN"],
  },
  {
    title: "Admin Setup",
    href: "/admin",
    icon: Settings,
    roles: ["ADMIN"],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { profile, company, roles, signOut, isAdmin } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const canAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles.includes(role));
  };

  const NavItemContent = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
    const Icon = item.icon;
    return (
      <>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {!isCollapsed && (
          <span
            className={cn(
              "font-medium transition-colors",
              isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground",
            )}
          >
            {item.title}
          </span>
        )}
      </>
    );
  };

  const renderNavItem = (item: NavItem) => {
    if (!canAccess(item)) return null;

    const isActive = pathname === item.href;

    const linkContent = (
      <Link
        key={item.title}
        to={item.href}
        onClick={() => setIsMobileOpen(false)}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
          "hover:bg-sidebar-accent/80",
          isActive && "bg-sidebar-accent shadow-sm",
          isCollapsed && "justify-center px-2",
        )}
      >
        <NavItemContent item={item} isActive={isActive} />
      </Link>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider key={item.title} delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {item.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return linkContent;
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border/50",
          isCollapsed ? "justify-center px-3" : "gap-3 px-4",
        )}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-1.5 shadow-sm ring-1 ring-primary/20">
          <img src="/favicon.png" alt="PNF OEE Logo" className="h-full w-full object-contain" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">PNF OEE</h1>
            <p className="text-xs text-sidebar-foreground/50 font-medium">Manufacturing System v1.0</p>
          </div>
        )}
      </div>

      {/* Company Switcher for Admins */}
      {isAdmin() && (
        <div className={cn("border-b border-sidebar-border/50", isCollapsed ? "flex justify-center p-2" : "p-3")}>
          <CompanySwitcher isCollapsed={isCollapsed} />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        <div className="space-y-1">{navItems.map((item) => renderNavItem(item))}</div>
      </nav>

      {/* Collapse Toggle (Desktop only) */}
      <div className="hidden md:block border-t border-sidebar-border/50 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
            isCollapsed ? "justify-center" : "justify-start gap-2",
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>

      {/* User Profile */}
      <div className="border-t border-sidebar-border/50 p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl bg-sidebar-accent/60 backdrop-blur-sm",
            isCollapsed ? "flex-col px-2 py-3" : "px-3 py-2.5",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground font-semibold text-sm shadow-sm">
            {profile?.full_name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name || "User"}</p>
              <p className="truncate text-xs text-sidebar-foreground/50 font-medium">{roles[0] || "No role"}</p>
              {!isAdmin() && company && (
                <p className="truncate text-xs text-sidebar-foreground/40 mt-0.5">{company.name}</p>
              )}
            </div>
          )}
          {isCollapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={signOut}
                    className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-3 top-3 z-40 md:hidden h-10 w-10 bg-background/95 backdrop-blur-sm border-border/50 shadow-md"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border/50 transition-transform duration-300 ease-out md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(false)}
          className="absolute right-3 top-4 h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <X className="h-5 w-5" />
        </Button>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border/50 transition-all duration-300 ease-out",
          isCollapsed ? "w-[72px]" : "w-64",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
