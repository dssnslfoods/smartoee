import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendData {
  date: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

interface OEETrendChartProps {
  data: TrendData[];
  title?: string;
  isLoading?: boolean;
}

function TrendChartSkeleton() {
  return (
    <div className="h-[300px] flex flex-col">
      <div className="flex-1 flex items-end gap-4 px-8 pb-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1 items-center">
            <Skeleton className="w-2 h-2 rounded-full" style={{ marginBottom: `${20 + Math.random() * 40}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-8 justify-center">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function OEETrendChart({ data, title = 'OEE Trend', isLoading }: OEETrendChartProps) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <CardTitle className="text-base sm:text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <TrendChartSkeleton />
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
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="availability"
                stroke="hsl(var(--oee-availability))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--oee-availability))' }}
                name="Availability"
              />
              <Line
                type="monotone"
                dataKey="performance"
                stroke="hsl(var(--oee-performance))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--oee-performance))' }}
                name="Performance"
              />
              <Line
                type="monotone"
                dataKey="quality"
                stroke="hsl(var(--oee-quality))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--oee-quality))' }}
                name="Quality"
              />
              <Line
                type="monotone"
                dataKey="oee"
                stroke="hsl(var(--oee-overall))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--oee-overall))' }}
                name="OEE"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
