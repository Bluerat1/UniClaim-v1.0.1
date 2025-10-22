// Mobile notification sender service for sending notifications to users when posts are created
import { db } from './config';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { notificationService } from './notifications';
import { notificationSubscriptionService } from './notificationSubscriptions';
import { adminNotificationService } from './adminNotifications';

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

            // Batch create all notifications using notificationService
            if (notifications.length > 0) {
                for (const notification of notifications) {
                    try {
                        await notificationService.createNotification({
                            userId: notification.userId,
                            type: notification.type,
                            title: notification.title,
                            body: notification.body,
                            data: notification.data,
                            postId: notification.postId
                        });
                        console.log(`✅ Mobile: Created notification for user ${notification.userId}`);
                    } catch (error) {
                        console.error(`❌ Mobile: Failed to create notification for user ${notification.userId}:`, error);
                    }
                }

                console.log(`✅ Mobile: Sent ${notifications.length} new post notifications with limit enforcement`);

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

    // Send response notification for handover/claim requests
    async sendResponseNotification(conversationId: string, responseData: {
        responderId: string;
        responderName: string;
        responseType: 'handover_response' | 'claim_response';
        status: 'accepted' | 'rejected';
        postTitle?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Mobile: Sending response notification for conversation:', conversationId);

            // Get the conversation to find participants
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('./config');

            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                console.warn('⚠️ Mobile: Conversation not found for response notification, skipping silently');
                return;
            }

            const conversationData = conversationDoc.data();
            const participantIds = Object.keys(conversationData.participants || {});

            // Get other participants (exclude the responder)
            const recipientIds = participantIds.filter(id => id !== responseData.responderId);

            if (recipientIds.length === 0) {
                console.log('⚠️ Mobile: No recipients found for response notification');
                return;
            }

            const postTitle = responseData.postTitle || 'Unknown Post';
            const statusText = responseData.status === 'accepted' ? 'accepted' : 'rejected';

            // Send notifications to all other participants
            await this.sendNotificationToUsers(recipientIds, {
                type: responseData.status === 'rejected' ?
                    (responseData.responseType === 'handover_response' ? 'handover_response' : 'claim_response') :
                    'message',
                title: `${responseData.responseType === 'handover_response' ? 'Handover' : 'Claim'} ${statusText}`,
                body: `${responseData.responderName} ${statusText} the ${responseData.responseType === 'handover_response' ? 'handover' : 'claim'} request for "${postTitle}"`,
                data: {
                    conversationId: conversationId,
                    postTitle: postTitle,
                    responderId: responseData.responderId,
                    responderName: responseData.responderName,
                    responseType: responseData.responseType,
                    status: responseData.status,
                    timestamp: new Date().toISOString()
                }
            });

            console.log(`✅ Mobile: Response notification sent to ${recipientIds.length} participants`);
        } catch (error) {
            console.error('❌ Mobile: Failed to send response notification:', error);
            // Don't throw error - notification failures shouldn't break main functionality
        }
    }
    async sendNotificationToUsers(userIds: string[], notificationData: {
        type: 'admin_alert' | 'claim_update' | 'message' | 'claim_response' | 'handover_response';
        title: string;
        body: string;
        data?: any;
    }): Promise<void> {
        try {
            for (const userId of userIds) {
                try {
                    await notificationService.createNotification({
                        userId: userId,
                        type: notificationData.type,
                        title: notificationData.title,
                        body: notificationData.body,
                        data: notificationData.data || {},
                        // Note: postId and conversationId not included in this interface, but can be added to data if needed
                    });
                    console.log(`✅ Mobile: Created notification for user ${userId}`);
                } catch (error) {
                    console.error(`❌ Mobile: Failed to create notification for user ${userId}:`, error);
                }
            }
            console.log(`✅ Mobile: Sent ${userIds.length} notifications to specific users with limit enforcement`);
        } catch (error) {
            console.error('❌ Mobile: Error sending notifications to specific users:', error);
            // Don't throw error - notification failures shouldn't break main functionality
        }
    }

    // Send message notifications to conversation participants
    async sendMessageNotifications(userIds: string[], messageData: {
        conversationId: string;
        senderId: string;
        senderName: string;
        messageText: string;
        conversationData: any;
    }): Promise<void> {
        try {
            console.log('📱 Mobile: Sending message notifications to users:', userIds);
            console.log('📱 Mobile: Message data:', {
                conversationId: messageData.conversationId,
                senderId: messageData.senderId,
                senderName: messageData.senderName,
                messageText: messageData.messageText.substring(0, 50) + '...'
            });

            const notifications = [];
            const adminNotifications = [];
            const adminUserIds: string[] = [];

            for (const userId of userIds) {
                try {
                    // Check if user should receive message notifications (only for regular users)
                    const shouldNotify = await notificationService.shouldSendNotification(userId, 'message');
                    if (!shouldNotify) {
                        console.log(`🚫 Mobile: User ${userId} has message notifications disabled or is in quiet hours`);
                        continue;
                    }

                    // Get user data to check if they're an admin and determine if they're mobile or web
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    if (!userDoc.exists()) {
                        console.log(`⚠️ Mobile: User ${userId} not found, skipping notification`);
                        continue;
                    }

                    const userData = userDoc.data();
                    const isMobileUser = userData.pushToken && userData.pushToken.length > 0;
                    const isAdmin = userData.role === 'admin' || userData.role === 'campus_security';

                    if (isAdmin) {
                        // Handle admin users differently - they get admin notifications
                        adminUserIds.push(userId);

                        const adminNotificationData = {
                            type: 'activity_summary' as const, // Use activity_summary for message activity
                            title: `New Message Activity`,
                            message: `${messageData.senderName} sent a message in conversation about "${messageData.conversationData?.postTitle || 'Unknown Item'}"`,
                            priority: 'normal' as const,
                            adminId: userId, // Send to specific admin
                            data: {
                                conversationId: messageData.conversationId,
                                senderId: messageData.senderId,
                                senderName: messageData.senderName,
                                messageText: messageData.messageText,
                                postId: messageData.conversationData?.postId || null,
                                postTitle: messageData.conversationData?.postTitle || null,
                                conversationParticipants: messageData.conversationData?.participants || {}
                            },
                            actionRequired: false,
                            relatedEntity: {
                                type: 'conversation' as const,
                                id: messageData.conversationId,
                                name: `Conversation about ${messageData.conversationData?.postTitle || 'Unknown Item'}`
                            }
                        };

                        adminNotifications.push(adminNotificationData);
                        console.log(`👑 Mobile: Created admin notification for admin user ${userId}`);
                    } else {
                        // Handle regular users - send regular notifications
                        // Create notification data
                        const notificationData = {
                            userId,
                            type: 'message' as const,
                            title: `New message from ${messageData.senderName}`,
                            body: messageData.messageText.length > 50
                                ? `${messageData.messageText.substring(0, 50)}...`
                                : messageData.messageText,
                            data: {
                                conversationId: messageData.conversationId,
                                senderId: messageData.senderId,
                                senderName: messageData.senderName,
                                messageText: messageData.messageText,
                                postId: messageData.conversationData?.postId || null,
                                postTitle: messageData.conversationData?.postTitle || null
                            },
                            read: false,
                            createdAt: serverTimestamp(),
                            conversationId: messageData.conversationId
                        };

                        notifications.push(notificationData);

                        // Send push notification immediately if user is on mobile
                        if (isMobileUser) {
                            try {
                                await notificationService.sendPushNotification(
                                    userId,
                                    notificationData.title,
                                    notificationData.body,
                                    {
                                        type: 'message',
                                        conversationId: messageData.conversationId,
                                        senderId: messageData.senderId,
                                        senderName: messageData.senderName,
                                        messageText: messageData.messageText
                                    }
                                );
                                console.log(`📲 Mobile: Sent push notification to mobile user ${userId}`);
                            } catch (pushError) {
                                console.warn(`⚠️ Mobile: Failed to send push notification to ${userId}:`, pushError);
                                // Continue - database notification will still be created
                            }
                        } else {
                            console.log(`💻 Mobile: User ${userId} appears to be web user, database notification created`);
                        }
                    }

                } catch (userError) {
                    console.error(`❌ Mobile: Error processing notification for user ${userId}:`, userError);
                    // Continue with other users
                }
            }

            // Batch create regular user notifications using notificationService
            if (notifications.length > 0) {
                for (const notification of notifications) {
                    try {
                        await notificationService.createNotification({
                            userId: notification.userId,
                            type: notification.type,
                            title: notification.title,
                            body: notification.body,
                            data: notification.data,
                            conversationId: notification.conversationId
                        });
                        console.log(`✅ Mobile: Created message notification for user ${notification.userId}`);
                    } catch (error) {
                        console.error(`❌ Mobile: Failed to create message notification for user ${notification.userId}:`, error);
                    }
                }
                console.log(`✅ Mobile: Created ${notifications.length} regular message notifications in database with limit enforcement`);
            } else {
                console.log('ℹ️ Mobile: No regular users eligible for message notifications');
            }

            // Batch create admin notifications
            if (adminNotifications.length > 0) {
                const adminBatch = adminNotifications.map(adminNotification =>
                    adminNotificationService.createAdminNotification(adminNotification)
                );

                await Promise.all(adminBatch);
                console.log(`✅ Mobile: Created ${adminNotifications.length} admin message notifications in database`);
            } else {
                console.log('ℹ️ Mobile: No admin users to notify');
            }

        } catch (error) {
            console.error('❌ Mobile: Error sending message notifications:', error);
            // Don't throw error - notification failures shouldn't break message sending
        }
    }
}

// Export singleton instance
export const notificationSender = NotificationSender.getInstance();
