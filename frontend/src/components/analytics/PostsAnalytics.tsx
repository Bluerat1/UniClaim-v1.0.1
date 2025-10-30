import React from "react";
import type { Post } from "@/types/Post";
import { PostsOverTimeChart } from "@/components/analytics/charts/PostsOverTimeChart";
import DateRangeSelector from "./DateRangeSelector";
import type { DateRange } from "react-day-picker";

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
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Posts Over Time</h2>
        <DateRangeSelector
          onDateRangeChange={handleDateRangeChange}
          className="mb-6"
        />
      </div>
      
      <div className="rounded-lg border bg-card p-4">
        <PostsOverTimeChart 
          posts={posts} 
          dateRange={dateRange} 
          loading={loading} 
        />
      </div>
      
      <div className="mt-4">
        <h3 className="text-md font-medium mb-2">Recent Activity</h3>
        <div className="space-y-2">
          {loading ? (
            <p>Loading recent activity...</p>
          ) : posts.length > 0 ? (
            <ul className="space-y-2">
              {posts.slice(0, 5).map((post) => (
                <li key={post.id} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <div>
                    <p className="font-medium">
                      {post.type === 'lost' ? 'Lost' : 'Found'}: {post.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {post.createdAt?.toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    post.status === 'resolved' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {post.status || 'pending'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No posts found in the selected date range.</p>
          )}
        </div>
      </div>
    </div>
  );
};
