import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, FileJson, Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DateRange } from "react-day-picker";
import type { Post } from "@/types/Post";
import { exportToExcel } from "@/utils/exportUtils";
import type { ChartImage } from "@/utils/exportUtils";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Import chart components
import { StatusDistributionChart } from "./charts/StatusDistributionChart";
import { PostsOverTimeChart } from "./charts/PostsOverTimeChart";
import { CategoryDistributionChart } from "./charts/CategoryDistributionChart";

interface DataExportProps {
  posts: Post[];
  loading: boolean;
  dateRange: DateRange | undefined;
}

export const DataExport: React.FC<DataExportProps> = ({
  posts,
  loading,
  dateRange,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'all' | 'lost' | 'found' | 'completed'>('all');
  const [lastExport, setLastExport] = useState<{
    type: string;
    time: Date;
  } | null>(null);

  // Refs for chart containers
  const statusChartRef = useRef<HTMLDivElement>(null);
  const postsOverTimeChartRef = useRef<HTMLDivElement>(null);
  const categoryChartRef = useRef<HTMLDivElement>(null);

  // Format posts for export
  const formatPostsForExport = () => {
    // Filter posts by selected type or status
    let filteredPosts = posts;
    if (exportType === 'completed') {
      filteredPosts = posts.filter(post => post.status === 'completed');
    } else if (exportType !== 'all') {
      filteredPosts = posts.filter(post => post.type === exportType);
    }

    return filteredPosts.map((post) => ({
      ID: post.id,
      Title: post.title,
      Type: post.type,
      Category: post.category || "Uncategorized",
      Status: post.status || "pending",
      "Created At": post.createdAt
        ? format(new Date(post.createdAt), "yyyy-MM-dd HH:mm")
        : "N/A",
      "Updated At": post.updatedAt
        ? format(new Date(post.updatedAt), "yyyy-MM-dd HH:mm")
        : "N/A",
      Description: post.description || "",
      Location: post.location || "",
      "User Name": post.user ? `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim() || "N/A" : "N/A",
      "Student ID": post.user?.studentId || "N/A",
      "User ID": post.creatorId || post.postedById || "N/A",
      Images: post.images ? post.images.length : 0,
    }));
  };

  const handleExport = async (type: "excel" | "json" | "csv") => {
    try {
      setIsExporting(type);
      const data = formatPostsForExport();

      if (data.length === 0) {
        throw new Error("No data to export");
      }

      const timestamp = format(new Date(), "yyyy-MM-dd");
      const typeSuffix = exportType === 'all' ? 'all' : exportType === 'lost' ? 'lost' : 'found';
      const filename = `posts-${typeSuffix}-export-${timestamp}`;

      // Prepare charts for export
      const charts: ChartImage[] = [];

      if (type === "excel") {
        // Add charts with their positions and dimensions
        if (statusChartRef.current) {
          charts.push({
            element: statusChartRef.current,
            sheetName: "Status Distribution",
            position: { col: 1, row: 1, width: 800, height: 400 },
          });
        }

        if (postsOverTimeChartRef.current) {
          charts.push({
            element: postsOverTimeChartRef.current,
            sheetName: "Posts Over Time",
            position: { col: 1, row: 1, width: 800, height: 400 },
          });
        }

        if (categoryChartRef.current) {
          charts.push({
            element: categoryChartRef.current,
            sheetName: "Category Distribution",
            position: { col: 1, row: 1, width: 800, height: 400 },
          });
        }
      }

      if (type === "excel") {
        const columns = Object.keys(data[0]).map((key) => ({
          header: key,
          key: key,
          width: 15,
        }));

        await exportToExcel(data, columns, filename, charts);
      } else if (type === "json") {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        downloadBlob(blob, `${filename}.json`, "application/json");
      } else if (type === "csv") {
        const headers = Object.keys(data[0]).join(",") + "\n";
        const csv = data
          .map((row) =>
            Object.values(row)
              .map((field) => `"${String(field).replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n");
        const blob = new Blob([headers + csv], { type: "text/csv" });
        downloadBlob(blob, `${filename}.csv`, "text/csv");
      }

      setLastExport({ type, time: new Date() });
      // Using console log instead of toast since we don't have the toast dependency
      console.log(
        `Successfully exported ${data.length} records to ${type.toUpperCase()}`
      );
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string, type: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.type = type;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>Preparing your data for export...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-12">
          <div className="animate-pulse text-muted-foreground">
            Loading export data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!posts.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>No data available for export</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12 text-muted-foreground">
          There is no data to export for the selected date range.
        </CardContent>
      </Card>
    );
  }

  const exportOptions = [
    {
      id: "excel",
      name: "Excel",
      description: "Export as XLSX file (recommended for Excel users)",
      icon: FileSpreadsheet,
      color: "bg-green-100 text-green-700 cursor-pointer hover:bg-green-200",
    },
    {
      id: "csv",
      name: "CSV",
      description: "Export as CSV file (compatible with most applications)",
      icon: FileText,
      color: "bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200",
    },
    {
      id: "json",
      name: "JSON",
      description: "Export as JSON file (for developers and APIs)",
      icon: FileJson,
      color: "bg-yellow-100 text-yellow-700 cursor-pointer hover:bg-yellow-200",
    },
  ];

  // Calculate stats for the export
  const stats = {
    total: posts.length,
    lost: posts.filter((post: Post) => post.type === "lost").length,
    found: posts.filter((post: Post) => post.type === "found").length,
  };

  // Render hidden charts for export
  const renderExportCharts = () => (
    <div
      style={{
        position: "absolute",
        left: "-9999px",
        top: "-9999px",
        opacity: 0,
      }}
    >
      <div ref={statusChartRef}>
        <StatusDistributionChart posts={posts} dateRange={dateRange} />
      </div>
      <div ref={postsOverTimeChartRef}>
        <PostsOverTimeChart
          posts={posts}
          dateRange={dateRange}
          loading={loading}
        />
      </div>
      <div ref={categoryChartRef}>
        <CategoryDistributionChart posts={posts} dateRange={dateRange} />
      </div>
    </div>
  );

  return (
    <Card>
      {renderExportCharts()}
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Export Data</h3>
              <p className="text-sm text-muted-foreground">
                Export your analytics data in various formats
              </p>
            </div>
          </div>
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Filter by Post Type</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between min-w-[180px] max-w-[180px]">
                  <span className="truncate">
                    {exportType === 'all' ? 'All Items' : exportType === 'lost' ? 'Lost Items Only' : exportType === 'found' ? 'Found Items Only' : 'Completed Items Only'}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px]">
                <DropdownMenuItem 
                  onClick={() => setExportType('all')}
                  className="whitespace-nowrap"
                >
                  All Items
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setExportType('lost')}
                  className="whitespace-nowrap"
                >
                  Lost Items Only
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setExportType('found')}
                  className="whitespace-nowrap"
                >
                  Found Items Only
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setExportType('completed')}
                  className="whitespace-nowrap"
                >
                  Completed Items Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {lastExport && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span>
                Exported as {lastExport.type.toUpperCase()} at{" "}
                {format(lastExport.time, "HH:mm")}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Items</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Lost Items</p>
            <p className="text-2xl font-semibold">{stats.lost}</p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Found Items</p>
            <p className="text-2xl font-semibold">{stats.found}</p>
          </div>
        </div>

        {/* Export Options */}
        <div className="grid gap-4 md:grid-cols-3">
          {exportOptions.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className={`h-32 flex flex-col items-center justify-center gap-2 p-4 transition-all ${option.color} relative`}
              onClick={() =>
                handleExport(option.id as "excel" | "json" | "csv")
              }
              disabled={isExporting === option.id}
            >
              <div className={`p-3 rounded-full ${option.color} bg-opacity-20`}>
                {React.createElement(option.icon, { className: "h-5 w-5" })}
              </div>
              <span className="font-medium">{option.name}</span>
              <p className="text-xs text-center text-muted-foreground">
                {option.description}
              </p>
              {isExporting === option.id && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </Button>
          ))}
        </div>

        {/* Export Info */}
        <div className="pt-2 text-xs text-muted-foreground">
          <p>Export includes {stats.total} records.</p>
          {dateRange?.from && dateRange?.to && (
            <p>
              Date range: {format(dateRange.from, "MMM d, yyyy")} -{" "}
              {format(dateRange.to, "MMM d, yyyy")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
