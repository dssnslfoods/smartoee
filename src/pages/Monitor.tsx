import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { MonitorMachineCard } from "@/components/monitor/MonitorMachineCard";
import { MonitorControlSheet } from "@/components/monitor/MonitorControlSheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMonitorData } from "@/hooks/useMonitorData";
import { useFullscreen } from "@/hooks/useFullscreen";
import { FullscreenToggle, FullscreenContainer } from "@/components/ui/FullscreenToggle";
import { useQuery } from "@tanstack/react-query";
import { getLines, getPlants } from "@/services/oeeApi";
import { ShiftScheduleBanner } from "@/components/monitor/ShiftScheduleBanner";
import {
  Monitor as MonitorIcon,
  Play,
  Pause,
  AlertTriangle,
  Wrench,
  Factory,
  Building2,
  Wifi,
  MapPin,
} from "lucide-react";

type StatusFilter = "all" | "running" | "idle" | "stopped" | "maintenance";

export default function MonitorPage() {
  const { company, isAdmin } = useAuth();
  const { data, isLoading } = useMonitorData();
  const { isFullscreen, isKiosk, toggleFullscreen, enterKiosk, enterFullscreen } = useFullscreen();
  const [selectedPlant, setSelectedPlant] = useState<string>("all");
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [controlSheetOpen, setControlSheetOpen] = useState(false);

  const companyId = company?.id;

  const { data: plants } = useQuery({
    queryKey: ["plants", companyId],
    queryFn: () => getPlants(companyId),
    enabled: !!companyId || !isAdmin(),
  });

  const { data: lines } = useQuery({
    queryKey: ["lines", companyId],
    queryFn: () => getLines(undefined, companyId),
    enabled: !!companyId || !isAdmin(),
  });

  // Filter lines based on selected plant
  const filteredLines = useMemo(() => {
    if (!lines) return [];
    if (selectedPlant === "all") return lines;
    return lines.filter((l) => l.plant_id === selectedPlant);
  }, [lines, selectedPlant]);

  // Auto-select when only one option available
  useEffect(() => {
    if (plants && plants.length === 1 && selectedPlant === "all") {
      setSelectedPlant(plants[0].id);
    }
  }, [plants, selectedPlant]);

  useEffect(() => {
    if (filteredLines.length === 1 && selectedLine === "all") {
      setSelectedLine(filteredLines[0].id);
    }
  }, [filteredLines, selectedLine]);

  // Reset line filter when plant changes
  const handlePlantChange = (plantId: string) => {
    setSelectedPlant(plantId);
    setSelectedLine("all");
  };

  // Filter machines
  const filteredMachines = useMemo(() => {
    if (!data?.machines) return [];
    let result = data.machines;
    if (selectedPlant !== "all") {
      result = result.filter((m) => m.plant_id === selectedPlant);
    }
    if (selectedLine !== "all") {
      result = result.filter((m) => m.line_id === selectedLine);
    }
    if (statusFilter !== "all") {
      result = result.filter((m) => m.status === statusFilter);
    }
    return result;
  }, [data?.machines, selectedPlant, selectedLine, statusFilter]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    const stats = { running: 0, idle: 0, stopped: 0, maintenance: 0, total: 0 };
    for (const m of filteredMachines) {
      stats[m.status]++;
      stats.total++;
    }
    return stats;
  }, [filteredMachines]);

  const stats = filteredStats;

  // Group machines by line
  const machinesByLine = useMemo(() => {
    const map = new Map<
      string,
      { lineId: string; lineName: string; plantName?: string; machines: typeof filteredMachines }
    >();
    for (const m of filteredMachines) {
      const key = m.line_id;
      if (!map.has(key)) {
        map.set(key, { lineId: key, lineName: m.line_name || "Unknown Line", plantName: m.plant_name, machines: [] });
      }
      map.get(key)!.machines.push(m);
    }
    // Sort lines alphabetically
    return [...map.values()].sort((a, b) => a.lineName.localeCompare(b.lineName));
  }, [filteredMachines]);

  const content = (
    <div className="page-container space-y-5">
      {/* Kiosk company banner */}
      {isKiosk && company && (
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Building2 className="h-5 w-5 sm:h-7 sm:w-7 text-primary shrink-0" />
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">{company.name}</h1>
            <span className="hidden sm:inline text-lg text-muted-foreground font-medium">— Production Monitor</span>
          </div>
          <Badge
            variant="outline"
            className="gap-1.5 px-2.5 py-1 text-xs font-medium border-status-running/30 text-status-running bg-status-running/5"
          >
            <Wifi className="h-3 w-3 animate-pulse" />
            Live
          </Badge>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={isKiosk ? "" : "Production Monitor"}
        description={isKiosk ? "" : "สถานะเครื่องจักรแบบ Real-time"}
        icon={isKiosk ? undefined : MonitorIcon}
        className={isKiosk ? "hidden" : undefined}
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

        {/* Realtime indicator */}

        {!isKiosk && isAdmin() && company && (
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/5 border-primary/20">
            <Building2 className="h-3.5 w-3.5" />
            {company.name}
          </Badge>
        )}

        {!isKiosk && (
          <>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[140px] bg-background border-border/50">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="running">🟢 Running</SelectItem>
                <SelectItem value="stopped">🔴 Stopped</SelectItem>
                <SelectItem value="maintenance">🟡 Setup</SelectItem>
                <SelectItem value="idle">⚪ Idle</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPlant} onValueChange={handlePlantChange}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background border-border/50">
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="เลือกโรงงาน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกโรงงาน</SelectItem>
                {plants?.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>
                    {plant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLine} onValueChange={setSelectedLine}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background border-border/50">
                <Factory className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="เลือกไลน์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกไลน์</SelectItem>
                {filteredLines?.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </PageHeader>

      {/* Shift & Break Schedule Reminder */}
      <ShiftScheduleBanner plantId={selectedPlant} />

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <StatPill
          icon={Play}
          label="Running"
          count={stats.running}
          colorClass="text-status-running"
          bgClass="bg-status-running/10"
        />
        <StatPill
          icon={AlertTriangle}
          label="Stopped"
          count={stats.stopped}
          colorClass="text-status-stopped"
          bgClass="bg-status-stopped/10"
        />
        <StatPill
          icon={Wrench}
          label="Setup"
          count={stats.maintenance}
          colorClass="text-status-maintenance"
          bgClass="bg-status-maintenance/10"
        />
        <StatPill
          icon={Pause}
          label="Idle"
          count={stats.idle}
          colorClass="text-status-idle"
          bgClass="bg-status-idle/10"
        />
      </div>

      {/* Machine Layout - Vertical Columns by Line */}
      {isLoading ? (
        <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-full md:min-w-[280px] md:flex-1 space-y-3">
              <Skeleton className="h-14 rounded-xl" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-36 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      ) : filteredMachines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MonitorIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>ไม่พบเครื่องจักร{statusFilter !== "all" ? ` ในสถานะ ${statusFilter}` : ""}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2 md:items-start">
          {machinesByLine.map(({ lineId, lineName, plantName, machines: lineMachines }) => {
            const lineStats = { running: 0, stopped: 0, maintenance: 0, idle: 0 };
            for (const m of lineMachines) lineStats[m.status]++;
            const dominantStatus =
              lineStats.running > 0
                ? "running"
                : lineStats.stopped > 0
                  ? "stopped"
                  : lineStats.maintenance > 0
                    ? "maintenance"
                    : "idle";
            const statusGlow: Record<string, string> = {
              running: "shadow-[0_0_25px_-5px_hsl(var(--status-running)/0.35)]",
              stopped: "shadow-[0_0_25px_-5px_hsl(var(--status-stopped)/0.35)]",
              maintenance: "shadow-[0_0_25px_-5px_hsl(var(--status-maintenance)/0.35)]",
              idle: "",
            };
            const statusBorder: Record<string, string> = {
              running: "border-status-running/40",
              stopped: "border-status-stopped/40",
              maintenance: "border-status-maintenance/40",
              idle: "border-border/50",
            };

            return (
              <div
                key={lineId}
                className={cn(
                  "w-full md:min-w-[280px] md:max-w-[320px] flex-1 flex flex-col rounded-xl border bg-card/60 backdrop-blur-sm overflow-hidden",
                  statusBorder[dominantStatus],
                  statusGlow[dominantStatus],
                )}
              >
                {/* Line Title Banner */}
                <div className="relative px-4 py-4 border-b border-border/30 bg-gradient-to-br from-primary/10 via-background to-background">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.08),transparent_70%)]" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/15 border border-primary/20">
                        <Factory className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-bold text-base tracking-tight text-foreground truncate">{lineName}</h3>
                    </div>
                    {plantName && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-9">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{plantName}</span>
                      </div>
                    )}
                    {/* Mini status pills */}
                    <div className="flex items-center gap-1.5 mt-2.5 ml-9 flex-wrap">
                      {lineStats.running > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-running/15 text-status-running">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-running animate-pulse" />
                          {lineStats.running}
                        </span>
                      )}
                      {lineStats.stopped > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-stopped/15 text-status-stopped">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-stopped" />
                          {lineStats.stopped}
                        </span>
                      )}
                      {lineStats.maintenance > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-maintenance/15 text-status-maintenance">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-maintenance" />
                          {lineStats.maintenance}
                        </span>
                      )}
                      {lineStats.idle > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-idle/15 text-status-idle">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-idle" />
                          {lineStats.idle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Machine Cards - Stacked vertically */}
                <div className="flex flex-col gap-2.5 p-2.5 flex-1">
                  {lineMachines.map((machine) => (
                    <MonitorMachineCard
                      key={machine.id}
                      machine={machine}
                      onClick={() => {
                        setSelectedMachineId(machine.id);
                        setControlSheetOpen(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Control Sheet */}
      {selectedMachineId &&
        (() => {
          const selectedMachine = data?.machines.find((m) => m.id === selectedMachineId);
          return (
            <MonitorControlSheet
              machineId={selectedMachineId}
              machineName={selectedMachine?.name}
              machineCode={selectedMachine?.code}
              machineStatus={selectedMachine?.status}
              open={controlSheetOpen}
              onOpenChange={setControlSheetOpen}
            />
          );
        })()}
    </div>
  );

  if (isFullscreen || isKiosk) {
    return (
      <FullscreenContainer isFullscreen={isFullscreen} isKiosk={isKiosk}>
        {content}
      </FullscreenContainer>
    );
  }

  return <AppLayout>{content}</AppLayout>;
}

// Small stat pill component
function StatPill({
  icon: Icon,
  label,
  count,
  colorClass,
  bgClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 sm:gap-3 rounded-lg border px-2.5 sm:px-4 py-2.5 sm:py-3", bgClass, "border-transparent")}>
      <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", colorClass)} />
      <div className="min-w-0">
        <p className={cn("text-lg sm:text-2xl font-bold tabular-nums", colorClass)}>{count}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}
