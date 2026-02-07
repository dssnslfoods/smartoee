import { useState } from 'react';
import { Calendar, RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenToggle, FullscreenContainer } from '@/components/ui/FullscreenToggle';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useExecutiveData } from '@/hooks/useExecutiveData';
import {
  ExecSnapshot,
  ExecTrendChart,
  ExecLossPareto,
  ExecLineRanking,
  ExecLossCategory,
  ExecAttentionPanel,
} from '@/components/executive';

export default function Executive() {
  const { hasRole } = useAuth();
  const [dateRange, setDateRange] = useState<'7' | '14' | '30'>('7');
  const { isFullscreen, isKiosk, toggleFullscreen, enterKiosk, enterFullscreen } = useFullscreen();

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
  } = useExecutiveData(dateRange, isFullscreen);

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
