import { db } from './authService';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query
} from 'firebase/firestore';
import type {
    GhostConversation,
    OrphanedMessage,
    ConversationIntegrityResult
} from './ghostConversationTypes';
import { ValidationError } from './ghostConversationTypes';

/**
 * Service for validating conversation integrity and detecting orphaned data
 */
export const conversationValidationService = {
    /**
     * Detect ghost conversations (conversations without corresponding posts)
     */
    async detectGhostConversations(): Promise<GhostConversation[]> {
        try {
            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            const ghostConversations: GhostConversation[] = [];

            // Check each conversation in parallel for better performance
            const conversationChecks = conversationsSnapshot.docs.map(async (convDoc) => {
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    return {
                        conversationId: convDoc.id,
                        postId: 'unknown',
                        reason: 'Missing postId field'
                    } as GhostConversation;
                }

                try {
                    // Check if the post still exists
                    const postDoc = await getDoc(doc(db, 'posts', postId));

                    if (!postDoc.exists()) {
                        return {
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: 'Post no longer exists'
                        } as GhostConversation;
                    }

                    return null; // Valid conversation
                } catch (error: any) {
                    if (error.code === 'permission-denied') {
                        return {
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: 'Cannot access post (permission denied)'
                        } as GhostConversation;
                    } else {
                        return {
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: `Error checking post: ${error.message}`
                        } as GhostConversation;
                    }
                }
            });

            // Wait for all checks to complete
            const results = await Promise.all(conversationChecks);

            // Filter out null results (valid conversations) and collect ghost conversations
            results.forEach(result => {
                if (result) {
                    ghostConversations.push(result);
                }
            });

            return ghostConversations;

        } catch (error: any) {
            console.error('Ghost conversation detection failed:', error);
            throw new ValidationError(`Failed to detect ghost conversations: ${error.message}`);
        }
    },

    /**
     * Detect orphaned messages (messages without parent conversations)
     */
    async detectOrphanedMessages(): Promise<OrphanedMessage[]> {
        try {
            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));

            // Check each conversation for orphaned messages
            const messageChecks = conversationsSnapshot.docs.map(async (convDoc) => {
                const conversationId = convDoc.id;
                const messages: OrphanedMessage[] = [];

                try {
                    // Check if conversation still exists
                    const convCheck = await getDoc(convDoc.ref);
                    if (!convCheck.exists()) {
                        // Conversation was deleted, check for orphaned messages
                        try {
                            const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                            const messagesSnapshot = await getDocs(messagesQuery);

                            messagesSnapshot.docs.forEach(messageDoc => {
                                messages.push({
                                    conversationId: conversationId,
                                    messageId: messageDoc.id,
                                    reason: 'Parent conversation was deleted'
                                });
                            });
                        } catch (error: any) {
                            // If we can't access messages, skip silently
                            console.warn(`Cannot access messages for deleted conversation ${conversationId}`);
                        }
                    }
                } catch (error: any) {
                    // If we can't access the conversation, it might be deleted
                    try {
                        const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                        const messagesSnapshot = await getDocs(messagesQuery);

                        if (messagesSnapshot.docs.length > 0) {
                            messagesSnapshot.docs.forEach(messageDoc => {
                                messages.push({
                                    conversationId: conversationId,
                                    messageId: messageDoc.id,
                                    reason: 'Cannot access parent conversation'
                                });
                            });
                        }
                    } catch (messageError: any) {
                        // Silent fail for message access errors
                        console.warn(`Cannot access messages for conversation ${conversationId}: ${messageError.message}`);
                    }
                }

                return messages;
            });

            // Wait for all checks to complete and flatten results
            const results = await Promise.all(messageChecks);
            return results.flat();

        } catch (error: any) {
            console.error('Orphaned message detection failed:', error);
            throw new ValidationError(`Failed to detect orphaned messages: ${error.message}`);
        }
    },

    /**
     * Validate conversation integrity (for admin use)
     */
    async validateConversationIntegrity(): Promise<ConversationIntegrityResult> {
        try {
            const result: ConversationIntegrityResult = {
                totalConversations: 0,
                validConversations: 0,
                ghostConversations: 0,
                orphanedMessages: 0,
                details: []
            };

            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            result.totalConversations = conversationsSnapshot.docs.length;

            // Check each conversation in parallel for better performance
            const validationChecks = conversationsSnapshot.docs.map(async (convDoc) => {
                const convData = convDoc.data();
                const postId = convData.postId;
                const details: string[] = [];

                if (!postId) {
                    return {
                        isGhost: true,
                        hasOrphanedMessages: false,
                        details: [`Conversation ${convDoc.id}: Missing postId`]
                    };
                }

                try {
                    // Check if post exists
                    const postDoc = await getDoc(doc(db, 'posts', postId));

                    if (!postDoc.exists()) {
                        return {
                            isGhost: true,
                            hasOrphanedMessages: false,
                            details: [`Conversation ${convDoc.id}: Post ${postId} not found`]
                        };
                    }

                    // Check for orphaned messages
                    try {
                        const messagesSnapshot = await getDocs(collection(db, 'conversations', convDoc.id, 'messages'));
                        if (messagesSnapshot.docs.length === 0) {
                            details.push(`Conversation ${convDoc.id}: No messages found`);
                        }
                    } catch (error: any) {
                        return {
                            isGhost: false,
                            hasOrphanedMessages: true,
                            details: [`Conversation ${convDoc.id}: Cannot access messages - ${error.message}`]
                        };
                    }

                    return {
                        isGhost: false,
                        hasOrphanedMessages: false,
                        details: details.length > 0 ? details : [`Conversation ${convDoc.id}: Valid`]
                    };

                } catch (error: any) {
                    return {
                        isGhost: true,
                        hasOrphanedMessages: false,
                        details: [`Conversation ${convDoc.id}: Error checking post - ${error.message}`]
                    };
                }
            });

            // Wait for all validations to complete
            const results = await Promise.all(validationChecks);

            // Aggregate results
            results.forEach(validation => {
                if (validation.isGhost) {
                    result.ghostConversations++;
                } else {
                    result.validConversations++;
                }

                if (validation.hasOrphanedMessages) {
                    result.orphanedMessages++;
                }

                result.details.push(...validation.details);
            });

            return result;

        } catch (error: any) {
            console.error('Conversation integrity validation failed:', error);
            throw new ValidationError(`Failed to validate conversation integrity: ${error.message}`);
        }
    }
};
