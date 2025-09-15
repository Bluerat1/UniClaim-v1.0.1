// Admin notification service for mobile - separate from user notifications
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';
import { db } from './config';

// Types (matching frontend types for consistency)
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

export class AdminNotificationService {
    private static instance: AdminNotificationService;

    static getInstance(): AdminNotificationService {
        if (!AdminNotificationService.instance) {
            AdminNotificationService.instance = new AdminNotificationService();
        }
        return AdminNotificationService.instance;
    }

    // Create a new admin notification
    async createAdminNotification(notificationData: {
        type: AdminNotification['type'];
        title: string;
        message: string;
        priority?: AdminNotification['priority'];
        adminId: string; // Specific admin ID or 'all' for all admins
        data?: any;
        actionRequired?: boolean;
        relatedEntity?: AdminNotification['relatedEntity'];
    }): Promise<string> {
        try {
            const adminNotificationsRef = collection(db, 'admin_notifications');
            const docRef = await addDoc(adminNotificationsRef, {
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message,
                priority: notificationData.priority || 'normal',
                read: false,
                adminId: notificationData.adminId,
                data: notificationData.data || {},
                createdAt: serverTimestamp(),
                actionRequired: notificationData.actionRequired || false,
                relatedEntity: notificationData.relatedEntity || null
            });

            console.log('Successfully created admin notification:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error creating admin notification:', error);
            throw error;
        }
    }

    // Notify all admins about a new post
    async notifyAdminsNewPost(postData: NewPostNotificationData): Promise<void> {
        try {
            // Get all admin users
            const adminIds = await this.getAllAdminIds();

            if (adminIds.length === 0) {
                console.log('No admin users found to notify');
                return;
            }

            // Create notification for each admin (or use 'all' for broadcast)
            const title = `New ${postData.postType === 'lost' ? 'Lost' : 'Found'} Item Posted`;
            const message = `${postData.creatorName} posted a new ${postData.postType} item: "${postData.postTitle}" in ${postData.postCategory} category at ${postData.postLocation}.`;

            // Create notifications for all admins using 'all' adminId
            await this.createAdminNotification({
                type: 'new_post',
                title,
                message,
                priority: 'normal',
                adminId: 'all', // Broadcast to all admins
                data: {
                    postId: postData.postId,
                    postTitle: postData.postTitle,
                    postType: postData.postType,
                    postCategory: postData.postCategory,
                    postLocation: postData.postLocation,
                    creatorId: postData.creatorId,
                    creatorName: postData.creatorName,
                    creatorEmail: postData.creatorEmail
                },
                actionRequired: false,
                relatedEntity: {
                    type: 'post',
                    id: postData.postId,
                    name: postData.postTitle
                }
            });

            console.log(`Created admin notification for new post: ${postData.postTitle}`);
        } catch (error) {
            console.error('Error notifying admins of new post:', error);
        }
    }

    // Helper method to get all admin user IDs
    private async getAllAdminIds(): Promise<string[]> {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('role', '==', 'admin'));
            const snapshot = await getDocs(q);

            const adminIds: string[] = [];
            snapshot.forEach((doc) => {
                adminIds.push(doc.id);
            });

            return adminIds;
        } catch (error) {
            console.error('Error getting admin user IDs:', error);
            return [];
        }
    }
}

// Export singleton instance
export const adminNotificationService = AdminNotificationService.getInstance();
