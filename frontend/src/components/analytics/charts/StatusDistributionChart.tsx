import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Post } from '@/types/Post';
import type { DateRange } from 'react-day-picker';

// Simple color utility since we can't access @/lib/utils
const getStatusColor = (status: string, opacity = 1): string => {
  const colors: Record<string, string> = {
    pending: `rgba(245, 158, 11, ${opacity})`, // amber-500
    claimed: `rgba(59, 130, 246, ${opacity})`, // blue-500
    resolved: `rgba(16, 185, 129, ${opacity})`, // emerald-500
    rejected: `rgba(239, 68, 68, ${opacity})`, // red-500
    expired: `rgba(107, 114, 128, ${opacity})`, // gray-500
  };
  return colors[status.toLowerCase()] || `rgba(139, 92, 246, ${opacity})`; // violet-500 for others
};

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StatusDistributionChartProps {
  posts: Post[];
  dateRange?: DateRange;
  loading?: boolean;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  posts,
  dateRange,
}) => {
  // Process data for the chart
  const { chartData, totalPosts } = React.useMemo(() => {
    if (!posts.length) return { chartData: { labels: [], datasets: [] }, totalPosts: 0 };

    // Count posts by status
    const statusCounts = posts.reduce<Record<string, number>>((acc, post) => {
      const status = post.status?.toLowerCase() || 'pending';
      const statusKey = ['pending', 'claimed', 'resolved', 'rejected', 'expired'].includes(status) 
        ? status 
        : 'other';
      acc[statusKey] = (acc[statusKey] || 0) + 1;
      return acc;
    }, {});
    
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    const data: ChartData<'bar', number[], string> = {
      labels: Object.keys(statusCounts),
      datasets: [
        {
          label: 'Number of Posts',
          data: Object.values(statusCounts),
          backgroundColor: Object.keys(statusCounts).map(status => 
            getStatusColor(status, 0.7)
          ),
          borderColor: Object.keys(statusCounts).map(status => 
            getStatusColor(status, 1)
          ),
          borderWidth: 1,
        },
      ],
    };

    return { chartData: data, totalPosts: total };
  }, [posts]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const label = context.dataset.label || '';
            const value = context.raw as number;
            const percentage = totalPosts > 0 ? Math.round((value / totalPosts) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#e5e7eb',
        },
        ticks: {
          color: '#6b7280',
          precision: 0,
        },
      },
    },
  };

  if (!posts.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No status data available.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <Bar data={chartData} options={options} />
        </div>
        {dateRange?.from && dateRange?.to && (
          <p className="text-sm text-gray-500 mt-2 text-right">
            Showing data from {dateRange.from.toLocaleDateString()} to {dateRange.to.toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
