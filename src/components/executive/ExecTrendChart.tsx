import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExecTrendPoint } from '@/hooks/useExecutiveData';

interface ExecTrendChartProps {
  data: ExecTrendPoint[];
  target?: number;
  isLoading: boolean;
  className?: string;
}

export function ExecTrendChart({ data, target, isLoading, className }: ExecTrendChartProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            OEE Trend &amp; Stability
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0;

  // Determine direction
  let direction = '';
  if (hasData && data.length >= 2) {
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const firstAvg = firstHalf.reduce((s, d) => s + d.oee, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.oee, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 2) direction = 'Trending Up';
    else if (diff < -2) direction = 'Trending Down';
    else direction = 'Stable';
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          OEE Trend &amp; Stability
        </CardTitle>
        {direction && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            direction === 'Trending Up' ? 'bg-status-running/15 text-status-running' :
            direction === 'Trending Down' ? 'bg-status-stopped/15 text-status-stopped' :
            'bg-muted text-muted-foreground'
          }`}>
            {direction}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No trend data available
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                />
                {target && target > 0 && (
                  <ReferenceLine
                    y={target}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="6 3"
                    strokeOpacity={0.5}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="oee"
                  stroke="hsl(var(--oee-overall))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--oee-overall))' }}
                  name="OEE"
                />
                <Line
                  type="monotone"
                  dataKey="availability"
                  stroke="hsl(var(--oee-availability))"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Availability"
                />
                <Line
                  type="monotone"
                  dataKey="performance"
                  stroke="hsl(var(--oee-performance))"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Performance"
                />
                <Line
                  type="monotone"
                  dataKey="quality"
                  stroke="hsl(var(--oee-quality))"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Quality"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
