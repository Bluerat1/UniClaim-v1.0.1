import { db } from './authService';
import {
    collection,
    doc,
    writeBatch,
    query,
    getDocs
} from 'firebase/firestore';
import type { GhostConversation, OrphanedMessage, CleanupResult } from './ghostConversationTypes';
import { CleanupError } from './ghostConversationTypes';

/**
 * Service for cleaning up ghost conversations and orphaned messages
 */
export const conversationCleanupService = {
    /**
     * Clean up ghost conversations
     */
    async cleanupGhostConversations(ghostConversations: GhostConversation[]): Promise<CleanupResult> {
        try {
            if (ghostConversations.length === 0) {
                return { success: 0, failed: 0, errors: [] };
            }

            const batch = writeBatch(db);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            // Add all ghost conversations to deletion batch
            ghostConversations.forEach(ghost => {
                try {
                    const convRef = doc(db, 'conversations', ghost.conversationId);
                    batch.delete(convRef);
                    success++;
                } catch (error: any) {
                    failed++;
                    errors.push(`Failed to add ${ghost.conversationId} to cleanup batch: ${error.message}`);
                }
            });

            if (success > 0) {
                // Execute the batch deletion
                await batch.commit();
                console.log(`Successfully cleaned up ${success} ghost conversations`);
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Ghost conversation cleanup failed:', error);
            throw new CleanupError(`Failed to cleanup ghost conversations: ${error.message}`);
        }
    },

    /**
     * Clean up orphaned messages
     */
    async cleanupOrphanedMessages(orphanedMessages: OrphanedMessage[]): Promise<CleanupResult> {
        try {
            if (orphanedMessages.length === 0) {
                return { success: 0, failed: 0, errors: [] };
            }

            const batch = writeBatch(db);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            // Group messages by conversation for efficient deletion
            const messagesByConversation = orphanedMessages.reduce((acc, message) => {
                if (!acc[message.conversationId]) {
                    acc[message.conversationId] = [];
                }
                acc[message.conversationId].push(message);
                return acc;
            }, {} as { [conversationId: string]: OrphanedMessage[] });

            // Delete messages for each conversation
            Object.entries(messagesByConversation).forEach(([conversationId, messages]) => {
                try {
                    messages.forEach(message => {
                        const messageRef = doc(db, 'conversations', conversationId, 'messages', message.messageId);
                        batch.delete(messageRef);
                    });

                    if (messages.length > 0) {
                        console.log(`Queued ${messages.length} orphaned messages for deletion in conversation ${conversationId}`);
                    }
                } catch (error: any) {
                    failed += messages.length;
                    errors.push(`Failed to process conversation ${conversationId}: ${error.message}`);
                }
            });

            if (success > 0 || Object.keys(messagesByConversation).length > 0) {
                // Execute the batch deletion
                await batch.commit();
                success = orphanedMessages.length;
                console.log(`Successfully cleaned up ${success} orphaned messages`);
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Orphaned message cleanup failed:', error);
            throw new CleanupError(`Failed to cleanup orphaned messages: ${error.message}`);
        }
    },

    /**
     * Clean up a specific conversation and all its messages
     */
    async cleanupConversation(conversationId: string): Promise<CleanupResult> {
        try {
            const batch = writeBatch(db);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            try {
                // Delete the conversation document
                const convRef = doc(db, 'conversations', conversationId);
                batch.delete(convRef);
                success++;

                // Delete all messages in the conversation
                const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                const messagesSnapshot = await getDocs(messagesQuery);

                messagesSnapshot.docs.forEach(messageDoc => {
                    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageDoc.id);
                    batch.delete(messageRef);
                    success++;
                });

                // Execute the batch deletion
                await batch.commit();
                console.log(`Successfully cleaned up conversation ${conversationId} and ${messagesSnapshot.docs.length} messages`);

            } catch (error: any) {
                failed++;
                errors.push(`Failed to cleanup conversation ${conversationId}: ${error.message}`);
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Conversation cleanup failed:', error);
            throw new CleanupError(`Failed to cleanup conversation: ${error.message}`);
        }
    },

    /**
     * Batch cleanup multiple conversations and their messages
     */
    async batchCleanupConversations(conversationIds: string[]): Promise<CleanupResult> {
        try {
            if (conversationIds.length === 0) {
                return { success: 0, failed: 0, errors: [] };
            }

            const batch = writeBatch(db);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            // Process conversations in smaller batches to avoid Firestore limits
            const BATCH_SIZE = 500; // Firestore batch limit
            for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
                const batchConversationIds = conversationIds.slice(i, i + BATCH_SIZE);

                for (const conversationId of batchConversationIds) {
                    try {
                        // Delete the conversation document
                        const convRef = doc(db, 'conversations', conversationId);
                        batch.delete(convRef);
                        success++;

                        // Delete all messages in the conversation
                        try {
                            const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                            const messagesSnapshot = await getDocs(messagesQuery);

                            messagesSnapshot.docs.forEach(messageDoc => {
                                const messageRef = doc(db, 'conversations', conversationId, 'messages', messageDoc.id);
                                batch.delete(messageRef);
                                success++;
                            });
                        } catch (messageError: any) {
                            // If we can't access messages, just skip them
                            console.warn(`Cannot access messages for conversation ${conversationId}: ${messageError.message}`);
                        }

                    } catch (error: any) {
                        failed++;
                        errors.push(`Failed to cleanup conversation ${conversationId}: ${error.message}`);
                    }
                }

                // Execute this batch
                if (success > 0) {
                    await batch.commit();
                    console.log(`Cleaned up batch of ${batchConversationIds.length} conversations`);
                }
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Batch conversation cleanup failed:', error);
            throw new CleanupError(`Failed to batch cleanup conversations: ${error.message}`);
        }
    }
};
