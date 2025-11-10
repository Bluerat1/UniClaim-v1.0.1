import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FiChevronDown,
  FiChevronUp,
  FiPackage,
  FiCheckSquare,
  FiAlertTriangle,
} from "react-icons/fi";
import { usePostsAnalytics } from "@/hooks/analytics/usePostsAnalytics";
import { PostsAnalytics } from "@/components/analytics/PostsAnalytics";
import { CategoryAnalytics } from "@/components/analytics/CategoryAnalytics";
import { StatusAnalytics } from "@/components/analytics/StatusAnalytics";
import { DataExport } from "@/components/analytics/DataExport";
import type { DateRange } from "react-day-picker";

export const AnalyticsDashboard: React.FC = () => {
  const { posts, loading, dateRange, setDateRange, stats } =
    usePostsAnalytics();

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range || { from: undefined, to: undefined });
  };
  const [isOverviewVisible, setIsOverviewVisible] = React.useState(true);

  return (
    <div className="space-y-4 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Analytics Dashboard</h1>
        <button
          onClick={() => setIsOverviewVisible(!isOverviewVisible)}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 self-end sm:self-auto"
        >
          {isOverviewVisible ? (
            <>
              <span>Hide Overview</span>
              <FiChevronUp className="ml-1" />
            </>
          ) : (
            <>
              <span>Show Overview</span>
              <FiChevronDown className="ml-1" />
            </>
          )}
        </button>
      </div>

      {isOverviewVisible && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <FiPackage className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
              <p className="text-xs text-muted-foreground">
                Total posts in the system
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lost Items</CardTitle>
              <FiAlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.lostItems}</div>
              <p className="text-xs text-muted-foreground">
                Items reported as lost
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Found Items</CardTitle>
              <FiPackage className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.foundItems}</div>
              <p className="text-xs text-muted-foreground">
                Items reported as found
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <FiCheckSquare className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.resolvedItems} / {stats.totalPosts}
              </div>
              <p className="text-xs text-muted-foreground">Resolved items</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="posts" className="space-y-4 -mx-2 sm:mx-0">
        <div className="px-2 sm:px-0">
          <TabsList>
            <TabsTrigger value="posts">Posts Over Time</TabsTrigger>
            <TabsTrigger value="categories">Category Distribution</TabsTrigger>
            <TabsTrigger value="status">Status Distribution</TabsTrigger>
            <TabsTrigger value="export">Export Data</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            <PostsAnalytics
              posts={posts}
              loading={loading}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategoryAnalytics
              posts={posts}
              loading={loading}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <StatusAnalytics
              posts={posts}
              loading={loading}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <DataExport posts={posts} loading={loading} dateRange={dateRange} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
