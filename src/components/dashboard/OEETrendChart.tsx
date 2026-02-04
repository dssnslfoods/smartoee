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
}

export function OEETrendChart({ data, title = 'OEE Trend' }: OEETrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
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
