import { useState, useEffect } from 'react';
import { Building2, Loader2, ChevronRight, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}

interface CompanySelectorProps {
  onSelectCompany: (company: Company) => void;
  isLoading?: boolean;
}

export function CompanySelector({ onSelectCompany, isLoading }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
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

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.code && company.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (company: Company) => {
    setSelectedId(company.id);
    onSelectCompany(company);
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Company List */}
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-2">
          {filteredCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                {searchTerm ? 'No companies found' : 'No companies available'}
              </p>
            </div>
          ) : (
            filteredCompanies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelect(company)}
                disabled={isLoading}
                className={cn(
                  'w-full rounded-lg border bg-card p-4 text-left transition-all hover:border-primary hover:bg-accent',
                  selectedId === company.id && isLoading && 'border-primary bg-accent',
                  isLoading && selectedId !== company.id && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{company.name}</p>
                      {company.code && (
                        <p className="text-xs text-muted-foreground">Code: {company.code}</p>
                      )}
                    </div>
                  </div>
                  {isLoading && selectedId === company.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      <p className="text-center text-xs text-muted-foreground">
        Select a company to continue as Administrator
      </p>
    </div>
  );
}
