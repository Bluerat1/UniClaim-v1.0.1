import { db } from '../utils/authService';
import {
    doc,
    updateDoc,
    getDoc,
    arrayUnion,
    serverTimestamp,
    collection,
    query,
    getDocs,
    orderBy,
    runTransaction,
    where
} from 'firebase/firestore';

export interface PreservedClaimRequest {
    messageId: string;
    senderId: string;
    senderName: string;
    senderProfilePicture?: string | null;
    status: "pending" | "accepted" | "rejected" | "pending_confirmation";
    claimReason?: string | null;
    requestedAt: any;
    respondedAt?: any;
    responseMessage?: string | null;
    isAccepted: boolean;
    // Additional fields that might be useful for display
    senderEmail?: string | null;
    senderContact?: string | null;
    senderStudentId?: string | null;
    // New field to track if the claim was made after the post was resolved/completed
    wasLateRequest?: boolean;
}

export const claimPreservationService = {
    /**
     * Add a new claim request to the post's allClaimRequests array
     */
    async addClaimRequest(
        postId: string,
        messageId: string,
        senderId: string,
        senderName: string,
        senderProfilePicture: string | null,
        claimReason: string,
        requestedAt: any
    ): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);

            // Get post data to check if it's already resolved/completed
            const postDoc = await getDoc(postRef);
            let wasLateRequest = false;

            if (postDoc.exists()) {
                const postData = postDoc.data();
                // Check if post is already resolved or completed
                if (postData.status === 'resolved' || postData.status === 'completed') {
                    wasLateRequest = true;
                }
            }

            // Get user details for more complete preservation
            let senderDetails: any = {};
            try {
                const userDoc = await getDoc(doc(db, 'users', senderId));
                if (userDoc.exists()) {
                    senderDetails = userDoc.data();
                }
            } catch (e) {
                console.warn('Could not fetch user details for claim preservation:', e);
            }

            // Get the best available profile picture (user document takes priority)
            const profilePicture = senderDetails.profilePicture
                || senderDetails.profileImageUrl
                || senderDetails.photoURL
                || senderProfilePicture
                || null;

            // 🛡️ IMPORTANT: Firebase arrayUnion() doesn't accept undefined values
            const claimRequest: PreservedClaimRequest = {
                messageId,
                senderId: senderId || '',
                senderName: senderName || (senderDetails.firstName ? `${senderDetails.firstName || ''} ${senderDetails.lastName || ''}`.trim() : 'Unknown'),
                senderProfilePicture: profilePicture,
                status: 'pending',
                claimReason: claimReason || '',
                requestedAt: requestedAt || null,
                isAccepted: false,
                senderEmail: senderDetails.email || null,
                senderContact: senderDetails.contactNum || null,
                senderStudentId: senderDetails.studentId || null,
                wasLateRequest
            };

            await updateDoc(postRef, {
                allClaimRequests: arrayUnion(claimRequest)
            });
        } catch (error: any) {
            // Don't throw, as this is a secondary operation
        }
    },

    /**
     * Update the status of a claim request in the post's allClaimRequests array
     */
    async updateClaimRequestStatus(
        postId: string,
        messageId: string,
        status: "pending" | "accepted" | "rejected" | "pending_confirmation",
        data: {
            respondedAt?: any;
            responseMessage?: string;
            responderId?: string;
        } = {}
    ): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);

            await runTransaction(db, async (transaction) => {
                const postDoc = await transaction.get(postRef);

                if (!postDoc.exists()) return;

                const postData = postDoc.data();
                const allClaimRequests: PreservedClaimRequest[] = postData.allClaimRequests || [];

                const requestIndex = allClaimRequests.findIndex(req => req.messageId === messageId);

                if (requestIndex === -1) {
                    // If not found (maybe created before this feature), we can't update it in the array
                    console.warn(`Claim request ${messageId} not found in post ${postId} for preservation update`);
                    return;
                }

                // Update the specific fields
                const updatedRequest = { ...allClaimRequests[requestIndex] };
                updatedRequest.status = status;

                if (status === 'accepted') {
                    updatedRequest.isAccepted = true;
                }

                if (data.respondedAt) {
                    updatedRequest.respondedAt = data.respondedAt;
                }
                // Use serverTimestamp if not provided and status changed
                else if (status !== allClaimRequests[requestIndex].status) {
                    updatedRequest.respondedAt = serverTimestamp();
                }

                if (data.responseMessage) {
                    updatedRequest.responseMessage = data.responseMessage;
                }

                if (data.responderId) {
                    // We can store responderId if we add it to the interface, 
                    // currently PreservedClaimRequest doesn't have it explicitly but we can add it if needed.
                    // But for now let's stick to the interface.
                }

                // Create a new array with the updated item
                const newClaimRequests = [...allClaimRequests];
                newClaimRequests[requestIndex] = updatedRequest;

                transaction.update(postRef, {
                    allClaimRequests: newClaimRequests
                });
            });
        } catch (error: any) {
            // Silent failure
        }
    },

    /**
     * Ensure all claim requests in a conversation are preserved before deletion
     */
    async preserveClaimsBeforeDeletion(conversationId: string, postId: string): Promise<void> {
        try {
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
            const messagesSnap = await getDocs(messagesQuery);

            const claimMessages = messagesSnap.docs.filter(doc => {
                const data = doc.data();
                return data.messageType === 'claim_request' && data.claimData;
            });

            if (claimMessages.length === 0) return;

            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) return;

            const postData = postDoc.data();
            const existingRequests: PreservedClaimRequest[] = postData.allClaimRequests || [];
            const existingMessageIds = new Set(existingRequests.map(req => req.messageId));
            const newRequests: PreservedClaimRequest[] = [];

            for (const messageDoc of claimMessages) {
                if (existingMessageIds.has(messageDoc.id)) continue;

                const data = messageDoc.data();
                const claimData = data.claimData;

                // Get user details (including the most up-to-date profile picture)
                let senderDetails: any = {};
                try {
                    const userDoc = await getDoc(doc(db, 'users', data.senderId));
                    if (userDoc.exists()) {
                        senderDetails = userDoc.data();
                    }
                } catch (e) {
                    // Ignore error
                }

                // Get the best available profile picture (user document takes priority)
                const profilePicture = senderDetails.profilePicture
                    || senderDetails.profileImageUrl
                    || senderDetails.photoURL
                    || data.senderProfilePicture
                    || null;

                // 🛡️ IMPORTANT: Firebase arrayUnion() doesn't accept undefined values
                // We must ensure all fields have valid values (null, empty string, or actual value)
                newRequests.push({
                    messageId: messageDoc.id,
                    senderId: data.senderId || '',
                    senderName: data.senderName || senderDetails.firstName ? `${senderDetails.firstName || ''} ${senderDetails.lastName || ''}`.trim() : 'Unknown',
                    senderProfilePicture: profilePicture,
                    status: claimData.status || 'pending',
                    claimReason: claimData.claimReason || '',
                    requestedAt: claimData.requestedAt || data.timestamp || null,
                    respondedAt: claimData.respondedAt || null,
                    responseMessage: claimData.responseMessage || null,
                    isAccepted: claimData.status === 'accepted' || claimData.status === 'confirmed',
                    senderEmail: senderDetails.email || null,
                    senderContact: senderDetails.contactNum || null,
                    senderStudentId: senderDetails.studentId || null
                });
            }

            if (newRequests.length > 0) {
                await updateDoc(postRef, {
                    allClaimRequests: arrayUnion(...newRequests)
                });
            }

        } catch (error: any) {
            // Silent failure - don't block deletion
        }
    },

    /**
     * Scan ALL active conversations for a post and ensure all claim requests are preserved
     * This handles cases where claims might have been made before this service existed or if preservation failed
     */
    async syncPostClaims(postId: string): Promise<void> {
        try {
            console.log(`🔄 Syncing all claim requests for post ${postId}...`);
            const postRef = doc(db, 'posts', postId);

            // 1. Get current preserved requests
            const postDoc = await getDoc(postRef);
            if (!postDoc.exists()) {
                console.warn(`Post ${postId} not found during sync`);
                return;
            }

            const postData = postDoc.data();
            const existingRequests: PreservedClaimRequest[] = postData.allClaimRequests || [];
            const existingMessageIds = new Set(existingRequests.map(req => req.messageId));

            // Get post resolution timestamp for late request detection
            const resolvedAt = postData.resolvedAt;
            const isPostResolved = postData.status === 'resolved' || postData.status === 'completed';

            // 2. Query ALL conversations for this post
            const conversationsQuery = query(
                collection(db, 'conversations'),
                where('postId', '==', postId)
            );

            const conversationsSnap = await getDocs(conversationsQuery);

            const newRequests: PreservedClaimRequest[] = [];

            // 3. Process each conversation
            for (const convDoc of conversationsSnap.docs) {
                const convId = convDoc.id;

                // Get claim messages from this conversation
                const messagesRef = collection(db, 'conversations', convId, 'messages');
                const messagesQuery = query(messagesRef, where('messageType', '==', 'claim_request'));
                const messagesSnap = await getDocs(messagesQuery);

                for (const messageDoc of messagesSnap.docs) {
                    // Skip if already preserved
                    if (existingMessageIds.has(messageDoc.id)) continue;

                    const data = messageDoc.data();
                    const claimData = data.claimData;

                    if (!claimData) continue;

                    // Get user details
                    let senderDetails: any = {};
                    try {
                        const userDoc = await getDoc(doc(db, 'users', data.senderId));
                        if (userDoc.exists()) {
                            senderDetails = userDoc.data();
                        }
                    } catch (e) {
                        // Ignore error
                    }

                    // Determine if this was a late request
                    let wasLateRequest = false;
                    if (isPostResolved && resolvedAt) {
                        const requestedAt = claimData.requestedAt || data.timestamp;
                        if (requestedAt) {
                            // Convert timestamps to comparable format
                            const resolvedTime = resolvedAt.toDate ? resolvedAt.toDate().getTime() : new Date(resolvedAt).getTime();
                            const requestedTime = requestedAt.toDate ? requestedAt.toDate().getTime() : new Date(requestedAt).getTime();

                            if (requestedTime > resolvedTime) {
                                wasLateRequest = true;
                            }
                        }
                    }

                    newRequests.push({
                        messageId: messageDoc.id,
                        senderId: data.senderId,
                        senderName: data.senderName,
                        senderProfilePicture: data.senderProfilePicture,
                        status: claimData.status || 'pending',
                        claimReason: claimData.claimReason,
                        requestedAt: claimData.requestedAt || data.timestamp,
                        respondedAt: claimData.respondedAt,
                        responseMessage: claimData.responseMessage,
                        isAccepted: claimData.status === 'accepted' || claimData.status === 'confirmed',
                        senderEmail: senderDetails.email,
                        senderContact: senderDetails.contactNum,
                        senderStudentId: senderDetails.studentId,
                        wasLateRequest
                    });
                }
            }

            // 4. Update the post if new requests found
            if (newRequests.length > 0) {
                await updateDoc(postRef, {
                    allClaimRequests: arrayUnion(...newRequests)
                });
            }

        } catch (error: any) {
            // Silent failure
        }
    }
};
