import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import type { Post } from '@/types/Post';
import type { DateRange } from 'react-day-picker';

const getStatusColor = (status: string, opacity = 1): string => {
  const colors: Record<string, string> = {
    pending: `rgba(245, 158, 11, ${opacity})`,
    claimed: `rgba(59, 130, 246, ${opacity})`,
    resolved: `rgba(16, 185, 129, ${opacity})`,
    rejected: `rgba(239, 68, 68, ${opacity})`,
    expired: `rgba(107, 114, 128, ${opacity})`,
  };
  return colors[status.toLowerCase()] || `rgba(139, 92, 246, ${opacity})`;
};

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StatusDistributionChartProps {
  posts: Post[];
  dateRange?: DateRange;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  posts,
  dateRange,
}) => {
  const { chartData, totalPosts } = React.useMemo(() => {
    if (!posts.length) return { chartData: { labels: [], datasets: [] }, totalPosts: 0 };

    const filteredPosts = dateRange?.from || dateRange?.to
      ? posts.filter((post) => {
          const createdAt = post.createdAt ? new Date(post.createdAt) : null;
          if (!createdAt) return false;
          if (dateRange.from && createdAt < dateRange.from) return false;
          if (dateRange.to) {
            const boundary = new Date(dateRange.to);
            boundary.setHours(23, 59, 59, 999);
            if (createdAt > boundary) return false;
          }
          return true;
        })
      : posts;

    const statusCounts = filteredPosts.reduce<Record<string, number>>((acc, post) => {
      const rawStatus = (post.status || 'pending').toLowerCase();
      const normalizedStatus = rawStatus === 'completed' ? 'resolved' : rawStatus;
      const statusKey = ['pending', 'claimed', 'resolved', 'rejected', 'expired'].includes(normalizedStatus)
        ? normalizedStatus
        : 'other';
      acc[statusKey] = (acc[statusKey] || 0) + 1;
      return acc;
    }, {});

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    const entries = Object.entries(statusCounts).map(([status, count]) => ({
      key: status,
      label: status === 'other' ? 'Other' : status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
    }));

    const data: ChartData<'bar', number[], string> = {
      labels: entries.map((entry) => entry.label),
      datasets: [
        {
          label: 'Number of Posts',
          data: entries.map((entry) => entry.value),
          backgroundColor: entries.map((entry) => getStatusColor(entry.key, 0.75)),
          borderColor: entries.map((entry) => getStatusColor(entry.key, 1)),
          borderWidth: 2,
          borderRadius: 6,
          barThickness: "flex",
          maxBarThickness: 36,
          categoryPercentage: 0.6,
          hoverBorderWidth: 2.5,
        },
      ],
    };

    return { chartData: data, totalPosts: total };
  }, [posts, dateRange]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
      },
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        padding: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        titleColor: '#fff',
        bodyColor: '#e2e8f0',
        footerColor: '#cbd5f5',
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const value = context.raw as number;
            const label = context.label || 'Total';
            const percentage = totalPosts > 0 ? Math.round((value / totalPosts) * 100) : 0;
            return `${label}: ${value.toLocaleString()} posts (${percentage}%)`;
          },
          footer: (context) => {
            const value = context[0]?.raw as number;
            if (!value || !totalPosts) return '';
            const avg = totalPosts ? (value / totalPosts) * 100 : 0;
            return `Share of total: ${avg.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#4b5563',
          padding: 8,
          font: { 
            size: 12, 
            weight: 500 
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        beginAtZero: true,
        grid: { 
          color: 'rgba(148, 163, 184, 0.1)',
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          precision: 0,
          stepSize: totalPosts <= 10 ? 1 : undefined,
          callback: (value) => value.toString(),
          padding: 8,
        },
      },
    },
  };

  if (!totalPosts) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-gray-500">
        No status data available.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        {dateRange?.from && dateRange?.to && (
          <p className="text-sm text-muted-foreground">
            {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{totalPosts.toLocaleString()}</span>
        </p>
      </div>
      <div className="flex-1 min-h-[300px] w-full">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};
