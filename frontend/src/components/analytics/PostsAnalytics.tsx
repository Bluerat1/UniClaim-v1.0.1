import React from "react";
import type { Post } from "@/types/Post";
import { PostsOverTimeChart } from "@/components/analytics/charts/PostsOverTimeChart";
import DateRangeSelector from "./DateRangeSelector";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardDescription } from "@/components/ui/card";

export type DateRangeType = DateRange;

interface PostsAnalyticsProps {
  posts: Post[];
  loading: boolean;
  dateRange: DateRangeType | undefined;
  onDateRangeChange: (range: DateRangeType) => void;
}

export const PostsAnalytics: React.FC<PostsAnalyticsProps> = ({
  posts,
  loading,
  dateRange,
  onDateRangeChange,
}) => {
  const handleDateRangeChange = (startDate: Date | null, endDate: Date | null) => {
    onDateRangeChange({ 
      from: startDate || undefined, 
      to: endDate || undefined 
    });
  };
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-lg">Posts Over Time</CardTitle>
          <CardDescription>Track how lost and found reports trend across the selected period.</CardDescription>
        </div>
        <DateRangeSelector onDateRangeChange={handleDateRangeChange} className="md:w-auto" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/20 p-4">
          <PostsOverTimeChart posts={posts} dateRange={dateRange} loading={loading} />
        </div>
        <div>
          <h3 className="text-md font-medium mb-2">Recent Activity</h3>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading recent activity...</p>
            ) : posts.length > 0 ? (
              <ul className="space-y-2">
                {posts.slice(0, 5).map((post) => (
                  <li
                    key={post.id}
                    className="flex items-center justify-between rounded-lg border bg-card/60 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {post.type === "lost" ? "Lost" : "Found"}: {post.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : "Unknown date"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium capitalize rounded-full ${
                        post.status === "resolved"
                          ? "bg-emerald-100 text-emerald-700"
                          : post.status === "completed"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {post.status || "pending"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No posts found in the selected date range.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
