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
    getDoc,
    writeBatch
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

            // Check current notification count before creating new one
            const currentCount = await this.getNotificationCount(notificationData.adminId);

            // If we're at or above the limit (15), delete exactly one oldest notification
            if (currentCount >= 15) {
                console.log(`🧹 Notification limit reached (${currentCount}), cleaning up oldest notification for admin: ${notificationData.adminId}`);
                await this.cleanupOldNotifications(notificationData.adminId, 14); // Keep 14, delete the oldest one to make room for new one
            }

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
            // Get all admin and campus security users
            const adminIds = await this.getAllAdminIds();

            if (adminIds.length === 0) {
                console.log('No admin or campus security users found to notify');
                return;
            }

            // Create notification for each admin and campus security user (or use 'all' for broadcast)
            const title = `New ${postData.postType === 'lost' ? 'Lost' : 'Found'} Item Posted`;
            const message = `${postData.creatorName} posted a new ${postData.postType} item: "${postData.postTitle}" in ${postData.postCategory} category at ${postData.postLocation}.`;

            // Create notifications for all admins and campus security using 'all' adminId
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

    // Helper method to get notification count for an admin
    private async getNotificationCount(adminId: string): Promise<number> {
        try {
            const adminNotificationsRef = collection(db, 'admin_notifications');

            // Get broadcast notifications count
            const broadcastQuery = query(
                adminNotificationsRef,
                where('adminId', '==', 'all')
            );
            const broadcastSnapshot = await getDocs(broadcastQuery);

            // Get specific admin notifications count
            const specificQuery = query(
                adminNotificationsRef,
                where('adminId', '==', adminId)
            );
            const specificSnapshot = await getDocs(specificQuery);

            return broadcastSnapshot.size + specificSnapshot.size;
        } catch (error) {
            console.error('Error getting notification count:', error);
            return 0;
        }
    }

    // Helper method to cleanup old notifications
    private async cleanupOldNotifications(adminId: string, keepCount: number): Promise<void> {
        try {
            if (keepCount <= 0) return;

            const adminNotificationsRef = collection(db, 'admin_notifications');

            // Get all notifications for this admin (both broadcast and specific)
            const broadcastQuery = query(
                adminNotificationsRef,
                where('adminId', '==', 'all')
            );

            const specificQuery = query(
                adminNotificationsRef,
                where('adminId', '==', adminId)
            );

            const [broadcastSnapshot, specificSnapshot] = await Promise.all([
                getDocs(broadcastQuery),
                getDocs(specificQuery)
            ]);

            const allNotifications: Array<{id: string, createdAt: any}> = [];

            // Collect all notifications with their creation times
            broadcastSnapshot.forEach((doc) => {
                allNotifications.push({
                    id: doc.id,
                    createdAt: doc.data().createdAt
                });
            });

            specificSnapshot.forEach((doc) => {
                allNotifications.push({
                    id: doc.id,
                    createdAt: doc.data().createdAt
                });
            });

            // Sort by createdAt ascending (oldest first)
            allNotifications.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return aTime - bTime;
            });

            // Delete oldest notifications, keeping only the specified count
            const notificationsToDelete = allNotifications.slice(0, allNotifications.length - keepCount);

            if (notificationsToDelete.length > 0) {
                const batch = writeBatch(db);

                notificationsToDelete.forEach(({id}) => {
                    const notificationRef = doc(db, 'admin_notifications', id);
                    batch.delete(notificationRef);
                });

                await batch.commit();
                console.log(`Deleted ${notificationsToDelete.length} old notifications for admin: ${adminId}`);
            }
        } catch (error) {
            console.error('Error cleaning up old notifications:', error);
            throw error;
        }
    }

    // Helper method to get all admin user IDs (includes campus_security)
    private async getAllAdminIds(): Promise<string[]> {
        try {
            const usersRef = collection(db, 'users');

            // Get both admin and campus_security users
            const adminQuery = query(usersRef, where('role', '==', 'admin'));
            const campusSecurityQuery = query(usersRef, where('role', '==', 'campus_security'));

            const [adminSnapshot, campusSecuritySnapshot] = await Promise.all([
                getDocs(adminQuery),
                getDocs(campusSecurityQuery)
            ]);

            const adminIds: string[] = [];

            // Add admin users
            adminSnapshot.forEach((doc) => {
                adminIds.push(doc.id);
            });

            // Add campus security users
            campusSecuritySnapshot.forEach((doc) => {
                adminIds.push(doc.id);
            });

            console.log(`Found ${adminSnapshot.size} admin users and ${campusSecuritySnapshot.size} campus security users`);
            return adminIds;
        } catch (error) {
            console.error('Error getting admin user IDs:', error);
            return [];
        }
    }
}

// Export singleton instance
export const adminNotificationService = AdminNotificationService.getInstance();
