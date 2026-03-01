import { useQuery } from "@tanstack/react-query";
import { getPlantSchedule } from "@/services/oeeApi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, Coffee, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ShiftScheduleBannerProps {
    plantId: string;
    className?: string;
}

export function ShiftScheduleBanner({ plantId, className }: ShiftScheduleBannerProps) {
    const { data: schedule, isLoading } = useQuery({
        queryKey: ["plant-schedule", plantId],
        queryFn: () => getPlantSchedule(plantId),
        enabled: !!plantId && plantId !== "all",
        refetchInterval: 60000, // Refresh every minute
    });

    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (!schedule) return;

        const calculateTimeLeft = () => {
            const now = new Date();
            const currentTime = now.toTimeString().split(' ')[0];

            // Find the next upcoming event (break start or shift end)
            const events = [
                { time: schedule.end_time, label: "ปิดกะทำงาน (Auto-Stop)" },
            ];

            if (schedule.break_start_time) {
                events.push({ time: schedule.break_start_time, label: "เริ่มพัก (Auto-Stop)" });
            }

            // Sort events by time
            const upcoming = events
                .filter(e => e.time > currentTime)
                .sort((a, b) => a.time.localeCompare(b.time))[0];

            if (upcoming) {
                const [h, m, s] = upcoming.time.split(':').map(Number);
                const eventDate = new Date();
                eventDate.setHours(h, m, s || 0);

                const diffMs = eventDate.getTime() - now.getTime();
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins >= 0 && diffMins <= 60) {
                    setTimeLeft(`(เหลืออีก ${diffMins} นาทีจะ ${upcoming.label})`);
                } else {
                    setTimeLeft(null);
                }
            } else {
                setTimeLeft(null);
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 30000);
        return () => clearInterval(timer);
    }, [schedule]);

    if (isLoading || !schedule || plantId === "all") return null;

    return (
        <div className={cn("space-y-3", className)}>
            <Alert className="bg-primary/5 border-primary/20 shadow-sm">
                <Clock className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-bold flex items-center gap-2">
                    ตารางกะทำงานปัจจุบัน: {schedule.shift_name}
                </AlertTitle>
                <AlertDescription className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 mt-1">
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground text-sm">เวลาเลิกกะ:</span>
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                            {schedule.end_time.substring(0, 5)} น.
                        </span>
                    </div>

                    {schedule.break_start_time && (
                        <div className="flex items-center gap-1.5 border-l border-border/50 pl-6">
                            <Coffee className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-medium text-foreground text-sm">เวลาพักกลางวัน:</span>
                            <span className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded text-xs font-bold">
                                {schedule.break_start_time.substring(0, 5)} - {schedule.break_end_time?.substring(0, 5)} น.
                            </span>
                        </div>
                    )}
                </AlertDescription>
            </Alert>

            {timeLeft && (
                <Alert variant="destructive" className="animate-pulse bg-destructive/5 border-destructive/30">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-bold">แจ้งเตือนระบบ Auto-Stop!</AlertTitle>
                    <AlertDescription className="font-medium">
                        ระบบจะทำการหยุดเครื่องจักรอัตโนมัติ {timeLeft} โปรดบันทึกงานให้เรียบร้อย
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
