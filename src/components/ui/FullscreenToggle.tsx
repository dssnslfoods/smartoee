 import { Maximize2, Minimize2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 
 interface FullscreenToggleProps {
   isFullscreen: boolean;
   onToggle: () => void;
   className?: string;
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