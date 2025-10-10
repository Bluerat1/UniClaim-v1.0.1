// Message service for conversation and messaging functionality
// Extracted from waterbase.ts for better organization

import { db } from './authService';
import type { UserData } from './authService';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    addDoc,
    increment
} from 'firebase/firestore';

// Message service functions from separate files
import { sanitizePostData } from './dataSanitizers';
import { extractMessageImages, deleteMessageImages } from './cloudinary';

// Message service functions
export const messageService = {
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
            // Note: contact number not used in conversation document

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
            // Use current timestamp for lastMessage to prevent jumping during sorting
            const currentTimestamp = new Date();
            await updateDoc(conversationRef, {
                lastMessage: {
                    text,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates
            });

            // 🔒 Cleanup old messages after sending to maintain 50-message limit
            try {
                await this.cleanupOldMessages(conversationId);
            } catch (cleanupError) {
                console.warn('⚠️ [sendMessage] Message cleanup failed, but message was sent successfully:', cleanupError);
                // Don't throw error - cleanup failure shouldn't break message sending
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send message');
        }
    },

    // Send a handover request message
    async sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            // First, check if this conversation already has a handover request
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();

            // Check if this is a lost item (only allow handover for lost items)
            if (conversationData.postType !== 'lost') {
                throw new Error('Handover requests are only allowed for lost items');
            }

            // Check if a handover request already exists
            if (conversationData.handoverRequested === true) {
                throw new Error('You have already requested a handover in this conversation');
            }

            const messagesRef = collection(db, 'conversations', conversationId, 'messages');

            // Validate handover data before creating message
            const isProduction = process.env.NODE_ENV === 'production';
            const logLevel = isProduction ? console.warn : console.log;

            logLevel('🔍 Validating handover data before Firestore storage...');
            logLevel('🔍 ID photo URL provided:', idPhotoUrl ? 'yes' : 'no');
            logLevel('🔍 Item photos array provided:', itemPhotos ? 'yes' : 'no');
            logLevel('🔍 Item photos length:', itemPhotos?.length || 0);

            // Validate ID photo URL
            if (!idPhotoUrl || typeof idPhotoUrl !== 'string' || !idPhotoUrl.includes('cloudinary.com')) {
                console.error('❌ Invalid ID photo URL in sendHandoverRequest:', {
                    idPhotoUrl: idPhotoUrl ? idPhotoUrl.substring(0, 50) + '...' : 'null',
                    type: typeof idPhotoUrl,
                    isCloudinary: idPhotoUrl?.includes('cloudinary.com')
                });
                throw new Error('Invalid ID photo URL provided to sendHandoverRequest');
            }

            // Validate item photos array
            if (!Array.isArray(itemPhotos) || itemPhotos.length === 0) {
                console.error('❌ Invalid item photos array in sendHandoverRequest:', {
                    isArray: Array.isArray(itemPhotos),
                    length: itemPhotos?.length || 0,
                    itemPhotos: itemPhotos
                });
                throw new Error('Invalid item photos array provided to sendHandoverRequest');
            }

            // Validate each item photo object
            itemPhotos.forEach((photo, index) => {
                if (!photo || typeof photo !== 'object') {
                    console.error(`❌ Item photo ${index} is not an object:`, photo);
                    throw new Error(`Invalid item photo object at index ${index}`);
                }

                if (!photo.url || typeof photo.url !== 'string' || !photo.url.includes('cloudinary.com')) {
                    console.error(`❌ Item photo ${index} has invalid URL:`, {
                        url: photo.url ? photo.url.substring(0, 50) + '...' : 'missing',
                        type: typeof photo.url,
                        isCloudinary: photo.url?.includes('cloudinary.com'),
                        photo: photo
                    });
                    throw new Error(`Invalid URL in item photo at index ${index}`);
                }

                logLevel(`✅ Item photo ${index} validation passed:`, photo.url.split('/').pop());
            });

            logLevel('✅ All handover data validated, creating message...');

            const handoverMessage = {
                senderId,
                senderName,
                senderProfilePicture: senderProfilePicture || null,
                text: handoverReason ? `I would like to handover the item "${postTitle}" to you. Reason: ${handoverReason}` : `I would like to handover the item "${postTitle}" to you.`,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: "handover_request",
                handoverData: {
                    postId,
                    postTitle,
                    status: "pending",
                    requestedAt: serverTimestamp(),
                    handoverReason: handoverReason || null,
                    idPhotoUrl: idPhotoUrl,
                    itemPhotos: itemPhotos
                }
            };

            logLevel('💾 Storing handover message in Firestore...');
            await addDoc(messagesRef, handoverMessage);
            logLevel('✅ Handover message stored successfully');

            // Get conversation data to find other participants for unread count updates
            const conversationDataForUnread = await getDoc(conversationRef);
            const participantIds = Object.keys(conversationDataForUnread.data()?.participants || {});

            // Increment unread count for all participants except the sender
            const otherParticipantIds = participantIds.filter(id => id !== senderId);

            // Prepare unread count updates for each receiver
            const unreadCountUpdates: { [key: string]: any } = {};
            otherParticipantIds.forEach(participantId => {
                unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
            });

            // Update conversation with handover request flag, last message, and unread counts
            // Use current timestamp for lastMessage to prevent jumping during sorting
            const currentTimestamp = new Date();
            await updateDoc(conversationRef, {
                handoverRequested: true,
                lastMessage: {
                    text: handoverMessage.text,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates
            });

            // 🔒 Cleanup old messages after sending to maintain 50-message limit
            try {
                await this.cleanupOldMessages(conversationId);
            } catch (cleanupError) {
                console.warn('⚠️ [sendHandoverRequest] Message cleanup failed, but handover request was sent successfully:', cleanupError);
                // Don't throw error - cleanup failure shouldn't break handover request
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send handover request');
        }
    },

    // Send a claim request message
    async sendClaimRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            // First, check if this conversation already has a claim request
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();

            // Check if this is a found item with "keep" action (only allow claims for found items that are being kept)
            if (conversationData.postType !== 'found') {
                throw new Error('Claim requests are only allowed for found items');
            }

            if (conversationData.foundAction !== 'keep') {
                throw new Error('Claim requests are only allowed for found items that are being kept');
            }

            // Check if a claim request already exists
            if (conversationData.claimRequested === true) {
                throw new Error('You have already requested to claim this item in this conversation');
            }

            const messagesRef = collection(db, 'conversations', conversationId, 'messages');

            // Validate claim data before creating message
            const isProduction = process.env.NODE_ENV === 'production';
            const logLevel = isProduction ? console.warn : console.log;

            logLevel('🔍 Validating claim data before Firestore storage...');
            logLevel('🔍 ID photo URL provided:', idPhotoUrl ? 'yes' : 'no');
            logLevel('🔍 Evidence photos array provided:', evidencePhotos ? 'yes' : 'no');
            logLevel('🔍 Evidence photos length:', evidencePhotos?.length || 0);

            // Validate ID photo URL
            if (!idPhotoUrl || typeof idPhotoUrl !== 'string' || !idPhotoUrl.includes('cloudinary.com')) {
                console.error('❌ Invalid ID photo URL in sendClaimRequest:', {
                    idPhotoUrl: idPhotoUrl ? idPhotoUrl.substring(0, 50) + '...' : 'null',
                    type: typeof idPhotoUrl,
                    isCloudinary: idPhotoUrl?.includes('cloudinary.com')
                });
                throw new Error('Invalid ID photo URL provided to sendClaimRequest');
            }

            // Validate evidence photos array
            if (!Array.isArray(evidencePhotos) || evidencePhotos.length === 0) {
                console.error('❌ Invalid evidence photos array in sendClaimRequest:', {
                    isArray: Array.isArray(evidencePhotos),
                    length: evidencePhotos?.length || 0,
                    evidencePhotos: evidencePhotos
                });
                throw new Error('Invalid evidence photos array provided to sendClaimRequest');
            }

            // Validate each evidence photo object
            evidencePhotos.forEach((photo, index) => {
                if (!photo || typeof photo !== 'object') {
                    console.error(`❌ Evidence photo ${index} is not an object:`, photo);
                    throw new Error(`Invalid evidence photo object at index ${index}`);
                }

                if (!photo.url || typeof photo.url !== 'string' || !photo.url.includes('cloudinary.com')) {
                    console.error(`❌ Evidence photo ${index} has invalid URL:`, {
                        url: photo.url ? photo.url.substring(0, 50) + '...' : 'missing',
                        type: typeof photo.url,
                        isCloudinary: photo.url?.includes('cloudinary.com'),
                        photo: photo
                    });
                    throw new Error(`Invalid URL in evidence photo at index ${index}`);
                }

                logLevel(`✅ Evidence photo ${index} validation passed:`, photo.url.split('/').pop());
            });

            logLevel('✅ All claim data validated, creating message...');

            const claimMessage = {
                senderId,
                senderName,
                senderProfilePicture: senderProfilePicture || null,
                text: `I would like to claim the item "${postTitle}" as my own.`,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: "claim_request",
                claimData: {
                    postId,
                    postTitle,
                    status: "pending",
                    requestedAt: serverTimestamp(),
                    claimReason: claimReason || null,
                    idPhotoUrl: idPhotoUrl,
                    evidencePhotos: evidencePhotos
                }
            };

            logLevel('💾 Storing claim message in Firestore...');
            await addDoc(messagesRef, claimMessage);
            logLevel('✅ Claim message stored successfully');

            // Get conversation data to find other participants for unread count updates
            const conversationDataForUnread = await getDoc(conversationRef);
            const participantIds = Object.keys(conversationDataForUnread.data()?.participants || {});

            // Increment unread count for all participants except the sender
            const otherParticipantIds = participantIds.filter(id => id !== senderId);

            // Prepare unread count updates for each receiver
            const unreadCountUpdates: { [key: string]: any } = {};
            otherParticipantIds.forEach(participantId => {
                unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
            });

            // Update conversation with claim request flag, last message, and unread counts
            await updateDoc(conversationRef, {
                claimRequested: true,
                lastMessage: {
                    text: claimMessage.text,
                    senderId,
                    timestamp: claimMessage.timestamp
                },
                ...unreadCountUpdates
            });

            // 🔒 Cleanup old messages after sending to maintain 50-message limit
            try {
                await this.cleanupOldMessages(conversationId);
            } catch (cleanupError) {
                console.warn('⚠️ [sendClaimRequest] Message cleanup failed, but claim request was sent successfully:', cleanupError);
                // Don't throw error - cleanup failure shouldn't break claim request
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send claim request');
        }
    },

    // Update claim response
    async updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', responderId: string, idPhotoUrl?: string): Promise<void> {
        try {
            console.log('🔄 Firebase: updateClaimResponse called with:', { conversationId, messageId, status, responderId, idPhotoUrl });
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // Update the claim message with the response
            const updateData: any = {
                'claimData.status': status,
                'claimData.respondedAt': serverTimestamp(),
                'claimData.responderId': responderId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                updateData['claimData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with separate field name
                updateData['claimData.status'] = 'pending_confirmation'; // New status for photo confirmation
            }

            await updateDoc(messageRef, updateData);

            // If claim is rejected, delete all photos and reset the claimRequested flag
            if (status === 'rejected') {
                console.log('🗑️ Firebase: Claim rejected, starting photo deletion process...');
                try {
                    // Step 1: Extract all photos from the claim message
                    const messageDoc = await getDoc(messageRef);
                    if (messageDoc.exists()) {
                        const messageData = messageDoc.data();
                        console.log('🗑️ Firebase: Message data retrieved:', messageData);
                        const imageUrls = extractMessageImages(messageData);
                        console.log('🗑️ Firebase: Extracted image URLs:', imageUrls);

                        // Step 2: Delete photos from Cloudinary
                        if (imageUrls.length > 0) {
                            try {
                                console.log('🗑️ Attempting to delete photos:', imageUrls);
                                const deletionResult = await deleteMessageImages(imageUrls);
                                console.log('🗑️ Deletion result:', deletionResult);
                                console.log('✅ Photos deleted after claim rejection:', imageUrls.length);

                                // Step 3: Clear photo URLs from the message data in database
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

                                // Clear legacy verification photos array
                                if (messageData.claimData?.verificationPhotos && messageData.claimData.verificationPhotos.length > 0) {
                                    photoCleanupData['claimData.verificationPhotos'] = [];
                                }

                                // Add photos deleted indicator to the message
                                photoCleanupData['claimData.photosDeleted'] = true;
                                photoCleanupData['claimData.photosDeletedAt'] = serverTimestamp();

                                // Update the message to remove photo references and add deletion indicator
                                if (Object.keys(photoCleanupData).length > 0) {
                                    await updateDoc(messageRef, photoCleanupData);
                                    console.log('✅ Photo URLs cleared from database and deletion indicator added:', photoCleanupData);
                                }

                            } catch (photoError: any) {
                                console.warn('⚠️ Failed to delete photos after rejection:', photoError.message);
                                // Continue with rejection even if photo cleanup fails
                            }
                        }
                    }
                } catch (photoExtractionError: any) {
                    console.warn('⚠️ Failed to extract photos for deletion:', photoExtractionError.message);
                    // Continue with rejection even if photo extraction fails
                }

                // Step 4: Reset conversation flags
                const conversationRef = doc(db, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    claimRequested: false
                });
            }

            // Note: No new chat bubble is created - only the status is updated
            // The existing claim request message will show the updated status

        } catch (error: any) {
            throw new Error(error.message || 'Failed to update claim response');
        }
    },

    // Confirm ID photo for claim
    async confirmClaimIdPhoto(conversationId: string, messageId: string, confirmBy: string): Promise<void> {
        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // STEP 1: Update the claim message to confirm the ID photo
            await updateDoc(messageRef, {
                'claimData.idPhotoConfirmed': true,
                'claimData.idPhotoConfirmedAt': serverTimestamp(),
                'claimData.idPhotoConfirmedBy': confirmBy,
                'claimData.status': 'accepted' // Final status after confirmation
            });

            console.log('✅ Claim ID photo confirmed successfully');

            // STEP 2: Get conversation data to retrieve postId and prepare claim details
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationSnap = await getDoc(conversationRef);

            if (conversationSnap.exists()) {
                const conversationData = conversationSnap.data();
                const postId = conversationData.postId;

                if (postId) {
                    // STEP 3: Get the claim message data to extract claim details
                    const messageSnap = await getDoc(messageRef);
                    if (messageSnap.exists()) {
                        const messageData = messageSnap.data();
                        const claimData = messageData.claimData;

                        if (claimData) {
                            // STEP 4: Get claimer user data
                            const claimerId = messageData.senderId;
                            const claimerDoc = await getDoc(doc(db, 'users', claimerId));
                            const claimerData = claimerDoc.exists() ? claimerDoc.data() : null;

                            // STEP 5: Get owner user data
                            const ownerDoc = await getDoc(doc(db, 'users', confirmBy));
                            const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;
                            const ownerName = ownerData ? `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() : 'Unknown';

                            // STEP 6: Prepare claim request details for the post
                            const claimRequestDetails = {
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
                                idPhotoConfirmedBy: confirmBy,

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

                            // STEP 7: Add claim confirmed timestamp to request details
                            (claimRequestDetails as any).claimConfirmedAt = serverTimestamp();
                            (claimRequestDetails as any).claimConfirmedBy = confirmBy;

                            // Prepare claim details for the post
                            const claimDetails = {
                                claimerName: claimerData ? `${claimerData.firstName || ''} ${claimerData.lastName || ''}`.trim() : 'Unknown',
                                claimerContact: claimerData?.contactNum || '',
                                claimerEmail: claimerData?.email || '',
                                claimerProfilePicture: claimerData?.profilePicture || claimerData?.profileImageUrl || '',

                                ownerName: ownerName,
                                ownerContact: ownerData?.contactNum || '',
                                ownerEmail: ownerData?.email || '',

                                postTitle: conversationData.postTitle || '',
                                postId: postId,

                                claimRequestDetails: claimRequestDetails,

                                // Status and timestamps
                                status: 'confirmed',
                                confirmedAt: serverTimestamp(),
                                confirmedBy: confirmBy,

                                // Add a unique ID for this claim confirmation
                                claimConfirmationId: `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                            };

                            // STEP 8: Update the post with the confirmed claim details
                            try {
                                const postRef = doc(db, 'posts', postId);
                                await updateDoc(postRef, {
                                    claimDetails: claimDetails,
                                    status: 'resolved',
                                    resolvedAt: serverTimestamp(),
                                    resolvedBy: confirmBy,
                                    updatedAt: serverTimestamp()
                                });

                                console.log('✅ Post updated with confirmed claim details');

                            } catch (postUpdateError: any) {
                                console.warn('⚠️ Failed to update post with claim details:', postUpdateError.message);
                                // Don't throw error - claim confirmation was successful
                            }
                        }
                    }
                }
            }

        } catch (error: any) {
            throw new Error(error.message || 'Failed to confirm claim ID photo');
        }
    },

    // Delete a message
    async deleteMessage(conversationId: string, messageId: string): Promise<void> {
        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // First, get the message data to extract photos for deletion
            const messageDoc = await getDoc(messageRef);
            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();

            // NEW: Extract and delete images from Cloudinary before deleting the message
            try {
                const imageUrls = extractMessageImages(messageData);

                if (imageUrls.length > 0) {
                    const imageDeletionResult = await deleteMessageImages(imageUrls);

                    if (!imageDeletionResult.success) {
                        console.warn(`⚠️ Image deletion completed with some failures. Deleted: ${imageDeletionResult.deleted.length}, Failed: ${imageDeletionResult.failed.length}`);
                    }
                }
            } catch (imageError: any) {
                console.warn('Failed to delete images from Cloudinary, but continuing with message deletion:', imageError.message);
                // Continue with message deletion even if image deletion fails
            }

            // Check message types before deleting
            const isHandoverRequest = messageData.messageType === 'handover_request';
            const isClaimRequest = messageData.messageType === 'claim_request';

            // Delete the message
            await deleteDoc(messageRef);

            // Reset flags based on message type
            const conversationRef = doc(db, 'conversations', conversationId);

            if (isHandoverRequest) {
                await updateDoc(conversationRef, {
                    handoverRequested: false
                });
                console.log('🗑️ Reset handoverRequested flag');
            } else if (isClaimRequest) {
                await updateDoc(conversationRef, {
                    claimRequested: false
                });
                console.log('🗑️ Reset claimRequested flag');
            }

            // Update the conversation's lastMessage with the most recent remaining message
            try {
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

        } catch (error: any) {
            throw new Error(error.message || 'Failed to delete message');
        }
    },

    // Cleanup old messages to maintain 50-message limit per conversation
    async cleanupOldMessages(conversationId: string): Promise<void> {
        try {
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');

            // Get all messages ordered by timestamp (oldest first)
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
            const messagesSnapshot = await getDocs(messagesQuery);

            // If we have more than 50 messages, delete the oldest ones
            if (messagesSnapshot.docs.length > 50) {
                const messagesToDelete = messagesSnapshot.docs.slice(0, messagesSnapshot.docs.length - 50);

                console.log(`🧹 Cleaning up ${messagesToDelete.length} old messages in conversation ${conversationId}`);

                // Delete messages in batch
                const deletePromises = messagesToDelete.map(async (messageDoc) => {
                    try {
                        await deleteDoc(messageDoc.ref);
                    } catch (error: any) {
                        console.warn(`Failed to delete message ${messageDoc.id}:`, error.message);
                    }
                });

                await Promise.all(deletePromises);

                console.log(`✅ Cleaned up ${messagesToDelete.length} old messages`);
            }
        } catch (error: any) {
            console.error('Message cleanup failed:', error);
            throw new Error(`Failed to cleanup old messages: ${error.message}`);
        }
    }
};
