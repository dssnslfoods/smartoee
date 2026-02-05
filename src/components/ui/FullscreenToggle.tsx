 import { Maximize2, Minimize2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 import { motion } from 'framer-motion';
 import { ReactNode } from 'react';
 
 interface FullscreenToggleProps {
   isFullscreen: boolean;
   onToggle: () => void;
   className?: string;
 }
 
 interface FullscreenContainerProps {
   isFullscreen: boolean;
   children: ReactNode;
 }
 
 export function FullscreenToggle({ isFullscreen, onToggle, className }: FullscreenToggleProps) {
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
       title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
     >
       {isFullscreen ? (
         <Minimize2 className="h-4 w-4 text-primary" />
       ) : (
         <Maximize2 className="h-4 w-4 text-primary" />
       )}
     </Button>
   );
 }
 
 export function FullscreenContainer({ isFullscreen, children }: FullscreenContainerProps) {
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
       {children}
     </motion.div>
   );
 }