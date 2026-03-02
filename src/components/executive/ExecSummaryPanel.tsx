import { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, AlertCircle, Target, BarChart2, Lightbulb, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type {
    ExecMetrics,
    ExecTrendPoint,
    ExecParetoItem,
    ExecLineRankItem,
    ExecLossCategoryItem,
    ExecAttentionItem,
} from '@/hooks/useExecutiveData';

// ---------- Types ----------
interface ExecSummaryPanelProps {
    summary: ExecMetrics | null;
    previousSummary: ExecMetrics | null;
    todaySummary: ExecMetrics | null;
    targets: ExecMetrics | null;
    trendData: ExecTrendPoint[];
    paretoData: ExecParetoItem[];
    lineRanking: ExecLineRankItem[];
    lossByCategory: ExecLossCategoryItem[];
    attentionItems: ExecAttentionItem[];
    dateRange: '7' | '14' | '30';
    isLoading: boolean;
}

// ---------- Helpers ----------
const OEE_WORLD_CLASS = 85;
const AVAIL_TARGET = 85;
const PERF_TARGET = 95;
const QUALITY_TARGET = 99;

function classify(val: number, target: number) {
    if (val >= target) return 'good';
    if (val >= target * 0.75) return 'warn';
    return 'bad';
}

function oeeLabel(val: number) {
    if (val >= OEE_WORLD_CLASS) return { text: 'World-Class', color: 'text-green-500 dark:text-green-400', bg: 'bg-green-500/10 border-green-500/20' };
    if (val >= 60) return { text: 'ระดับกลาง', color: 'text-yellow-500 dark:text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' };
    return { text: 'ต้องปรับปรุง', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
}

function metricColor(cls: string) {
    return cls === 'good' ? 'text-green-500' : cls === 'warn' ? 'text-yellow-500' : 'text-red-500';
}

// ---------- Trend direction helper ----------
function trendDirection(data: ExecTrendPoint[]): 'up' | 'down' | 'flat' {
    if (data.length < 3) return 'flat';
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const avgFirst = firstHalf.reduce((s, d) => s + d.oee, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, d) => s + d.oee, 0) / secondHalf.length;
    const delta = avgSecond - avgFirst;
    if (delta > 2) return 'up';
    if (delta < -2) return 'down';
    return 'flat';
}

// ---------- Main Component ----------
export function ExecSummaryPanel({
    summary,
    previousSummary,
    todaySummary,
    targets,
    trendData,
    paretoData,
    lineRanking,
    lossByCategory,
    attentionItems,
    dateRange,
    isLoading,
}: ExecSummaryPanelProps) {
    const insights = useMemo(() => {
        if (!summary) return null;

        const s = summary;
        const dayLabel = dateRange === '7' ? '7 วัน' : dateRange === '14' ? '14 วัน' : '30 วัน';

        // OEE label
        const oeeL = oeeLabel(s.oee);

        // vs previous
        const oeeDelta = previousSummary ? s.oee - previousSummary.oee : null;
        const avDelta = previousSummary ? s.availability - previousSummary.availability : null;

        // weakest metric
        const metrics = [
            { name: 'Availability', val: s.availability, target: AVAIL_TARGET, cls: classify(s.availability, AVAIL_TARGET) },
            { name: 'Performance', val: s.performance, target: PERF_TARGET, cls: classify(s.performance, PERF_TARGET) },
            { name: 'Quality', val: s.quality, target: QUALITY_TARGET, cls: classify(s.quality, QUALITY_TARGET) },
        ];
        const sorted = [...metrics].sort((a, b) => (a.val - a.target) - (b.val - b.target));
        const weakest = sorted[0];
        const strongest = sorted[sorted.length - 1];

        // trend
        const trend = trendDirection(trendData);

        // top pareto loss
        const topLoss = paretoData[0];
        const topLossCategory = lossByCategory[0];

        // best/worst line
        const bestLine = lineRanking[0];
        const worstLine = lineRanking[lineRanking.length - 1];

        // Critical attention items
        const criticalItems = attentionItems.filter(i => i.severity === 'critical');
        const warningItems = attentionItems.filter(i => i.severity === 'warning');

        // today vs period
        const todayVsPeriod = todaySummary && s.oee > 0 ? todaySummary.oee - s.oee : null;

        // Gap to target
        const gapToTarget = targets ? targets.oee - s.oee : null;

        return {
            oeeL, dayLabel, s, oeeDelta, avDelta,
            weakest, strongest, trend, topLoss, topLossCategory,
            bestLine, worstLine, criticalItems, warningItems,
            todayVsPeriod, gapToTarget, metrics,
        };
    }, [summary, previousSummary, todaySummary, targets, trendData, paretoData, lineRanking, lossByCategory, attentionItems, dateRange]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!insights || !summary) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
                    <p className="text-sm">ยังไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์</p>
                </CardContent>
            </Card>
        );
    }

    const { oeeL, dayLabel, s, oeeDelta, weakest, strongest, trend, topLoss, topLossCategory, bestLine, worstLine, criticalItems, warningItems, todayVsPeriod, gapToTarget, metrics } = insights;

    // ---------- Build narrative ----------
    const narParts: string[] = [];

    // Sentence 1: Overall OEE
    const oeeVsPrev = oeeDelta !== null
        ? ` (${oeeDelta >= 0 ? '+' : ''}${oeeDelta.toFixed(1)}% เทียบกับช่วงก่อนหน้า)`
        : '';
    narParts.push(
        `ในช่วง ${dayLabel}ที่ผ่านมา ภาพรวม OEE ของโรงงานอยู่ที่ **${s.oee.toFixed(1)}%**${oeeVsPrev} ซึ่งอยู่ในระดับ${oeeL.text}`
    );

    // Sentence 2: Weakest metric
    if (weakest.cls !== 'good') {
        const deficit = (weakest.target - weakest.val).toFixed(1);
        narParts.push(
            `${weakest.name} เป็นตัวชี้วัดที่อ่อนแอที่สุด (${weakest.val.toFixed(1)}%) ต่ำกว่าเป้าหมาย ${deficit}%`
        );
    }

    // Sentence 3: Trend
    if (trend === 'up') narParts.push('แนวโน้ม OEE มีทิศทางดีขึ้นในช่วงครึ่งหลังของช่วงเวลา');
    else if (trend === 'down') narParts.push('แนวโน้ม OEE ลดลงในช่วงครึ่งหลังของช่วงเวลา — ควรเฝ้าระวัง');

    // Sentence 4: Top loss
    if (topLoss) {
        narParts.push(
            `สาเหตุ Downtime อันดับ 1 คือ "${topLoss.reason}" (${topLoss.minutes} นาที คิดเป็น ${topLoss.percentage.toFixed(0)}% ของ Downtime ทั้งหมด)`
        );
    }

    // Sentence 5: Line comparison
    if (bestLine && worstLine && bestLine.id !== worstLine.id) {
        narParts.push(
            `สายการผลิตที่ดีที่สุดคือ "${bestLine.name}" (OEE ${bestLine.oee.toFixed(1)}%) ส่วน "${worstLine.name}" มี OEE ต่ำสุด (${worstLine.oee.toFixed(1)}%)`
        );
    }

    const narrative = narParts.join(' — ');

    // ---------- Recommendations ----------
    const recs: { priority: 'critical' | 'high' | 'medium'; icon: string; title: string; detail: string }[] = [];

    if (criticalItems.length > 0) {
        criticalItems.forEach(item => {
            recs.push({ priority: 'critical', icon: '🚨', title: item.title, detail: item.detail });
        });
    }
    if (warningItems.length > 0) {
        warningItems.slice(0, 2).forEach(item => {
            recs.push({ priority: 'high', icon: '⚠️', title: item.title, detail: item.detail });
        });
    }
    if (weakest.cls !== 'good') {
        const recMap: Record<string, { icon: string; detail: string }> = {
            Availability: { icon: '🔧', detail: 'วิเคราะห์ Downtime Log, วางแผน Preventive Maintenance และตรวจสอบ MTTR/MTBF' },
            Performance: { icon: '⚡', detail: 'ตรวจสอบ Cycle Time จริงเทียบมาตรฐาน, ลด Minor Stops และ Speed Losses' },
            Quality: { icon: '✅', detail: 'วิเคราะห์ Defect Pareto, ปรับ SOP และเพิ่มความถี่ในการตรวจ QC' },
        };
        const r = recMap[weakest.name];
        if (r && !recs.find(rec => rec.title.includes(weakest.name))) {
            recs.push({ priority: 'high', icon: r.icon, title: `ปรับปรุง ${weakest.name}`, detail: r.detail });
        }
    }
    if (topLoss && topLoss.percentage > 30) {
        recs.push({
            priority: 'high',
            icon: '⏱️',
            title: `จัดการสาเหตุ Downtime หลัก: "${topLoss.reason}"`,
            detail: `ใช้เวลา ${topLoss.minutes} นาที (${topLoss.percentage.toFixed(0)}%) — ทำ Root Cause Analysis เพื่อลดเวลาสูญเสีย`,
        });
    }
    if (worstLine && worstLine.oee < 60 && bestLine && bestLine.id !== worstLine.id) {
        recs.push({
            priority: 'medium',
            icon: '📉',
            title: `ยกระดับสายการผลิต "${worstLine.name}"`,
            detail: `OEE ต่ำเพียง ${worstLine.oee.toFixed(1)}% — ศึกษา Best Practice จากสาย "${bestLine.name}" (${bestLine.oee.toFixed(1)}%)`,
        });
    }
    if (recs.length === 0) {
        recs.push({ priority: 'medium', icon: '🏆', title: 'รักษามาตรฐาน World-Class', detail: 'OEE อยู่ในระดับดีเยี่ยม — ตั้งเป้าหมายที่สูงขึ้นและแบ่งปัน Best Practice' });
    }

    const priorityStyle: Record<string, string> = {
        critical: 'border-red-500/40 bg-red-500/5',
        high: 'border-yellow-500/30 bg-yellow-500/5',
        medium: 'border-blue-500/20 bg-blue-500/5',
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" />
                        Executive Summary
                    </CardTitle>
                    <Badge variant="outline" className={cn('text-xs font-semibold', oeeL.color, oeeL.bg)}>
                        OEE {s.oee.toFixed(1)}% — {oeeL.text}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">

                {/* Narrative summary */}
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">สรุปภาพรวม ({dayLabel})</p>
                    <p className="text-sm leading-relaxed text-foreground">{narrative}</p>
                </div>

                {/* KPI Status Grid */}
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">สถานะตัวชี้วัดหลัก</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { label: 'Overall OEE', val: s.oee, target: OEE_WORLD_CLASS, cls: classify(s.oee, OEE_WORLD_CLASS) },
                            ...metrics,
                        ].map(m => {
                            const gap = m.val - m.target;
                            const Icon = m.cls === 'good' ? CheckCircle : m.cls === 'warn' ? AlertCircle : AlertTriangle;
                            return (
                                <div key={m.label} className={cn('rounded-lg border p-3 space-y-1', m.cls === 'good' ? 'border-green-500/20 bg-green-500/5' : m.cls === 'warn' ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-red-500/20 bg-red-500/5')}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-muted-foreground">{m.label}</span>
                                        <Icon className={cn('h-3.5 w-3.5', metricColor(m.cls))} />
                                    </div>
                                    <p className={cn('text-xl font-bold tabular-nums', metricColor(m.cls))}>{m.val.toFixed(1)}%</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        เป้า: {m.target}% •{' '}
                                        <span className={gap >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            {gap >= 0 ? '+' : ''}{gap.toFixed(1)}%
                                        </span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Trend & Today indicators */}
                <div className="flex flex-wrap gap-3">
                    {/* Trend */}
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                        {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                        {trend === 'flat' && <Minus className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-muted-foreground text-xs">แนวโน้ม {dayLabel}:</span>
                        <span className={cn('text-xs font-semibold', trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground')}>
                            {trend === 'up' ? 'ดีขึ้น ↑' : trend === 'down' ? 'แย่ลง ↓' : 'ทรงตัว →'}
                        </span>
                    </div>

                    {/* Today vs period */}
                    {todayVsPeriod !== null && (
                        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                            <Target className="h-4 w-4 text-primary" />
                            <span className="text-muted-foreground text-xs">วันนี้ vs เฉลี่ย:</span>
                            <span className={cn('text-xs font-semibold', todayVsPeriod >= 0 ? 'text-green-500' : 'text-red-500')}>
                                {todayVsPeriod >= 0 ? '+' : ''}{todayVsPeriod.toFixed(1)}%
                            </span>
                        </div>
                    )}

                    {/* Gap to target */}
                    {gapToTarget !== null && targets && targets.oee > 0 && (
                        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                            <BarChart2 className="h-4 w-4 text-primary" />
                            <span className="text-muted-foreground text-xs">ห่างจากเป้า:</span>
                            <span className={cn('text-xs font-semibold', gapToTarget <= 0 ? 'text-green-500' : 'text-red-500')}>
                                {gapToTarget <= 0 ? '✓ บรรลุเป้า' : `${gapToTarget.toFixed(1)}%`}
                            </span>
                        </div>
                    )}

                    {/* Best line */}
                    {bestLine && (
                        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground text-xs">สายดีที่สุด:</span>
                            <span className="text-xs font-semibold">{bestLine.name} ({bestLine.oee.toFixed(1)}%)</span>
                        </div>
                    )}

                    {/* Top loss */}
                    {topLoss && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-muted-foreground text-xs">Downtime หลัก:</span>
                            <span className="text-xs font-semibold">{topLoss.reason} ({topLoss.minutes} นาที)</span>
                        </div>
                    )}
                </div>

                {/* Recommendations */}
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">ข้อเสนอแนะสำหรับผู้บริหาร</p>
                    <div className="space-y-2">
                        {recs.map((r, i) => (
                            <div key={i} className={cn('rounded-lg border p-3 flex gap-3 items-start text-sm', priorityStyle[r.priority])}>
                                <span className="text-base shrink-0">{r.icon}</span>
                                <div>
                                    <p className="font-semibold text-sm">{r.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Loss category breakdown */}
                {lossByCategory.length > 0 && (
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">การสูญเสียตามประเภท</p>
                        <div className="flex flex-wrap gap-2">
                            {lossByCategory.map(lc => (
                                <div key={lc.category} className="rounded-full border px-3 py-1 text-xs flex items-center gap-1.5">
                                    <span className="font-medium">{lc.category}</span>
                                    <span className="text-muted-foreground">{lc.minutes} นาที ({lc.percentage.toFixed(0)}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
