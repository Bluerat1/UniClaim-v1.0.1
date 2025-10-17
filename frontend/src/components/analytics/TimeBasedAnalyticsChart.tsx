import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsData } from '@/services/firebase/analytics';

interface TimeBasedAnalyticsChartProps {
  data: AnalyticsData[];
  period: 'weekly' | 'monthly' | 'yearly';
  title: string;
  className?: string;
}

const TimeBasedAnalyticsChart: React.FC<TimeBasedAnalyticsChartProps> = ({
  data,
  period,
  title,
  className = ""
}) => {
  // Format data for chart display
  const chartData = data.map(item => {
    let formattedDate = item.date;

    // Format the date based on the period
    if (period === 'weekly') {
      // For weekly data, format as "Week of MMM dd, yyyy"
      try {
        const date = parseISO(item.date + '-1'); // Add day to make it parseable
        formattedDate = `Week of ${format(date, 'MMM dd, yyyy')}`;
      } catch (error) {
        formattedDate = item.date;
      }
    } else if (period === 'monthly') {
      // For monthly data, format as "MMM yyyy"
      try {
        const date = parseISO(item.date + '-01');
        formattedDate = format(date, 'MMM yyyy');
      } catch (error) {
        formattedDate = item.date;
      }
    } else if (period === 'yearly') {
      // For yearly data, just use the year
      formattedDate = item.date;
    }

    return {
      date: formattedDate,
      lost: item.lost,
      found: item.found,
      total: item.total,
      period: item.period
    };
  });

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Choose chart type based on period
  const ChartComponent = period === 'yearly' ? BarChart : LineChart;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'Yearly'} post trends
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={period === 'weekly' ? -45 : 0}
                textAnchor={period === 'weekly' ? 'end' : 'middle'}
                height={period === 'weekly' ? 60 : 30}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {period !== 'yearly' && (
                <>
                  <Line
                    type="monotone"
                    dataKey="lost"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Lost Items"
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="found"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Found Items"
                    dot={{ r: 4 }}
                  />
                </>
              )}

              {period === 'yearly' && (
                <>
                  <Bar
                    dataKey="lost"
                    fill="#ef4444"
                    name="Lost Items"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="found"
                    fill="#22c55e"
                    name="Found Items"
                    radius={[2, 2, 0, 0]}
                  />
                </>
              )}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeBasedAnalyticsChart;
