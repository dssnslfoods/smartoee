import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, RefreshCw, BarChart3, Building2, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenToggle, FullscreenContainer } from '@/components/ui/FullscreenToggle';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useExecutiveData } from '@/hooks/useExecutiveData';
import { supabase } from '@/integrations/supabase/client';
import {
  ExecSnapshot,
  ExecTrendChart,
  ExecLossPareto,
  ExecLineRanking,
  ExecLossCategory,
  ExecAttentionPanel,
  ExecSummaryPanel,
} from '@/components/executive';

export default function Executive() {
  const { hasRole, company: authCompany, profile } = useAuth();
  const [dateRange, setDateRange] = useState<'7' | '14' | '30'>('7');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(authCompany?.id ?? null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const { isFullscreen, isKiosk, toggleFullscreen, enterKiosk, enterFullscreen } = useFullscreen();

  const isAdmin = profile?.role === 'ADMIN';

  // Default to user's company on first load
  useEffect(() => {
    if (!selectedCompanyId && authCompany?.id) setSelectedCompanyId(authCompany.id);
  }, [authCompany?.id, selectedCompanyId]);

  // Companies: ADMIN sees all, others see only their own (RLS enforces too)
  const { data: companies = [] } = useQuery({
    queryKey: ['exec-companies', isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, code')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Plants under selected company
  const { data: plants = [] } = useQuery({
    queryKey: ['exec-plants', selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from('plants').select('id, name, code').eq('is_active', true).order('name');
      if (selectedCompanyId) q = q.eq('company_id', selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompanyId,
  });

  // Reset plant when company changes
  useEffect(() => {
    setSelectedPlantId(null);
  }, [selectedCompanyId]);

  const {
    summary,
    previousSummary,
    todaySummary,
    targets,
    trendData,
    paretoData,
    lineRanking,
    lossByCategory,
    attentionItems,
    isLoading,
    refetch,
  } = useExecutiveData(dateRange, isFullscreen, selectedCompanyId, selectedPlantId);

  const hasLossCategory = lossByCategory.length > 0;

  const content = (
    <div className="page-container space-y-3">
      {/* Header */}
      <PageHeader
        title="Executive Dashboard"
        description="OEE Performance Overview"
        icon={BarChart3}
      >
        {!isKiosk && (
          <FullscreenToggle
            isFullscreen={isFullscreen}
            isKiosk={isKiosk}
            onToggle={toggleFullscreen}
            onEnterKiosk={enterKiosk}
            onEnterFullscreen={enterFullscreen}
          />
        )}

        {!isKiosk && (
          <>
            {/* Company filter (ADMIN: เลือกได้ทั้งหมด, ผู้ใช้อื่น: locked to own company) */}
            {companies.length > 1 && (
              <Select
                value={selectedCompanyId ?? ''}
                onValueChange={(v) => setSelectedCompanyId(v || null)}
                disabled={!isAdmin && companies.length === 1}
              >
                <SelectTrigger className="w-[200px] bg-background">
                  <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="เลือกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Plant filter */}
            {plants.length > 0 && (
              <Select
                value={selectedPlantId ?? '__all__'}
                onValueChange={(v) => setSelectedPlantId(v === '__all__' ? null : v)}
              >
                <SelectTrigger className="w-[180px] bg-background">
                  <Factory className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">ทุกโรงงาน</SelectItem>
                  {plants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={dateRange} onValueChange={(v: '7' | '14' | '30') => setDateRange(v)}>
              <SelectTrigger className="w-[130px] bg-background">
                <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="14">Last 14 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => refetch()} className="bg-background">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </>
        )}
      </PageHeader>

      {/* Section 0: Executive Summary */}
      <ExecSummaryPanel
        summary={summary}
        previousSummary={previousSummary}
        todaySummary={todaySummary}
        targets={targets}
        trendData={trendData}
        paretoData={paretoData}
        lineRanking={lineRanking}
        lossByCategory={lossByCategory}
        attentionItems={attentionItems}
        dateRange={dateRange}
        isLoading={isLoading}
      />

      {/* Section 1: KPI Snapshot */}
      <ExecSnapshot
        summary={summary}
        previous={previousSummary}
        today={todaySummary}
        targets={targets}
        isLoading={isLoading}
      />

      {/* Section 2 + 3: Trend & Pareto */}
      <div className="grid gap-3 lg:grid-cols-5">
        <ExecTrendChart
          data={trendData}
          target={targets?.oee}
          isLoading={isLoading}
          className="lg:col-span-3"
        />
        <ExecLossPareto
          data={paretoData}
          isLoading={isLoading}
          className="lg:col-span-2"
        />
      </div>

      {/* Section 4 + 5 + 6: Ranking, Category, Attention */}
      <div className={`grid gap-3 ${hasLossCategory ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <ExecLineRanking
          data={lineRanking}
          isLoading={isLoading}
        />
        {hasLossCategory && (
          <ExecLossCategory
            data={lossByCategory}
            isLoading={isLoading}
          />
        )}
        <ExecAttentionPanel
          items={attentionItems}
          isLoading={isLoading}
        />
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <FullscreenContainer isFullscreen={isFullscreen} isKiosk={isKiosk}>
        {content}
      </FullscreenContainer>
    );
  }

  return (
    <AppLayout>
      {content}
    </AppLayout>
  );
}
