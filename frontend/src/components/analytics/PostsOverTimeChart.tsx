import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, subDays } from 'date-fns';

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface PostsOverTimeChartProps {
  posts: Array<{
    id: string;
    createdAt?: string | Date | { toDate: () => Date };
    type?: 'lost' | 'found' | string;
  }>;
  timeRange: TimeRange;
}

const safeParseDate = (dateInput?: string | Date | { toDate: () => Date }): Date => {
  try {
    if (!dateInput) return new Date();
    
    if (typeof dateInput === 'string') {
      return new Date(dateInput);
    } else if (typeof dateInput === 'object' && 'toDate' in dateInput) {
      return dateInput.toDate();
    } else if (dateInput instanceof Date) {
      return dateInput;
    }
    
    return new Date();
  } catch (error) {
    console.error('Error parsing date:', error, 'Input was:', dateInput);
    return new Date();
  }
};

const groupByDay = (posts: Array<{ createdAt?: string | Date | { toDate: () => Date } }>) => {
  const counts: Record<string, { date: string; count: number }> = {};
  
  posts.forEach(post => {
    try {
      const date = safeParseDate(post.createdAt);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date encountered:', post.createdAt);
        return;
      }
      
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (!counts[dateStr]) {
        counts[dateStr] = {
          date: dateStr,
          count: 0
        };
      }
      
      counts[dateStr].count += 1;
    } catch (error) {
      console.error('Error processing post:', error, post);
    }
  });
  
  return Object.values(counts).sort((a, b) => a.date.localeCompare(b.date));
};

const groupByWeek = (posts: Array<{ createdAt?: string | Date | { toDate: () => Date } }>) => {
  const counts: Record<string, { date: string; count: number }> = {};
  
  posts.forEach(post => {
    try {
      const date = safeParseDate(post.createdAt);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date encountered in week grouping:', post.createdAt);
        return;
      }
      
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
      
      if (!counts[weekKey]) {
        counts[weekKey] = {
          date: weekKey,
          count: 0
        };
      }
      
      counts[weekKey].count += 1;
    } catch (error) {
      console.error('Error processing post in week grouping:', error, post);
    }
  });
  
  return Object.values(counts).sort((a, b) => a.date.localeCompare(b.date));
};

// Helper function to get ISO week number
function getWeekNumber(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const PostsOverTimeChart: React.FC<PostsOverTimeChartProps> = ({ posts, timeRange }) => {
  const filterPostsByTimeRange = () => {
    const now = new Date();
    let filteredPosts = [...posts];
    
    if (timeRange !== 'all') {
      const days = parseInt(timeRange);
      if (isNaN(days)) {
        console.error('Invalid timeRange value:', timeRange);
        return filteredPosts;
      }
      
      const cutoffDate = subDays(now, days);
      filteredPosts = posts.filter(post => {
        try {
          const postDate = safeParseDate(post.createdAt);
          return !isNaN(postDate.getTime()) && postDate >= cutoffDate;
        } catch (error) {
          console.error('Error filtering post by date:', error, post);
          return false;
        }
      });
    }
    
    return filteredPosts;
  };
  
  const filteredPosts = filterPostsByTimeRange();
  const lostPosts = filteredPosts.filter(post => post.type === 'lost');
  const foundPosts = filteredPosts.filter(post => post.type === 'found');
  
  // Determine grouping based on time range
  let lostData, foundData;
  
  if (timeRange === '7d') {
    lostData = groupByDay(lostPosts);
    foundData = groupByDay(foundPosts);
  } else if (timeRange === '30d') {
    lostData = groupByDay(lostPosts);
    foundData = groupByDay(foundPosts);
  } else {
    lostData = groupByWeek(lostPosts);
    foundData = groupByWeek(foundPosts);
  }
  
  // Merge data for the chart
  const chartData = Array.from(new Set([...lostData.map(d => d.date), ...foundData.map(d => d.date)]))
    .sort()
    .map(date => {
      const lost = lostData.find(d => d.date === date);
      const found = foundData.find(d => d.date === date);
      
      return {
        date,
        lost: lost ? lost.count : 0,
        found: found ? found.count : 0,
        total: (lost?.count || 0) + (found?.count || 0)
      };
    });

  return (
    <div className="w-full h-[400px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              if (timeRange === '7d' || timeRange === '30d') {
                return format(parseISO(value), 'MMM d');
              } else {
                return value;
              }
            }}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(value) => {
              if (timeRange === '7d' || timeRange === '30d') {
                return format(parseISO(value), 'MMMM d, yyyy');
              } else {
                return `Week ${value.split('-W')[1]}, ${value.split('-W')[0]}`;
              }
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="lost" 
            name="Lost Items" 
            stroke="#FF6B6B" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="found" 
            name="Found Items" 
            stroke="#4ECDC4" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="total" 
            name="Total Posts" 
            stroke="#8884d8" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PostsOverTimeChart;
