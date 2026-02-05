 import { Maximize2, Minimize2, Tv, MonitorPlay } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 import { motion } from 'framer-motion';
 import { ReactNode } from 'react';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import type { FullscreenMode } from '@/hooks/useFullscreen';
 import { KioskClock } from './KioskClock';
 
 interface FullscreenToggleProps {
   isFullscreen: boolean;
   isKiosk?: boolean;
   onToggle: () => void;
   onEnterKiosk?: () => void;
   onEnterFullscreen?: () => void;
   className?: string;
 }
 
 interface FullscreenContainerProps {
   isFullscreen: boolean;
   isKiosk?: boolean;
   refreshInterval?: number;
   children: ReactNode;
 }
 
 export function FullscreenToggle({ 
   isFullscreen, 
   isKiosk,
   onToggle, 
   onEnterKiosk,
   onEnterFullscreen,
   className 
 }: FullscreenToggleProps) {
   // If in fullscreen or kiosk mode, show exit button only
   if (isFullscreen) {
     return (
       <Button
         variant="outline"
         size="icon"
         onClick={onToggle}
         className={cn(
           'bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50 transition-all',
           'shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)]',
           className
         )}
         title="Exit Fullscreen (Esc)"
       >
         <Minimize2 className="h-4 w-4 text-primary" />
       </Button>
     );
   }
 
   // Normal mode - show dropdown with options
   return (
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <Button
           variant="outline"
           size="icon"
           className={cn(
             'bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/10 hover:border-primary/50 transition-all',
             'shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)]',
             className
           )}
           title="Display Mode"
         >
           <Maximize2 className="h-4 w-4 text-primary" />
         </Button>
       </DropdownMenuTrigger>
       <DropdownMenuContent align="end" className="w-48">
         <DropdownMenuItem onClick={onEnterFullscreen || onToggle} className="gap-2 cursor-pointer">
           <MonitorPlay className="h-4 w-4" />
           <div>
             <div className="font-medium">Fullscreen</div>
             <div className="text-xs text-muted-foreground">Show all controls</div>
           </div>
         </DropdownMenuItem>
         <DropdownMenuItem onClick={onEnterKiosk} className="gap-2 cursor-pointer">
           <Tv className="h-4 w-4" />
           <div>
             <div className="font-medium">TV / Kiosk Mode</div>
             <div className="text-xs text-muted-foreground">Data only, no controls</div>
           </div>
         </DropdownMenuItem>
       </DropdownMenuContent>
     </DropdownMenu>
   );
 }
 
 export function FullscreenContainer({ isFullscreen, isKiosk, refreshInterval = 30, children }: FullscreenContainerProps) {
   if (!isFullscreen) {
     return <>{children}</>;
   }
 
   return (
     <motion.div
       initial={{ opacity: 0, scale: 0.95 }}
       animate={{ opacity: 1, scale: 1 }}
       exit={{ opacity: 0, scale: 0.95 }}
       transition={{ 
         duration: 0.3, 
         ease: [0.4, 0, 0.2, 1]
       }}
       className="fixed inset-0 z-50 overflow-auto bg-background dark"
     >
       {/* Backdrop flash effect */}
       <motion.div
         initial={{ opacity: 1 }}
         animate={{ opacity: 0 }}
         transition={{ duration: 0.5, delay: 0.1 }}
         className="absolute inset-0 bg-primary/5 pointer-events-none"
       />
       {/* Kiosk mode clock and refresh countdown */}
       {isKiosk && (
         <motion.div
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.3, delay: 0.2 }}
           className="absolute top-4 right-4 z-50"
         >
           <KioskClock refreshInterval={refreshInterval} />
         </motion.div>
       )}
       {/* Exit hint - shows briefly then fades */}
       {isKiosk && (
         <motion.div
           initial={{ opacity: 1 }}
           animate={{ opacity: 0 }}
           transition={{ duration: 0.5, delay: 5 }}
           className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground font-medium"
         >
           <Tv className="h-3 w-3" />
           Press ESC to exit TV Mode
         </motion.div>
       )}
       {children}
     </motion.div>
   );
 }