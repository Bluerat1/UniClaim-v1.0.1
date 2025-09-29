import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface CategoryDistributionChartProps {
  posts: Array<{
    id: string;
    category?: string;
    type?: 'lost' | 'found' | string;
  }>;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A4DE6C', 
  '#D0ED57', '#8884D8', '#8DD1E1', '#83A6ED', '#FFC658'
];

const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({ posts }) => {
  // Group posts by category and type
  interface CategoryData {
    name: string;
    lost: number;
    found: number;
    total: number;
    [key: string]: number | string; // For dynamic type access
  }

  const categoryData = posts.reduce<Record<string, CategoryData>>((acc, post) => {
    if (!post.category) return acc;
    
    const category = post.category.toLowerCase();
    const type = post.type || 'unknown';
    
    if (!acc[category]) {
      acc[category] = { 
        name: category.charAt(0).toUpperCase() + category.slice(1),
        lost: 0, 
        found: 0,
        total: 0
      };
    }
    
    // Update counts
    const categoryEntry = acc[category];
    if (type === 'lost') {
      categoryEntry.lost++;
    } else if (type === 'found') {
      categoryEntry.found++;
    }
    categoryEntry.total++;
    
    return acc;
  }, {});
  
  // Convert to array and sort by total count
  const sortedCategories = Object.values(categoryData)
    .sort((a, b) => b.total - a.total);
  
  // Prepare data for the chart (top 10 categories, rest as 'Other')
  const topCategories = sortedCategories.slice(0, 9);
  const otherCategories = sortedCategories.slice(9);
  
  const otherTotal = otherCategories.reduce((sum, cat) => sum + cat.total, 0);
  
  const chartData = [
    ...topCategories.map(cat => ({
      name: cat.name,
      value: cat.total,
      lost: cat.lost,
      found: cat.found
    })),
    ...(otherTotal > 0 ? [{
      name: 'Other',
      value: otherTotal,
      lost: otherCategories.reduce((sum, cat) => sum + cat.lost, 0),
      found: otherCategories.reduce((sum, cat) => sum + cat.found, 0)
    }] : [])
  ] as Array<{
    name: string;
    value: number;
    lost: number;
    found: number;
  }>;
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm">Total: {data.value}</p>
          <p className="text-sm text-red-500">Lost: {data.lost}</p>
          <p className="text-sm text-green-500">Found: {data.found}</p>
        </div>
      );
    }
    return null;
  };

  // Custom legend formatter
  const renderColorfulLegendText = (value: string, entry: any) => {
    const { color } = entry;
    const data = chartData.find(item => item.name === value);
    const percentage = data ? ((data.value / posts.length) * 100).toFixed(1) : '0';
    
    return (
      <span style={{ color }}>
        {value}: {data?.value} ({percentage}%)
      </span>
    );
  };

  return (
    <div className="w-full h-[400px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={({ name = 'Unknown', percent }: PieLabelRenderProps) => {
              // Ensure we have a valid percentage value
              const percentageValue = typeof percent === 'number' ? Math.round(percent * 100) : 0;
              return `${name} (${percentageValue}%)`;
            }}
          >
            {chartData.map((_, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]} 
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            layout="vertical" 
            align="right" 
            verticalAlign="middle"
            formatter={renderColorfulLegendText}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryDistributionChart;
