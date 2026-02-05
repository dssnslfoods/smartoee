 import { useState, useEffect } from 'react';
 import { Clock, RefreshCw } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface KioskClockProps {
   refreshInterval?: number; // in seconds
   className?: string;
 }
 
 export function KioskClock({ refreshInterval = 30, className }: KioskClockProps) {
   const [currentTime, setCurrentTime] = useState(new Date());
   const [countdown, setCountdown] = useState(refreshInterval);
 
   // Update current time every second
   useEffect(() => {
     const timer = setInterval(() => {
       setCurrentTime(new Date());
     }, 1000);
 
     return () => clearInterval(timer);
   }, []);
 
   // Countdown timer
   useEffect(() => {
     setCountdown(refreshInterval);
     
     const timer = setInterval(() => {
       setCountdown(prev => {
         if (prev <= 1) {
           return refreshInterval;
         }
         return prev - 1;
       });
     }, 1000);
 
     return () => clearInterval(timer);
   }, [refreshInterval]);
 
   const formatTime = (date: Date) => {
     return date.toLocaleTimeString('th-TH', {
       hour: '2-digit',
       minute: '2-digit',
       second: '2-digit',
       hour12: false,
     });
   };
 
   const formatDate = (date: Date) => {
     return date.toLocaleDateString('th-TH', {
       weekday: 'short',
       day: 'numeric',
       month: 'short',
       year: 'numeric',
     });
   };
 
   // Calculate progress percentage for the circular indicator
   const progress = ((refreshInterval - countdown) / refreshInterval) * 100;
 
   return (
     <div className={cn(
       'flex items-center gap-4 px-4 py-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50',
       'shadow-[0_0_20px_-5px_hsl(var(--primary)/0.2)]',
       className
     )}>
       {/* Current Time */}
       <div className="flex items-center gap-2">
         <Clock className="h-4 w-4 text-primary" />
         <div className="text-right">
           <div className="text-lg font-bold tabular-nums text-foreground">
             {formatTime(currentTime)}
           </div>
           <div className="text-xs text-muted-foreground">
             {formatDate(currentTime)}
           </div>
         </div>
       </div>
 
       {/* Divider */}
       <div className="h-8 w-px bg-border/50" />
 
       {/* Refresh Countdown */}
       <div className="flex items-center gap-2">
         <div className="relative h-8 w-8">
           {/* Background circle */}
           <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
             <circle
               cx="16"
               cy="16"
               r="14"
               fill="none"
               stroke="hsl(var(--muted))"
               strokeWidth="2"
             />
             <circle
               cx="16"
               cy="16"
               r="14"
               fill="none"
               stroke="hsl(var(--primary))"
               strokeWidth="2"
               strokeLinecap="round"
               strokeDasharray={`${(progress / 100) * 88} 88`}
               className="transition-all duration-1000 ease-linear"
             />
           </svg>
           <RefreshCw className="absolute inset-0 m-auto h-3.5 w-3.5 text-primary" />
         </div>
         <div className="text-right">
           <div className="text-sm font-semibold tabular-nums text-foreground">
             {countdown}s
           </div>
           <div className="text-xs text-muted-foreground">
             refresh
           </div>
         </div>
       </div>
     </div>
   );
 }