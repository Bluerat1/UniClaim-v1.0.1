// Admin notification service - separate from user notifications
import {
    collection,
    addDoc,
    query,
    where,
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
import type {
    AdminNotification,
    NewPostNotificationData,
    AdminNotificationPreferences
} from '../../types/AdminNotification';

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
            console.log('🔔 Starting admin notification process for post:', postData.postTitle);

            // Get all admin and campus security users
            const adminIds = await this.getAllAdminIds();
            console.log('📋 Found admin and campus security users:', adminIds.length, adminIds);

            if (adminIds.length === 0) {
                console.warn('⚠️ No admin or campus security users found to notify - make sure there are users with role: "admin" or "campus_security"');
                return;
            }

            // Create notification for each admin and campus security user (or use 'all' for broadcast)
            const title = `New ${postData.postType === 'lost' ? 'Lost' : 'Found'} Item Posted`;
            const message = `${postData.creatorName} posted a new ${postData.postType} item: "${postData.postTitle}" in ${postData.postCategory} category at ${postData.postLocation}.`;

            console.log('📝 Creating admin notification:', { title, message });

            // Create notifications for all admins using 'all' adminId
            const notificationId = await this.createAdminNotification({
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

            console.log(`✅ Successfully created admin notification (ID: ${notificationId}) for new post: ${postData.postTitle}`);
        } catch (error) {
            console.error('❌ Error notifying admins of new post:', error);
            console.error('Stack trace:', error);
        }
    }

    // Get admin notifications for a specific admin
    async getAdminNotifications(adminId: string, limitCount: number = 15): Promise<AdminNotification[]> {
        try {
            // console.log('🔍 Getting admin notifications for adminId:', adminId);
            const adminNotificationsRef = collection(db, 'admin_notifications');

            // Get broadcast notifications (adminId: 'all')
            // console.log('📋 Querying broadcast notifications...');
            const broadcastQuery = query(
                adminNotificationsRef,
                where('adminId', '==', 'all'),
                limit(limitCount)
            );

            const broadcastSnapshot = await getDocs(broadcastQuery);
            const notifications: AdminNotification[] = [];

            broadcastSnapshot.forEach((doc) => {
                // console.log('📄 Found broadcast notification:', doc.id, doc.data());
                notifications.push({
                    id: doc.id,
                    ...doc.data()
                } as AdminNotification);
            });

            // Get specific admin notifications
            // console.log('📋 Querying specific admin notifications...');
            const specificQuery = query(
                adminNotificationsRef,
                where('adminId', '==', adminId),
                limit(limitCount)
            );

            const specificSnapshot = await getDocs(specificQuery);
            specificSnapshot.forEach((doc) => {
                // console.log('📄 Found specific notification:', doc.id, doc.data());
                notifications.push({
                    id: doc.id,
                    ...doc.data()
                } as AdminNotification);
            });

            // Sort all notifications by createdAt descending
            notifications.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

            // Limit to requested count
            const limitedNotifications = notifications.slice(0, limitCount);

            // console.log('✅ Retrieved admin notifications:', limitedNotifications.length);
            return limitedNotifications;
        } catch (error) {
            console.error('❌ Error getting admin notifications:', error);
            throw error;
        }
    }

    // Get unread count for admin
    async getUnreadCount(adminId: string): Promise<number> {
        try {
            // console.log('🔢 Getting unread count for adminId:', adminId);
            const adminNotificationsRef = collection(db, 'admin_notifications');

            // Get broadcast unread notifications
            const broadcastQuery = query(
                adminNotificationsRef,
                where('adminId', '==', 'all'),
                where('read', '==', false)
            );
            const broadcastSnapshot = await getDocs(broadcastQuery);

            // Get specific admin unread notifications
            const specificQuery = query(
                adminNotificationsRef,
                where('adminId', '==', adminId),
                where('read', '==', false)
            );
            const specificSnapshot = await getDocs(specificQuery);

            const totalUnread = broadcastSnapshot.size + specificSnapshot.size;
            // console.log('🔢 Total unread notifications:', totalUnread, `(broadcast: ${broadcastSnapshot.size}, specific: ${specificSnapshot.size})`);
            return totalUnread;
        } catch (error) {
            console.error('❌ Error getting unread count:', error);
            return 0;
        }
    }

    // Mark admin notification as read
    async markAsRead(notificationId: string): Promise<void> {
        try {
            const notificationRef = doc(db, 'admin_notifications', notificationId);
            await updateDoc(notificationRef, {
                read: true
            });
            console.log('Marked admin notification as read:', notificationId);
        } catch (error) {
            console.error('Error marking admin notification as read:', error);
            throw error;
        }
    }

    // Mark all admin notifications as read for a specific admin
    async markAllAsRead(adminId: string): Promise<void> {
        try {
            const adminNotificationsRef = collection(db, 'admin_notifications');

            // Get all unread notifications for this admin (both broadcast and specific)
            const broadcastQuery = query(
                adminNotificationsRef,
                where('adminId', '==', 'all'),
                where('read', '==', false)
            );

            const specificQuery = query(
                adminNotificationsRef,
                where('adminId', '==', adminId),
                where('read', '==', false)
            );

            const [broadcastSnapshot, specificSnapshot] = await Promise.all([
                getDocs(broadcastQuery),
                getDocs(specificQuery)
            ]);

            if (broadcastSnapshot.size === 0 && specificSnapshot.size === 0) {
                console.log('No unread admin notifications to mark as read');
                return;
            }

            // Use batch write for better performance when updating multiple documents
            const batch = writeBatch(db);

            // Mark broadcast notifications as read
            broadcastSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });

            // Mark specific admin notifications as read
            specificSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });

            await batch.commit();
            console.log(`Marked ${broadcastSnapshot.size + specificSnapshot.size} admin notifications as read for admin: ${adminId} using batch write`);
        } catch (error) {
            console.error('Error marking all admin notifications as read:', error);
            throw error;
        }
    }

    // Delete admin notification
    async deleteNotification(notificationId: string): Promise<void> {
        try {
            const notificationRef = doc(db, 'admin_notifications', notificationId);
            await deleteDoc(notificationRef);
            console.log('Deleted admin notification:', notificationId);
        } catch (error) {
            console.error('Error deleting admin notification:', error);
            throw error;
        }
    }

    // Delete all admin notifications for a specific admin
    async deleteAllNotifications(adminId: string): Promise<void> {
        try {
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

            if (broadcastSnapshot.size === 0 && specificSnapshot.size === 0) {
                console.log('No admin notifications to delete');
                return;
            }

            // Use batch write for better performance when deleting multiple documents
            const batch = writeBatch(db);

            // Delete broadcast notifications
            broadcastSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Delete specific admin notifications
            specificSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log(`Deleted ${broadcastSnapshot.size + specificSnapshot.size} admin notifications for admin: ${adminId} using batch write`);
        } catch (error) {
            console.error('Error deleting all admin notifications:', error);
            throw error;
        }
    }

    // Setup real-time listener for admin notifications
    setupRealtimeListener(
        adminId: string,
        onNotificationsChange: (notifications: AdminNotification[]) => void,
        onError?: (error: Error) => void
    ) {
        try {
            console.log('🔄 Setting up real-time listener for adminId:', adminId);
            const adminNotificationsRef = collection(db, 'admin_notifications');

            // Set up listener for broadcast notifications (adminId: 'all')
            const broadcastQuery = query(
                adminNotificationsRef,
                where('adminId', '==', 'all'),
                limit(15)
            );

            // Set up listener for specific admin notifications
            const specificQuery = query(
                adminNotificationsRef,
                where('adminId', '==', adminId),
                limit(15)
            );

            // Listen to both queries
            const unsubscribeBroadcast = onSnapshot(broadcastQuery,
                (broadcastSnapshot) => {
                    // console.log('🔄 Broadcast notifications update:', broadcastSnapshot.size);

                    // Also get specific admin notifications
                    getDocs(specificQuery).then(specificSnapshot => {
                        const allNotifications: AdminNotification[] = [];

                        // Add broadcast notifications
                        broadcastSnapshot.forEach((doc) => {
                            // console.log('📄 Broadcast notification:', doc.id, doc.data());
                            allNotifications.push({
                                id: doc.id,
                                ...doc.data()
                            } as AdminNotification);
                        });

                        // Add specific admin notifications
                        specificSnapshot.forEach((doc) => {
                            // console.log('📄 Specific admin notification:', doc.id, doc.data());
                            allNotifications.push({
                                id: doc.id,
                                ...doc.data()
                            } as AdminNotification);
                        });

                        // Sort by createdAt descending
                        allNotifications.sort((a, b) => {
                            const aTime = a.createdAt?.toMillis?.() || 0;
                            const bTime = b.createdAt?.toMillis?.() || 0;
                            return bTime - aTime;
                        });

                        // console.log('🔄 Total notifications after merge:', allNotifications.length);
                        onNotificationsChange(allNotifications);
                    }).catch(error => {
                        console.error('❌ Error getting specific admin notifications:', error);
                        if (onError) onError(error);
                    });
                },
                (error) => {
                    console.error('❌ Broadcast notifications listener error:', error);
                    if (onError) onError(error);
                }
            );

            // Also listen to specific admin notifications for real-time updates
            const unsubscribeSpecific = onSnapshot(specificQuery,
                (specificSnapshot) => {
                    // console.log('🔄 Specific admin notifications update:', specificSnapshot.size);

                    // Get broadcast notifications too
                    getDocs(broadcastQuery).then(broadcastSnapshot => {
                        const allNotifications: AdminNotification[] = [];

                        // Add specific admin notifications
                        specificSnapshot.forEach((doc) => {
                            console.log('📄 Specific notification:', doc.id, doc.data());
                            allNotifications.push({
                                id: doc.id,
                                ...doc.data()
                            } as AdminNotification);
                        });

                        // Add broadcast notifications
                        broadcastSnapshot.forEach((doc) => {
                            console.log('📄 Broadcast notification:', doc.id, doc.data());
                            allNotifications.push({
                                id: doc.id,
                                ...doc.data()
                            } as AdminNotification);
                        });

                        // Sort by createdAt descending
                        allNotifications.sort((a, b) => {
                            const aTime = a.createdAt?.toMillis?.() || 0;
                            const bTime = b.createdAt?.toMillis?.() || 0;
                            return bTime - aTime;
                        });

                        // console.log('🔄 Total notifications after merge:', allNotifications.length);
                        onNotificationsChange(allNotifications);
                    }).catch(error => {
                        console.error('❌ Error getting broadcast notifications:', error);
                        if (onError) onError(error);
                    });
                },
                (error) => {
                    console.error('❌ Specific admin notifications listener error:', error);
                    if (onError) onError(error);
                }
            );

            // Return unsubscribe function that unsubscribes from both listeners
            return () => {
                unsubscribeBroadcast();
                unsubscribeSpecific();
            };
        } catch (error) {
            console.error('❌ Error setting up admin notifications listener:', error);
            if (onError) onError(error as Error);
            return () => { }; // Return empty unsubscribe function
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

    // Get admin notification preferences
    async getAdminPreferences(adminId: string): Promise<AdminNotificationPreferences> {
        try {
            const preferencesRef = doc(db, 'admin_notification_preferences', adminId);
            const docSnap = await getDoc(preferencesRef);

            if (docSnap.exists()) {
                return docSnap.data() as AdminNotificationPreferences;
            } else {
                // Return default preferences
                return this.getDefaultPreferences();
            }
        } catch (error) {
            console.error('Error getting admin notification preferences:', error);
            return this.getDefaultPreferences();
        }
    }

    // Get default admin notification preferences
    private getDefaultPreferences(): AdminNotificationPreferences {
        return {
            newPosts: true,
            flaggedPosts: true,
            userReports: true,
            systemAlerts: true,
            activitySummaries: false,
            emailNotifications: false,
            quietHours: {
                enabled: false,
                start: '22:00',
                end: '08:00'
            }
        };
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
