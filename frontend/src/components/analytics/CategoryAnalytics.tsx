import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryDistributionChart } from "./charts/CategoryDistributionChart";
import type { DateRange } from 'react-day-picker';
import type { Post } from "@/types/Post";

interface CategoryAnalyticsProps {
  posts: Post[];
  loading: boolean;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export const CategoryAnalytics: React.FC<CategoryAnalyticsProps> = ({
  posts,
  loading,
  dateRange,
}) => {
  // Count posts by category
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, { total: number; lost: number; found: number }> = {};
    
    posts.forEach((post) => {
      const category = post.category || 'Uncategorized';
      if (!counts[category]) {
        counts[category] = { total: 0, lost: 0, found: 0 };
      }
      
      counts[category].total += 1;
      if (post.type === 'lost') {
        counts[category].lost += 1;
      } else if (post.type === 'found') {
        counts[category].found += 1;
      }
    });
    
    return Object.entries(counts)
      .map(([category, { total, lost, found }]) => ({
        category,
        total,
        lost,
        found,
        percentage: (total / posts.length) * 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [posts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading category data...</div>
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
          <CardTitle>Category Distribution</CardTitle>
          <CardDescription>Visual representation of lost and found items by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <CategoryDistributionChart 
              posts={posts} 
              dateRange={dateRange} 
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
          <CardDescription>Detailed statistics of lost and found items by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm font-medium text-muted-foreground border-b">
                  <th className="pb-3 px-4">Category</th>
                  <th className="pb-3 px-4 text-right">Total</th>
                  <th className="pb-3 px-4 text-right">Lost</th>
                  <th className="pb-3 px-4 text-right">Found</th>
                  <th className="pb-3 px-4 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categoryCounts.map(({ category, total, lost, found, percentage }) => (
                  <tr key={category} className="hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{category}</td>
                    <td className="py-3 px-4 text-right">{total}</td>
                    <td className="py-3 px-4 text-right">{lost}</td>
                    <td className="py-3 px-4 text-right">{found}</td>
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
