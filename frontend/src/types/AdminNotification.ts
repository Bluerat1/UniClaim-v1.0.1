// Admin notification types and interfaces
// Separate from user notifications for clean architecture

export interface AdminNotification {
    id: string;
    type: 'new_post' | 'flagged_post' | 'user_report' | 'system_alert' | 'activity_summary';
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    read: boolean;
    adminId: string; // Which admin this notification is for (or 'all' for broadcast)
    data?: any; // Additional context data
    createdAt: any;
    actionRequired?: boolean;
    relatedEntity?: {
        type: 'user' | 'post' | 'conversation';
        id: string;
        name?: string; // For display purposes
    };
}

// Data structure for new post notifications
export interface NewPostNotificationData {
    postId: string;
    postTitle: string;
    postType: 'lost' | 'found';
    postCategory: string;
    postLocation: string;
    creatorId: string;
    creatorName: string;
    creatorEmail: string;
}

// Admin notification preferences
export interface AdminNotificationPreferences {
    newPosts: boolean;
    flaggedPosts: boolean;
    userReports: boolean;
    systemAlerts: boolean;
    activitySummaries: boolean;
    emailNotifications: boolean; // Send email copies
    quietHours: {
        enabled: boolean;
        start: string; // "22:00"
        end: string; // "08:00"
    };
}
