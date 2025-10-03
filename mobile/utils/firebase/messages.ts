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
    createConversation(postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any, postType?: string, postStatus?: string, foundAction?: string): Promise<string>;
    sendMessage(conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void>;
    getConversationMessages(conversationId: string, callback: (messages: any[]) => void, messageLimit?: number): () => void;
    getUserConversations(userId: string, callback: (conversations: any[]) => void): () => void;
    markConversationAsRead(conversationId: string, userId: string): Promise<void>;
    markMessageAsRead(conversationId: string, messageId: string, userId: string): Promise<void>;
    markAllUnreadMessagesAsRead(conversationId: string, userId: string): Promise<void>;
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
}

// Message service implementation
export const messageService: MessageService = {
    // Create conversation
    async createConversation(postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: any, postOwnerUserData?: any, postType?: string, postStatus?: string, foundAction?: string): Promise<string> {
        try {
            // Fetch post details to get type, status, and creator ID (like web version)
            let actualPostType: "lost" | "found" = postType as "lost" | "found" || "lost";
            let actualPostStatus: "pending" | "resolved" | "unclaimed" = postStatus as "pending" | "resolved" | "unclaimed" || "pending";
            let actualPostCreatorId = postOwnerId; // Default to post owner ID
            let actualFoundAction: "keep" | "turnover to OSA" | "turnover to Campus Security" | null = foundAction as "keep" | "turnover to OSA" | "turnover to Campus Security" | null || null;

            try {
                const postDoc = await getDoc(doc(db, 'posts', postId));
                if (postDoc.exists()) {
                    const postData = postDoc.data();
                    actualPostType = postData.type || actualPostType;
                    actualPostStatus = postData.status || actualPostStatus;
                    actualPostCreatorId = postData.creatorId || postOwnerId;
                    // Only set foundAction if it exists and is valid, otherwise keep as null
                    if (postData.foundAction && typeof postData.foundAction === 'string') {
                        // Validate that foundAction is one of the expected values
                        const validFoundActions = ["keep", "turnover to OSA", "turnover to Campus Security"];
                        if (validFoundActions.includes(postData.foundAction)) {
                            actualFoundAction = postData.foundAction as "keep" | "turnover to OSA" | "turnover to Campus Security";
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not fetch post data:', error);
                // Continue with provided values if fetch fails
            }

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
                postCreatorId: actualPostCreatorId, // Use the actual post creator ID
                postType: actualPostType, // Use the actual post type
                postStatus: actualPostStatus, // Use the actual post status
                foundAction: actualFoundAction, // Use the actual found action
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

    // Confirm handover ID photo with detail preservation (matches web implementation)
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

            // Update the handover request with confirmation
            await updateDoc(messageRef, {
                'handoverData.idPhotoConfirmed': true,
                'handoverData.idPhotoConfirmedAt': serverTimestamp(),
                'handoverData.idPhotoConfirmedBy': userId
            });

            // Extract handover details and preserve in post before deletion
            const handoverData = messageData.handoverData;
            if (handoverData) {
                console.log('📋 Mobile: handoverData available:', JSON.stringify(handoverData, null, 2));
                console.log('📋 Mobile: handoverData fields:', Object.keys(handoverData || {}));
                // Get handover person user data
                const handoverPersonId = messageData.senderId;
                const handoverPersonDoc = await getDoc(doc(db, 'users', handoverPersonId));
                const handoverPersonData = handoverPersonDoc.exists() ? handoverPersonDoc.data() : null;

                // Get owner user data (person who confirmed)
                const ownerDoc = await getDoc(doc(db, 'users', userId));
                const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;
                const ownerName = ownerData ? `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() : 'Unknown';

                // Prepare handover request details for the post
                const handoverRequestDetails: any = {
                    // Original message details
                    messageId: messageId,
                    messageText: messageData.text || '',
                    messageTimestamp: messageData.timestamp,
                    senderId: messageData.senderId,
                    senderName: messageData.senderName || '',
                    senderProfilePicture: messageData.senderProfilePicture || '',

                    // Handover data from the message
                    handoverReason: handoverData.handoverReason || '',
                    handoverRequestedAt: handoverData.requestedAt || null,
                    handoverRespondedAt: handoverData.respondedAt || null,
                    handoverResponseMessage: handoverData.responseMessage || '',

                    // ID photo verification details
                    idPhotoUrl: handoverData.idPhotoUrl || '',
                    idPhotoConfirmed: true,
                    idPhotoConfirmedAt: serverTimestamp(),
                    idPhotoConfirmedBy: userId,

                    // Item photos
                    itemPhotos: handoverData.itemPhotos || [],
                    itemPhotosConfirmed: handoverData.itemPhotosConfirmed || false,
                    itemPhotosConfirmedAt: handoverData.itemPhotosConfirmedAt || null,
                    itemPhotosConfirmedBy: handoverData.itemPhotosConfirmedBy || '',

                    // Owner verification details
                    ownerIdPhoto: handoverData.ownerIdPhoto || '',
                    ownerIdPhotoConfirmed: handoverData.ownerIdPhotoConfirmed || false,
                    ownerIdPhotoConfirmedAt: handoverData.ownerIdPhotoConfirmedAt || null,
                    ownerIdPhotoConfirmedBy: handoverData.ownerIdPhotoConfirmedBy || ''
                };

                // Add handover confirmed timestamp to request details
                handoverRequestDetails.handoverConfirmedAt = serverTimestamp();
                handoverRequestDetails.handoverConfirmedBy = userId;

                // Prepare handover details for the post
                const handoverDetails = {
                    handoverPersonName: handoverPersonData ? `${handoverPersonData.firstName || ''} ${handoverPersonData.lastName || ''}`.trim() : 'Unknown',
                    handoverPersonContact: handoverPersonData?.contactNum || '',
                    handoverPersonStudentId: handoverPersonData?.studentId || '',
                    handoverPersonEmail: handoverPersonData?.email || '',
                    handoverItemPhotos: handoverData.itemPhotos || [],
                    handoverIdPhoto: handoverData.idPhotoUrl || '',
                    ownerIdPhoto: handoverData.ownerIdPhoto || '',
                    handoverConfirmedAt: serverTimestamp(),
                    handoverConfirmedBy: userId,
                    ownerName: ownerName,
                    // Store the complete handover request chat bubble details
                    handoverRequestDetails: handoverRequestDetails
                };

                // Get all messages from the conversation to preserve the chat history
                const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
                const messagesSnap = await getDocs(messagesQuery);

                const conversationMessages = messagesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Update post with handover details, status, and conversation data
                await updateDoc(doc(db, 'posts', postId), {
                    status: 'resolved',
                    handoverDetails: handoverDetails,
                    conversationData: {
                        conversationId: conversationId,
                        messages: conversationMessages,
                        participants: conversationData.participants || {},
                        createdAt: conversationData.createdAt || serverTimestamp(),
                        lastMessage: conversationData.lastMessage || null
                    },
                    updatedAt: serverTimestamp()
                });

                console.log('✅ Mobile: Post updated with complete handover details and conversation data');
                console.log('📋 Mobile: handoverDetails saved:', JSON.stringify(handoverDetails, null, 2));
            } else {
                console.warn('⚠️ Mobile: No handover data found in message, cannot store handover details');
                // Fallback: just update post status
                await updateDoc(doc(db, 'posts', postId), {
                    status: 'resolved',
                    updatedAt: serverTimestamp()
                });
            }

            // Delete the conversation after successful data preservation
            try {
                // First, delete all messages in the conversation
                const messagesQuery = query(collection(db, `conversations/${conversationId}/messages`));
                const messagesSnapshot = await getDocs(messagesQuery);

                // Delete all messages
                for (const messageDoc of messagesSnapshot.docs) {
                    await deleteDoc(doc(db, `conversations/${conversationId}/messages`, messageDoc.id));
                }

                // Then delete the conversation document
                await deleteDoc(conversationRef);

                console.log(`✅ Mobile: Conversation ${conversationId} deleted after handover confirmation`);
            } catch (deleteError) {
                console.warn('⚠️ Mobile: Failed to delete conversation after handover confirmation:', deleteError);
                // Continue even if conversation deletion fails
            }

            console.log(`✅ Mobile: Handover ID photo confirmed by ${userId}`);
            return { success: true, conversationDeleted: true, postId };
        } catch (error: any) {
            console.error('❌ Mobile: confirmHandoverIdPhoto failed:', error);
            return { success: false, conversationDeleted: false, error: error.message };
        }
    },

    // Confirm claim ID photo with detail preservation (matches web implementation)
    async confirmClaimIdPhoto(conversationId: string, messageId: string, userId: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> {
        try {
            console.log('🔄 Mobile: confirmClaimIdPhoto called with:', { conversationId, messageId, userId });

            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
            const messageDoc = await getDoc(messageRef);

            if (!messageDoc.exists()) {
                console.error('❌ Mobile: Message not found');
                return { success: false, conversationDeleted: false, error: 'Message not found' };
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

            // STEP 1: Update the claim message to confirm the ID photo
            await updateDoc(messageRef, {
                'claimData.idPhotoConfirmed': true,
                'claimData.idPhotoConfirmedAt': serverTimestamp(),
                'claimData.idPhotoConfirmedBy': userId
            });

            // STEP 2: Get conversation data and prepare claim details
            const claimData = messageData.claimData;
            if (claimData) {
                // Get claimer user data
                const claimerId = messageData.senderId;
                const claimerDoc = await getDoc(doc(db, 'users', claimerId));
                const claimerData = claimerDoc.exists() ? claimerDoc.data() : null;

                // Get owner user data
                const ownerDoc = await getDoc(doc(db, 'users', userId));
                const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;
                const ownerName = ownerData ? `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() : 'Unknown';

                // Prepare claim request details for the post
                const claimRequestDetails: any = {
                    // Original message details
                    messageId: messageId,
                    messageText: messageData.text || '',
                    messageTimestamp: messageData.timestamp,
                    senderId: messageData.senderId,
                    senderName: messageData.senderName || '',
                    senderProfilePicture: messageData.senderProfilePicture || '',

                    // Claim data from the message
                    claimReason: claimData.claimReason || '',
                    claimRequestedAt: claimData.requestedAt || null,
                    claimRespondedAt: claimData.respondedAt || null,
                    claimResponseMessage: claimData.responseMessage || '',

                    // ID photo verification details
                    idPhotoUrl: claimData.idPhotoUrl || '',
                    idPhotoConfirmed: true,
                    idPhotoConfirmedAt: serverTimestamp(),
                    idPhotoConfirmedBy: userId,

                    // Evidence photos
                    evidencePhotos: claimData.evidencePhotos || [],
                    evidencePhotosConfirmed: claimData.evidencePhotosConfirmed || false,
                    evidencePhotosConfirmedAt: claimData.evidencePhotosConfirmedAt || null,
                    evidencePhotosConfirmedBy: claimData.evidencePhotosConfirmedBy || '',

                    // Owner verification details
                    ownerIdPhoto: claimData.ownerIdPhoto || '',
                    ownerIdPhotoConfirmed: claimData.ownerIdPhotoConfirmed || false,
                    ownerIdPhotoConfirmedAt: claimData.ownerIdPhotoConfirmedAt || null,
                    ownerIdPhotoConfirmedBy: claimData.ownerIdPhotoConfirmedBy || ''
                };

                // Add claim confirmed timestamp to request details
                claimRequestDetails.claimConfirmedAt = serverTimestamp();
                claimRequestDetails.claimConfirmedBy = userId;

                // Prepare claim details for the post
                const claimDetails = {
                    claimerName: claimerData ? `${claimerData.firstName || ''} ${claimerData.lastName || ''}`.trim() : 'Unknown',
                    claimerContact: claimerData?.contactNum || '',
                    claimerStudentId: claimerData?.studentId || '',
                    claimerEmail: claimerData?.email || '',
                    evidencePhotos: claimData.evidencePhotos || [],
                    claimerIdPhoto: claimData.idPhotoUrl || '',
                    ownerIdPhoto: claimData.ownerIdPhoto || '',
                    claimConfirmedAt: serverTimestamp(),
                    claimConfirmedBy: userId,
                    ownerName: ownerName,
                    // Store the complete claim request chat bubble details
                    claimRequestDetails: claimRequestDetails
                };

                // Get all messages from the conversation to preserve the chat history
                const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
                const messagesSnap = await getDocs(messagesQuery);

                const conversationMessages = messagesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Update post with claim details, status, and conversation data
                await updateDoc(doc(db, 'posts', postId), {
                    status: 'resolved',
                    claimDetails: claimDetails,
                    conversationData: {
                        conversationId: conversationId,
                        messages: conversationMessages,
                        participants: conversationData.participants || {},
                        createdAt: conversationData.createdAt || serverTimestamp(),
                        lastMessage: conversationData.lastMessage || null
                    },
                    updatedAt: serverTimestamp()
                });

                console.log('✅ Mobile: Post updated with complete claim details and conversation data');
            } else {
                console.warn('⚠️ Mobile: No claim data found in message, cannot store claim details');
                // Fallback: just update post status
                await updateDoc(doc(db, 'posts', postId), {
                    status: 'resolved',
                    updatedAt: serverTimestamp()
                });
            }

            // Delete the conversation after successful data preservation
            try {
                // First, delete all messages in the conversation
                const messagesQuery = query(collection(db, `conversations/${conversationId}/messages`));
                const messagesSnapshot = await getDocs(messagesQuery);

                // Delete all messages
                for (const messageDoc of messagesSnapshot.docs) {
                    await deleteDoc(doc(db, `conversations/${conversationId}/messages`, messageDoc.id));
                }

                // Then delete the conversation document
                await deleteDoc(conversationRef);

                console.log(`✅ Mobile: Conversation ${conversationId} deleted after claim confirmation`);
            } catch (deleteError) {
                console.warn('⚠️ Mobile: Failed to delete conversation after claim confirmation:', deleteError);
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
    async sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            console.log('🔄 Mobile: sendHandoverRequest called with:', { conversationId, senderId, senderName, postId, postTitle, handoverReason, idPhotoUrl, itemPhotos });

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
            const messageRef = await addDoc(collection(db, `conversations/${conversationId}/messages`), messageData);

            // Update conversation with handover request flag
            const conversationRef = doc(db, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                handoverRequested: true,
                updatedAt: serverTimestamp(),
                lastMessage: {
                    text: messageData.text,
                    senderId,
                    timestamp: serverTimestamp()
                }
            });

            console.log('✅ Mobile: Handover request sent successfully');
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
            console.log('🔄 Mobile: sendClaimRequest called with:', { conversationId, senderId, senderName, postId, postTitle, claimReason, idPhotoUrl, evidencePhotos });

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

            // Update conversation with claim request flag
            const conversationRef = doc(db, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                claimRequested: true,
                updatedAt: serverTimestamp(),
                lastMessage: {
                    text: messageData.text,
                    senderId,
                    timestamp: serverTimestamp()
                }
            });

            console.log('✅ Mobile: Claim request sent successfully');
        } catch (error: any) {
            console.error('❌ Mobile: Failed to send claim request:', error);
            throw new Error(error.message || 'Failed to send claim request');
        }
    },

    // Update claim response
    async updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', userId: string, idPhotoUrl?: string): Promise<void> {
        try {
            console.log('🔄 Mobile Firebase: updateClaimResponse called with:', { conversationId, messageId, status, userId, idPhotoUrl: idPhotoUrl ? 'provided' : 'not provided' });

            const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);

            // Update the claim message with the response and ID photo
            const updateData: any = {
                'claimData.status': status,
                'claimData.respondedAt': serverTimestamp(),
                'claimData.respondedBy': userId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                console.log('📸 Mobile Firebase: Setting status to pending_confirmation with ID photo');
                updateData['claimData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with correct field name
                updateData['claimData.status'] = 'pending_confirmation'; // New status for photo confirmation
            } else {
                console.log('❌ Mobile Firebase: Not setting pending_confirmation status');
            }

            console.log('📝 Mobile Firebase: Final updateData:', updateData);

            await updateDoc(messageRef, updateData);
            console.log('✅ Mobile Firebase: Claim response updated successfully');
        } catch (error: any) {
            console.error('❌ Mobile Firebase: Failed to update claim response:', error);
            throw new Error(error.message || 'Failed to update claim response');
        }
    }
};
