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
  // Process data for the chart
  const chartData = React.useMemo<ChartData<'doughnut'>>(() => {
    if (!posts.length) return { labels: [], datasets: [] };

    // Filter posts by date range if provided
    const filteredPosts = dateRange?.from || dateRange?.to
      ? posts.filter(post => {
          if (!post.createdAt) return false;
          const postDate = new Date(post.createdAt);
          if (dateRange.from && postDate < dateRange.from) return false;
          if (dateRange.to) {
            const nextDay = new Date(dateRange.to);
            nextDay.setDate(nextDay.getDate() + 1);
            if (postDate >= nextDay) return false;
          }
          return true;
        })
      : posts;

    // Count posts by category
    const categoryCounts = filteredPosts.reduce<Record<string, number>>((acc, post) => {
      const category = post.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Sort by count (descending)
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([category]) => category);

    // Get counts in the same order as sorted categories
    const counts = sortedCategories.map(category => categoryCounts[category]);

    // Use colors based on the number of categories
    const backgroundColors = sortedCategories.map((_, index) => 
      COLORS[index % COLORS.length]
    );

    return {
      labels: sortedCategories,
      datasets: [
        {
          data: counts,
          backgroundColor: backgroundColors,
          borderWidth: 1,
        },
      ],
    };
  }, [posts]);

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
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

  return (
    <div className="h-full w-full">
      <Doughnut data={chartData} options={options} />
    </div>
  );
};
