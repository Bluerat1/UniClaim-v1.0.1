import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDistributionChart } from "./charts/StatusDistributionChart.tsx";
import type { DateRange } from 'react-day-picker';
import type { Post } from "@/types/Post";

interface StatusAnalyticsProps {
  posts: Post[];
  loading: boolean;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export const StatusAnalytics: React.FC<StatusAnalyticsProps> = ({
  posts,
  loading,
  dateRange,
}) => {
  // Count posts by status
  const statusCounts = React.useMemo(() => {
    const counts = {
      pending: 0,
      claimed: 0,
      resolved: 0,
      rejected: 0,
      expired: 0,
      other: 0,
    };
    
    posts.forEach((post) => {
      const status = post.status?.toLowerCase() || 'pending';
      if (status in counts) {
        counts[status as keyof typeof counts]++;
      } else {
        counts.other++;
      }
    });
    
    return Object.entries(counts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: (count / posts.length) * 100,
    }));
  }, [posts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading status data...</div>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available for the selected date range.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statusCounts.map(({ status, count, percentage }) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {status}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{count}</span>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <StatusDistributionChart 
                  posts={posts} 
                  dateRange={dateRange} 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Status Breakdown</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statusCounts.map(({ status, count, percentage }) => (
            <Card key={status} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{status}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                  {percentage.toFixed(1)}% of total
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full" 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
