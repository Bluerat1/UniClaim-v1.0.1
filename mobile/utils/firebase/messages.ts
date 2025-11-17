// Messaging service for chat and conversations
import { db } from './config';
import {
    doc,
    collection,
    addDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    where,
    getDocs,
    writeBatch,
    increment,
    limit,
    startAfter,
    arrayUnion,
    serverTimestamp
} from 'firebase/firestore';
import { notificationSender } from './notificationSender';
import { notificationService } from './notifications';

// Message service interface
interface MessageService {
    createConversation(
        postId: string,
        postTitle: string,
        postOwnerId: string,
        currentUserId: string,
        currentUserData: any,
        postOwnerUserData: any,
        postType: "lost" | "found",
        postStatus: "pending" | "resolved" | "unclaimed",
        foundAction: "keep" | "turnover to OSA" | "turnover to Campus Security" | null,
        greetingText: string
    ): Promise<string>;
    sendMessage(conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void>;
    getConversationMessages(conversationId: string, callback: (messages: any[]) => void, messageLimit?: number): () => void;
    getUserConversations(userId: string, callback: (conversations: any[]) => void): () => void;
    markConversationAsRead(conversationId: string, userId: string): Promise<void>;
    markMessageAsRead(conversationId: string, messageId: string, userId: string): Promise<void>;
    hasUnreadMessages(conversationId: string, userId: string): Promise<boolean>;
    markAllUnreadMessagesAsRead(conversationId: string, userId: string): Promise<boolean>;
    sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void>;
    sendClaimRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void>;
    updateHandoverResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void>;
    updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void>;
    getOlderMessages(conversationId: string, lastMessageTimestamp: any, messageLimit?: number): Promise<any[]>;
    getConversation(conversationId: string): Promise<any>;
    deleteMessage(conversationId: string, messageId: string, userId: string): Promise<void>;
    confirmHandoverIdPhoto(conversationId: string, messageId: string, userId: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }>;
    confirmClaimIdPhoto(conversationId: string, messageId: string, userId: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }>;
    getCurrentConversations(userId: string): Promise<any[]>;
    deleteConversation(conversationId: string, userId: string): Promise<{ success: boolean; error?: string }>;
    updateConversationParticipant(conversationId: string, participantId: string, data: any): Promise<void>;
    cleanupOldMessages(conversationId: string): Promise<void>;
}

// Message service implementation
export const messageService: MessageService = {
    // Create conversation
    async createConversation(
        postId: string,
        postTitle: string,
        postOwnerId: string,
        currentUserId: string,
        currentUserData: any,
        postOwnerUserData: any,
        postType: "lost" | "found",
        postStatus: "pending" | "resolved" | "unclaimed",
        foundAction: "keep" | "turnover to OSA" | "turnover to Campus Security" | null,
        greetingText: string
    ): Promise<string> {
        try {
            // Create new conversation (duplicate checks are handled client-side)
            const participantIds = [currentUserId, postOwnerId].filter((id, index, self) => id && self.indexOf(id) === index);

            const conversationRef = doc(collection(db, 'conversations'));
            const messageRef = doc(collection(db, `conversations/${conversationRef.id}/messages`));

            const senderName = currentUserData?.firstName && currentUserData?.lastName
                ? `${currentUserData.firstName} ${currentUserData.lastName}`
                : currentUserData?.displayName || 'User';

            const senderProfilePicture = currentUserData?.profilePicture || currentUserData?.profileImageUrl || currentUserData?.photoURL || '';

            const now = new Date();

            const conversationData: any = {
                postId,
                postTitle,
                postOwnerId,
                postCreatorId: postOwnerId,
                postType,
                participantIds,
                postStatus,
                foundAction,
                participants: {
                    [currentUserId]: {
                        uid: currentUserId,
                        firstName: currentUserData.firstName,
                        lastName: currentUserData.lastName,
                        joinedAt: serverTimestamp()
                    },
                    [postOwnerId]: {
                        uid: postOwnerId,
                        firstName: postOwnerUserData?.firstName || '',
                        lastName: postOwnerUserData?.lastName || '',
                        joinedAt: serverTimestamp()
                    }
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: {
                    text: greetingText,
                    senderId: currentUserId,
                    timestamp: now
                },
                unreadCounts: {
                    [postOwnerId]: 1,
                    [currentUserId]: 0
                }
            };

            // Add profile pictures only if they exist
            if (currentUserData.profilePicture || currentUserData.profileImageUrl) {
                conversationData.participants[currentUserId].profilePicture = currentUserData.profilePicture || currentUserData.profileImageUrl;
            }
            if (postOwnerUserData?.profilePicture || postOwnerUserData?.profileImageUrl) {
                conversationData.participants[postOwnerId].profilePicture = postOwnerUserData.profilePicture || postOwnerUserData.profileImageUrl;
            }

            const greetingMessageData: any = {
                senderId: currentUserId,
                senderName,
                text: greetingText,
                timestamp: serverTimestamp(),
                readBy: [currentUserId],
                messageType: 'text'
            };

            if (senderProfilePicture) {
                greetingMessageData.senderProfilePicture = senderProfilePicture;
            }

            const batch = writeBatch(db);
            batch.set(conversationRef, conversationData);
            batch.set(messageRef, greetingMessageData);

            await batch.commit();

            // Send notifications to other participants (mobile and web users)
            const otherParticipantIds = participantIds.filter(id => id !== currentUserId);
            if (otherParticipantIds.length > 0) {
                try {
                    await notificationSender.sendMessageNotifications(
                        otherParticipantIds,
                        {
                            conversationId: conversationRef.id,
                            senderId: currentUserId,
                            senderName,
                            messageText: greetingText,
                            conversationData,
                            trigger: 'message'
                        }
                    );
                } catch (notificationError) {
                    console.warn('⚠️ Firebase: Failed to send message notifications for new conversation, but conversation was created:', notificationError);
                }
            }

            return conversationRef.id;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create conversation');
        }
    },

    // Cleanup old messages to maintain 50-message limit per conversation
    async cleanupOldMessages(conversationId: string): Promise<void> {
        try {
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');

            // Get all messages ordered by timestamp (oldest first)
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
            const messagesSnapshot = await getDocs(messagesQuery);

            const allMessages = messagesSnapshot.docs;
            const totalMessages = allMessages.length;

            // If we have more than 50 messages, delete the oldest ones
            if (totalMessages > 50) {
                const messagesToKeep: string[] = [];
                const messagesToDelete: string[] = [];
                const totalToDelete = totalMessages - 50;
                let deletedCount = 0;

                // First pass: Process all messages to identify which to keep and which to delete
                for (const doc of allMessages) {
                    const messageData = doc.data();

                    // Always keep claim and handover request messages
                    if (messageData.messageType === 'claim_request' || messageData.messageType === 'handover_request') {
                        messagesToKeep.push(doc.id);
                        continue;
                    }

                    // If we still need to delete more messages to reach the limit
                    if (deletedCount < totalToDelete) {
                        messagesToDelete.push(doc.id);
                        deletedCount++;
                    } else {
                        // We've reached our target number of messages to delete
                        messagesToKeep.push(doc.id);
                    }
                }

                // Second pass: If we still need to delete more messages (because we hit protected messages)
                if (messagesToDelete.length < totalToDelete) {
                    // Find more messages to delete (excluding protected ones)
                    for (const doc of allMessages) {
                        if (messagesToDelete.length >= totalToDelete) break;

                        const messageData = doc.data();
                        if (messageData.messageType !== 'claim_request' &&
                            messageData.messageType !== 'handover_request' &&
                            !messagesToDelete.includes(doc.id) &&
                            !messagesToKeep.includes(doc.id)) {
                            messagesToDelete.push(doc.id);
                        }
                    }
                }

                if (messagesToDelete.length > 0) {
                    console.log(`🧹 Cleaning up ${messagesToDelete.length} old messages in conversation ${conversationId}`);

                    // Delete messages in batch
                    const batch = writeBatch(db);
                    messagesToDelete.forEach(messageId => {
                        const messageRef = doc(messagesRef, messageId);
                        batch.delete(messageRef);
                    });

                    await batch.commit();
                    console.log(`✅ Cleaned up ${messagesToDelete.length} old messages`);
                } else {
                    console.log('⚠️ No messages to clean up after skipping protected messages');
                }
            }
        } catch (error: any) {
            console.error('Message cleanup failed:', error);
            // Don't throw error - cleanup failure shouldn't break chat functionality
        }
    },

    // Send message
    async sendMessage(conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void> {
        try {
            // Prepare message data, filtering out undefined values
            const messageData: any = {
                senderId,
                senderName,
                text,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: 'text'
            };

            // Only add senderProfilePicture if it exists and is not null/undefined
            if (senderProfilePicture) {
                messageData.senderProfilePicture = senderProfilePicture;
            }

            await addDoc(collection(db, `conversations/${conversationId}/messages`), messageData);

            // Get conversation data to find other participants
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const participantIds = Object.keys(conversationData.participants || {});

            // Increment unread count for all participants except the sender
            const otherParticipantIds = participantIds.filter(id => id !== senderId);

            // Prepare unread count updates for each receiver
            const unreadCountUpdates: { [key: string]: any } = {};
            otherParticipantIds.forEach(participantId => {
                unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
            });

            // Update conversation with last message and increment unread counts for other participants
            const currentTimestamp = new Date();
            await updateDoc(conversationRef, {
                updatedAt: serverTimestamp(),
                lastMessage: {
                    text,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates
            });

            // Send notifications to other participants (mobile and web users)
            if (otherParticipantIds.length > 0) {
                try {
                    await notificationSender.sendMessageNotifications(
                        otherParticipantIds,
                        {
                            conversationId,
                            senderId,
                            senderName,
                            messageText: text,
                            conversationData,
                            trigger: 'message'
                        }
                    );
                } catch (notificationError) {
                    console.warn('⚠️ Firebase: Failed to send message notifications, but message was sent:', notificationError);
                }
            }
        } catch (error: any) {
            console.error('❌ Firebase: Failed to send message:', error);
            throw new Error(error.message || 'Failed to send message');
        }
    },

    // Get conversation messages
    getConversationMessages(conversationId: string, callback: (messages: any[]) => void, messageLimit: number = 50) {
        try {
            const messagesRef = collection(db, `conversations/${conversationId}/messages`);
            const q = query(
                messagesRef,
                orderBy('timestamp', 'asc'),
                limit(messageLimit)
            );

            return onSnapshot(q,
                (snapshot) => {
                    const messages = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    callback(messages);
                },
                () => {
                    // Return empty array on error to prevent UI issues
                    callback([]);
                }
            );
        } catch (error) {
            // Return empty cleanup function
            return () => { };
        }
    },

    // Get user conversations with real-time updates
    getUserConversations(userId: string, callback: (conversations: any[]) => void) {
        if (!userId) {
            return () => { }; // Return empty cleanup function
        }

        try {
            const q = query(
                collection(db, 'conversations'),
                where('participantIds', 'array-contains', userId),
                orderBy('updatedAt', 'desc'),
                limit(50)
            );

            const unsubscribe = onSnapshot(q,
                (snapshot) => {
                    const conversations = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            participants: data.participants || {},
                            unreadCounts: data.unreadCounts || {}
                        };
                    });

                    // Filter out conversations where the user is the only participant
                    const validConversations = conversations.filter((conv: any) => {
                        const participantIds = Object.keys(conv.participants || {});
                        return participantIds.length > 1; // Must have at least 2 participants
                    });

                    callback(validConversations);
                },
                (error) => {
                    console.error('Error in conversation listener:', error);
                }
            );

            return unsubscribe;

        } catch (error) {
            console.error('Error setting up conversation listener:', error);
            return () => { }; // Return empty cleanup function in case of error
        }
    },

    // Mark conversation as read
    async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'conversations', conversationId), {
                [`unreadCounts.${userId}`]: 0
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to mark conversation as read');
        }
    },

    // Mark message as read
    async markMessageAsRead(conversationId: string, messageId: string, userId: string): Promise<void> {
        try {
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            const messageDoc = await getDoc(messageRef);

            if (messageDoc.exists()) {
                const messageData = messageDoc.data();
                const readBy = messageData.readBy || [];

                if (!readBy.includes(userId)) {
                    await updateDoc(messageRef, {
                        readBy: arrayUnion(userId)
                    });
                }
            } else {
                console.warn(`⚠️ Mobile: Message ${messageId} not found in conversation ${conversationId}`);
            }
        } catch (error: any) {
            console.error(`❌ Mobile: Failed to mark message ${messageId} as read in conversation ${conversationId} for user ${userId}:`, error);

            // Log additional debugging information for permission errors
            if (error.code === 'permission-denied') {
                console.error(`🔒 Mobile: Permission denied. User ${userId} may not have access to update message ${messageId} in conversation ${conversationId}`);
                console.error(`🔍 Mobile: Error details:`, {
                    code: error.code,
                    message: error.message,
                    conversationId,
                    messageId,
                    userId
                });
            }

            throw new Error(error.message || 'Failed to mark message as read');
        }
    },

    // Check if conversation has unread messages
    async hasUnreadMessages(conversationId: string, userId: string): Promise<boolean> {
        try {
            const q = query(
                collection(db, `conversations/${conversationId}/messages`),
                where('readBy', 'not-in', [[userId]]),
                limit(1)
            );
            const snapshot = await getDocs(q);

            // Double-check if the found messages are actually unread
            if (!snapshot.empty) {
                for (const doc of snapshot.docs) {
                    const messageData = doc.data();
                    if (!messageData.readBy?.includes(userId)) {
                        return true; // Found at least one truly unread message
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking for unread messages:', error);
            return false;
        }
    },

    // Mark all unread messages as read
    async markAllUnreadMessagesAsRead(conversationId: string, userId: string): Promise<boolean> {
        const startTime = Date.now();
        const debugId = Math.random().toString(36).substring(2, 8);

        try {
            console.log(`[MARK-READ:${debugId}] 🔍 Checking for unread messages in conversation ${conversationId}`);

            // First check if there are any unread messages
            const hasUnread = await this.hasUnreadMessages(conversationId, userId);

            if (!hasUnread) {
                console.log(`[MARK-READ:${debugId}] ℹ️ No unread messages to mark as read`);
                return false; // No unread messages to update
            }

            console.log(`[MARK-READ:${debugId}] 📝 Found unread messages, preparing batch update`);

            // Get all unread messages for this conversation and user
            const q = query(
                collection(db, `conversations/${conversationId}/messages`),
                where('readBy', 'not-in', [[userId]])
            );

            const snapshot = await getDocs(q);
            console.log(`[MARK-READ:${debugId}] 🔢 Found ${snapshot.size} unread messages`);

            if (snapshot.empty) {
                console.log(`[MARK-READ:${debugId}] ⚠️ No unread messages found in query, but hasUnread was true`);
                return false;
            }

            const batch = writeBatch(db);
            let updateCount = 0;

            // Mark all messages as read by this user
            snapshot.docs.forEach((doc) => {
                const messageData = doc.data();
                if (!messageData.readBy?.includes(userId)) {
                    batch.update(doc.ref, {
                        readBy: arrayUnion(userId)
                    });
                    updateCount++;
                }
            });

            if (updateCount > 0) {
                console.log(`[MARK-READ:${debugId}] 📝 Updating ${updateCount} messages as read`);
                await batch.commit();
                const elapsed = Date.now() - startTime;
                console.log(`[MARK-READ:${debugId}] ✅ Successfully marked ${updateCount} messages as read (${elapsed}ms)`);
                return true;
            } else {
                console.log(`[MARK-READ:${debugId}] ℹ️ No messages needed updating (all messages were already read)`);
                return false;
            }
        } catch (error: any) {
            const elapsed = Date.now() - startTime;
            console.error(`[MARK-READ:${debugId}] ❌ Error after ${elapsed}ms:`, error);
            throw new Error(error.message || 'Failed to mark all unread messages as read');
        }
    },

    // Get older messages for pagination
    async getOlderMessages(conversationId: string, lastMessageTimestamp: any, messageLimit: number = 20): Promise<any[]> {
        try {
            const q = query(
                collection(db, `conversations/${conversationId}/messages`),
                orderBy('timestamp', 'asc'),
                startAfter(lastMessageTimestamp),
                limit(messageLimit)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error: any) {
            throw new Error(error.message || 'Failed to get older messages');
        }
    },

    // Get conversation data
    async getConversation(conversationId: string): Promise<any> {
        try {
            const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
            if (conversationDoc.exists()) {
                return { id: conversationDoc.id, ...conversationDoc.data() };
            }
            return null;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to get conversation');
        }
    },

    // Delete message
    async deleteMessage(conversationId: string, messageId: string, userId: string): Promise<void> {
        try {
            // Get message data first to extract images
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();

            // Check if user has permission to delete this message
            if (messageData.senderId !== userId) {
                throw new Error('You can only delete your own messages');
            }

            // Extract and delete images from Cloudinary before deleting the message
            try {
                const { extractMessageImages, deleteMessageImages } = await import('../cloudinary');
                const imageUrls = extractMessageImages(messageData);

                console.log(`🗑️ Mobile: Found ${imageUrls.length} images to delete`);
                if (imageUrls.length > 0) {
                    console.log('🗑️ Mobile: Images to delete:', imageUrls.map(url => url.split('/').pop()));
                    const imageDeletionResult = await deleteMessageImages(imageUrls);

                    if (!imageDeletionResult.success) {
                        console.warn(`⚠️ Mobile: Image deletion completed with some failures. Deleted: ${imageDeletionResult.deleted.length}, Failed: ${imageDeletionResult.failed.length}`);
                    }
                }
            } catch (imageError: any) {
                console.warn('Mobile: Failed to delete images from Cloudinary, but continuing with message deletion:', imageError.message);
                // Continue with message deletion even if image deletion fails
            }

            // Delete the message
            await deleteDoc(messageRef);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to delete message');
        }
    },

    // Confirm handover ID photo with optimized batching and reduced data storage
    async confirmHandoverIdPhoto(conversationId: string, messageId: string, userId: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> {
        try {
            console.log('🔄 Mobile: confirmHandoverIdPhoto called with:', { conversationId, messageId, userId });

            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                console.error('❌ Mobile: Handover message not found');
                return { success: false, conversationDeleted: false, error: 'Handover message not found' };
            }

            const messageData = messageDoc.data();
            if (messageData.messageType !== 'handover_request') {
                return { success: false, conversationDeleted: false, error: 'Message is not a handover request' };
            }

            // Get conversation data to find the post ID
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const postId = conversationData.postId;

            if (!postId) {
                throw new Error('No post ID found in conversation');
            }

            // Start a batch for all document updates
            const batch = writeBatch(db);

            // Update the handover request with confirmation in the batch
            batch.update(messageRef, {
                'handoverData.idPhotoConfirmed': true,
                'handoverData.idPhotoConfirmedAt': serverTimestamp(),
                'handoverData.idPhotoConfirmedBy': userId
            });

            // Update the conversation's postCreatorId in the batch
            batch.update(conversationRef, {
                postCreatorId: userId,
                isAdminPost: true,
                updatedAt: serverTimestamp()
            });

            console.log(`🔄 Mobile: Updated conversation ${conversationId} postCreatorId to ${userId} and set isAdminPost to true`);

            // Extract handover details and preserve in post before deletion
            const handoverData = messageData.handoverData;
            if (handoverData) {
                console.log('📋 Mobile: handoverData available:', JSON.stringify(handoverData, null, 2));
                console.log('📋 Mobile: handoverData fields:', Object.keys(handoverData || {}));
                // Get user data in parallel
                const [handoverPersonDoc, ownerDoc] = await Promise.all([
                    getDoc(doc(db, 'users', messageData.senderId)),
                    getDoc(doc(db, 'users', userId))
                ]);

                const handoverPersonData = handoverPersonDoc.exists() ? handoverPersonDoc.data() : null;
                const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;
                const ownerName = ownerData ? `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() : 'Unknown';

                // Prepare handover details for the post
                const handoverDetails = {
                    handoverPersonName: handoverPersonData ?
                        `${handoverPersonData.firstName || ''} ${handoverPersonData.lastName || ''}`.trim() : 'Unknown',
                    handoverPersonContact: handoverPersonData?.contactNum || '',
                    handoverPersonStudentId: handoverPersonData?.studentId || '',
                    handoverPersonEmail: handoverPersonData?.email || '',
                    handoverItemPhotos: handoverData.itemPhotos || [],
                    handoverIdPhoto: handoverData.idPhotoUrl || '',
                    ownerIdPhoto: handoverData.ownerIdPhoto || '',
                    handoverConfirmedAt: serverTimestamp(),
                    handoverConfirmedBy: userId,
                    ownerName: ownerName,
                    conversationId: conversationId  // Store only the conversation ID instead of full history
                };

                // Update post with handover details and status in the batch
                const postRef = doc(db, 'posts', postId);
                batch.update(postRef, {
                    status: 'resolved',
                    handoverDetails: handoverDetails,
                    updatedAt: serverTimestamp()
                });

                console.log('✅ Mobile: Post updated with handover details');
            } else {
                console.warn('⚠️ Mobile: No handover data found in message, cannot store handover details');
                // Fallback: just update post status
                // We must use the batch here too.
                const postRef = doc(db, 'posts', postId);
                batch.update(postRef, {
                    status: 'resolved',
                    updatedAt: serverTimestamp()
                });
            }

            // ❗ COMMIT THE BATCH HERE
            await batch.commit();
            console.log('✅ Mobile: Batch committed. Post status is now "resolved" and details are saved.');

            // Delete ALL conversations tied to this post after successful data preservation
            try {
                // First, find all conversations for this post
                const conversationsQuery = query(
                    collection(db, 'conversations'),
                    where('postId', '==', postId)
                );
                const conversationsSnapshot = await getDocs(conversationsQuery);

                console.log(`🔍 Mobile: Found ${conversationsSnapshot.docs.length} conversations for post ${postId}`);

                // STEP 1: Send reject notifications to other conversations before deletion
                // (excluding the conversation that was just confirmed)
                for (const conversationDoc of conversationsSnapshot.docs) {
                    const currentConversationId = conversationDoc.id;
                    const conversationRef = doc(db, 'conversations', currentConversationId);
                    const conversationDocData = await getDoc(conversationRef);

                    if (!conversationDocData.exists()) continue;

                    const conversationData = conversationDocData.data();
                    const participantIds = Object.keys(conversationData.participants || {});

                    // Skip the conversation that was just confirmed (it will be deleted anyway)
                    if (conversationDoc.id === conversationId) continue;

                    // Get user data for the person who confirmed the handover
                    const confirmerDoc = await getDoc(doc(db, 'users', userId));
                    const confirmerData = confirmerDoc.exists() ? confirmerDoc.data() : null;
                    const confirmerName = confirmerData ? `${confirmerData.firstName || ''} ${confirmerData.lastName || ''}`.trim() : 'Someone';

                    // Send reject notifications to all participants in other conversations
                    for (const participantId of participantIds) {
                        // Skip the user who confirmed (they shouldn't get a reject notification for their own confirmation)
                        if (participantId === userId) continue;

                        try {
                            // Get participant user data for personalized notification
                            const participantDoc = await getDoc(doc(db, 'users', participantId));
                            if (!participantDoc.exists()) continue;

                            const participantData = participantDoc.data();

                            // Check if user should receive this notification type
                            const shouldNotify = await notificationService.shouldSendNotification(participantId, 'handover_response');
                            if (!shouldNotify) {
                                console.log(`🚫 Mobile: User ${participantId} has handover_response notifications disabled`);
                                continue;
                            }

                            // Send database notification
                            await notificationSender.sendNotificationToUsers([participantId], {
                                type: 'handover_response',
                                title: 'Handover Request Rejected',
                                body: `${confirmerName} has already completed the handover process for "${conversationData.postTitle || 'this item'}". Your request cannot be processed.`,
                                data: {
                                    conversationId: currentConversationId,
                                    postTitle: conversationData.postTitle || 'Unknown Item',
                                    postId: postId,
                                    confirmerId: userId,
                                    confirmerName: confirmerName,
                                    rejectionReason: 'another_user_confirmed',
                                    timestamp: new Date().toISOString()
                                }
                            });

                            // Send push notification if user is on mobile
                            const isMobileUser = participantData.pushToken && participantData.pushToken.length > 0;
                            if (isMobileUser) {
                                try {
                                    await notificationService.sendPushNotification(
                                        participantId,
                                        'Handover Request Rejected',
                                        `${confirmerName} has already completed the handover process for "${conversationData.postTitle || 'this item'}". Your request cannot be processed.`,
                                        {
                                            type: 'handover_response',
                                            conversationId: currentConversationId,
                                            postTitle: conversationData.postTitle || 'Unknown Item',
                                            postId: postId,
                                            confirmerId: userId,
                                            confirmerName: confirmerName,
                                            rejectionReason: 'another_user_confirmed',
                                            timestamp: new Date().toISOString()
                                        }
                                    );
                                    console.log(`📲 Mobile: Sent reject push notification to mobile user ${participantId}`);
                                } catch (pushError) {
                                    console.warn(`⚠️ Mobile: Failed to send reject push notification to ${participantId}:`, pushError);
                                }
                            } else {
                                console.log(`💻 Mobile: User ${participantId} appears to be web user, database notification created`);
                            }

                            console.log(`📢 Mobile: Sent reject notification to user ${participantId} for conversation ${currentConversationId}`);
                        } catch (notificationError) {
                            console.warn(`⚠️ Mobile: Failed to send reject notification to user ${participantId}:`, notificationError);
                            // Continue with other participants even if one fails
                        }
                    }
                }

                // STEP 2: Collect all image URLs from all conversations, but preserve only confirmed request photos
                const allImageUrls: string[] = [];
                const confirmedRequestPhotos: string[] = []; // Only photos from the confirmed request should be preserved

                for (const conversationDoc of conversationsSnapshot.docs) {
                    const conversationId = conversationDoc.id;

                    // Get all messages in this conversation to extract image URLs
                    const messagesQuery = query(collection(db, `conversations/${conversationId}/messages`));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    console.log(`📸 Mobile: Scanning ${messagesSnapshot.docs.length} messages for images in conversation ${conversationId}`);

                    // Extract image URLs from each message
                    for (const messageDoc of messagesSnapshot.docs) {
                        const messageData = messageDoc.data();
                        const messageImageUrls = await import('../cloudinary').then(module => module.extractMessageImages(messageData));

                        // Check if this is the specific confirmed handover request message
                        if (messageDoc.id === messageId && messageData.handoverData && messageData.handoverData.idPhotoConfirmed) {
                            // This is the confirmed handover request - preserve its photos
                            if (messageData.handoverData.idPhotoUrl) {
                                confirmedRequestPhotos.push(messageData.handoverData.idPhotoUrl);
                                console.log('🛡️ Mobile: Preserving confirmed handover request requester photo:', messageData.handoverData.idPhotoUrl.split('/').pop());
                            }
                            if (messageData.handoverData.ownerIdPhoto) {
                                confirmedRequestPhotos.push(messageData.handoverData.ownerIdPhoto);
                                console.log('🛡️ Mobile: Preserving confirmed handover request owner photo:', messageData.handoverData.ownerIdPhoto.split('/').pop());
                            }
                            // Also preserve item photos from the confirmed request
                            if (messageData.handoverData.itemPhotos && Array.isArray(messageData.handoverData.itemPhotos)) {
                                messageData.handoverData.itemPhotos.forEach((photo: any) => {
                                    if (photo.url) {
                                        confirmedRequestPhotos.push(photo.url);
                                        console.log('🛡️ Mobile: Preserving confirmed handover request item photo:', photo.url.split('/').pop());
                                    }
                                });
                            }
                        }

                        allImageUrls.push(...messageImageUrls);
                    }
                }

                // STEP 3: Filter out only the confirmed request photos from deletion list
                const imagesToDelete = allImageUrls.filter(url => !confirmedRequestPhotos.includes(url));

                // STEP 4: Delete all non-confirmed-request images from Cloudinary
                if (imagesToDelete.length > 0) {
                    console.log(`🗑️ Mobile: Deleting ${imagesToDelete.length} images from Cloudinary (preserving ${confirmedRequestPhotos.length} photos from confirmed request)`);
                    const { deleteMessageImages } = await import('../cloudinary');
                    const deletionResult = await deleteMessageImages(imagesToDelete);

                    if (deletionResult.success) {
                        console.log(`✅ Mobile: Successfully deleted ${deletionResult.deleted.length} images from Cloudinary`);
                    } else {
                        console.warn(`⚠️ Mobile: Cloudinary deletion completed with issues: ${deletionResult.deleted.length} deleted, ${deletionResult.failed.length} failed`);
                    }
                } else {
                    console.log('ℹ️ Mobile: No images to delete (all images are from confirmed request or no images found)');
                }

                // STEP 5: Delete each conversation and all its messages
                for (const conversationDoc of conversationsSnapshot.docs) {
                    const conversationId = conversationDoc.id;
                    const conversationRef = doc(db, 'conversations', conversationId);

                    // Delete all messages in the conversation
                    const messagesQuery = query(collection(db, `conversations/${conversationId}/messages`));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    console.log(`🗑️ Mobile: Deleting ${messagesSnapshot.docs.length} messages from conversation ${conversationId}`);

                    // Delete all messages
                    for (const messageDoc of messagesSnapshot.docs) {
                        await deleteDoc(doc(db, `conversations/${conversationId}/messages`, messageDoc.id));
                    }

                    // Then delete the conversation document
                    await deleteDoc(conversationRef);

                    console.log(`✅ Mobile: Conversation ${conversationId} deleted`);
                }

                console.log(`✅ Mobile: All ${conversationsSnapshot.docs.length} conversations for post ${postId} deleted after handover confirmation`);
            } catch (deleteError) {
                console.warn('⚠️ Mobile: Failed to delete all conversations after handover confirmation:', deleteError);
                // Continue even if conversation deletion fails
            }

            console.log(`✅ Mobile: Handover ID photo confirmed by ${userId}`);
            return { success: true, conversationDeleted: true, postId };
        } catch (error: any) {
            console.error('❌ Mobile: confirmHandoverIdPhoto failed:', error);
            return { success: false, conversationDeleted: false, error: error.message };
        }
    },

    // Confirm claim ID photo with optimized batching and reduced data storage
    async confirmClaimIdPhoto(conversationId: string, messageId: string, userId: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> {
        try {
            console.log('🔄 Mobile: confirmClaimIdPhoto called with:', { conversationId, messageId, userId });

            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                console.error('❌ Mobile: Claim message not found');
                return { success: false, conversationDeleted: false, error: 'Claim message not found' };
            }

            const messageData = messageDoc.data();
            if (messageData.messageType !== 'claim_request') {
                return { success: false, conversationDeleted: false, error: 'Message is not a claim request' };
            }

            // Get conversation data to find the post ID
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const postId = conversationData.postId;

            if (!postId) {
                throw new Error('No post ID found in conversation');
            }

            // Start a batch for all document updates
            const batch = writeBatch(db);

            // Update the claim request with confirmation in the batch
            batch.update(messageRef, {
                'claimData.idPhotoConfirmed': true,
                'claimData.idPhotoConfirmedAt': serverTimestamp(),
                'claimData.idPhotoConfirmedBy': userId
            });

            // Update the conversation's postCreatorId in the batch
            batch.update(conversationRef, {
                postCreatorId: userId,
                updatedAt: serverTimestamp()
            });

            console.log(`🔄 Mobile: Updated conversation ${conversationId} postCreatorId to ${userId}`);

            // Get claim data from the message
            const claimData = messageData.claimData;
            if (claimData) {
                // Get user data in parallel
                const [claimerDoc, ownerDoc] = await Promise.all([
                    getDoc(doc(db, 'users', messageData.senderId)),
                    getDoc(doc(db, 'users', userId))
                ]);

                const claimerData = claimerDoc.exists() ? claimerDoc.data() : null;
                const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;
                const ownerName = ownerData ? `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() : 'Unknown';

                // Prepare claim details for the post
                const claimDetails = {
                    claimerName: claimerData ?
                        `${claimerData.firstName || ''} ${claimerData.lastName || ''}`.trim() : 'Unknown',
                    claimerContact: claimerData?.contactNum || '',
                    claimerStudentId: claimerData?.studentId || '',
                    claimerEmail: claimerData?.email || '',
                    evidencePhotos: claimData.evidencePhotos || [],
                    claimerIdPhoto: claimData.idPhotoUrl || '',
                    ownerIdPhoto: claimData.ownerIdPhoto || '',
                    claimConfirmedAt: serverTimestamp(),
                    claimConfirmedBy: userId,
                    ownerName: ownerName,
                    conversationId: conversationId  // Store only the conversation ID instead of full history
                };

                // Update post with claim details and status in the batch
                const postRef = doc(db, 'posts', postId);
                batch.update(postRef, {
                    status: 'resolved',
                    claimDetails: claimDetails,
                    updatedAt: serverTimestamp()
                });

                console.log('✅ Mobile: Post updated with claim details');
            } else {
                console.warn('⚠️ Mobile: No claim data found in message, cannot store claim details');
                // Fallback: just update post status
                // We must use the batch here too.
                const postRef = doc(db, 'posts', postId);
                batch.update(postRef, {
                    status: 'resolved',
                    updatedAt: serverTimestamp()
                });
            }

            // ❗ COMMIT THE BATCH HERE
            await batch.commit();
            console.log('✅ Mobile: Batch committed. Post status is now "resolved" and details are saved.');

            // Delete ALL conversations tied to this post after successful data preservation
            try {
                // First, find all conversations for this post
                const conversationsQuery = query(
                    collection(db, 'conversations'),
                    where('postId', '==', postId)
                );
                const conversationsSnapshot = await getDocs(conversationsQuery);

                console.log(`🔍 Mobile: Found ${conversationsSnapshot.docs.length} conversations for post ${postId}`);

                // STEP 1: Send reject notifications to other conversations before deletion
                // (excluding the conversation that was just confirmed)
                for (const conversationDoc of conversationsSnapshot.docs) {
                    const currentConversationId = conversationDoc.id;
                    const conversationRef = doc(db, 'conversations', currentConversationId);
                    const conversationDocData = await getDoc(conversationRef);

                    if (!conversationDocData.exists()) continue;

                    const conversationData = conversationDocData.data();
                    const participantIds = Object.keys(conversationData.participants || {});

                    // Skip the conversation that was just confirmed (it will be deleted anyway)
                    if (conversationDoc.id === conversationId) continue;

                    // Get user data for the person who confirmed the claim
                    const confirmerDoc = await getDoc(doc(db, 'users', userId));
                    const confirmerData = confirmerDoc.exists() ? confirmerDoc.data() : null;
                    const confirmerName = confirmerData ? `${confirmerData.firstName || ''} ${confirmerData.lastName || ''}`.trim() : 'Someone';

                    // Send reject notifications to all participants in other conversations
                    for (const participantId of participantIds) {
                        // Skip the user who confirmed (they shouldn't get a reject notification for their own confirmation)
                        if (participantId === userId) continue;

                        try {
                            // Get participant user data for personalized notification
                            const participantDoc = await getDoc(doc(db, 'users', participantId));
                            if (!participantDoc.exists()) continue;

                            const participantData = participantDoc.data();

                            // Check if user should receive this notification type
                            const shouldNotify = await notificationService.shouldSendNotification(participantId, 'claim_response');
                            if (!shouldNotify) {
                                console.log(`🚫 Mobile: User ${participantId} has claim_response notifications disabled`);
                                continue;
                            }

                            // Send database notification
                            await notificationSender.sendNotificationToUsers([participantId], {
                                type: 'claim_response',
                                title: 'Claim Request Rejected',
                                body: `${confirmerName} has already completed the claim process for "${conversationData.postTitle || 'this item'}". Your request cannot be processed.`,
                                data: {
                                    conversationId: currentConversationId,
                                    postTitle: conversationData.postTitle || 'Unknown Item',
                                    postId: postId,
                                    confirmerId: userId,
                                    confirmerName: confirmerName,
                                    rejectionReason: 'another_user_confirmed',
                                    timestamp: new Date().toISOString()
                                }
                            });

                            // Send push notification if user is on mobile
                            const isMobileUser = participantData.pushToken && participantData.pushToken.length > 0;
                            if (isMobileUser) {
                                try {
                                    await notificationService.sendPushNotification(
                                        participantId,
                                        'Claim Request Rejected',
                                        `${confirmerName} has already completed the claim process for "${conversationData.postTitle || 'this item'}". Your request cannot be processed.`,
                                        {
                                            type: 'claim_response',
                                            conversationId: currentConversationId,
                                            postTitle: conversationData.postTitle || 'Unknown Item',
                                            postId: postId,
                                            confirmerId: userId,
                                            confirmerName: confirmerName,
                                            rejectionReason: 'another_user_confirmed',
                                            timestamp: new Date().toISOString()
                                        }
                                    );
                                    console.log(`📲 Mobile: Sent reject push notification to mobile user ${participantId}`);
                                } catch (pushError) {
                                    console.warn(`⚠️ Mobile: Failed to send reject push notification to ${participantId}:`, pushError);
                                    // Continue - database notification was already created
                                }
                            } else {
                                console.log(`💻 Mobile: User ${participantId} appears to be web user, database notification created`);
                            }

                            console.log(`📢 Mobile: Sent reject notification to user ${participantId} for conversation ${currentConversationId}`);
                        } catch (notificationError) {
                            console.warn(`⚠️ Mobile: Failed to send reject notification to user ${participantId}:`, notificationError);
                            // Continue with other participants even if one fails
                        }
                    }
                }

                // STEP 2: Collect all image URLs from all conversations, but preserve only confirmed request photos
                const allImageUrls: string[] = [];
                const confirmedRequestPhotos: string[] = []; // Only photos from the confirmed request should be preserved

                for (const conversationDoc of conversationsSnapshot.docs) {
                    const conversationId = conversationDoc.id;

                    // Get all messages in this conversation to extract image URLs
                    const messagesQuery = query(collection(db, `conversations/${conversationId}/messages`));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    console.log(`📸 Mobile: Scanning ${messagesSnapshot.docs.length} messages for images in conversation ${conversationId}`);

                    // Extract image URLs from each message
                    for (const messageDoc of messagesSnapshot.docs) {
                        const messageData = messageDoc.data();
                        const messageImageUrls = await import('../cloudinary').then(module => module.extractMessageImages(messageData));

                        // Check if this is the specific confirmed claim request message
                        if (messageDoc.id === messageId && messageData.claimData && messageData.claimData.idPhotoConfirmed) {
                            // This is the confirmed claim request - preserve its photos
                            if (messageData.claimData.idPhotoUrl) {
                                confirmedRequestPhotos.push(messageData.claimData.idPhotoUrl);
                                console.log('🛡️ Mobile: Preserving confirmed claim request claimer photo:', messageData.claimData.idPhotoUrl.split('/').pop());
                            }
                            if (messageData.claimData.ownerIdPhoto) {
                                confirmedRequestPhotos.push(messageData.claimData.ownerIdPhoto);
                                console.log('🛡️ Mobile: Preserving confirmed claim request owner photo:', messageData.claimData.ownerIdPhoto.split('/').pop());
                            }
                            // Also preserve evidence photos from the confirmed request
                            if (messageData.claimData.evidencePhotos && Array.isArray(messageData.claimData.evidencePhotos)) {
                                messageData.claimData.evidencePhotos.forEach((photo: any) => {
                                    if (photo.url) {
                                        confirmedRequestPhotos.push(photo.url);
                                        console.log('🛡️ Mobile: Preserving confirmed claim request evidence photo:', photo.url.split('/').pop());
                                    }
                                });
                            }
                        }

                        allImageUrls.push(...messageImageUrls);
                    }
                }

                // STEP 3: Filter out only the confirmed request photos from deletion list
                const imagesToDelete = allImageUrls.filter(url => !confirmedRequestPhotos.includes(url));

                // STEP 4: Delete all non-confirmed-request images from Cloudinary
                if (imagesToDelete.length > 0) {
                    console.log(`🗑️ Mobile: Deleting ${imagesToDelete.length} images from Cloudinary (preserving ${confirmedRequestPhotos.length} photos from confirmed request)`);
                    const { deleteMessageImages } = await import('../cloudinary');
                    const deletionResult = await deleteMessageImages(imagesToDelete);

                    if (deletionResult.success) {
                        console.log(`✅ Mobile: Successfully deleted ${deletionResult.deleted.length} images from Cloudinary`);
                    } else {
                        console.warn(`⚠️ Mobile: Cloudinary deletion completed with issues: ${deletionResult.deleted.length} deleted, ${deletionResult.failed.length} failed`);
                    }
                } else {
                    console.log('ℹ️ Mobile: No images to delete (all images are from confirmed request or no images found)');
                }

                // STEP 5: Delete each conversation and all its messages
                for (const conversationDoc of conversationsSnapshot.docs) {
                    const conversationId = conversationDoc.id;
                    const conversationRef = doc(db, 'conversations', conversationId);

                    // Delete all messages in the conversation
                    const messagesQuery = query(collection(db, `conversations/${conversationId}/messages`));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    console.log(`🗑️ Mobile: Deleting ${messagesSnapshot.docs.length} messages from conversation ${conversationId}`);

                    // Delete all messages
                    for (const messageDoc of messagesSnapshot.docs) {
                        await deleteDoc(doc(db, `conversations/${conversationId}/messages`, messageDoc.id));
                    }

                    // Then delete the conversation document
                    await deleteDoc(conversationRef);

                    console.log(`✅ Mobile: Conversation ${conversationId} deleted`);
                }

                console.log(`✅ Mobile: All ${conversationsSnapshot.docs.length} conversations for post ${postId} deleted after claim confirmation`);
            } catch (deleteError) {
                console.warn('⚠️ Mobile: Failed to delete all conversations after claim confirmation:', deleteError);
                // Continue even if conversation deletion fails
            }

            console.log(`✅ Mobile: Claim ID photo confirmed by ${userId}`);
            return { success: true, conversationDeleted: true, postId };
        } catch (error: any) {
            console.error('❌ Mobile: confirmClaimIdPhoto failed:', error);
            return { success: false, conversationDeleted: false, error: error.message };
        }
    },

    // Get current conversations (one-time query)
    // Delete conversation for a user
    async updateConversationParticipant(conversationId: string, participantId: string, data: any): Promise<void> {
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
            [`participants.${participantId}`]: data,
            updatedAt: serverTimestamp()
        });
    },

    async deleteConversation(conversationId: string, userId: string): Promise<{ success: boolean; error?: string }> {
        const batch = writeBatch(db);

        try {
            if (!conversationId || !userId) {
                console.error('❌ [deleteConversation] Missing required parameters');
                return { success: false, error: 'Missing required parameters' };
            }

            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                console.error(`❌ [deleteConversation] Conversation ${conversationId} not found`);
                return { success: false, error: 'Conversation not found' };
            }

            const conversationData = conversationDoc.data();

            // Check if user is a participant
            if (!conversationData.participantIds?.includes(userId) &&
                conversationData.participants?.[userId] !== true) {
                console.error(`❌ [deleteConversation] User ${userId} is not a participant in conversation ${conversationId}`);
                return { success: false, error: 'Not authorized to delete this conversation' };
            }

            // Check if conversation is resolved
            if (conversationData.status === 'resolved' ||
                conversationData.status === 'handed_over' ||
                conversationData.status === 'claimed' ||
                conversationData.status === 'returned') {
                console.log(`⚠️ [deleteConversation] Cannot delete resolved conversation ${conversationId}`);
                return { success: false, error: 'Cannot delete a resolved conversation' };
            }

            // Delete all messages in the conversation
            const messagesQuery = query(
                collection(db, `conversations/${conversationId}/messages`)
            );
            const messagesSnapshot = await getDocs(messagesQuery);

            // Delete each message in the conversation
            messagesSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Delete the conversation document
            batch.delete(conversationRef);

            // Commit the batch
            await batch.commit();

            console.log(`✅ [deleteConversation] Successfully deleted conversation ${conversationId}`);
            return { success: true };
        } catch (error) {
            console.error(`❌ [deleteConversation] Error deleting conversation ${conversationId}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete conversation'
            };
        }
    },

    // Get current conversations (one-time query)
    async getCurrentConversations(userId: string): Promise<any[]> {
        if (!userId) {
            return [];
        }

        try {
            const q = query(
                collection(db, 'conversations'),
                where('participantIds', 'array-contains', userId),
                orderBy('updatedAt', 'desc'),
                limit(50)
            );

            const snapshot = await getDocs(q);

            const conversations = snapshot.docs.map(doc => {
                const data = doc.data();
                // Ensure backward compatibility
                const participants = data.participants || {};

                // If participantIds doesn't exist, fall back to using participants keys
                const participantIds = data.participantIds || Object.keys(participants);

                return {
                    id: doc.id,
                    ...data,
                    participants,
                    participantIds,
                    unreadCounts: data.unreadCounts || {}
                };
            });

            // Filter out conversations where the user is the only participant
            const validConversations = conversations.filter((conv: any) => {
                return conv.participantIds && conv.participantIds.length > 1; // Must have at least 2 participants
            });

            return validConversations;
        } catch (error: any) {
            console.error('Error getting conversations:', {
                error: error.message,
                code: error.code,
                userId,
                stack: error.stack
            });
            throw new Error('Failed to get current conversations: ' + error.message);
        }
    },

    // Send handover request
    async sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            // Validate ID photo URL
            if (idPhotoUrl && !idPhotoUrl.startsWith('http')) {
                console.error('❌ Invalid ID photo URL in sendHandoverRequest:', { idPhotoUrl });
                throw new Error('Invalid ID photo URL provided to sendHandoverRequest');
            }

            // Validate item photos array
            if (itemPhotos && (!Array.isArray(itemPhotos) || itemPhotos.some(photo => !photo.url || !photo.url.startsWith('http')))) {
                console.error('❌ Invalid item photos array in sendHandoverRequest:', { itemPhotos });
                throw new Error('Invalid item photos array provided to sendHandoverRequest');
            }

            const messageData = {
                text: `Handover Request: ${handoverReason || 'No reason provided'}`,
                senderId,
                senderName,
                senderProfilePicture,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: 'handover_request',
                handoverData: {
                    postId,
                    postTitle,
                    handoverReason: handoverReason || 'No reason provided',
                    idPhotoUrl: idPhotoUrl || '',
                    itemPhotos: itemPhotos || [],
                    requestedAt: serverTimestamp(),
                    status: 'pending'
                }
            };

            // Add message to conversation
            await addDoc(collection(db, `conversations/${conversationId}/messages`), messageData);

            // Get conversation data and update in parallel operations
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (conversationDoc.exists()) {
                const conversationData = conversationDoc.data();
                const participantIds = Object.keys(conversationData.participants || {});
                const otherParticipantIds = participantIds.filter(id => id !== senderId);

                // Prepare unread count updates for all receivers in one object
                const unreadCountUpdates: { [key: string]: any } = {};
                otherParticipantIds.forEach(participantId => {
                    unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
                });

                // Single update call with all conversation updates
                await updateDoc(conversationRef, {
                    handoverRequested: true,
                    updatedAt: serverTimestamp(),
                    lastMessage: {
                        text: messageData.text,
                        senderId,
                        timestamp: serverTimestamp()
                    },
                    ...unreadCountUpdates
                });

                // Send notifications in parallel if there are participants
                if (otherParticipantIds.length > 0) {
                    try {
                        await notificationSender.sendMessageNotifications(
                            otherParticipantIds,
                            {
                                conversationId,
                                senderId,
                                senderName,
                                messageText: `Handover Request: ${handoverReason || 'No reason provided'}`,
                                conversationData
                            }
                        );
                    } catch (notificationError) {
                        console.warn('⚠️ Mobile: Failed to send handover request notifications, but request was sent:', notificationError);
                        // Continue even if notifications fail - request is already sent
                    }
                }
            } else {
                // Fallback if no conversation data
                await updateDoc(conversationRef, {
                    handoverRequested: true,
                    updatedAt: serverTimestamp(),
                    lastMessage: {
                        text: messageData.text,
                        senderId,
                        timestamp: serverTimestamp()
                    }
                });
                console.warn('⚠️ Mobile: No conversation data available for handover request notifications');
            }
        } catch (error: any) {
            console.error('❌ Mobile: Failed to send handover request:', error);
            throw new Error(error.message || 'Failed to send handover request');
        }
    },

    // Update handover response
    async updateHandoverResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> {
        try {
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();

            // Update the handover message with the response and ID photo
            const updateData: any = {
                'handoverData.status': status,
                'handoverData.respondedAt': serverTimestamp(),
                'handoverData.respondedBy': userId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                updateData['handoverData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with correct field name
                updateData['handoverData.status'] = 'pending_confirmation'; // New status for photo confirmation
            }

            // If rejecting, delete all photos from Cloudinary and clear photo URLs (like web version)
            if (status === 'rejected') {
                console.log('🗑️ Mobile: REJECTION DETECTED - Starting photo deletion process for handover rejection');
                console.log('🗑️ Mobile: Message data:', JSON.stringify(messageData, null, 2));
                try {
                    const { extractMessageImages, deleteMessageImages } = await import('../cloudinary');
                    const imageUrls = extractMessageImages(messageData);

                    console.log(`🗑️ Mobile: Found ${imageUrls.length} images to delete for handover rejection`);
                    console.log('🗑️ Mobile: Full image URLs:', imageUrls);
                    if (imageUrls.length > 0) {
                        console.log('🗑️ Mobile: Images to delete:', imageUrls.map(url => url.split('/').pop()));

                        // Try to delete from Cloudinary
                        let cloudinaryDeletionSuccess = false;
                        try {
                            const imageDeletionResult = await deleteMessageImages(imageUrls);
                            cloudinaryDeletionSuccess = imageDeletionResult.success;

                            if (!imageDeletionResult.success) {
                                console.warn(`⚠️ Mobile: Cloudinary deletion completed with some failures. Deleted: ${imageDeletionResult.deleted.length}, Failed: ${imageDeletionResult.failed.length}`);
                            } else {
                                console.log('✅ Mobile: Photos deleted from Cloudinary after handover rejection:', imageUrls.length);
                            }
                        } catch (cloudinaryError: any) {
                            console.warn('Mobile: Cloudinary deletion failed (likely missing API credentials):', cloudinaryError.message);
                            // Continue with database cleanup even if Cloudinary deletion fails
                        }

                        // Always clear photo URLs from the message data in database
                        const photoCleanupData: any = {};

                        // Clear ID photo URL
                        if (messageData.handoverData?.idPhotoUrl) {
                            photoCleanupData['handoverData.idPhotoUrl'] = null;
                        }

                        // Clear owner's ID photo URL
                        if (messageData.handoverData?.ownerIdPhoto) {
                            photoCleanupData['handoverData.ownerIdPhoto'] = null;
                        }

                        // Clear item photos array
                        if (messageData.handoverData?.itemPhotos && messageData.handoverData.itemPhotos.length > 0) {
                            photoCleanupData['handoverData.itemPhotos'] = [];
                        }

                        // Add photos deleted indicator to the message
                        photoCleanupData['handoverData.photosDeleted'] = true;
                        photoCleanupData['handoverData.photosDeletedAt'] = serverTimestamp();
                        photoCleanupData['handoverData.cloudinaryDeletionSuccess'] = cloudinaryDeletionSuccess;

                        // Merge photo cleanup data with update data
                        Object.assign(updateData, photoCleanupData);
                        console.log('✅ Mobile: Photo URLs cleared from database and deletion indicator added');

                        if (!cloudinaryDeletionSuccess) {
                            console.log('ℹ️ Mobile: Note - Photos may still exist in Cloudinary due to missing API credentials. Consider adding EXPO_PUBLIC_CLOUDINARY_API_KEY and EXPO_PUBLIC_CLOUDINARY_API_SECRET to your .env file for complete cleanup.');
                        }
                    }
                } catch (photoError: any) {
                    console.warn('Mobile: Failed to process photo deletion during handover rejection, but continuing with rejection:', photoError.message);
                    // Continue with rejection even if photo deletion fails
                }
            }

            await updateDoc(messageRef, updateData);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update handover response');
        }
    },

    // Send claim request
    async sendClaimRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            // Validate ID photo URL
            if (idPhotoUrl && !idPhotoUrl.startsWith('http')) {
                console.error('❌ Invalid ID photo URL in sendClaimRequest:', { idPhotoUrl });
                throw new Error('Invalid ID photo URL provided to sendClaimRequest');
            }

            // Validate evidence photos array
            if (evidencePhotos && (!Array.isArray(evidencePhotos) || evidencePhotos.some(photo => !photo.url || !photo.url.startsWith('http')))) {
                console.error('❌ Invalid evidence photos array in sendClaimRequest:', { evidencePhotos });
                throw new Error('Invalid evidence photos array provided to sendClaimRequest');
            }

            const messageData = {
                text: `Claim Request: ${claimReason || 'No reason provided'}`,
                senderId,
                senderName,
                senderProfilePicture,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: 'claim_request',
                claimData: {
                    postId,
                    postTitle,
                    claimReason: claimReason || 'No reason provided',
                    idPhotoUrl: idPhotoUrl || '',
                    evidencePhotos: evidencePhotos || [],
                    requestedAt: serverTimestamp(),
                    status: 'pending'
                }
            };

            // Add message to conversation
            const messageRef = await addDoc(collection(db, `conversations/${conversationId}/messages`), messageData);

            // Get conversation data for notifications
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);
            const conversationData = conversationDoc.data();

            // Increment unread count for all participants except the sender
            if (conversationData) {
                const participantIds = Object.keys(conversationData.participants || {});
                const otherParticipantIds = participantIds.filter(id => id !== senderId);

                // Prepare unread count updates for each receiver
                const unreadCountUpdates: { [key: string]: any } = {};
                otherParticipantIds.forEach(participantId => {
                    unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
                });

                // Update conversation with claim request flag and unread counts
                await updateDoc(conversationRef, {
                    claimRequested: true,
                    updatedAt: serverTimestamp(),
                    lastMessage: {
                        text: messageData.text,
                        senderId,
                        timestamp: serverTimestamp()
                    },
                    ...unreadCountUpdates
                });
            } else {
                // Fallback if no conversation data
                await updateDoc(conversationRef, {
                    claimRequested: true,
                    updatedAt: serverTimestamp(),
                    lastMessage: {
                        text: messageData.text,
                        senderId,
                        timestamp: serverTimestamp()
                    }
                });
            }

            // Send notifications to other participants for claim request
            if (conversationData) {
                const participantIds = Object.keys(conversationData.participants || {});
                const otherParticipantIds = participantIds.filter(id => id !== senderId);

                if (otherParticipantIds.length > 0) {
                    try {
                        await notificationSender.sendMessageNotifications(
                            otherParticipantIds,
                            {
                                conversationId,
                                senderId,
                                senderName,
                                messageText: `Claim Request: ${claimReason || 'No reason provided'}`,
                                conversationData
                            }
                        );
                    } catch (notificationError) {
                        console.warn('⚠️ Mobile: Failed to send claim request notifications, but request was sent:', notificationError);
                        // Continue even if notifications fail - request is already sent
                    }
                }
            } else {
                console.warn('⚠️ Mobile: No conversation data available for claim request notifications');
            }
        } catch (error: any) {
            console.error('❌ Mobile: Failed to send claim request:', error);
            throw new Error(error.message || 'Failed to send claim request');
        }
    },

    // Update claim response
    async updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> {
        try {
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();

            // Update the claim message with the response and ID photo
            const updateData: any = {
                'claimData.status': status,
                'claimData.respondedAt': serverTimestamp(),
                'claimData.respondedBy': userId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                updateData['claimData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with correct field name
                updateData['claimData.status'] = 'pending_confirmation'; // New status for photo confirmation
            }

            // If rejecting, delete all photos from Cloudinary and clear photo URLs (like handover rejection)
            if (status === 'rejected') {
                try {
                    const { extractMessageImages, deleteMessageImages } = await import('../cloudinary');
                    const imageUrls = extractMessageImages(messageData);

                    if (imageUrls.length > 0) {
                        // Try to delete from Cloudinary
                        let cloudinaryDeletionSuccess = false;
                        try {
                            const imageDeletionResult = await deleteMessageImages(imageUrls);
                            cloudinaryDeletionSuccess = imageDeletionResult.success;
                        } catch (cloudinaryError: any) {
                            console.warn('Mobile: Cloudinary deletion failed (likely missing API credentials):', cloudinaryError.message);
                            // Continue with database cleanup even if Cloudinary deletion fails
                        }

                        // Always clear photo URLs from the message data in database
                        const photoCleanupData: any = {};

                        // Clear ID photo URL
                        if (messageData.claimData?.idPhotoUrl) {
                            photoCleanupData['claimData.idPhotoUrl'] = null;
                        }

                        // Clear owner's ID photo URL
                        if (messageData.claimData?.ownerIdPhoto) {
                            photoCleanupData['claimData.ownerIdPhoto'] = null;
                        }

                        // Clear evidence photos array
                        if (messageData.claimData?.evidencePhotos && messageData.claimData.evidencePhotos.length > 0) {
                            photoCleanupData['claimData.evidencePhotos'] = [];
                        }

                        // Add photos deleted indicator to the message
                        photoCleanupData['claimData.photosDeleted'] = true;
                        photoCleanupData['claimData.photosDeletedAt'] = serverTimestamp();
                        photoCleanupData['claimData.cloudinaryDeletionSuccess'] = cloudinaryDeletionSuccess;

                        // Merge photo cleanup data with update data
                        Object.assign(updateData, photoCleanupData);
                    }
                } catch (photoError: any) {
                    console.warn('Mobile: Failed to process photo deletion during claim rejection, but continuing with rejection:', photoError.message);
                    // Continue with rejection even if photo deletion fails
                }
            }

            await updateDoc(messageRef, updateData);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update claim response');
        }
    }
};
