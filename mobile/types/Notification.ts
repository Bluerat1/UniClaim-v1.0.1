// Notification types for the mobile app
export interface NotificationData {
    id: string;
    userId: string;
    type: 'new_post' | 'message' | 'claim_update' | 'admin_alert' | 'conversation_deleted';
    title: string;
    body: string;
    data?: any;
    read: boolean;
    createdAt: any;
    postId?: string;
    conversationId?: string;
}

// User notification preferences
export interface NotificationPreferences {
    newPosts: boolean;
    messages: boolean;
    claimUpdates: boolean;
    adminAlerts: boolean;
    locationFilter: boolean;
    categoryFilter: string[];
    quietHours: {
        enabled: boolean;
        start: string; // "22:00"
        end: string;   // "08:00"
    };
}
