import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from "chart.js";
import type { ScriptableContext } from "chart.js";
import "chartjs-adapter-date-fns";
import {
  format,
  subDays,
  startOfWeek,
  addWeeks,
  startOfMonth,
  addMonths,
} from "date-fns";
import type { Post } from "@/types/Post";
import type { DateRange } from "react-day-picker";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler
);

type ViewMode = "daily" | "weekly" | "monthly";

const viewOptions: { label: string; value: ViewMode }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

interface PostsOverTimeChartProps {
  posts: Post[];
  dateRange: DateRange | undefined;
  loading: boolean;
}

export const PostsOverTimeChart: React.FC<PostsOverTimeChartProps> = ({
  posts,
  dateRange,
  loading,
}) => {
  const [viewMode, setViewMode] = React.useState<ViewMode>("daily");

  const normalizeDate = React.useCallback((value: unknown) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "object" && value !== null && "seconds" in (value as Record<string, unknown>)) {
      const seconds = (value as { seconds: number }).seconds;
      return new Date(seconds * 1000);
    }
    return null;
  }, []);

  const summaryUnit = viewMode === "daily" ? "day" : viewMode === "weekly" ? "week" : "month";
  const summaryTitle = viewMode === "daily" ? "Daily" : viewMode === "weekly" ? "Weekly" : "Monthly";

  const {
    labels,
    totalSeries,
    lostSeries,
    foundSeries,
    summary,
    rangeText,
  } = React.useMemo(() => {
    const derivedEnd = dateRange?.to ? normalizeDate(dateRange.to) : null;
    const derivedStart = dateRange?.from ? normalizeDate(dateRange.from) : null;

    const end = derivedEnd ? new Date(derivedEnd) : new Date();
    const start = derivedStart ? new Date(derivedStart) : subDays(end, 29);

    if (start > end) {
      const temp = new Date(start);
      start.setTime(end.getTime());
      end.setTime(temp.getTime());
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const rangeLabel = start.toDateString() === end.toDateString()
      ? format(start, "MMM d, yyyy")
      : `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;

    const filteredPosts = posts.filter((post) => {
      const created = normalizeDate(post.createdAt);
      if (!created) return false;
      return created >= start && created <= end;
    });

    const bucketMap: Record<string, { label: string; lost: number; found: number; total: number }> = {};
    const bucketOrder: string[] = [];

    const addBucket = (key: string, label: string) => {
      if (!bucketMap[key]) {
        bucketMap[key] = { label, lost: 0, found: 0, total: 0 };
        bucketOrder.push(key);
      }
    };

    if (viewMode === "weekly") {
      const startWeek = startOfWeek(start, { weekStartsOn: 1 });
      const endWeek = startOfWeek(end, { weekStartsOn: 1 });
      let cursor = new Date(startWeek);
      while (cursor <= endWeek) {
        const key = format(cursor, "yyyy-'W'II");
        const label = `Week of ${format(cursor, "MMM d")}`;
        addBucket(key, label);
        cursor = addWeeks(cursor, 1);
      }
    } else if (viewMode === "monthly") {
      const startMonth = startOfMonth(start);
      const endMonth = startOfMonth(end);
      let cursor = new Date(startMonth);
      while (cursor <= endMonth) {
        const key = format(cursor, "yyyy-MM");
        const label = format(cursor, "MMM yyyy");
        addBucket(key, label);
        cursor = addMonths(cursor, 1);
      }
    } else {
      let cursor = new Date(start);
      while (cursor <= end) {
        const key = format(cursor, "yyyy-MM-dd");
        const label = format(cursor, "MMM d");
        addBucket(key, label);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    let lostTotal = 0;
    let foundTotal = 0;
    let resolvedTotal = 0;

    filteredPosts.forEach((post) => {
      const created = normalizeDate(post.createdAt);
      if (!created) return;

      let key: string;
      let label: string;

      if (viewMode === "weekly") {
        const bucket = startOfWeek(created, { weekStartsOn: 1 });
        key = format(bucket, "yyyy-'W'II");
        label = `Week of ${format(bucket, "MMM d")}`;
      } else if (viewMode === "monthly") {
        const bucket = startOfMonth(created);
        key = format(bucket, "yyyy-MM");
        label = format(bucket, "MMM yyyy");
      } else {
        key = format(created, "yyyy-MM-dd");
        label = format(created, "MMM d");
      }

      if (!bucketMap[key]) {
        addBucket(key, label);
      }

      const bucket = bucketMap[key];

      if (post.type === "lost") {
        bucket.lost += 1;
        lostTotal += 1;
      } else if (post.type === "found") {
        bucket.found += 1;
        foundTotal += 1;
      }

      if (post.status === "resolved" || post.status === "completed") {
        resolvedTotal += 1;
      }

      bucket.total += 1;
    });

    const labels = bucketOrder.map((key) => bucketMap[key].label);
    const lostSeries = bucketOrder.map((key) => bucketMap[key].lost);
    const foundSeries = bucketOrder.map((key) => bucketMap[key].found);
    const totalSeries = bucketOrder.map((key) => bucketMap[key].total);

    const latestKey = bucketOrder[bucketOrder.length - 1];
    const previousKey = bucketOrder[bucketOrder.length - 2];
    const currentTotal = latestKey ? bucketMap[latestKey].total : 0;
    const previousTotal = previousKey ? bucketMap[previousKey].total : 0;

    const changePercent = previousTotal
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : currentTotal > 0
        ? 100
        : 0;

    const averagePerBucket = bucketOrder.length ? filteredPosts.length / bucketOrder.length : 0;

    return {
      labels,
      lostSeries,
      foundSeries,
      totalSeries,
      summary: {
        totalPosts: filteredPosts.length,
        lostTotal,
        foundTotal,
        resolvedTotal,
        averagePerBucket,
        changePercent,
        latestTotal: currentTotal,
      },
      rangeText: rangeLabel,
    };
  }, [posts, dateRange, viewMode, normalizeDate]);

  const formatAverage = (value: number) => {
    if (!value) return "0";
    if (value >= 10) return Math.round(value).toString();
    if (value >= 1) return value.toFixed(1);
    return value.toFixed(2);
  };

  const changeValue = Number.isFinite(summary.changePercent) ? summary.changePercent : 0;
  const changeLabel = `${changeValue > 0 ? "+" : ""}${changeValue.toFixed(1)}%`;
  const changeColor = changeValue >= 0 ? "text-emerald-600" : "text-red-500";
  const resolutionRate = summary.totalPosts ? (summary.resolvedTotal / summary.totalPosts) * 100 : 0;
  const resolutionLabel = `${resolutionRate.toFixed(1)}%`;

  const createGradient = React.useCallback((context: ScriptableContext<"line">, color: string) => {
    const { chart } = context;
    const { ctx, chartArea } = chart;
    if (!chartArea) {
      return `rgba(${color},0.24)`;
    }
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `rgba(${color},0.24)`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    return gradient;
  }, []);

  const chartData = React.useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Total Posts",
          data: totalSeries,
          borderColor: "rgb(37, 99, 235)",
          backgroundColor: (context: ScriptableContext<"line">) => createGradient(context, "37,99,235"),
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 0,
        },
        {
          label: "Lost",
          data: lostSeries,
          borderColor: "rgb(239, 68, 68)",
          backgroundColor: (context: ScriptableContext<"line">) => createGradient(context, "239,68,68"),
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: "Found",
          data: foundSeries,
          borderColor: "rgb(16, 185, 129)",
          backgroundColor: (context: ScriptableContext<"line">) => createGradient(context, "16,185,129"),
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    }),
    [labels, totalSeries, lostSeries, foundSeries, createGradient]
  );

  const maxTotal = React.useMemo(() => totalSeries.reduce((max, value) => Math.max(max, value), 0), [totalSeries]);

  const chartOptions = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            usePointStyle: true,
            padding: 16,
          },
        },
        tooltip: {
          callbacks: {
            footer: (items: any[]) => {
              if (!items?.length) return "";
              const index = items[0].dataIndex;
              const windowSize = viewMode === "daily" ? 7 : viewMode === "weekly" ? 4 : 3;
              const total = totalSeries
                .slice(Math.max(0, index - (windowSize - 1)), index + 1)
                .reduce((acc, value) => acc + value, 0);
              const unit = viewMode === "daily" ? "day" : viewMode === "weekly" ? "week" : "month";
              return `${windowSize}-${unit} total: ${total}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: viewMode === "daily" ? 10 : viewMode === "weekly" ? 12 : 12,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            stepSize: maxTotal <= 5 ? 1 : undefined,
          },
          grid: { color: "rgba(148, 163, 184, 0.2)" },
        },
      },
    }),
    [viewMode, totalSeries, maxTotal]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading chart data...</div>
      </div>
    );
  }

  if (!summary.totalPosts) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-center text-gray-500">
        <p className="text-sm font-medium">No data available for the selected date range.</p>
        <p className="mt-1 text-xs text-muted-foreground">Try adjusting the filters to view post activity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Total Posts</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold">{summary.totalPosts.toLocaleString()}</span>
            <span className={`text-sm font-medium ${changeColor}`}>{changeLabel}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">vs previous {summaryUnit}</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Lost · Found</p>
          <div className="mt-2 flex items-baseline gap-4">
            <span className="text-2xl font-semibold text-red-500">{summary.lostTotal.toLocaleString()}</span>
            <span className="text-lg font-semibold text-muted-foreground">·</span>
            <span className="text-2xl font-semibold text-emerald-500">{summary.foundTotal.toLocaleString()}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Average {formatAverage(summary.averagePerBucket)} per {summaryUnit}</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Resolution Rate</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-sky-600">{resolutionLabel}</span>
            <span className="text-sm text-muted-foreground">{summary.resolvedTotal.toLocaleString()} resolved</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Out of {summary.totalPosts.toLocaleString()} posts in range</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Post Trends</h3>
          <p className="text-sm text-muted-foreground">{summaryTitle} activity • {rangeText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setViewMode(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                viewMode === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm"
                  : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80">
        <Line options={chartOptions} data={chartData} updateMode="resize" />
      </div>
    </div>
  );
};
