// Service for sending notifications to users when posts are created
import { db } from './config';
import { collection, serverTimestamp, doc, writeBatch, getDoc, addDoc } from 'firebase/firestore';
import { notificationSubscriptionService } from './notificationSubscriptions';
import { authService } from './auth';
import { adminNotificationService } from './adminNotifications';
export interface PostNotificationData {
    type: 'new_post' | 'claim_request';
    title: string;
    body: string;
    postId: string;
    postTitle: string;
    postCategory: string;
    postLocation: string;
    postType: 'lost' | 'found';
    creatorId: string;
    creatorName: string;
    conversationId?: string;
}

export class NotificationSender {
    private static instance: NotificationSender;

    static getInstance(): NotificationSender {
        if (!NotificationSender.instance) {
            NotificationSender.instance = new NotificationSender();
        }
        return NotificationSender.instance;
    }

    // Send notification for claim requests
    async sendClaimRequestNotification(conversationId: string, claimData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        senderId: string;
        senderName: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending claim request notification for post:', claimData.postTitle);

            // Get the conversation to find the post owner
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const recipientId = Object.keys(conversationData.participants || {}).find(id => id !== claimData.senderId);

            if (!recipientId) {
                throw new Error('No recipient found for claim request');
            }

            // Send notification to the post owner
            await this.sendNotificationToUser(recipientId, {
                type: 'claim_request',
                title: 'New Claim Request',
                body: `${claimData.senderName} has submitted a claim for your ${claimData.postType} post: ${claimData.postTitle}`,
                postId: claimData.postId,
                postTitle: claimData.postTitle,
                postCategory: '',
                postLocation: '',
                postType: claimData.postType,
                creatorId: claimData.senderId,
                creatorName: claimData.senderName,
                conversationId: conversationId
            });

            console.log('✅ Claim request notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send claim request notification:', error);
            throw error;
        }
    }

    // Send notification to a specific user
    private async sendNotificationToUser(userId: string, notificationData: PostNotificationData): Promise<void> {
        try {
            // In a real implementation, you would:
            // 1. Get the user's FCM token from Firestore
            // 2. Send a push notification using Firebase Cloud Messaging
            // 3. Save the notification to the user's notifications collection

            // For now, we'll just log it
            console.log(`📨 Sending notification to user ${userId}:`, notificationData);

            // Save notification to user's notifications collection
            // Note: This requires proper Firestore security rules to allow cross-user writes
            // For now, we'll make this non-blocking to avoid breaking the main flow
            try {
                const notificationRef = collection(db, 'users', userId, 'notifications');
                await addDoc(notificationRef, {
                    ...notificationData,
                    read: false,
                    createdAt: serverTimestamp()
                });

                console.log(`✅ Notification saved for user ${userId}`);
            } catch (notificationError) {
                // Make notification saving non-blocking - don't throw error
                console.warn(`⚠️ Failed to save notification for user ${userId}:`, notificationError);
                // Don't throw - this shouldn't break the main claim acceptance flow
            }
        } catch (error) {
            console.error(`❌ Failed to send notification to user ${userId}:`, error);
            // Don't throw error - notification failures shouldn't break main functionality
        }
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
    // Send response notification for handover/claim requests
    async sendResponseNotification(conversationId: string, responseData: {
        responderId: string;
        responderName: string;
        responseType: 'handover_response' | 'claim_response';
        status: 'accepted' | 'rejected';
        postTitle?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending response notification for conversation:', conversationId);

            // Get the conversation to find participants
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const participantIds = Object.keys(conversationData.participants || {});

            // Get other participants (exclude the responder)
            const recipientIds = participantIds.filter(id => id !== responseData.responderId);

            if (recipientIds.length === 0) {
                console.log('⚠️ No recipients found for response notification');
                return;
            }

            const postTitle = responseData.postTitle || 'Unknown Post';
            const statusText = responseData.status === 'accepted' ? 'accepted' : 'rejected';

            // Send notifications to all other participants
            await this.sendNotificationToUsers(recipientIds, {
                type: 'message',
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

            // Send admin notifications
            await this.sendAdminNotifications({
                type: responseData.responseType === 'handover_response' ? 'admin_handover' : 'admin_claim',
                title: `${responseData.responseType === 'handover_response' ? 'Handover' : 'Claim'} ${statusText}`,
                body: `${responseData.responderName} ${statusText} a ${responseData.responseType === 'handover_response' ? 'handover' : 'claim'} request for "${postTitle}"`,
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

            console.log(`✅ Response notification sent to ${recipientIds.length} participants and admins`);
        } catch (error) {
            console.error('❌ Failed to send response notification:', error);
            throw error;
        }
    }

    // Send message notification to conversation participants
    async sendMessageNotification(conversationId: string, messageData: {
        senderId: string;
        senderName: string;
        text: string;
        postTitle?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending message notification for conversation:', conversationId);

            // Get the conversation to find participants
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const participantIds = Object.keys(conversationData.participants || {});

            // Get other participants (exclude the sender)
            const recipientIds = participantIds.filter(id => id !== messageData.senderId);

            if (recipientIds.length === 0) {
                console.log('⚠️ No recipients found for message notification');
                return;
            }

            // Create notification data
            const postTitle = messageData.postTitle || 'Unknown Post';
            const truncatedText = messageData.text.length > 50
                ? messageData.text.substring(0, 50) + '...'
                : messageData.text;

            // Send notifications to all other participants
            await this.sendNotificationToUsers(recipientIds, {
                type: 'message',
                title: `New Message from ${messageData.senderName}`,
                body: `${messageData.senderName}: ${truncatedText}`,
                data: {
                    conversationId: conversationId,
                    postTitle: postTitle,
                    senderId: messageData.senderId,
                    senderName: messageData.senderName,
                    messageText: messageData.text,
                    timestamp: new Date().toISOString()
                }
            });

            // Send admin notifications
            await this.sendAdminNotifications({
                type: 'admin_message',
                title: `New Message in Conversation`,
                body: `${messageData.senderName} sent a message in "${postTitle}"`,
                data: {
                    conversationId: conversationId,
                    postTitle: postTitle,
                    senderId: messageData.senderId,
                    senderName: messageData.senderName,
                    messageText: messageData.text,
                    timestamp: new Date().toISOString()
                }
            });

            console.log(`✅ Message notification sent to ${recipientIds.length} participants and admins`);
        } catch (error) {
            console.error('❌ Failed to send message notification:', error);
            throw error;
        }
    }

    // Send notification to all admin users
    async sendAdminNotifications(notificationData: {
        type: 'admin_message' | 'admin_alert' | 'admin_claim' | 'admin_handover';
        title: string;
        body: string;
        data?: any;
    }): Promise<void> {
        try {
            console.log('🚨 Sending admin notification:', notificationData.title);

            // Get all admin users
            const adminUsers = await authService.getAllAdminUsers();

            if (adminUsers.length === 0) {
                console.log('⚠️ No admin users found');
                return;
            }

            // Create admin notification for each admin user using the admin notification service
            for (const admin of adminUsers) {
                await adminNotificationService.createAdminNotification({
                    type: 'system_alert', // Use system_alert for message notifications to admins
                    title: notificationData.title,
                    message: notificationData.body,
                    priority: 'normal',
                    adminId: admin.uid, // Send to specific admin
                    data: {
                        ...notificationData.data,
                        isAdminNotification: true,
                        adminNotificationType: notificationData.type
                    },
                    actionRequired: false,
                    relatedEntity: notificationData.data?.conversationId ? {
                        type: 'conversation',
                        id: notificationData.data.conversationId,
                        name: notificationData.data.postTitle || 'Conversation'
                    } : undefined
                });
            }

            console.log(`✅ Admin notification sent to ${adminUsers.length} admins`);
        } catch (error) {
            console.error('❌ Failed to send admin notification:', error);
            throw error;
        }
    }

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

            // Test notification click functionality (development only)
            if (process.env.NODE_ENV === 'development' && notificationData.type === 'message') {
                console.log('🧪 Development mode: Testing notification click...');
                setTimeout(() => {
                    const testUrl = `/messages?conversation=${notificationData.data?.conversationId}`;
                    console.log('🧪 Would navigate to:', testUrl);
                    // Uncomment the next line to test navigation
                    // window.open(testUrl, '_blank');
                }, 1000);
            }
        } catch (error) {
            console.error('Error sending notifications to specific users:', error);
        }
    }
}

// Export singleton instance
export const notificationSender = NotificationSender.getInstance();
