import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryCounts.slice(0, 5).map(({ category, total, percentage }) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {category}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{total}</span>
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
              <CardTitle className="text-lg">Category Distribution</CardTitle>
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
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Lost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Found
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {categoryCounts.map(({ category, total, lost, found, percentage }) => (
                <tr key={category} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {total}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {lost}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {found}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
