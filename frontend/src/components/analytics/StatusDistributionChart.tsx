import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StatusDistributionChartProps {
  posts: Array<{
    status: string;
    type: 'lost' | 'found';
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  'open': '#4CAF50',
  'pending': '#FFC107',
  'resolved': '#2196F3',
  'resolved_completed': '#2196F3', // Combined status color
  'in-progress': '#FF9800',
  'closed': '#9E9E9E',
  'claimed': '#9C27B0',
  'unclaimed': '#F44336',
  'returned': '#4CAF50',
  'donated': '#3F51B5',
  'disposed': '#607D8B',
};

const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({ posts }) => {
  // Group posts by status and type
  const statusData = posts.reduce((acc, post) => {
    if (!post.status) return acc;
    
    let status = post.status.toLowerCase();
    
    // Combine 'resolved' and 'completed' into one category
    if (status === 'resolved' || status === 'completed') {
      status = 'resolved_completed';
    }
    
    const type = post.type;
    
    if (!acc[status]) {
      acc[status] = { 
        name: status === 'resolved_completed' ? 'Resolved' : status.charAt(0).toUpperCase() + status.slice(1),
        lost: 0, 
        found: 0,
        total: 0
      };
    }
    
    acc[status][type]++;
    acc[status].total++;
    
    return acc;
  }, {} as Record<string, { name: string; lost: number; found: number; total: number }>);
  
  // Convert to array and sort by total count
  const sortedStatuses = Object.values(statusData)
    .sort((a, b) => b.total - a.total);
  
  // Prepare data for the chart
  const chartData = sortedStatuses.map(status => ({
    name: status.name,
    Lost: status.lost,
    Found: status.found,
    Total: status.total,
    color: STATUS_COLORS[status.name.toLowerCase()] || '#8884d8'
  }));
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const lost = payload.find((p: any) => p.dataKey === 'Lost')?.value || 0;
      const found = payload.find((p: any) => p.dataKey === 'Found')?.value || 0;
      const total = lost + found;
      
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded">
          <p className="font-semibold">{label}</p>
          <p className="text-sm">Total: {total}</p>
          <p className="text-sm text-red-500">Lost: {lost}</p>
          <p className="text-sm text-green-500">Found: {found}</p>
          <p className="text-sm text-gray-500">
            {total > 0 ? `(${((total / posts.length) * 100).toFixed(1)}% of all posts)` : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          barCategoryGap={20}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end" 
            height={60}
            tick={{ fontSize: 12 }}
          />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar 
            dataKey="Lost" 
            name="Lost Items" 
            fill="#FF6B6B"
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="Found" 
            name="Found Items" 
            fill="#4ECDC4"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatusDistributionChart;
