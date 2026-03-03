import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    Play, Pause, AlertTriangle, Wrench,
    TrendingUp, TrendingDown, Minus, Activity, X
} from 'lucide-react';
import { OEETrendChart } from './OEETrendChart';
import { KioskClock } from '@/components/ui/KioskClock';

// ---------- Types ----------
interface MachineItem {
    id: string;
    name: string;
    code?: string;
    status: 'running' | 'idle' | 'stopped' | 'maintenance';
    oee?: number;
    currentProduct?: string;
    line_id?: string;
}

interface OEEData {
    oee: number;
    availability: number;
    performance: number;
    quality: number;
}

interface DashboardTVLayoutProps {
    oee: OEEData;
    machines: MachineItem[];
    stats: { running: number; idle: number; stopped: number; maintenance: number };
    trendData: any[];
    companyName?: string;
    isKiosk: boolean;
    onExit?: () => void;
}

// ---------- Helpers ----------
function oeeGrade(val: number) {
    if (val >= 85) return { label: 'World Class', color: 'text-green-400', glow: 'shadow-[0_0_60px_-5px_rgba(74,222,128,0.6)]', bar: 'from-green-500 to-emerald-400' };
    if (val >= 60) return { label: 'Acceptable', color: 'text-yellow-400', glow: 'shadow-[0_0_60px_-5px_rgba(234,179,8,0.6)]', bar: 'from-yellow-500 to-amber-400' };
    return { label: 'Needs Improvement', color: 'text-red-400', glow: 'shadow-[0_0_60px_-5px_rgba(248,113,113,0.6)]', bar: 'from-red-500 to-rose-400' };
}

function metricColor(val: number, target: number) {
    if (val >= target) return 'text-green-400';
    if (val >= target * 0.75) return 'text-yellow-400';
    return 'text-red-400';
}

function statusConfig(status: string) {
    switch (status) {
        case 'running': return { color: 'bg-green-500', text: 'text-green-400', label: 'Running', pulse: true };
        case 'idle': return { color: 'bg-yellow-500', text: 'text-yellow-400', label: 'Idle', pulse: false };
        case 'stopped': return { color: 'bg-red-500', text: 'text-red-400', label: 'Stopped', pulse: false };
        case 'maintenance': return { color: 'bg-blue-500', text: 'text-blue-400', label: 'Maintenance', pulse: false };
        default: return { color: 'bg-muted', text: 'text-muted-foreground', label: status, pulse: false };
    }
}

// ---------- Sub-components ----------
function OEEArcGauge({ value, label, color }: { value: number; label: string; color: string }) {
    const r = 44;
    const circ = 2 * Math.PI * r;
    const arc = circ * 0.75; // 270° arc
    const filled = arc * (Math.min(value, 100) / 100);
    const strokeColor = value >= 85 ? '#4ade80' : value >= 60 ? '#facc15' : '#f87171';

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
                    {/* Track */}
                    <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8"
                        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
                    {/* Filled */}
                    <circle cx="50" cy="50" r={r} fill="none" stroke={strokeColor} strokeWidth="8"
                        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${strokeColor})` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn('text-xl font-bold tabular-nums', color)}>{value.toFixed(1)}%</span>
                </div>
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">{label}</span>
        </div>
    );
}

function StatPill({ icon: Icon, count, label, color }: { icon: any; count: number; label: string; color: string }) {
    return (
        <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3 bg-slate-900/60 backdrop-blur-sm', color)}>
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', color.replace('border-', 'bg-').replace('/30', '/15'))}>
                <Icon className="h-4 w-4" />
            </div>
            <div>
                <p className="text-2xl font-bold tabular-nums leading-none">{count}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

function MachineTile({ machine }: { machine: MachineItem }) {
    const sc = statusConfig(machine.status);
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm p-2.5 flex flex-col gap-1.5"
        >
            <div className="flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className={cn('h-2.5 w-2.5 rounded-full', sc.color, sc.pulse && 'animate-ping absolute inline-flex opacity-75')} />
                    <span className={cn('h-2.5 w-2.5 rounded-full', sc.color)} />
                </div>
                <span className="text-xs font-semibold truncate text-slate-200">{machine.name}</span>
            </div>
            {machine.oee !== undefined && (
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                            className={cn('h-full rounded-full', machine.oee >= 85 ? 'bg-green-500' : machine.oee >= 60 ? 'bg-yellow-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(machine.oee, 100)}%` }}
                        />
                    </div>
                    <span className={cn('text-[10px] font-bold tabular-nums', machine.oee >= 85 ? 'text-green-400' : machine.oee >= 60 ? 'text-yellow-400' : 'text-red-400')}>
                        {machine.oee.toFixed(0)}%
                    </span>
                </div>
            )}
        </motion.div>
    );
}

