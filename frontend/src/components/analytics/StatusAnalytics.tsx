import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDistributionChart } from "./charts/StatusDistributionChart";
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
      const rawStatus = post.status?.toLowerCase() || "pending";
      const normalizedStatus = rawStatus === "completed" ? "resolved" : rawStatus;
      if (normalizedStatus in counts) {
        counts[normalizedStatus as keyof typeof counts]++;
      } else {
        counts.other++;
      }
    });

    return Object.entries(counts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: posts.length ? (count / posts.length) * 100 : 0,
    })).filter(({ count }) => count > 0 || posts.length === 0);
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
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>Visual representation of item status distribution</CardDescription>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Status Breakdown</CardTitle>
          <CardDescription>Detailed statistics of items by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm font-medium text-muted-foreground border-b">
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4 text-right">Count</th>
                  <th className="pb-3 px-4 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {statusCounts.map(({ status, count, percentage }) => (
                  <tr key={status} className="hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{status}</td>
                    <td className="py-3 px-4 text-right">{count}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
