// Mobile notification sender service for sending notifications to users when posts are created
import { db } from './config';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { notificationService } from './notifications';
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
            console.log('Sending new post notification for:', postData.title);

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

                // Skip the post creator
                if (userId === postData.creatorId) {
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

            // Batch create all notifications
            if (notifications.length > 0) {
                const batch = notifications.map(notification =>
                    addDoc(collection(db, 'notifications'), notification)
                );

                await Promise.all(batch);
                console.log(`Sent ${notifications.length} new post notifications`);

                // Send push notifications to users' phones
                for (const notification of notifications) {
                    try {
                        await notificationService.sendPushNotification(
                            notification.userId,
                            notification.title,
                            notification.body,
                            {
                                type: notification.type,
                                postId: notification.data.postId,
                                postTitle: notification.data.postTitle,
                                postCategory: notification.data.postCategory,
                                postLocation: notification.data.postLocation,
                                postType: notification.data.postType
                            }
                        );
                    } catch (error) {
                        console.error('Error sending push notification to user:', notification.userId, error);
                    }
                }
            } else {
                console.log('No users to notify for this post');
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

            const batch = notifications.map(notification =>
                addDoc(collection(db, 'notifications'), notification)
            );

            await Promise.all(batch);
            console.log(`Sent ${notifications.length} notifications to specific users`);
        } catch (error) {
            console.error('Error sending notifications to specific users:', error);
            // Don't throw error - notification failures shouldn't break main functionality
        }
    }
}

// Export singleton instance
export const notificationSender = NotificationSender.getInstance();