// ---------- Main TV Layout ----------
export function DashboardTVLayout({ oee, machines, stats, trendData, companyName, isKiosk, onExit }: DashboardTVLayoutProps) {
    const grade = oeeGrade(oee.oee);
    const totalMachines = machines.length;

    // OEE change — use trend data
    const trendDir = useMemo(() => {
        if (trendData.length < 4) return 'flat';
        const first = trendData.slice(0, 2).reduce((s, d) => s + (d.oee || 0), 0) / 2;
        const last = trendData.slice(-2).reduce((s, d) => s + (d.oee || 0), 0) / 2;
        const delta = last - first;
        if (delta > 1) return 'up';
        if (delta < -1) return 'down';
        return 'flat';
    }, [trendData]);

    const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus;
    const trendColor = trendDir === 'up' ? 'text-green-400' : trendDir === 'down' ? 'text-red-400' : 'text-slate-400';

    return (
        <div className="fixed inset-0 bg-[#06080f] text-white overflow-hidden flex flex-col">
            {/* Ambient glow bg */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
            </div>

            {/* ── TOP BAR ── */}
            <div className="relative flex items-center justify-between px-6 py-3 border-b border-slate-700/40 bg-slate-900/60 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        <span className="text-base font-bold tracking-tight">OEE Dashboard</span>
                    </div>
                    {companyName && (
                        <span className="text-xs text-slate-400 border border-slate-700 rounded-full px-3 py-0.5">{companyName}</span>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className={cn('flex items-center gap-1 font-semibold text-sm', trendColor)}>
                            <TrendIcon className="h-4 w-4" />
                            {trendDir === 'up' ? 'Improving' : trendDir === 'down' ? 'Declining' : 'Stable'}
                        </span>
                    </div>
                    <KioskClock refreshInterval={30} />
                    {onExit && (
                        <button
                            onClick={onExit}
                            className="p-1 px-2 rounded-md border border-slate-700 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-all flex items-center gap-1.5"
                            title="Exit TV Mode (Esc)"
                        >
                            <X className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Exit</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── MAIN CONTENT ── */}
            <div className="relative flex-1 grid grid-cols-12 gap-3 p-4 min-h-0">

                {/* ── LEFT: OEE Hero + APQ ── */}
                <div className="col-span-3 flex flex-col gap-3 min-h-0">
                    {/* OEE Hero */}
                    <div className={cn(
                        'rounded-2xl border border-slate-700/50 bg-slate-900/70 backdrop-blur-sm p-5 flex flex-col items-center justify-center gap-3',
                        grade.glow
                    )}>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Overall OEE</p>
                        {/* Large arc */}
                        <div className="relative w-40 h-40">
                            {(() => {
                                const r = 60, circ = 2 * Math.PI * r, arc = circ * 0.75;
                                const filled = arc * (Math.min(oee.oee, 100) / 100);
                                const stroke = oee.oee >= 85 ? '#4ade80' : oee.oee >= 60 ? '#facc15' : '#f87171';
                                return (
                                    <svg viewBox="0 0 130 130" className="w-full h-full -rotate-[135deg]">
                                        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"
                                            strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
                                        <circle cx="65" cy="65" r={r} fill="none" stroke={stroke} strokeWidth="10"
                                            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
                                            style={{ filter: `drop-shadow(0 0 10px ${stroke})` }}
                                        />
                                    </svg>
                                );
                            })()}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={cn('text-4xl font-black tabular-nums', grade.color)}>{oee.oee.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className={cn('px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border', grade.color,
                            grade.color === 'text-green-400' ? 'border-green-500/30 bg-green-500/10' :
                                grade.color === 'text-yellow-400' ? 'border-yellow-500/30 bg-yellow-500/10' :
                                    'border-red-500/30 bg-red-500/10')}>
                            {grade.label}
                        </div>
                    </div>

                    {/* A / P / Q */}
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 backdrop-blur-sm p-4 grid grid-cols-3 gap-2 flex-1">
                        <OEEArcGauge value={oee.availability} label="Avail" color={metricColor(oee.availability, 85)} />
                        <OEEArcGauge value={oee.performance} label="Perf" color={metricColor(oee.performance, 95)} />
                        <OEEArcGauge value={oee.quality} label="Quality" color={metricColor(oee.quality, 99)} />
                    </div>

                    {/* Machine Status Pills */}
                    <div className="grid grid-cols-2 gap-2">
                        <StatPill icon={Play} count={stats.running} label="Running" color="border-green-500/30 text-green-400" />
                        <StatPill icon={Pause} count={stats.idle} label="Idle" color="border-yellow-500/30 text-yellow-400" />
                        <StatPill icon={AlertTriangle} count={stats.stopped} label="Stopped" color="border-red-500/30 text-red-400" />
                        <StatPill icon={Wrench} count={stats.maintenance} label="Maint." color="border-blue-500/30 text-blue-400" />
                    </div>
                </div>

                {/* ── CENTER: Trend Chart ── */}
                <div className="col-span-5 flex flex-col gap-3 min-h-0">
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 backdrop-blur-sm flex-1 overflow-hidden p-1">
                        <OEETrendChart
                            data={trendData}
                            title="OEE Trend"
                        />
                    </div>

                    {/* Horizontal OEE bars */}
                    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 backdrop-blur-sm p-4 space-y-3">
                        {[
                            { label: 'Availability', val: oee.availability, target: 85 },
                            { label: 'Performance', val: oee.performance, target: 95 },
                            { label: 'Quality', val: oee.quality, target: 99 },
                        ].map(m => {
                            const col = m.val >= m.target ? 'bg-green-500' : m.val >= m.target * 0.75 ? 'bg-yellow-500' : 'bg-red-500';
                            const textCol = m.val >= m.target ? 'text-green-400' : m.val >= m.target * 0.75 ? 'text-yellow-400' : 'text-red-400';
                            return (
                                <div key={m.label} className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-400 font-medium">{m.label}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500">Target: {m.target}%</span>
                                            <span className={cn('text-sm font-bold tabular-nums', textCol)}>{m.val.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="relative h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(m.val, 100)}%` }}
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                            className={cn('h-full rounded-full', col)}
                                            style={{ boxShadow: `0 0 8px currentColor` }}
                                        />
                                        {/* Target line */}
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-white/30" style={{ left: `${m.target}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── RIGHT: Machine Grid ── */}
                <div className="col-span-4 flex flex-col gap-2 min-h-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs uppercase tracking-widest text-slate-400 font-medium">All Machines</span>
                        <span className="text-[10px] text-slate-500">{totalMachines} units</span>
                    </div>
                    <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 content-start pr-1
            [&::-webkit-scrollbar]:w-1
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-slate-600/50
            [&::-webkit-scrollbar-thumb]:rounded-full">
                        {machines.map((m, i) => (
                            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                                <MachineTile machine={m} />
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── BOTTOM BAR ── */}
            <div className="relative shrink-0 border-t border-slate-700/40 bg-slate-900/60 backdrop-blur-sm px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-6 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />Auto-refresh every 30s</span>
                    <span>TV Mode — Press <kbd className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 font-mono">ESC</kbd> to exit</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Total: <span className="text-slate-300 font-semibold">{totalMachines}</span> machines</span>
                    <span>Running: <span className="text-green-400 font-semibold">{stats.running}</span></span>
                    <span>Stopped: <span className="text-red-400 font-semibold">{stats.stopped}</span></span>
                </div>
            </div>
        </div>
    );
}
