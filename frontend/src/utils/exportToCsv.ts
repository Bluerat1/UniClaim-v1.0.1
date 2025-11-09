export const exportToCsv = (posts: any[], type: 'lost' | 'found' | 'all') => {
  // Filter posts by type if needed
  const filteredPosts = type === 'all' 
    ? posts 
    : posts.filter(post => post.type === type);

  if (filteredPosts.length === 0) {
    return null;
  }

  // Define CSV headers
  const headers = [
    'ID',
    'Type',
    'Title',
    'Description',
    'Category',
    'Location',
    'Status',
    'Created At',
    'Reported By',
    'Email',
    'Contact Number',
    'Student ID'
  ];

  // Convert posts to CSV rows
  const rows = filteredPosts.map(post => {
    const createdAt = post.createdAt?.toDate 
      ? post.createdAt.toDate().toLocaleString() 
      : post.createdAt?.toLocaleString() || 'N/A';
      
    return [
      `"${post.id || ''}"`,
      `"${post.type || ''}"`,
      `"${post.title?.replace(/"/g, '""') || ''}"`,
      `"${post.description?.replace(/"/g, '""') || ''}"`,
      `"${post.category || ''}"`,
      `"${post.location || ''}"`,
      `"${post.status || 'pending'}"`,
      `"${createdAt}"`,
      `"${post.user?.firstName ? `${post.user.firstName} ${post.user.lastName || ''}`.trim() : 'N/A'}"`,
      `"${post.user?.email || 'N/A'}"`,
      `"${post.user?.contactNum || 'N/A'}"`,
      `"${post.user?.studentId || 'N/A'}"`
    ].join(',');
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows
  ].join('\n');

  return csvContent;
};

export const downloadCsv = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
