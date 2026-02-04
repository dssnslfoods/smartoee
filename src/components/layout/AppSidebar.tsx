import { 
  LayoutDashboard, 
  Factory, 
  Settings, 
  BarChart3, 
  ClipboardCheck,
  Gauge,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ('STAFF' | 'SUPERVISOR' | 'EXECUTIVE' | 'ADMIN')[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Shopfloor',
    href: '/shopfloor',
    icon: Factory,
  },
  {
    title: 'Supervisor',
    href: '/supervisor',
    icon: ClipboardCheck,
    roles: ['SUPERVISOR', 'ADMIN'],
  },
  {
    title: 'Executive',
    href: '/executive',
    icon: BarChart3,
    roles: ['EXECUTIVE', 'ADMIN'],
  },
  {
    title: 'Admin Setup',
    href: '/admin',
    icon: Settings,
    roles: ['ADMIN'],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { profile, roles, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const canAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.some(role => roles.includes(role));
  };

  const renderNavItem = (item: NavItem) => {
    if (!canAccess(item)) return null;

    const isActive = pathname === item.href;
    const Icon = item.icon;

    return (
      <Link
        key={item.title}
        to={item.href}
        onClick={() => setIsMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm',
          isCollapsed && 'justify-center px-2'
        )}
        title={isCollapsed ? item.title : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span>{item.title}</span>}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-sidebar-border',
        isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'
      )}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
          <Gauge className="h-6 w-6 text-sidebar-primary-foreground" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold text-sidebar-foreground">PNF OEE</h1>
            <p className="text-xs text-sidebar-foreground/60">Manufacturing System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(item => renderNavItem(item))}
      </nav>

      {/* Collapse Toggle (Desktop only) */}
      <div className="hidden md:block border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <>
              <Menu className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-3">
        <div className={cn(
          'flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2',
          isCollapsed && 'flex-col px-2 py-3'
        )}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{profile?.full_name || 'User'}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {roles[0] || 'No role'}
              </p>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={signOut}
            className={cn(
              'h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
              isCollapsed && 'mt-1'
            )}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsMobileOpen(true)}
        className="fixed left-4 top-4 z-40 md:hidden bg-background shadow-md"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 md:hidden',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(false)}
          className="absolute right-2 top-4 text-sidebar-foreground/60"
        >
          <X className="h-5 w-5" />
        </Button>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden md:flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}
