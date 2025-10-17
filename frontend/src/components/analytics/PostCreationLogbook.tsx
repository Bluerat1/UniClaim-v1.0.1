import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Calendar, User, MapPin, Tag, Eye } from 'lucide-react';

interface PostCreationLog {
  id: string;
  title: string;
  type: 'lost' | 'found';
  category: string;
  location: string;
  createdAt: Date;
  creatorName: string;
  creatorEmail: string;
  status: string;
  imageCount: number;
}

interface PostCreationLogbookProps {
  posts: any[];
  loading?: boolean;
}

const PostCreationLogbook: React.FC<PostCreationLogbookProps> = ({
  posts,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Convert posts to log format
  const logs: PostCreationLog[] = posts.map(post => ({
    id: post.id,
    title: post.title || 'Untitled',
    type: post.type || 'unknown',
    category: post.category || 'uncategorized',
    location: post.location || 'Not specified',
    createdAt: post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt),
    creatorName: post.user?.firstName && post.user?.lastName
      ? `${post.user.firstName} ${post.user.lastName}`
      : 'Unknown User',
    creatorEmail: post.user?.email || 'No email',
    status: post.status || 'unknown',
    imageCount: post.images?.length || 0
  }));

  // Filter logs based on search and filters
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' ||
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.creatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === 'all' || log.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Sort by creation date (newest first)
  const sortedLogs = filteredLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const getTypeColor = (type: string) => {
    return type === 'lost' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'unclaimed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Post Creation Logbook
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Detailed log of all post creation events with user information
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, creator, or location..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="lost">Lost Items</SelectItem>
              <SelectItem value="found">Found Items</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="unclaimed">Unclaimed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {sortedLogs.length} of {logs.length} post creation events
        </div>

        {/* Log entries */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sortedLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No post creation events found matching your criteria.
            </div>
          ) : (
            sortedLogs.map((log) => (
              <div
                key={log.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getTypeColor(log.type)}>
                        {log.type === 'lost' ? 'Lost' : 'Found'}
                      </Badge>
                      <Badge className={getStatusColor(log.status)}>
                        {log.status}
                      </Badge>
                      {log.imageCount > 0 && (
                        <Badge variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          {log.imageCount}
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-medium text-lg mb-1">{log.title}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{log.creatorName}</span>
                          <span className="text-xs">({log.creatorEmail})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          <span>{log.category}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{format(log.createdAt, 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{log.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PostCreationLogbook;
