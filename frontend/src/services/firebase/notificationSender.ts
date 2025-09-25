// Service for sending notifications to users when posts are created
import { db } from './config';
import { collection, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
import { notificationSubscriptionService } from './notificationSubscriptions';

// Notification data structure
export interface PostNotificationData {
    type: 'new_post';
    title: string;
    body: string;
    postId: string;
    postTitle: string;
    postCategory: string;
    postLocation: string;
    postType: 'lost' | 'found';
    creatorId: string;
    creatorName: string;
}

export class NotificationSender {
    private static instance: NotificationSender;

    static getInstance(): NotificationSender {
        if (!NotificationSender.instance) {
            NotificationSender.instance = new NotificationSender();
        }
        return NotificationSender.instance;
    }

    // Send notification to all active users when a new post is created
    async sendNewPostNotification(postData: {
        id: string;
        title: string;
        category: string;
        location: string;
        type: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
    }): Promise<void> {
        try {
            console.log('🚀 Starting to send new post notification for:', postData.title);
            console.log('📊 Post data:', postData);

            // Get users with optimal filtering (category + location + time awareness)
            const interestedSubscriptions = await notificationSubscriptionService.getOptimalUsersForPost({
                category: postData.category,
                location: postData.location,
                type: postData.type
            });

            console.log('🎯 Optimal filtering found', interestedSubscriptions.length, 'users for post:', postData.title);

            const notifications = [];

            // Create notification for each interested user (except the creator)
            for (const subscription of interestedSubscriptions) {
                const userId = subscription.userId;

                console.log('👤 Processing subscription for user:', userId);

                // Skip the post creator
                if (userId === postData.creatorId) {
                    console.log('⏭️ Skipping post creator:', userId);
                    continue;
                }

                // Note: shouldReceiveNotification check removed - getOptimalUsersForPost already filters by quiet hours

                // Create notification data
                const notificationData = {
                    userId,
                    type: 'new_post' as const,
                    title: this.generateNotificationTitle(postData),
                    body: this.generateNotificationBody(postData),
                    data: {
                        postId: postData.id,
                        postTitle: postData.title,
                        postCategory: postData.category,
                        postLocation: postData.location,
                        postType: postData.type,
                        creatorId: postData.creatorId,
                        creatorName: postData.creatorName
                    },
                    read: false,
                    createdAt: serverTimestamp(),
                    postId: postData.id
                };

                notifications.push(notificationData);
            }

            // Batch create all notifications using Firestore batch writes
            console.log('📝 Created', notifications.length, 'notifications to send');

            if (notifications.length > 0) {
                // Use Firestore batch for better performance and atomicity
                const batch = writeBatch(db);
                const notificationsRef = collection(db, 'notifications');

                notifications.forEach(notification => {
                    const docRef = doc(notificationsRef); // Auto-generated ID
                    batch.set(docRef, notification);
                });

                await batch.commit();
                console.log('✅ Successfully sent', notifications.length, 'new post notifications using batch write');
            } else {
                console.log('❌ No users to notify for this post');
            }

        } catch (error) {
            console.error('Error sending new post notifications:', error);
        }
    }

    // Note: shouldNotifyUser method removed - now using notificationSubscriptionService.shouldReceiveNotification()

    // Generate notification title based on post data
    private generateNotificationTitle(postData: any): string {
        if (postData.type === 'lost') {
            return `🔍 New Lost Item: ${postData.title}`;
        } else {
            return `🎯 New Found Item: ${postData.title}`;
        }
    }

    // Generate notification body based on post data
    private generateNotificationBody(postData: any): string {
        const location = postData.location || 'Unknown location';
        const category = postData.category || 'General';

        if (postData.type === 'lost') {
            return `Someone lost a ${category.toLowerCase()} at ${location}. Can you help?`;
        } else {
            return `Someone found a ${category.toLowerCase()} at ${location}. Is it yours?`;
        }
    }

    // Note: timeToMinutes method removed - now handled by notificationSubscriptionService

    // Send notification to specific users (for admin alerts, etc.)
    async sendNotificationToUsers(userIds: string[], notificationData: {
        type: 'admin_alert' | 'claim_update' | 'message';
        title: string;
        body: string;
        data?: any;
    }): Promise<void> {
        try {
            const notifications = userIds.map(userId => ({
                userId,
                ...notificationData,
                read: false,
                createdAt: serverTimestamp()
            }));

            // Use Firestore batch for better performance
            const batch = writeBatch(db);
            const notificationsRef = collection(db, 'notifications');

            notifications.forEach(notification => {
                const docRef = doc(notificationsRef);
                batch.set(docRef, notification);
            });

            await batch.commit();
            console.log(`Sent ${notifications.length} notifications to specific users using batch write`);
        } catch (error) {
            console.error('Error sending notifications to specific users:', error);
        }
    }
}

// Export singleton instance
export const notificationSender = NotificationSender.getInstance();
