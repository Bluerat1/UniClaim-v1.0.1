import React from 'react';
import { Button } from "../ui/button";
import { Download, FileText } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import type { Post } from "@/types/Post";
import { exportToExcel } from "@/utils/exportUtils";
import { format } from 'date-fns';

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

  // Format posts for export
  const formatPostsForExport = () => {
    return posts.map(post => ({
      'ID': post.id,
      'Title': post.title,
      'Type': post.type,
      'Category': post.category || 'Uncategorized',
      'Status': post.status || 'pending',
      'Created At': post.createdAt ? format(new Date(post.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A',
      'Updated At': post.updatedAt ? format(new Date(post.updatedAt), 'yyyy-MM-dd HH:mm') : 'N/A',
      'Description': post.description || '',
      'Location': post.location || '',
      'User ID': post.userId || 'N/A',
      'Images': post.images ? post.images.length : 0,
    }));
  };

  const handleExport = () => {
    const data = formatPostsForExport();
    if (data.length === 0) {
      console.warn('No data to export');
      return;
    }
    
    // Create columns definition from the first data item
    const columns = Object.keys(data[0]).map(key => ({
      header: key,
      key: key,
      width: 15 // Optional: set column width
    }));
    
    exportToExcel(
      data,
      columns,
      'Posts',
      `posts-export-${format(new Date(), 'yyyy-MM-dd')}`
    );
  };

  const handleExportToJSON = () => {
    const data = formatPostsForExport();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `posts-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading export data...</div>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available for export.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-6">
        <div className="flex flex-col items-center justify-center text-center p-8">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <Download className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Export Data</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
            Download your analytics data in various formats for further analysis or reporting.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
            <Button 
              variant="outline" 
              className="flex flex-col items-center justify-center h-32 gap-2"
              onClick={handleExport}
              disabled={loading || posts.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
            
            <Button 
              variant="outline" 
              className="flex flex-col items-center justify-center h-32 gap-2"
              onClick={handleExportToJSON}
            >
              <FileText className="h-6 w-6" />
              <span>JSON (.json)</span>
              <span className="text-xs text-gray-500">For developers</span>
            </Button>
          </div>
          
          <div className="mt-8 w-full max-w-2xl">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Export Summary
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Posts</p>
                  <p className="font-medium">{posts.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Date Range</p>
                  <p className="font-medium">
                    {dateRange?.from 
                      ? `${format(dateRange.from, 'MMM d, yyyy')} - ${dateRange.to ? format(dateRange.to, 'MMM d, yyyy') : 'Present'}`
                      : 'All time'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Lost Items</p>
                  <p className="font-medium">
                    {posts.filter(p => p.type === 'lost').length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Found Items</p>
                  <p className="font-medium">
                    {posts.filter(p => p.type === 'found').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-900 rounded-lg border p-6">
        <h3 className="text-lg font-medium mb-4">Export Preview</h3>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {posts.slice(0, 5).map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {post.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        post.type === 'lost' 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {post.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {post.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {post.createdAt ? format(new Date(post.createdAt), 'MMM d, yyyy') : 'N/A'}
                    </td>
                  </tr>
                ))}
                {posts.length > 5 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      ... and {posts.length - 5} more items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
