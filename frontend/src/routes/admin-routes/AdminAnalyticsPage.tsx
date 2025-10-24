import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import PageWrapper from "../../components/PageWrapper";
import type { Post } from "@/types/Post";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NavHeader from "../../components/NavHeadComp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PostsOverTimeChart from "@/components/analytics/PostsOverTimeChart";
import CategoryDistributionChart from "@/components/analytics/CategoryDistributionChart";
import StatusDistributionChart from "@/components/analytics/StatusDistributionChart";
import DateRangeSelector from "@/components/analytics/DateRangeSelector";
import PostCreationLogbook from "@/components/analytics/PostCreationLogbook";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import * as ExcelJS from "exceljs";
import { Chart as ChartJS, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import html2canvas from "html2canvas";

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

  // Function to export category data to Excel with embedded chart image
  const exportCategoryDataToExcel = async () => {
    try {
      const categoryCounts: Record<string, number> = {};
      displayPosts.forEach((post) => {
        const category = post.category || "Uncategorized";
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      const data = Object.entries(categoryCounts).map(([category, count]) => ({
        Category: category,
        Count: count,
      }));

      if (data.length === 0) {
        console.warn("No data to export");
        return;
      }

      // Create a temporary div for the chart
      const chartDiv = document.createElement("div");
      chartDiv.style.position = "absolute";
      chartDiv.style.left = "-9999px";
      chartDiv.style.top = "-9999px";
      chartDiv.style.width = "800px";
      chartDiv.style.height = "400px";
      chartDiv.style.backgroundColor = "white"; // Ensure background for better capture
      document.body.appendChild(chartDiv);

      // Create canvas for Chart.js
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 400;
      chartDiv.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get canvas context");
        document.body.removeChild(chartDiv);
        return;
      }

      // Register Chart.js components
      ChartJS.register(...registerables);

      // Generate chart data
      const chartData = {
        labels: data.map((row) => row.Category),
        datasets: [
          {
            label: "Count",
            data: data.map((row) => row.Count),
            backgroundColor: "rgba(75, 192, 192, 0.6)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1,
          },
        ],
      };

      // Create Chart.js chart
      new ChartJS(ctx, {
        type: "bar",
        data: chartData,
        options: {
          responsive: false,
          plugins: {
            title: {
              display: true,
              text: "Category Distribution",
            },
          },
        },
      });

      // Wait for chart to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture the chart as an image
      const chartImage = await html2canvas(chartDiv, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
      });

      const chartBuffer = await new Promise<Uint8Array>((resolve, reject) => {
        chartImage.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer;
              resolve(new Uint8Array(arrayBuffer));
            };
            reader.onerror = () => reject(new Error("Failed to read blob"));
            reader.readAsArrayBuffer(blob);
          } else {
            reject(new Error("Failed to generate blob"));
          }
        });
      });

      console.log("Chart buffer generated:", chartBuffer.length);

      // Remove temporary div
      document.body.removeChild(chartDiv);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Category Analysis");

      // Add data to worksheet
      worksheet.addRow(["Category", "Count"]);
      data.forEach((row) => {
        worksheet.addRow([row.Category, row.Count]);
      });

      // Auto-fit columns
      worksheet.columns = [
        { key: "category", width: 20 },
        { key: "count", width: 10 },
      ];

      // Embed the chart image
      try {
        const imageId = workbook.addImage({
          buffer: chartBuffer,
          extension: "png",
        });

        worksheet.addImage(imageId, {
          tl: { col: 3, row: 1 },
          ext: { width: 400, height: 200 },
        });

        console.log("Image embedded successfully");
      } catch (imageError) {
        console.error("Failed to embed image:", imageError);
      }

      // Save and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `category_analysis_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  // Function to export timeline data to Excel with embedded chart
  const exportTimelineDataToExcel = async () => {
    try {
      // Group posts by date
      const postsByDate: Record<string, number> = {};
      displayPosts.forEach((post) => {
        if (post.createdAt) {
          let postDate: Date;
          try {
            postDate = post.createdAt.toDate
              ? post.createdAt.toDate()
              : new Date(post.createdAt);
            const date = postDate.toISOString().split("T")[0]; // YYYY-MM-DD format
            postsByDate[date] = (postsByDate[date] || 0) + 1;
          } catch (error) {
            console.error("Error processing date for post:", post.id, error);
          }
        }
      });

      const data = Object.entries(postsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ Date: date, Count: count }));

      if (data.length === 0) {
        console.warn("No data to export");
        return;
      }

      // Create a temporary div for the chart
      const chartDiv = document.createElement("div");
      chartDiv.style.position = "absolute";
      chartDiv.style.left = "-9999px";
      chartDiv.style.top = "-9999px";
      chartDiv.style.width = "800px";
      chartDiv.style.height = "400px";
      chartDiv.style.backgroundColor = "white";
      document.body.appendChild(chartDiv);

      // Create canvas for Chart.js
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 400;
      chartDiv.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get canvas context");
        document.body.removeChild(chartDiv);
        return;
      }

      // Register Chart.js components
      ChartJS.register(...registerables);

      // Generate chart data
      const chartData = {
        labels: data.map((row) => row.Date),
        datasets: [
          {
            label: "Posts",
            data: data.map((row) => row.Count),
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      };

      // Create Chart.js chart
      new ChartJS(ctx, {
        type: "bar",
        data: chartData,
        options: {
          responsive: false,
          plugins: {
            title: {
              display: true,
              text: "Posts Over Time",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });

      // Wait for chart to render
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture the chart as an image
      const chartImage = await html2canvas(chartDiv, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
      });

      const chartBuffer = await new Promise<Uint8Array>((resolve, reject) => {
        chartImage.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer;
              resolve(new Uint8Array(arrayBuffer));
            };
            reader.onerror = () => reject(new Error("Failed to read blob"));
            reader.readAsArrayBuffer(blob);
          } else {
            reject(new Error("Failed to generate blob"));
          }
        });
      });

      console.log("Timeline chart buffer generated:", chartBuffer.length);

      // Remove temporary div
      document.body.removeChild(chartDiv);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Posts Timeline");

      // Add data to worksheet
      worksheet.addRow(["Date", "Count"]);
      data.forEach((row) => {
        worksheet.addRow([row.Date, row.Count]);
      });

      // Auto-fit columns
      worksheet.columns = [
        { key: "date", width: 15 },
        { key: "count", width: 10 },
      ];

      // Embed the chart image
      try {
        const imageId = workbook.addImage({
          buffer: chartBuffer,
          extension: "png",
        });

        worksheet.addImage(imageId, {
          tl: { col: 3, row: 1 },
          ext: { width: 400, height: 200 },
        });

        console.log("Timeline image embedded successfully");
      } catch (imageError) {
        console.error("Failed to embed timeline image:", imageError);
      }

      // Save and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `posts_timeline_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Timeline export failed:", error);
    }
  };

  // Function to export all analytics data to Excel with multiple sheets and charts
  const exportAllDataToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();

      // Helper function to generate chart image
      const generateChartImage = async (
        chartType: "bar" | "line",
        labels: string[],
        data: number[],
        title: string
      ) => {
        const chartDiv = document.createElement("div");
        chartDiv.style.position = "absolute";
        chartDiv.style.left = "-9999px";
        chartDiv.style.top = "-9999px";
        chartDiv.style.width = "800px";
        chartDiv.style.height = "400px";
        chartDiv.style.backgroundColor = "white";
        document.body.appendChild(chartDiv);

        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 400;
        chartDiv.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ChartJS.register(...registerables);

        const chartData = {
          labels,
          datasets: [
            {
              label: "Count",
              data,
              backgroundColor:
                chartType === "bar"
                  ? "rgba(75, 192, 192, 0.6)"
                  : "rgba(54, 162, 235, 0.6)",
              borderColor:
                chartType === "bar"
                  ? "rgba(75, 192, 192, 1)"
                  : "rgba(54, 162, 235, 1)",
              borderWidth: 1,
              fill: chartType === "line" ? false : undefined,
            },
          ],
        };

        new ChartJS(ctx, {
          type: chartType,
          data: chartData,
          options: {
            responsive: false,
            plugins: {
              title: {
                display: true,
                text: title,
              },
            },
            scales:
              chartType === "line"
                ? {
                    y: { beginAtZero: true },
                  }
                : {
                    y: { beginAtZero: true },
                  },
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        const chartImage = await html2canvas(chartDiv, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
        });

        const chartBuffer = await new Promise<Uint8Array>((resolve, reject) => {
          chartImage.toBlob((blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer;
                resolve(new Uint8Array(arrayBuffer));
              };
              reader.onerror = () => reject(new Error("Failed to read blob"));
              reader.readAsArrayBuffer(blob);
            } else {
              reject(new Error("Failed to generate blob"));
            }
          });
        });

        document.body.removeChild(chartDiv);
        return chartBuffer;
      };

      // Categories data and chart
      const categoryCounts: Record<string, number> = {};
      displayPosts.forEach((post) => {
        const category = post.category || "Uncategorized";
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      const categoryData = Object.entries(categoryCounts).map(
        ([category, count]) => ({ Category: category, Count: count })
      );

      if (categoryData.length > 0) {
        const categorySheet = workbook.addWorksheet("Categories");
        categorySheet.addRow(["Category", "Count"]);
        categoryData.forEach((row) => {
          categorySheet.addRow([row.Category, row.Count]);
        });
        categorySheet.columns = [
          { key: "category", width: 20 },
          { key: "count", width: 10 },
        ];

        // Add chart image
        const categoryChartBuffer = await generateChartImage(
          "bar",
          categoryData.map((d) => d.Category),
          categoryData.map((d) => d.Count),
          "Category Distribution"
        );
        if (categoryChartBuffer) {
          const imageId = workbook.addImage({
            buffer: categoryChartBuffer,
            extension: "png",
          });
          categorySheet.addImage(imageId, {
            tl: { col: 3, row: 1 },
            ext: { width: 400, height: 200 },
          });
        }
      }

      // Timeline data and chart
      const postsByDate: Record<string, number> = {};
      displayPosts.forEach((post) => {
        if (post.createdAt) {
          let postDate: Date;
          try {
            postDate = post.createdAt.toDate
              ? post.createdAt.toDate()
              : new Date(post.createdAt);
            const date = postDate.toISOString().split("T")[0];
            postsByDate[date] = (postsByDate[date] || 0) + 1;
          } catch (error) {
            console.error("Error processing date for post:", post.id, error);
          }
        }
      });

      const timelineData = Object.entries(postsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ Date: date, Count: count }));

      if (timelineData.length > 0) {
        const timelineSheet = workbook.addWorksheet("Timeline");
        timelineSheet.addRow(["Date", "Count"]);
        timelineData.forEach((row) => {
          timelineSheet.addRow([row.Date, row.Count]);
        });
        timelineSheet.columns = [
          { key: "date", width: 15 },
          { key: "count", width: 10 },
        ];

        // Add chart image
        const timelineChartBuffer = await generateChartImage(
          "line",
          timelineData.map((d) => d.Date),
          timelineData.map((d) => d.Count),
          "Posts Over Time"
        );
        if (timelineChartBuffer) {
          const imageId = workbook.addImage({
            buffer: timelineChartBuffer,
            extension: "png",
          });
          timelineSheet.addImage(imageId, {
            tl: { col: 3, row: 1 },
            ext: { width: 400, height: 200 },
          });
        }
      }

      // Status distribution data and chart
      const statusCounts: Record<string, number> = {};
      displayPosts.forEach((post) => {
        const status = post.status || "Unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const statusData = Object.entries(statusCounts).map(
        ([status, count]) => ({ Status: status, Count: count })
      );

      if (statusData.length > 0) {
        const statusSheet = workbook.addWorksheet("Status Distribution");
        statusSheet.addRow(["Status", "Count"]);
        statusData.forEach((row) => {
          statusSheet.addRow([row.Status, row.Count]);
        });
        statusSheet.columns = [
          { key: "status", width: 20 },
          { key: "count", width: 10 },
        ];

        // Add chart image
        const statusChartBuffer = await generateChartImage(
          "bar",
          statusData.map((d) => d.Status),
          statusData.map((d) => d.Count),
          "Status Distribution"
        );
        if (statusChartBuffer) {
          const imageId = workbook.addImage({
            buffer: statusChartBuffer,
            extension: "png",
          });
          statusSheet.addImage(imageId, {
            tl: { col: 3, row: 1 },
            ext: { width: 400, height: 200 },
          });
        }
      }

      // Overview data
      const overviewData = [
        { Metric: "Total Posts", Value: totalPosts },
        { Metric: "Lost Items", Value: lostItems },
        { Metric: "Found Items", Value: foundItems },
        {
          Metric: "Pending",
          Value: displayPosts.filter((p) => p.status === "pending").length,
        },
        {
          Metric: "Unclaimed",
          Value: displayPosts.filter(
            (p) => p.status === "unclaimed" || p.movedToUnclaimed
          ).length,
        },
        { Metric: "Completed", Value: resolvedItems },
        {
          Metric: "OSA Turnover",
          Value: displayPosts.filter(
            (p) =>
              p.type === "found" &&
              p.turnoverDetails &&
              p.turnoverDetails.turnoverAction === "turnover to OSA"
          ).length,
        },
      ];

      const overviewSheet = workbook.addWorksheet("Overview");
      overviewSheet.addRow(["Metric", "Value"]);
      overviewData.forEach((row) => {
        overviewSheet.addRow([row.Metric, row.Value]);
      });
      overviewSheet.columns = [
        { key: "metric", width: 20 },
        { key: "value", width: 10 },
      ];

      // Logbook data
      const logbookData = displayPosts.map((post) => ({
        ID: post.id,
        Title: post.title || "Untitled",
        Type: post.type || "Unknown",
        Category: post.category || "Uncategorized",
        Location: post.location || "Not specified",
        CreatedAt: post.createdAt?.toDate
          ? post.createdAt.toDate().toISOString().split("T")[0]
          : "Unknown",
        Creator:
          post.user?.firstName && post.user?.lastName
            ? `${post.user.firstName} ${post.user.lastName}`
            : "Unknown",
        Status: post.status || "Unknown",
        Images: post.images?.length || 0,
      }));

      if (logbookData.length > 0) {
        const logbookSheet = workbook.addWorksheet("Logbook");
        logbookSheet.addRow([
          "ID",
          "Title",
          "Type",
          "Category",
          "Location",
          "Created At",
          "Creator",
          "Status",
          "Images",
        ]);
        logbookData.forEach((row) => {
          logbookSheet.addRow([
            row.ID,
            row.Title,
            row.Type,
            row.Category,
            row.Location,
            row.CreatedAt,
            row.Creator,
            row.Status,
            row.Images,
          ]);
        });
        logbookSheet.columns = [
          { key: "id", width: 15 },
          { key: "title", width: 25 },
          { key: "type", width: 10 },
          { key: "category", width: 15 },
          { key: "location", width: 20 },
          { key: "createdAt", width: 15 },
          { key: "creator", width: 20 },
          { key: "status", width: 15 },
          { key: "images", width: 10 },
        ];
      }

      // Save and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics_report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("All export failed:", error);
    }
  };

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
    <PageWrapper title="Analytics Dashboard">
      <div className="w-full mx-auto mb-13">
        {/* Page Header */}
        <div className="mb-5 hidden px-4 py-3 sm:px-6 lg:px-8 lg:flex items-center justify-between bg-gray-50 border-b border-zinc-200">
          <div className="">
            <h1 className="text-base font-medium text-gray-900">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Analyze and export analytics data for lost and found items
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {totalPosts} Total Posts
            </div>
            <button
              onClick={exportAllDataToExcel}
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
            >
              Export All
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <NavHeader
          title="Analytics Dashboard"
          description="Analyze and export analytics data for lost and found items"
        />

        {/* Rest of content */}

        {/* Date Range Selector */}
        <div className="mb-8 ml-4 mr-4 sm:ml-6 sm:mr-6 lg:ml-8 lg:mr-8">
          <DateRangeSelector onDateRangeChange={handleDateRangeChange} />
        </div>

        {/* Dashboard Overview */}
        <div className="mb-8 ml-4 mr-4 sm:ml-6 sm:mr-6 lg:ml-8 lg:mr-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Dashboard Overview
            </h2>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <Card className="shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600 mt-5">
                  {totalPosts}
                </div>
                <div className="text-sm text-gray-600">Total Posts</div>
              </CardContent>
            </Card>
            <Card className="shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600 mt-5">
                  {lostItems}
                </div>
                <div className="text-sm text-gray-600">Lost Items</div>
              </CardContent>
            </Card>
            <Card className="shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600 mt-5">
                  {foundItems}
                </div>
                <div className="text-sm text-gray-600">Found Items</div>
              </CardContent>
            </Card>
            <Card className="shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600 mt-5">
                  {displayPosts.filter((p) => p.status === "pending").length}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </CardContent>
            </Card>
            <Card className="shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600 mt-5">
                  {
                    displayPosts.filter(
                      (p) => p.status === "unclaimed" || p.movedToUnclaimed
                    ).length
                  }
                </div>
                <div className="text-sm text-gray-600">Unclaimed</div>
              </CardContent>
            </Card>
            <Card className="shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600 mt-5">
                  {resolvedItems}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </CardContent>
            </Card>
            <Card className="shadow">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-indigo-600 mt-5">
                  {
                    displayPosts.filter(
                      (p) =>
                        p.type === "found" &&
                        p.turnoverDetails &&
                        p.turnoverDetails.turnoverAction === "turnover to OSA"
                    ).length
                  }
                </div>
                <div className="text-sm text-gray-600">OSA Turnover</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs for different analytics views */}
        <Tabs
          defaultValue="overview"
          className="space-y-4 ml-4 mr-4 sm:ml-6 sm:mr-6 lg:ml-8 lg:mr-8"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="logbook">Logbook</TabsTrigger>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Category Analysis</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Distribution of posts by category
                    </p>
                  </div>
                  <button
                    onClick={exportCategoryDataToExcel}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Export to Excel
                  </button>
                </div>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Posts Timeline</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Posts created over time
                    </p>
                  </div>
                  <button
                    onClick={exportTimelineDataToExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Export to Excel
                  </button>
                </div>
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

          <TabsContent value="logbook" className="space-y-4">
            <PostCreationLogbook posts={displayPosts} />
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
    </PageWrapper>
  );
};

export default AdminAnalyticsPage;
