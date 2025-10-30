import React from 'react';
import { Line } from 'react-chartjs-2';
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
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { format, parseISO, subDays } from 'date-fns';
import type { Post } from '@/types/Post';
import type { DateRange } from 'react-day-picker';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

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
  // Process data for the chart
  const chartData = React.useMemo(() => {
    if (!posts.length) return { labels: [], datasets: [] };

    // Group posts by date and type
    const postsByDate: Record<string, { lost: number; found: number }> = {};
    
    // Get the start and end dates for the range
    const endDate = dateRange?.to ? new Date(dateRange.to) : new Date();
    const startDate = dateRange?.from ? new Date(dateRange.from) : subDays(new Date(), 30);
    
    // Initialize dates in range with 0 counts
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      postsByDate[dateKey] = { lost: 0, found: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count posts by date and type
    posts.forEach((post) => {
      if (!post.createdAt) return;
      
      const postDate = post.createdAt instanceof Date 
        ? post.createdAt 
        : new Date(post.createdAt);
      
      const dateKey = format(postDate, 'yyyy-MM-dd');
      
      if (!postsByDate[dateKey]) {
        postsByDate[dateKey] = { lost: 0, found: 0 };
      }
      
      if (post.type === 'lost') {
        postsByDate[dateKey].lost += 1;
      } else if (post.type === 'found') {
        postsByDate[dateKey].found += 1;
      }
    });

    // Sort dates
    const sortedDates = Object.keys(postsByDate).sort();

    return {
      labels: sortedDates.map(date => format(parseISO(date), 'MMM d')),
      datasets: [
        {
          label: 'Lost Items',
          data: sortedDates.map(date => postsByDate[date].lost),
          borderColor: 'rgb(239, 68, 68)', // red-500
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          tension: 0.3,
        },
        {
          label: 'Found Items',
          data: sortedDates.map(date => postsByDate[date].found),
          borderColor: 'rgb(16, 185, 129)', // emerald-500
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          tension: 0.3,
        },
      ],
    };
  }, [posts, dateRange]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Posts Over Time',
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Posts',
        },
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading chart data...</div>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available for the selected date range.
      </div>
    );
  }

  return (
    <div className="h-80">
      <Line options={options} data={chartData} />
    </div>
  );
};
