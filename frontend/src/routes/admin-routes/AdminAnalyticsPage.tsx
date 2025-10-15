import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import type { Post } from "@/types/Post";
// AdminLayout is used by the router, no need to import it here
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Simple Tabs implementation
interface TabComponentProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

const Tabs = ({ children, className = "" }: TabComponentProps) => (
  <div className={`tabs ${className}`} data-tabs>
    {children}
  </div>
);

const TabsList = ({ children, className = "" }: TabComponentProps) => (
  <div className={`flex border-b mb-4 ${className}`}>{children}</div>
);

const TabsTrigger = ({
  value,
  children,
  className = "",
  ...props
}: TabComponentProps & { value: string }) => (
  <button
    className={`px-4 py-2 font-medium text-sm border-b-2 border-transparent hover:border-gray-300 ${className}`}
    data-tab-trigger={value}
    {...props}
  >
    {children}
  </button>
);

const TabsContent = ({
  value,
  children,
  className = "",
}: TabComponentProps & { value: string }) => (
  <div data-tab-content={value} className={`mt-4 ${className}`}>
    {children}
  </div>
);
import PostsOverTimeChart from "@/components/analytics/PostsOverTimeChart";
import CategoryDistributionChart from "@/components/analytics/CategoryDistributionChart";
import StatusDistributionChart from "@/components/analytics/StatusDistributionChart";
import DateRangeSelector from "@/components/analytics/DateRangeSelector";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const AdminAnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  // Active tab is managed by the Tabs component internally
  // We don't need to track it in state since we're not using it elsewhere
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: subDays(new Date(), 29),
    end: new Date(),
  });

  // Fetch posts from Firestore
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const postsCollection = collection(db, "posts");

        // Create a query with ordering by createdAt
        const q = query(postsCollection, orderBy("createdAt", "desc"));

        const postsSnapshot = await getDocs(q);
        const postsData = postsSnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Post)
        );

        setPosts(postsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching posts:", error);
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Filter posts based on date range
  useEffect(() => {
    if (!dateRange.start || !dateRange.end) {
      setFilteredPosts(posts);
      return;
    }

    const filtered = posts.filter((post) => {
      if (!post.createdAt) return false;

      const postDate = post.createdAt.toDate
        ? post.createdAt.toDate()
        : new Date(post.createdAt);

      return (
        postDate >= startOfDay(dateRange.start as Date) &&
        postDate <= endOfDay(dateRange.end as Date)
      );
    });

    setFilteredPosts(filtered);
  }, [posts, dateRange]);

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (start: Date | null, end: Date | null) => {
      setDateRange({ start, end });
    },
    []
  );

  // Calculate basic statistics
  const displayPosts = filteredPosts.length > 0 ? filteredPosts : posts;
  const totalPosts = displayPosts.length;
  const lostItems = displayPosts.filter((post) => post.type === "lost").length;
  const foundItems = displayPosts.filter(
    (post) => post.type === "found"
  ).length;
  const resolvedItems = displayPosts.filter(
    (post) => post.status === "resolved"
  ).length;
  const resolutionRate =
    totalPosts > 0 ? Math.round((resolvedItems / totalPosts) * 100) : 0;

  // Date range display text
  const dateRangeText =
    dateRange.start && dateRange.end
      ? `${format(dateRange.start, "MMM d, yyyy")} - ${format(
          dateRange.end,
          "MMM d, yyyy"
        )}`
      : "All time";

  // Prepare data for charts with proper typing
  const chartPosts = displayPosts.map((post) => {
    // Safely handle createdAt date
    let postDate: Date;
    try {
      if (post.createdAt) {
        postDate = post.createdAt.toDate
          ? post.createdAt.toDate()
          : new Date(post.createdAt);
      } else {
        postDate = new Date();
      }
    } catch (error) {
      console.error("Error parsing post date:", error, post);
      postDate = new Date();
    }

    return {
      ...post,
      // Ensure we have default values for required fields
      createdAt: postDate,
      status: post.status || "unknown",
      type: post.type || "unknown",
      category: post.category || "uncategorized",
    };
  });

  // Simple loading component
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-xl font-bold">Analytics Dashboard</h1>
          <div className="mt-2 md:mt-0 text-sm text-gray-500">
            {dateRangeText} • {totalPosts} total posts
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8">
          <DateRangeSelector onDateRangeChange={handleDateRangeChange} />
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPosts}</div>
              <p className="text-xs text-muted-foreground">
                Total items reported
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lost Items</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lostItems}</div>
              <p className="text-xs text-muted-foreground">
                Items reported as lost
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Found Items</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{foundItems}</div>
              <p className="text-xs text-muted-foreground">
                Items reported as found
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Resolution Rate
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resolutionRate}%</div>
              <p className="text-xs text-muted-foreground">
                Of items successfully resolved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different analytics views */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Posts Over Time</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  {loading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <PostsOverTimeChart
                      posts={displayPosts}
                      timeRange={dateRange.start ? "30d" : "all"}
                    />
                  )}
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <StatusDistributionChart posts={chartPosts} />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Category Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-[400px] flex items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <CategoryDistributionChart posts={chartPosts} />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Category Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Distribution of posts by category
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <CategoryDistributionChart posts={displayPosts} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Posts Timeline</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Posts created over time
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[400px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                  </div>
                ) : (
                  <div className="h-[500px]">
                    <PostsOverTimeChart
                      posts={displayPosts}
                      timeRange={dateRange.start ? "30d" : "all"}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Location Analysis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Posts by location
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] flex flex-col items-center justify-center bg-gray-50 rounded-md p-4">
                  <p className="text-muted-foreground mb-4">
                    Location heatmap will be implemented in a future update
                  </p>
                  <div className="w-full h-full flex items-center justify-center bg-white border rounded-lg">
                    <p className="text-gray-400">
                      Map visualization coming soon
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
