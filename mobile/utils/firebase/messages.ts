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

// Message service interface
interface MessageService {
    createConversation(postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any): Promise<string>;
    sendMessage(conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void>;
    getConversationMessages(conversationId: string, callback: (messages: any[]) => void, messageLimit?: number): () => void;
    getUserConversations(userId: string, callback: (conversations: any[]) => void): () => void;
    markConversationAsRead(conversationId: string, userId: string): Promise<void>;
    markMessageAsRead(conversationId: string, messageId: string, userId: string): Promise<void>;
    markAllUnreadMessagesAsRead(conversationId: string, userId: string): Promise<void>;
    sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string): Promise<void>;
    sendClaimRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void>;
    updateHandoverResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void>;
    updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void>;
    getOlderMessages(conversationId: string, lastMessageTimestamp: any, messageLimit?: number): Promise<any[]>;
    getConversation(conversationId: string): Promise<any>;
    deleteMessage(conversationId: string, messageId: string, userId: string): Promise<void>;
    confirmHandoverIdPhoto(conversationId: string, messageId: string, userId: string): Promise<void>;
    confirmClaimIdPhoto(conversationId: string, messageId: string, userId: string): Promise<void>;
    getCurrentConversations(userId: string): Promise<any[]>;
}

// Message service implementation
export const messageService: MessageService = {
    // Create conversation
    async createConversation(postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any): Promise<string> {
        try {
            // Check for existing conversation first (same logic as web)
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

            // Create new conversation if none exists
            const conversationRef = await addDoc(collection(db, 'conversations'), {
                postId,
                postTitle,
                postOwnerId,
                participants: {
                    [currentUserId]: {
                        uid: currentUserId,
                        firstName: currentUserData.firstName,
                        lastName: currentUserData.lastName,
                        profilePicture: currentUserData.profilePicture || currentUserData.profileImageUrl || null,
                        joinedAt: serverTimestamp()
                    },
                    [postOwnerId]: {
                        uid: postOwnerId,
                        firstName: postOwnerUserData?.firstName || '',
                        lastName: postOwnerUserData?.lastName || '',
                        profilePicture: postOwnerUserData?.profilePicture || postOwnerUserData?.profileImageUrl || null,
                        joinedAt: serverTimestamp()
                    }
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                unreadCounts: {
                    [postOwnerId]: 0,
                    [currentUserId]: 0
                }
            });
            return conversationRef.id;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create conversation');
        }
    },

    // Send message
    async sendMessage(conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void> {
        try {
            await addDoc(collection(db, `conversations/${conversationId}/messages`), {
                senderId,
                senderName,
                senderProfilePicture,
                text,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: 'text'
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
                updatedAt: serverTimestamp(),
                lastMessage: {
                    text,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send message');
        }
    },

    // Get conversation messages
    getConversationMessages(conversationId: string, callback: (messages: any[]) => void, messageLimit: number = 50) {
        const q = query(
            collection(db, `conversations/${conversationId}/messages`),
            orderBy('timestamp', 'asc'),
            limit(messageLimit)
        );

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        });
    },

    // Get user conversations
    getUserConversations(userId: string, callback: (conversations: any[]) => void) {
        const q = query(
            collection(db, 'conversations'),
            where(`participants.${userId}`, '!=', null)
        );

        return onSnapshot(q, (snapshot) => {
            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter out conversations where the user is the only participant
            const validConversations = conversations.filter((conv: any) => {
                const participantIds = Object.keys(conv.participants || {});
                return participantIds.length > 1; // Must have at least 2 participants
            });

            callback(validConversations);
        });
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
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to mark message as read');
        }
    },

    // Mark all unread messages as read
    async markAllUnreadMessagesAsRead(conversationId: string, userId: string): Promise<void> {
        try {
            // Get all unread messages for this conversation and user
            const q = query(
                collection(db, `conversations/${conversationId}/messages`),
                where('readBy', 'array-contains', userId)
            );

            const snapshot = await getDocs(q);
            const batch = writeBatch(db);

            // Mark all messages as read by this user
            snapshot.docs.forEach((doc) => {
                const messageData = doc.data();
                if (!messageData.readBy?.includes(userId)) {
                    batch.update(doc.ref, {
                        readBy: arrayUnion(userId)
                    });
                }
            });

            await batch.commit();
        } catch (error: any) {
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

    // Confirm handover ID photo
    async confirmHandoverIdPhoto(conversationId: string, messageId: string, userId: string): Promise<void> {
        try {
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            await updateDoc(messageRef, {
                'handoverData.idPhotoConfirmed': true,
                'handoverData.confirmedAt': serverTimestamp(),
                'handoverData.confirmedBy': userId
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to confirm handover ID photo');
        }
    },

    // Confirm claim ID photo
    async confirmClaimIdPhoto(conversationId: string, messageId: string, userId: string): Promise<void> {
        try {
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            await updateDoc(messageRef, {
                'claimData.idPhotoConfirmed': true,
                'claimData.confirmedAt': serverTimestamp(),
                'claimData.confirmedBy': userId
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to confirm claim ID photo');
        }
    },

    // Get current conversations (one-time query)
    async getCurrentConversations(userId: string): Promise<any[]> {
        try {
            const q = query(
                collection(db, 'conversations'),
                where(`participants.${userId}`, '!=', null)
            );

            const snapshot = await getDocs(q);
            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter out conversations where the user is the only participant
            const validConversations = conversations.filter((conv: any) => {
                const participantIds = Object.keys(conv.participants || {});
                return participantIds.length > 1; // Must have at least 2 participants
            });

            return validConversations;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to get current conversations');
        }
    },

    // Send handover request
    async sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string): Promise<void> {
        try {
            await addDoc(collection(db, `conversations/${conversationId}/messages`), {
                senderId,
                senderName,
                senderProfilePicture,
                text: `Requesting handover of item: ${postTitle}`,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: 'handover_request',
                handoverData: {
                    postId,
                    postTitle,
                    status: 'pending',
                    requestedAt: serverTimestamp()
                }
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send handover request');
        }
    },

    // Update handover response
    async updateHandoverResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> {
        try {
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);

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

            await updateDoc(messageRef, updateData);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update handover response');
        }
    },

    // Send claim request
    async sendClaimRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            await addDoc(collection(db, `conversations/${conversationId}/messages`), {
                senderId,
                senderName,
                senderProfilePicture,
                text: `Requesting claim of item: ${postTitle}`,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: 'claim_request',
                claimData: {
                    postId,
                    postTitle,
                    status: 'pending',
                    requestedAt: serverTimestamp(),
                    claimReason,
                    idPhotoUrl,
                    evidencePhotos
                }
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send claim request');
        }
    },

    // Update claim response
    async updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> {
        try {
            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);

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

            await updateDoc(messageRef, updateData);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update claim response');
        }
    }
};
