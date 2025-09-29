// Message service for Firebase - handles chat, conversations, and messaging
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    onSnapshot,
    increment,
    addDoc,
    deleteDoc,
    arrayUnion,
    serverTimestamp
} from 'firebase/firestore';
import { notificationSender } from './notificationSender';

// Import Firebase instances and types
import { db } from './config';
import type { UserData } from './types';

// Import helper functions
import { sanitizePostData } from './utils';

// Message service functions
export const messageService = {
    // Get user's conversations (real-time listener)
    getUserConversations(userId: string, callback: (conversations: any[]) => void, errorCallback?: (error: any) => void) {
        const q = query(
            collection(db, 'conversations'),
            where(`participants.${userId}`, '!=', null)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const conversations = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Filter out conversations where the user is the only participant
                const validConversations = conversations.filter((conv: any) => {
                    const participantIds = Object.keys(conv.participants || {});
                    return participantIds.length > 1; // Must have at least 2 participants
                });

                // Return conversations without sorting - let the UI component handle sorting
                callback(validConversations);
            },
            (error) => {
                // Handle listener errors gracefully
                console.log('🔧 MessageService: Listener error:', error?.message || 'Unknown error');
                if (errorCallback) {
                    errorCallback(error);
                }
            }
        );

        // Return the unsubscribe function
        return unsubscribe;
    },
    // Find an existing conversation for a specific post between two users
    async findConversationByPostAndUsers(postId: string, userId1: string, userId2: string): Promise<string | null> {
        try {
            // Query conversations that include this post and both users
            const q = query(
                collection(db, 'conversations'),
                where('postId', '==', postId),
                where(`participants.${userId1}`, '!=', null),
                where(`participants.${userId2}`, '!=', null)
            );

            const snapshot = await getDocs(q);

            // Return the first matching conversation ID if found
            if (!snapshot.empty) {
                return snapshot.docs[0].id;
            }

            return null;
        } catch (error) {
            console.error('Error finding existing conversation:', error);
            return null;
        }
    },
    // Create a new conversation
    async createConversation(postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: UserData, postOwnerUserData?: any): Promise<string> {
        try {
            // Fetch post details to get type, status, and creator ID
            let postType: "lost" | "found" = "lost";
            let postStatus: "pending" | "resolved" | "rejected" = "pending";
            let postCreatorId = postOwnerId; // Default to post owner ID
            let foundAction: "keep" | "turnover to OSA" | "turnover to Campus Security" | null = null;

            try {
                const postDoc = await getDoc(doc(db, 'posts', postId));
                if (postDoc.exists()) {
                    const postData = postDoc.data();
                    postType = postData.type || "lost";
                    postStatus = postData.status || "pending";
                    postCreatorId = postData.creatorId || postOwnerId;
                    // Only set foundAction if it exists and is valid, otherwise keep as null
                    if (postData.foundAction && typeof postData.foundAction === 'string') {
                        // Validate that foundAction is one of the expected values
                        const validFoundActions = ["keep", "turnover to OSA", "turnover to Campus Security"];
                        if (validFoundActions.includes(postData.foundAction)) {
                            foundAction = postData.foundAction as "keep" | "turnover to OSA" | "turnover to Campus Security";
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not fetch post data:', error);
                // Continue with default values if fetch fails
            }

            // Use passed post owner user data or fallback to fetching from users collection
            let postOwnerFirstName = '';
            let postOwnerLastName = '';
            let postOwnerProfilePicture = '';

            if (postOwnerUserData && postOwnerUserData.firstName && postOwnerUserData.lastName) {
                // Use the passed user data from the post
                postOwnerFirstName = postOwnerUserData.firstName;
                postOwnerLastName = postOwnerUserData.lastName;
                postOwnerProfilePicture = postOwnerUserData.profilePicture || '';
            } else {
                // Fallback: try to fetch from users collection
                try {
                    const postOwnerDoc = await getDoc(doc(db, 'users', postOwnerId));
                    if (postOwnerDoc.exists()) {
                        const postOwnerData = postOwnerDoc.data();
                        postOwnerFirstName = postOwnerData.firstName || '';
                        postOwnerLastName = postOwnerData.lastName || '';
                        postOwnerProfilePicture = postOwnerData.profilePicture || '';
                    }
                } catch (error) {
                    console.warn('Could not fetch post owner data:', error);
                    // Continue with empty values if fetch fails
                }
            }

            // Always ensure we have profile pictures - fetch fresh data if missing
            let currentUserProfilePicture = currentUserData.profilePicture || currentUserData.profileImageUrl || '';
            if (!currentUserProfilePicture) {
                try {
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
                    if (currentUserDoc.exists()) {
                        const freshUserData = currentUserDoc.data();
                        currentUserProfilePicture = freshUserData.profilePicture || freshUserData.profileImageUrl || '';
                    }
                } catch (error) {
                    console.warn('Could not fetch current user data for profile picture:', error);
                }
            }

            if (!postOwnerProfilePicture) {
                try {
                    const postOwnerDoc = await getDoc(doc(db, 'users', postOwnerId));
                    if (postOwnerDoc.exists()) {
                        const freshPostOwnerData = postOwnerDoc.data();
                        postOwnerProfilePicture = freshPostOwnerData.profilePicture || freshPostOwnerData.profileImageUrl || '';
                    }
                } catch (error) {
                    console.warn('Could not fetch post owner data for profile picture:', error);
                }
            }

            // Simple duplicate check: get all user conversations and filter in JavaScript
            const userConversationsQuery = query(
                collection(db, 'conversations'),
                where(`participants.${currentUserId}`, '!=', null)
            );
            const userConversationsSnapshot = await getDocs(userConversationsQuery);
            const existingConversation = userConversationsSnapshot.docs.find((docSnap) => {
                const data: any = docSnap.data();
                return data.postId === postId && data.participants && data.participants[postOwnerId];
            });
            if (existingConversation) {
                console.log('Reusing existing conversation:', existingConversation.id);
                return existingConversation.id;
            }

            const conversationData = {
                postId,
                postTitle,
                // New fields for handover button functionality
                postType,
                postStatus,
                postCreatorId,
                foundAction, // Include foundAction for found items
                participants: {
                    [currentUserId]: {
                        uid: currentUserId,
                        firstName: currentUserData.firstName,
                        lastName: currentUserData.lastName,
                        profilePicture: currentUserProfilePicture || null,
                        joinedAt: serverTimestamp()
                    },
                    [postOwnerId]: {
                        uid: postOwnerId,
                        firstName: postOwnerFirstName,
                        lastName: postOwnerLastName,
                        profilePicture: postOwnerProfilePicture || null,
                        joinedAt: serverTimestamp()
                    }
                },
                createdAt: serverTimestamp()
            };

            // Sanitize conversation data before saving to Firestore
            const sanitizedConversationData = sanitizePostData(conversationData);

            const conversationRef = await addDoc(collection(db, 'conversations'), sanitizedConversationData);

            return conversationRef.id;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create conversation');
        }
    },

    // Send a message
    async sendMessage(conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void> {
        try {
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            await addDoc(messagesRef, {
                senderId,
                senderName,
                senderProfilePicture: senderProfilePicture || null,
                text,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: "text" // Default message type
            });

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
                lastMessage: {
                    text,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates
            });

            // Cleanup old messages after sending to maintain 50-message limit
            try {
                await messageService.cleanupOldMessages(conversationId);
            } catch (cleanupError) {
                console.warn('⚠️ [sendMessage] Message cleanup failed, but message was sent successfully:', cleanupError);
                // Don't throw error - cleanup failure shouldn't break message sending
            }
        } catch (error) {
            console.error('❌ [sendMessage] Error sending message:', error);
            throw error; // Re-throw to allow caller to handle the error
        }
    },

    // Get user's conversations (real-time listener)

    // Get messages for a conversation with 50-message limit
    getConversationMessages(conversationId: string, callback: (messages: any[]) => void) {
        const q = query(
            collection(db, 'conversations', conversationId, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(50) // Limit to 50 messages for performance
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        });

        // Return unsubscribe function
        return unsubscribe;
    },

    // Cleanup old messages when conversation exceeds 50 messages
    async cleanupOldMessages(conversationId: string): Promise<void> {
        try {
            console.log('🔧 [cleanupOldMessages] Starting cleanup for conversation:', conversationId);

            // Get all messages ordered by timestamp (oldest first)
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            const messagesQuery = query(
                messagesRef,
                orderBy('timestamp', 'asc')
            );

            const messagesSnapshot = await getDocs(messagesQuery);
            const totalMessages = messagesSnapshot.docs.length;

            // If we have more than 50 messages, delete the oldest ones
            if (totalMessages > 50) {
                const messagesToDelete = totalMessages - 50;
                console.log(`🔧 [cleanupOldMessages] Found ${totalMessages} messages, deleting ${messagesToDelete} oldest messages`);

                // Get the oldest messages to delete
                const oldestMessages = messagesSnapshot.docs.slice(0, messagesToDelete);

                // Delete oldest messages in batch
                const deletePromises = oldestMessages.map(doc => {
                    console.log(`🗑️ [cleanupOldMessages] Deleting message: ${doc.id}`);
                    return deleteDoc(doc.ref);
                });

                await Promise.all(deletePromises);
                console.log(`✅ [cleanupOldMessages] Successfully deleted ${messagesToDelete} old messages`);
            } else {
                console.log(`🔧 [cleanupOldMessages] No cleanup needed - only ${totalMessages} messages`);
            }
        } catch (error: any) {
            console.error('❌ [cleanupOldMessages] Failed to cleanup old messages:', error);
            // Don't throw error - cleanup failure shouldn't break chat functionality
        }
    },

    // Mark conversation as read
    async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
        try {
            // Reset the unread count for the specific user who is reading the conversation
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
            // Get the message document reference
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // Add the user to the readBy array if they're not already there
            await updateDoc(messageRef, {
                readBy: arrayUnion(userId)
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to mark message as read');
        }
    },

    // Mark all unread messages as read automatically when chat opens
    async markAllUnreadMessagesAsRead(conversationId: string, userId: string): Promise<void> {
        try {
            // Get all messages in the conversation
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

            const messagesSnapshot = await getDocs(messagesQuery);

            // Find ALL unread messages (any type) that haven't been read by this user
            const unreadMessages = messagesSnapshot.docs.filter(doc => {
                const messageData = doc.data();
                const notReadByUser = !messageData.readBy?.includes(userId);

                return notReadByUser; // Include ALL message types
            });

            // Mark each unread message as read
            const updatePromises = unreadMessages.map(doc => {
                return updateDoc(doc.ref, {
                    readBy: arrayUnion(userId)
                });
            });

            // Execute all updates
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                console.log(`✅ Marked ${updatePromises.length} unread messages as read for user ${userId}`);
            }
        } catch (error: any) {
            console.error('Failed to mark unread messages as read:', error);
            // Don't throw error - just log it to avoid breaking the chat experience
        }
    },

    // Update post status
    async updatePostStatus(postId: string, status: 'pending' | 'resolved' | 'unclaimed'): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);

            await updateDoc(postRef, {
                status,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error('❌ Firebase updatePostStatus failed:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                name: error.name
            });
            throw new Error(error.message || 'Failed to update post status');
        }
    },

    // Update conversation post data
    async updateConversationPostData(conversationId: string): Promise<void> {
        try {
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

            // Get the post data
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();

            // Update conversation with current post data
            await updateDoc(conversationRef, {
                postTitle: postData.title,
                postStatus: postData.status,
                postType: postData.type,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Updated conversation ${conversationId} with current post data`);
        } catch (error: any) {
            console.error('❌ Failed to update conversation post data:', error);
            throw new Error(error.message || 'Failed to update conversation post data');
        }
    },

    // Send handover request
    async sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            console.log('🔄 Firebase: sendHandoverRequest called with:', { conversationId, senderId, senderName, postId, postTitle, handoverReason, idPhotoUrl, itemPhotos });

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

            // Add message to conversation
            const messageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
                ...messageData,
                readBy: [senderId] // Mark as read by the sender
            });

            // Update conversation with handover request info and increment unread counts for other participants
            await updateDoc(conversationRef, {
                hasHandoverRequest: true,
                handoverRequestId: messageRef.id,
                lastMessage: {
                    text: `Handover Request: ${handoverReason || 'New handover request'}`,
                    senderId,
                    timestamp: serverTimestamp()
                },
                updatedAt: serverTimestamp(),
                ...unreadCountUpdates
            });

            console.log(`✅ Handover request sent successfully: ${messageRef.id}`);
        } catch (error: any) {
            console.error('❌ Firebase sendHandoverRequest failed:', error);
            throw new Error(error.message || 'Failed to send handover request');
        }
    },

    // Update handover response
    async updateHandoverResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> {
        try {
            console.log('🔄 Firebase: updateHandoverResponse called with:', { conversationId, messageId, status, userId, idPhotoUrl });

            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();
            if (messageData.messageType !== 'handover_request') {
                throw new Error('Message is not a handover request');
            }

            // Update the handover message with the response and ID photo
            const updateData: any = {
                'handoverData.status': status,
                'handoverData.respondedAt': serverTimestamp(),
                'handoverData.responderId': userId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                updateData['handoverData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with correct field name
                updateData['handoverData.status'] = 'pending_confirmation'; // New status for photo confirmation
            }

            await updateDoc(messageRef, updateData);

            // Update conversation status
            await updateDoc(doc(db, 'conversations', conversationId), {
                handoverRequestStatus: status,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Handover response updated: ${status}`);
        } catch (error: any) {
            console.error('❌ Firebase updateHandoverResponse failed:', error);
            throw new Error(error.message || 'Failed to update handover response');
        }
    },

    // Send claim request
    async sendClaimRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, postType: 'lost' | 'found', claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            console.log('🔄 Firebase: sendClaimRequest called with:', {
                conversationId,
                senderId,
                senderName,
                postId,
                postTitle,
                postType,
                claimReason,
                idPhotoUrl,
                evidencePhotos
            });

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

            // Get conversation data to find other participants
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const participantIds = Object.keys(conversationData.participants || {});
            const otherParticipantIds = participantIds.filter(id => id !== senderId);

            // Prepare unread count updates for each receiver
            const unreadCountUpdates: { [key: string]: any } = {};
            otherParticipantIds.forEach(participantId => {
                unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
            });

            const messageData = {
                text: `Claim Request: ${claimReason || 'No reason provided'}`,
                senderId,
                senderName,
                senderProfilePicture,
                timestamp: serverTimestamp(),
                readBy: [senderId], // Mark as read by sender
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
            const messageRef = await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);
            const currentTimestamp = new Date();

            // Update conversation with claim request info and unread counts
            await updateDoc(conversationRef, {
                hasClaimRequest: true,
                claimRequestId: messageRef.id,
                lastMessage: {
                    text: `New claim request from ${senderName}`,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Claim request sent successfully: ${messageRef.id}`);

            // Send notification to the post owner
            try {
                await notificationSender.sendClaimRequestNotification(conversationId, {
                    postId: postId,
                    postTitle: postTitle,
                    postType: postType,
                    senderId: senderId,
                    senderName: senderName
                });
            } catch (notificationError) {
                console.error('⚠️ Failed to send claim request notification:', notificationError);
                // Don't fail the whole operation if notification fails
            }
        } catch (error: any) {
            console.error('❌ Firebase sendClaimRequest failed:', error);
            throw new Error(error.message || 'Failed to send claim request');
        }
    },

    // Update claim response
    async updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> {
        try {
            console.log('🔄 Firebase: updateClaimResponse called with:', { conversationId, messageId, status, userId, idPhotoUrl });

            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();
            if (messageData.messageType !== 'claim_request') {
                throw new Error('Message is not a claim request');
            }

            // If rejecting, clean up any uploaded photos
            if (status === 'rejected' && messageData.claimData) {
                try {
                    // Collect all image URLs to be deleted
                    const imageUrls = [
                        ...(messageData.claimData.idPhotoUrl ? [messageData.claimData.idPhotoUrl] : []),
                        ...(messageData.claimData.evidencePhotos?.map((p: any) => p.url) || [])
                    ];

                    if (imageUrls.length > 0) {
                        console.log('🗑️ Cleaning up images for rejected claim');
                        const { deleteMessageImages } = await import('../../utils/cloudinary');
                        const result = await deleteMessageImages(imageUrls);
                        console.log(`✅ Cleanup result: ${result.deleted.length} deleted, ${result.failed.length} failed`);
                    }
                } catch (cleanupError) {
                    console.error('⚠️ Failed to clean up claim images:', cleanupError);
                    // Don't fail the whole operation if cleanup fails
                }
            }

            // Update the claim message with the response and ID photo
            const updateData: any = {
                'claimData.status': status,
                'claimData.respondedAt': serverTimestamp(),
                'claimData.responderId': userId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                updateData['claimData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with correct field name
                updateData['claimData.status'] = 'pending_confirmation'; // New status for photo confirmation
            }

            await updateDoc(messageRef, updateData);

            // Update conversation status
            await updateDoc(doc(db, 'conversations', conversationId), {
                claimRequestStatus: status,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Claim response updated: ${status}`);
        } catch (error: any) {
            console.error('❌ Firebase updateClaimResponse failed:', error);
            throw new Error(error.message || 'Failed to update claim response');
        }
    },

    // Confirm handover ID photo
    async confirmHandoverIdPhoto(conversationId: string, messageId: string, confirmBy: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> {
        try {
            console.log('🔄 Firebase: confirmHandoverIdPhoto called with:', { conversationId, messageId, confirmBy });

            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();
            if (messageData.messageType !== 'handover_request') {
                throw new Error('Message is not a handover request');
            }

            // Update the handover request with confirmation
            await updateDoc(messageRef, {
                'handoverData.idPhotoConfirmed': true,
                'handoverData.idPhotoConfirmedAt': serverTimestamp(),
                'handoverData.idPhotoConfirmedBy': confirmBy
            });

            console.log(`✅ Handover ID photo confirmed by ${confirmBy}`);
            return { success: true, conversationDeleted: false };
        } catch (error: any) {
            console.error('❌ Firebase confirmHandoverIdPhoto failed:', error);
            return { success: false, conversationDeleted: false, error: error.message };
        }
    },

    // Confirm claim ID photo
    async confirmClaimIdPhoto(conversationId: string, messageId: string, confirmBy: string): Promise<void> {
        try {
            console.log('🔄 Firebase: confirmClaimIdPhoto called with:', { conversationId, messageId, confirmBy });

            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();
            if (messageData.messageType !== 'claim_request') {
                throw new Error('Message is not a claim request');
            }

            // Update the claim request with confirmation
            await updateDoc(messageRef, {
                'claimData.idPhotoConfirmed': true,
                'claimData.idPhotoConfirmedAt': serverTimestamp(),
                'claimData.idPhotoConfirmedBy': confirmBy
            });

            console.log(`✅ Claim ID photo confirmed by ${confirmBy}`);
        } catch (error: any) {
            console.error('❌ Firebase confirmClaimIdPhoto failed:', error);
            throw new Error(error.message || 'Failed to confirm claim ID photo');
        }
    },

    // Delete message
    async deleteMessage(conversationId: string, messageId: string, currentUserId: string): Promise<void> {
        try {
            console.log('🔄 Firebase: deleteMessage called with:', { conversationId, messageId, currentUserId });

            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();

            // Check if user has permission to delete this message
            if (messageData.senderId !== currentUserId) {
                throw new Error('You can only delete your own messages');
            }

            // Extract and delete images from Cloudinary before deleting the message
            try {
                const { extractMessageImages, deleteMessageImages } = await import('../../utils/cloudinary');
                const imageUrls = extractMessageImages(messageData);

                console.log(`🗑️ Found ${imageUrls.length} images to delete`);
                if (imageUrls.length > 0) {
                    console.log('🗑️ Images to delete:', imageUrls.map(url => url.split('/').pop()));
                    const imageDeletionResult = await deleteMessageImages(imageUrls);

                    if (!imageDeletionResult.success) {
                        console.warn(`⚠️ Image deletion completed with some failures. Deleted: ${imageDeletionResult.deleted.length}, Failed: ${imageDeletionResult.failed.length}`);
                    }
                }
            } catch (imageError: any) {
                console.warn('Failed to delete images from Cloudinary, but continuing with message deletion:', imageError.message);
                // Continue with message deletion even if image deletion fails
            }

            // Delete the message
            await deleteDoc(messageRef);

            // Update the conversation's lastMessage with the most recent remaining message
            try {
                const conversationRef = doc(db, 'conversations', conversationId);
                const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
                const messagesSnapshot = await getDocs(messagesQuery);

                if (!messagesSnapshot.empty) {
                    const lastMessageDoc = messagesSnapshot.docs[0];
                    const lastMessageData = lastMessageDoc.data();

                    await updateDoc(conversationRef, {
                        lastMessage: {
                            text: lastMessageData.text,
                            senderId: lastMessageData.senderId,
                            timestamp: lastMessageData.timestamp
                        }
                    });
                    console.log('🔄 Updated conversation lastMessage after deletion');
                } else {
                    // No messages left, clear the lastMessage
                    await updateDoc(conversationRef, {
                        lastMessage: null
                    });
                    console.log('🗑️ Cleared conversation lastMessage - no messages remaining');
                }
            } catch (updateError: any) {
                console.warn('Failed to update conversation lastMessage after deletion:', updateError.message);
                // Continue even if lastMessage update fails
            }

            console.log(`✅ Message deleted successfully: ${messageId}`);
        } catch (error: any) {
            console.error('❌ Firebase deleteMessage failed:', error);
            throw new Error(error.message || 'Failed to delete message');
        }
    },

    // Get all conversations for admin (no user filter)
    async getAllConversations(): Promise<any[]> {
        try {
            const q = query(
                collection(db, 'conversations'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter out conversations with less than 2 participants
            const validConversations = conversations.filter((conv: any) => {
                const participantIds = Object.keys(conv.participants || {});
                return participantIds.length > 1; // Must have at least 2 participants
            });

            return validConversations;
        } catch (error: any) {
            console.error('Error fetching all conversations:', error);
            throw new Error(error.message || 'Failed to fetch all conversations');
        }
    },

    // Get admin message statistics
    async getAdminMessageStats(): Promise<{
        totalConversations: number;
        totalUnreadMessages: number;
        pendingHandoverRequests: number;
        pendingClaimRequests: number;
    }> {
        try {
            // Get all conversations
            const conversations = await this.getAllConversations();

            let totalUnreadMessages = 0;
            let pendingHandoverRequests = 0;
            let pendingClaimRequests = 0;

            // Process each conversation to calculate stats
            for (const conversation of conversations) {
                // Calculate total unread messages across all users
                if (conversation.unreadCounts) {
                    const conversationUnread = Object.values(conversation.unreadCounts).reduce((sum: number, count: any) => {
                        return sum + (typeof count === 'number' ? count : 0);
                    }, 0);
                    totalUnreadMessages += conversationUnread;
                }

                // Get messages for this conversation to check for pending requests
                try {
                    const messagesQuery = query(
                        collection(db, 'conversations', conversation.id, 'messages'),
                        orderBy('timestamp', 'desc'),
                        limit(50) // Only check recent messages for performance
                    );
                    const messagesSnapshot = await getDocs(messagesQuery);

                    for (const messageDoc of messagesSnapshot.docs) {
                        const messageData = messageDoc.data();

                        // Check for pending handover requests
                        if (messageData.messageType === 'handover_request' &&
                            messageData.handoverData?.status === 'pending') {
                            pendingHandoverRequests++;
                        }

                        // Check for pending claim requests
                        if (messageData.messageType === 'claim_request' &&
                            messageData.claimData?.status === 'pending') {
                            pendingClaimRequests++;
                        }
                    }
                } catch (messageError) {
                    console.warn(`Failed to fetch messages for conversation ${conversation.id}:`, messageError);
                    // Continue processing other conversations
                }
            }

            return {
                totalConversations: conversations.length,
                totalUnreadMessages,
                pendingHandoverRequests,
                pendingClaimRequests
            };
        } catch (error: any) {
            console.error('Error fetching admin message stats:', error);
            throw new Error(error.message || 'Failed to fetch admin message statistics');
        }
    },

    // Delete entire conversation (admin only)
    async deleteConversation(conversationId: string): Promise<void> {
        try {
            // First, delete all messages in the conversation
            const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
            const messagesSnapshot = await getDocs(messagesQuery);

            // Delete all messages
            for (const messageDoc of messagesSnapshot.docs) {
                await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageDoc.id));
            }

            // Then delete the conversation document
            await deleteDoc(doc(db, 'conversations', conversationId));

            console.log(`✅ Conversation ${conversationId} and all its messages deleted successfully`);
        } catch (error: any) {
            console.error('❌ Failed to delete conversation:', error);
            throw new Error(error.message || 'Failed to delete conversation');
        }
    }
};
