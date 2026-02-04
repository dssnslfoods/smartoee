import { 
  LayoutDashboard, 
  Factory, 
  Settings, 
  Users, 
  BarChart3, 
  FileText,
  Wrench,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Production',
    href: '/production',
    icon: Factory,
    children: [
      { title: 'Daily Input', href: '/production/daily', icon: FileText },
      { title: 'Machine Status', href: '/production/machines', icon: Wrench },
    ],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin', 'executive', 'supervisor'],
  },
  {
    title: 'Users',
    href: '/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin'],
  },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { profile, roles, signOut } = useAuth();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const canAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.some(role => roles.includes(role as any));
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    if (!canAccess(item)) return null;

    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.includes(item.title);
    const Icon = item.icon;

    if (hasChildren) {
      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.title)}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.title}</span>
              <ChevronDown 
                className={cn(
                  'h-4 w-4 transition-transform',
                  isOpen && 'rotate-180'
                )} 
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-4 pt-1">
            {item.children?.map(child => renderNavItem(child, level + 1))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.title}
        to={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-primary text-sidebar-primary-foreground',
          level > 0 && 'text-sidebar-foreground/80'
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.title}</span>
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Factory className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">PNF OEE</h1>
          <p className="text-xs text-sidebar-foreground/60">Manufacturing</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {navItems.map(item => renderNavItem(item))}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{profile?.full_name || 'User'}</p>
            <p className="truncate text-xs text-sidebar-foreground/60 capitalize">
              {roles[0] ? String(roles[0]) : 'No role'}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={signOut}
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
