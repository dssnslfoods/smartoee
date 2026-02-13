 import { cn } from '@/lib/utils';
 
 interface OEEGaugeProps {
   value: number;
   label: string;
   color: 'availability' | 'performance' | 'quality' | 'overall';
   size?: 'sm' | 'md' | 'lg';
 }
 
 const colorConfig = {
   availability: {
     stroke: 'stroke-oee-availability',
     text: 'text-oee-availability',
     glow: 'drop-shadow-[0_0_8px_hsl(var(--oee-availability))]',
   },
   performance: {
     stroke: 'stroke-oee-performance',
     text: 'text-oee-performance',
     glow: 'drop-shadow-[0_0_8px_hsl(var(--oee-performance))]',
   },
   quality: {
     stroke: 'stroke-oee-quality',
     text: 'text-oee-quality',
     glow: 'drop-shadow-[0_0_8px_hsl(var(--oee-quality))]',
   },
   overall: {
     stroke: 'stroke-oee-overall',
     text: 'text-oee-overall',
     glow: 'drop-shadow-[0_0_8px_hsl(var(--oee-overall))]',
   },
 };
 
 const sizeConfig = {
   sm: { size: 72, stroke: 6, text: 'text-sm font-bold', label: 'text-[10px]', tickLength: 4 },
   md: { size: 140, stroke: 10, text: 'text-2xl font-bold', label: 'text-xs', tickLength: 6 },
   lg: { size: 180, stroke: 12, text: 'text-3xl font-bold', label: 'text-sm', tickLength: 8 },
 };
 
 export function OEEGauge({ value, label, color, size = 'md' }: OEEGaugeProps) {
   const { size: gaugeSize, stroke, text, label: labelSize, tickLength } = sizeConfig[size];
   const { stroke: strokeClass, text: textClass, glow } = colorConfig[color];
   
   const centerX = gaugeSize / 2;
   const centerY = gaugeSize / 2;
   const radius = (gaugeSize - stroke - 8) / 2;
   
   // Arc spans from -135 to +135 degrees (270 degree arc)
   const startAngle = -225;
   const endAngle = 45;
   const totalAngle = endAngle - startAngle;
   
   // Calculate arc path
   const polarToCartesian = (angle: number, r: number) => {
     const rad = (angle * Math.PI) / 180;
     return {
       x: centerX + r * Math.cos(rad),
       y: centerY + r * Math.sin(rad),
     };
   };
   
   const arcPath = (startA: number, endA: number, r: number) => {
     const start = polarToCartesian(startA, r);
     const end = polarToCartesian(endA, r);
     const largeArc = Math.abs(endA - startA) > 180 ? 1 : 0;
     return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
   };
   
   // Value arc
   const clampedValue = Math.min(100, Math.max(0, value));
   const valueAngle = startAngle + (clampedValue / 100) * totalAngle;
   
   // Generate tick marks
   const ticks = [];
   const tickCount = 11; // 0, 10, 20, ... 100
   for (let i = 0; i < tickCount; i++) {
     const tickAngle = startAngle + (i / (tickCount - 1)) * totalAngle;
     const isMajor = i % 2 === 0;
     const innerR = radius - (isMajor ? tickLength * 1.5 : tickLength);
     const outerR = radius + 2;
     const inner = polarToCartesian(tickAngle, innerR);
     const outer = polarToCartesian(tickAngle, outerR);
     ticks.push({ inner, outer, isMajor, value: i * 10 });
   }
 
   return (
     <div className="flex flex-col items-center">
       <div className="relative" style={{ width: gaugeSize, height: gaugeSize }}>
         <svg
           width={gaugeSize}
           height={gaugeSize}
           className="transition-all duration-300"
         >
           {/* Background track */}
           <path
             d={arcPath(startAngle, endAngle, radius)}
             fill="none"
             stroke="currentColor"
             strokeWidth={stroke}
             strokeLinecap="round"
             className="text-muted/30"
           />
           
           {/* Tick marks */}
           {ticks.map((tick, i) => (
             <line
               key={i}
               x1={tick.inner.x}
               y1={tick.inner.y}
               x2={tick.outer.x}
               y2={tick.outer.y}
               stroke="currentColor"
               strokeWidth={tick.isMajor ? 2 : 1}
               className={tick.isMajor ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}
             />
           ))}
           
           {/* Value arc with glow */}
           {clampedValue > 0 && (
             <path
               d={arcPath(startAngle, valueAngle, radius)}
               fill="none"
               strokeWidth={stroke}
               strokeLinecap="round"
               className={cn(strokeClass, 'transition-all duration-700 ease-out')}
               style={{
                 filter: 'drop-shadow(0 0 6px currentColor)',
               }}
             />
           )}
           
           {/* Needle indicator */}
           {(() => {
             const needleAngle = valueAngle;
             const needleTip = polarToCartesian(needleAngle, radius - stroke / 2 - 4);
             const needleBase1 = polarToCartesian(needleAngle - 90, 4);
             const needleBase2 = polarToCartesian(needleAngle + 90, 4);
             return (
               <polygon
                 points={`${needleTip.x},${needleTip.y} ${centerX + needleBase1.x - centerX},${centerY + needleBase1.y - centerY} ${centerX + needleBase2.x - centerX},${centerY + needleBase2.y - centerY}`}
                 className={cn(strokeClass.replace('stroke-', 'fill-'), 'transition-all duration-700')}
                 style={{
                   transformOrigin: `${centerX}px ${centerY}px`,
                   filter: 'drop-shadow(0 0 4px currentColor)',
                 }}
               />
             );
           })()}
           
           {/* Center hub */}
           <circle
             cx={centerX}
             cy={centerY}
             r={size === 'sm' ? 6 : size === 'md' ? 10 : 14}
             className="fill-card stroke-border"
             strokeWidth={2}
           />
         </svg>
         
         {/* Center value text */}
         <div 
           className="absolute inset-0 flex flex-col items-center justify-center"
           style={{ paddingTop: gaugeSize * 0.15 }}
         >
           <span className={cn('tabular-nums tracking-tight', text, textClass)}>
             {value.toFixed(1)}%
           </span>
         </div>
       </div>
       
       {label && (
         <span className={cn('mt-1 font-medium text-muted-foreground uppercase tracking-wider', labelSize)}>
           {label}
         </span>
       )}
     </div>
   );
 }