import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DowntimeData {
  reason: string;
  minutes: number;
  percentage: number;
  cumulative: number;
}

interface ParetoChartProps {
  data: DowntimeData[];
  title?: string;
  isLoading?: boolean;
}

function ChartSkeleton() {
  return (
    <div className="h-[300px] flex flex-col">
      <div className="flex-1 flex items-end gap-2 px-8 pb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <Skeleton 
              className="w-full rounded-t" 
              style={{ height: `${90 - i * 12}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-3" />
        ))}
      </div>
    </div>
  );
}

export function ParetoChart({ data, title = 'Pareto Downtime Analysis', isLoading }: ParetoChartProps) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <CardTitle className="text-base sm:text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <ChartSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <CardTitle className="text-base sm:text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No downtime data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="text-base sm:text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="reason"
                angle={-45}
                textAnchor="end"
                interval={0}
                height={80}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                label={{ value: 'Cumulative %', angle: 90, position: 'insideRight', style: { fill: 'hsl(var(--muted-foreground))' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  color: 'hsl(var(--popover-foreground))',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'minutes') return [`${value} min`, 'Downtime'];
                  if (name === 'cumulative') return [`${value.toFixed(1)}%`, 'Cumulative'];
                  return [value, name];
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="minutes"
                fill="hsl(var(--status-stopped))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--oee-overall))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--oee-overall))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
