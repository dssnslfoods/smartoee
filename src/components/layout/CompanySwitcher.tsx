import { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface CompanySwitcherProps {
  isCollapsed?: boolean;
}

export function CompanySwitcher({ isCollapsed = false }: CompanySwitcherProps) {
  const { company, selectCompanyForAdmin, isAdmin } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isAdmin()) {
      fetchCompanies();
    }
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, code, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin()) return null;

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectCompany = (selectedCompany: Company) => {
    selectCompanyForAdmin(selectedCompany);
    setOpen(false);
    setSearchTerm('');
    toast.success(`Switched to ${selectedCompany.name}`);
  };

  if (isCollapsed) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          >
            <Building2 className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Switch Company
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="p-2">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <ScrollArea className="h-[200px]">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No companies found
              </div>
            ) : (
              filteredCompanies.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => handleSelectCompany(c)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{c.name}</span>
                  </div>
                  {company?.id === c.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between gap-2 px-3 py-2.5 h-auto text-left hover:bg-sidebar-accent/60 rounded-xl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20">
              <Building2 className="h-4 w-4 text-sidebar-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                Company
              </p>
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {company?.name || 'Select Company'}
              </p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          Switch Company
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Input
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <ScrollArea className="h-[240px]">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No companies found
            </div>
          ) : (
            filteredCompanies.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => handleSelectCompany(c)}
                className={cn(
                  'flex items-center justify-between cursor-pointer mx-1',
                  company?.id === c.id && 'bg-accent'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{c.name}</p>
                    {c.code && (
                      <p className="text-xs text-muted-foreground">{c.code}</p>
                    )}
                  </div>
                </div>
                {company?.id === c.id && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
