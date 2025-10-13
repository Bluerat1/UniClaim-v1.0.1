// Service for sending notifications to users when posts are created
import { db } from './config';
import { collection, serverTimestamp, doc, writeBatch, getDoc } from 'firebase/firestore';
import { notificationSubscriptionService } from './notificationSubscriptions';
import { authService } from './auth';
import { adminNotificationService } from './adminNotifications';
import { userService } from './users';
export interface PostNotificationData {
    type: 'new_post' | 'claim_request' | 'claim_response' | 'handover_response' | 'status_change' | 'post_reverted' | 'post_activated' | 'post_deleted' | 'post_restored' | 'post_hidden' | 'post_unhidden' | 'post_approved';
    title: string;
    body: string;
    postId?: string;
    postTitle?: string;
    postCategory?: string;
    postLocation?: string;
    postType?: 'lost' | 'found';
    creatorId?: string;
    creatorName?: string;
    data?: any;
    conversationId?: string;
} // Already there, but making sure

export class NotificationSender {
    private static instance: NotificationSender;
    static getInstance(): NotificationSender {
        if (!NotificationSender.instance) {
            NotificationSender.instance = new NotificationSender();
        }
        return NotificationSender.instance;
    }

    // Send notification for status changes
    async sendStatusChangeNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        oldStatus: string;
        newStatus: string;
        adminName?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending status change notification for post:', postData.postTitle);

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for status change notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'status_change',
                title: `Post Status Updated`,
                body: `Your ${postData.postType} post "${postData.postTitle}" status changed from ${postData.oldStatus} to ${postData.newStatus}${postData.adminName ? ` by ${postData.adminName}` : ''}`,
                postId: postData.postId,
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    oldStatus: postData.oldStatus,
                    newStatus: postData.newStatus,
                    adminName: postData.adminName,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Status change notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send status change notification:', error);
            throw error;
        }
    }
    async sendActivateNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        adminName?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending post activation notification for post:', postData.postTitle);

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for activation notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'post_activated',
                title: `Post Activated`,
                body: `Your ${postData.postType} post "${postData.postTitle}" has been activated by ${postData.adminName ? postData.adminName : 'an admin'} and is now visible to other users.`,
                postId: postData.postId,
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    adminName: postData.adminName,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Post activation notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send post activation notification:', error);
            throw error;
        }
    }

    // Send notification for post deletion (admin action)
    async sendDeleteNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        adminName?: string;
        deletionType?: 'soft' | 'permanent';
    }): Promise<void> {
        try {
            console.log('🚀 Sending post deletion notification for post:', postData.postTitle);

            const deletionTypeText = postData.deletionType === 'permanent' ? 'permanently deleted' : 'moved to Recently Deleted';

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for deletion notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'post_deleted',
                title: `Post ${deletionTypeText.charAt(0).toUpperCase() + deletionTypeText.slice(1)}`,
                body: `Your ${postData.postType} post "${postData.postTitle}" has been ${deletionTypeText} by ${postData.adminName ? postData.adminName : 'an admin'}.`,
                // Don't include postId to prevent deletion when post is deleted
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    adminName: postData.adminName,
                    deletionType: postData.deletionType,
                    postId: postData.postId, // Include in data for reference if needed
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Post deletion notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send post deletion notification:', error);
            throw error;
        }
    }

    // Send notification for post restoration (admin action)
    async sendRestoreNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        adminName?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending post restoration notification for post:', postData.postTitle);

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for restoration notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'post_restored',
                title: `Post Restored`,
                body: `Your ${postData.postType} post "${postData.postTitle}" has been restored by ${postData.adminName ? postData.adminName : 'an admin'} and is now pending review.`,
                postId: postData.postId,
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    adminName: postData.adminName,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Post restoration notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send post restoration notification:', error);
            throw error;
        }
    }

    // Send notification for post reversion (admin action)
    async sendRevertNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        adminName?: string;
        revertReason?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending post reversion notification for post:', postData.postTitle);

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for reversion notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'post_reverted',
                title: `Post Reverted`,
                body: `Your ${postData.postType} post "${postData.postTitle}" has been reverted to pending status by ${postData.adminName ? postData.adminName : 'an admin'}${postData.revertReason ? ` for the following reason: ${postData.revertReason}` : ''}.`,
                postId: postData.postId,
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    adminName: postData.adminName,
                    revertReason: postData.revertReason,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Post reversion notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send post reversion notification:', error);
            throw error;
        }
    }

    // Send notification for post hiding (admin action)
    async sendHideNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        adminName?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending post hide notification for post:', postData.postTitle);

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for hide notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'post_hidden',
                title: `Post Hidden`,
                body: `Your ${postData.postType} post "${postData.postTitle}" has been hidden from public view by ${postData.adminName ? postData.adminName : 'an admin'}. It can be unhidden later if needed.`,
                postId: postData.postId,
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    adminName: postData.adminName,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Post hide notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send post hide notification:', error);
            throw error;
        }
    }

    // Send notification for post unhiding (admin action)
    async sendUnhideNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        adminName?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending post unhide notification for post:', postData.postTitle);

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for unhide notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'post_unhidden',
                title: `Post Unhidden`,
                body: `Your ${postData.postType} post "${postData.postTitle}" has been unhidden and is now visible to other users again${postData.adminName ? ` by ${postData.adminName}` : ''}.`,
                postId: postData.postId,
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    adminName: postData.adminName,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Post unhide notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send post unhide notification:', error);
            throw error;
        }
    }

    // Send notification for post approval (admin action)
    async sendApproveNotification(postData: {
        postId: string;
        postTitle: string;
        postType: 'lost' | 'found';
        creatorId: string;
        creatorName: string;
        adminName?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending post approval notification for post:', postData.postTitle);

            // Check if this post has been turned over and use the original finder instead
            // We need to fetch the post data to check for turnoverDetails
            const { postService } = await import('./posts');
            const post = await postService.getPostById(postData.postId);

            if (!post) {
                throw new Error('Post not found for approval notification');
            }

            const notificationRecipientId = post.turnoverDetails?.originalFinder?.uid || postData.creatorId;

            // Send notification to the post creator (or original finder if post was turned over)
            await this.sendNotificationToUser(notificationRecipientId, {
                type: 'post_approved',
                title: `Post Approved`,
                body: `Your ${postData.postType} post "${postData.postTitle}" has been approved and is now visible to all users${postData.adminName ? ` by ${postData.adminName}` : ''}.`,
                postId: postData.postId,
                postTitle: postData.postTitle,
                postType: postData.postType,
                creatorId: notificationRecipientId,
                creatorName: post.turnoverDetails?.originalFinder ?
                    `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}` :
                    postData.creatorName,
                data: {
                    adminName: postData.adminName,
                    timestamp: new Date().toISOString()
                }
            });

            console.log('✅ Post approval notification sent successfully');
        } catch (error) {
            console.error('❌ Failed to send post approval notification:', error);
            throw error;
        }
    }
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
    async sendNotificationToUser(userId: string, notificationData: PostNotificationData): Promise<void> {
        try {
            // In a real implementation, you would:
            // 1. Get the user's FCM token from Firestore
            // 2. Send a push notification using Firebase Cloud Messaging
            // 3. Save the notification to the user's notifications collection

            // For now, we'll just log it
            console.log(`📨 Sending notification to user ${userId}:`, notificationData);

            // Use the same batch mechanism as sendNotificationToUsers for consistency
            // This ensures real-time listeners are properly triggered
            const notifications = [{
                userId,
                type: notificationData.type,
                title: notificationData.title,
                body: notificationData.body,
                data: notificationData.data,
                read: false,
                createdAt: serverTimestamp(),
                ...(notificationData.postId && { postId: notificationData.postId }),
                ...(notificationData.conversationId && { conversationId: notificationData.conversationId })
            }];

            // Use Firestore batch for better performance and atomicity
            const batch = writeBatch(db);
            const notificationsRef = collection(db, 'notifications');

            notifications.forEach((notification) => {
                try {
                    const docRef = doc(notificationsRef); // Auto-generated ID
                    batch.set(docRef, notification);
                } catch (error) {
                    console.error(`❌ Failed to add notification to batch:`, error, notification);
                }
            });

            await batch.commit();
            console.log(`✅ Notification created for user ${userId} using batch write`);
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
    // Send response notification for handover/claim requests (user-only)
    async sendResponseNotification(conversationId: string, responseData: {
        responderId: string;
        responderName: string;
        responseType: 'handover_response' | 'claim_response';
        status: 'accepted' | 'rejected';
        postTitle?: string;
        postId?: string;
    }): Promise<void> {
        try {
            console.log('🚀 Sending user-only response notification for conversation:', conversationId);

            const postTitle = responseData.postTitle || 'Unknown Post';
            const statusText = responseData.status === 'accepted' ? 'accepted' : 'rejected';

            // Send notification only to the responder
            await this.sendNotificationToUsers([responseData.responderId], {
                type: responseData.responseType,
                title: `${responseData.responseType === 'handover_response' ? 'Handover' : 'Claim'} ${statusText}`,
                body: `${responseData.responderName} ${statusText} the ${responseData.responseType === 'handover_response' ? 'handover' : 'claim'} request for "${postTitle}"`,
                data: {
                    conversationId: conversationId,
                    postTitle: postTitle,
                    postId: responseData.postId,
                    responderId: responseData.responderId,
                    responderName: responseData.responderName,
                    responseType: responseData.responseType,
                    status: responseData.status,
                    timestamp: new Date().toISOString()
                },
                postId: responseData.postId,
                conversationId: conversationId
            });

            console.log(`✅ User-only response notification sent to ${responseData.responderId}`);
        } catch (error) {
            console.error('❌ Failed to send user-only response notification:', error);
            throw error;
        }
    }

    // Send message notification to conversation participants (and admins if conversation involves admins or requires oversight)
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
                console.warn('⚠️ Conversation not found for message notification, skipping silently');
                return;
            }

            const conversationData = conversationDoc.data();
            const participantIds = Object.keys(conversationData.participants || {});
            const recipientIds = participantIds.filter(id => id !== messageData.senderId);

            if (recipientIds.length === 0) {
                console.log('⚠️ No recipients found for message notification');
                return;
            }

            // Check if any conversation participant is an admin (for admin notification filtering)
            let shouldSendAdminNotification = false;
            try {
                // Check if any conversation participant is an admin
                for (const participantId of participantIds) {
                    const participantUser = await userService.getUserById(participantId);
                    if (participantUser && (participantUser.role === 'admin' || participantUser.role === 'campus_security')) {
                        shouldSendAdminNotification = true;
                        console.log('👮 Admin participant detected, sending admin notification');
                        break;
                    }
                }
            } catch (error) {
                console.warn('Failed to check admin participation:', error);
                // Default to not sending admin notification if check fails
                shouldSendAdminNotification = false;
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

            // Send admin notifications only if conversation involves admins or requires oversight
            if (shouldSendAdminNotification) {
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
            }

            console.log(`✅ Message notification sent to ${recipientIds.length} participants${shouldSendAdminNotification ? ' and admins' : ''}`);
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
        type: 'admin_alert' | 'claim_update' | 'message' | 'claim_response' | 'handover_response';
        title: string;
        body: string;
        data?: any;
        postId?: string;
        conversationId?: string;
    }): Promise<void> {
        try {
            // Filter users based on their notification preferences for claim/handover responses
            let filteredUserIds = userIds;

            if (notificationData.type === 'claim_response' || notificationData.type === 'handover_response') {
                // For response notifications, check if it's a rejection or acceptance
                const isRejection = notificationData.data?.status === 'rejected';

                // Always send rejection notifications (important for users to know)
                if (isRejection) {
                    console.log('📨 Sending rejection notification (always sent regardless of preferences)');
                    filteredUserIds = userIds;
                } else {
                    // For acceptances, respect user preferences
                    const usersWithPreferences = await Promise.all(
                        userIds.map(async (userId) => {
                            try {
                                // Import notificationService here to avoid circular dependency
                                const { notificationService } = await import('./notifications');
                                const preferences = await notificationService.getNotificationPreferences(userId);

                                // Check if user has enabled this type of response notification
                                const isEnabled = notificationData.type === 'claim_response'
                                    ? preferences.claimResponses
                                    : preferences.handoverResponses;

                                return isEnabled ? userId : null;
                            } catch (error) {
                                console.warn(`Failed to get preferences for user ${userId}:`, error);
                                // If we can't get preferences, assume enabled (don't block notifications)
                                return userId;
                            }
                        })
                    );

                    filteredUserIds = usersWithPreferences.filter((userId): userId is string => userId !== null);
                }
            }

            if (filteredUserIds.length === 0) {
                console.log('⚠️ No users have enabled response notifications for this type');
                return;
            }

            const notifications = filteredUserIds.map(userId => {
                const notification = {
                    userId,
                    type: notificationData.type,
                    title: notificationData.title,
                    body: notificationData.body,
                    data: notificationData.data,
                    read: false,
                    createdAt: serverTimestamp(),
                    // Only add optional fields if they exist
                    ...(notificationData.postId && { postId: notificationData.postId }),
                    ...(notificationData.conversationId && { conversationId: notificationData.conversationId })
                };

                // Debug: Log the notification data to check for issues
                console.log('🔍 Notification data being sent:', {
                    userId: notification.userId,
                    type: notification.type,
                    title: notification.title,
                    hasData: !!notification.data,
                    dataKeys: notification.data ? Object.keys(notification.data) : []
                });

                return notification;
            });

            // Use Firestore batch for better performance
            const batch = writeBatch(db);

            notifications.forEach((notification, index) => {
                try {
                    // Validate notification data before adding to batch
                    if (!notification.userId || !notification.type || !notification.title) {
                        console.error(`❌ Invalid notification data at index ${index}:`, notification);
                        return;
                    }

                    const notificationsRef = collection(db, 'notifications');
                    const docRef = doc(notificationsRef); // Auto-generated ID
                    batch.set(docRef, notification);

                    console.log(`📨 Added notification ${index + 1} to batch for user ${notification.userId}`);
                } catch (error) {
                    console.error(`❌ Failed to add notification ${index + 1} to batch:`, error, notification);
                }
            });

            if (notifications.length === 0) {
                console.log('⚠️ No valid notifications to send');
                return;
            }

            console.log(`🔄 Committing batch with ${notifications.length} notifications...`);
            await batch.commit();
            console.log(`✅ Successfully sent ${notifications.length} notifications to Firestore`);

            // Test notification click functionality (development only)
            if (process.env.NODE_ENV === 'development' && (notificationData.type === 'message' || notificationData.type === 'claim_response' || notificationData.type === 'handover_response')) {
                console.log('🧪 Development mode: Testing notification click...');
                setTimeout(() => {
                    let testUrl;
                    if (notificationData.data?.postId) {
                        testUrl = `/post/${notificationData.data.postId}`;
                    } else {
                        testUrl = `/messages?conversation=${notificationData.data?.conversationId}`;
                    }
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
