import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type {
  ChartData,
  ChartOptions,
  ScriptableContext,
} from 'chart.js';
import type { Post } from "@/types/Post";
import type { DateRange } from 'react-day-picker';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryDistributionChartProps {
  posts: Post[];
  dateRange?: DateRange;
}

// Generate a color palette
const COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#06b6d4', // cyan-500
];

export const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({
  posts,
  dateRange,
}) => {
  const normalizeDate = React.useCallback((value: unknown) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'object' && value !== null && 'seconds' in (value as Record<string, unknown>)) {
      const seconds = (value as { seconds: number }).seconds;
      return new Date(seconds * 1000);
    }
    return null;
  }, []);

  const chartData = React.useMemo<ChartData<'doughnut'>>(() => {
    if (!posts.length) return { labels: [], datasets: [] };

    const fromDate = dateRange?.from ? normalizeDate(dateRange.from) : null;
    const toDate = dateRange?.to ? normalizeDate(dateRange.to) : null;

    const filteredPosts = fromDate || toDate
      ? posts.filter((post) => {
          const created = normalizeDate(post.createdAt);
          if (!created) return false;
          if (fromDate && created < fromDate) return false;
          if (toDate) {
            const boundary = new Date(toDate);
            boundary.setHours(23, 59, 59, 999);
            if (created > boundary) return false;
          }
          return true;
        })
      : posts;

    const categoryCounts = filteredPosts.reduce<Record<string, number>>((acc, post) => {
      const category = post.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([category]) => category);

    const counts = sortedCategories.map((category) => categoryCounts[category]);

    const backgroundColors = sortedCategories.map((_, index) => COLORS[index % COLORS.length]);

    return {
      labels: sortedCategories,
      datasets: [
        {
          data: counts,
          backgroundColor: backgroundColors,
          hoverBackgroundColor: backgroundColors,
          borderWidth: 1,
          hoverOffset: 8,
        },
      ],
    };
  }, [posts, dateRange, normalizeDate]);

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 900,
      easing: 'easeOutQuart',
      delay: (context: ScriptableContext<'doughnut'>) => context.dataIndex * 80,
    },
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw as number;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    cutout: '60%',
  };

  if (!posts.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No category data available.
      </div>
    );
  }

  const chartKey = React.useMemo(() => {
    const data = chartData.datasets[0]?.data ?? [];
    return `${chartData.labels.join('-')}|${data.join('-')}`;
  }, [chartData]);

  return (
    <div className="h-full w-full">
      <Doughnut key={chartKey} data={chartData} options={options} />
    </div>
  );
};
