// Conversations service for Firebase - handles ghost conversation detection, cleanup, and maintenance
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    writeBatch
} from 'firebase/firestore';

// Import Firebase instances
import { db } from './config';

// Ghost conversation detection and cleanup utilities
export const ghostConversationService = {
    // Detect ghost conversations (conversations without corresponding posts)
    async detectGhostConversations(): Promise<{ conversationId: string; postId: string; reason: string }[]> {
        try {
            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            const ghostConversations: { conversationId: string; postId: string; reason: string }[] = [];

            // Check each conversation
            for (const convDoc of conversationsSnapshot.docs) {
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    ghostConversations.push({
                        conversationId: convDoc.id,
                        postId: 'unknown',
                        reason: 'Missing postId field'
                    });
                    continue;
                }

                try {
                    // Check if the post still exists
                    const postDoc = await getDoc(doc(db, 'posts', postId));

                    if (!postDoc.exists()) {
                        ghostConversations.push({
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: 'Post no longer exists'
                        });
                    }
                } catch (error: any) {
                    if (error.code === 'permission-denied') {
                        ghostConversations.push({
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: 'Cannot access post (permission denied)'
                        });
                    } else {
                        ghostConversations.push({
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: `Error checking post: ${error.message}`
                        });
                    }
                }
            }

            return ghostConversations;

        } catch (error: any) {
            console.error('Ghost conversation detection failed:', error);
            throw new Error(`Failed to detect ghost conversations: ${error.message}`);
        }
    },

    async detectOrphanedMessages(): Promise<{ conversationId: string; messageId: string; reason: string }[]> {
        try {
            const orphanedMessages: { conversationId: string; messageId: string; reason: string }[] = [];

            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));

            for (const convDoc of conversationsSnapshot.docs) {
                const conversationId = convDoc.id;

                try {
                    // Check if conversation still exists
                    const convCheck = await getDoc(convDoc.ref);
                    if (!convCheck.exists()) {
                        // Conversation was deleted, check for orphaned messages
                        const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                        const messagesSnapshot = await getDocs(messagesQuery);

                        if (messagesSnapshot.docs.length > 0) {
                            messagesSnapshot.docs.forEach(messageDoc => {
                                orphanedMessages.push({
                                    conversationId: conversationId,
                                    messageId: messageDoc.id,
                                    reason: 'Parent conversation was deleted'
                                });
                            });
                        }
                    }
                } catch (error: any) {
                    // If we can't access the conversation, it might be deleted
                    try {
                        const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                        const messagesSnapshot = await getDocs(messagesQuery);

                        if (messagesSnapshot.docs.length > 0) {
                            messagesSnapshot.docs.forEach(messageDoc => {
                                orphanedMessages.push({
                                    conversationId: conversationId,
                                    messageId: messageDoc.id,
                                    reason: 'Cannot access parent conversation'
                                });
                            });
                        }
                    } catch (messageError: any) {
                        // Silent fail for message access errors
                    }
                }
            }

            return orphanedMessages;

        } catch (error: any) {
            console.error('Orphaned message detection failed:', error);
            throw new Error(`Failed to detect orphaned messages: ${error.message}`);
        }
    },

    // Clean up ghost conversations
    async cleanupGhostConversations(ghostConversations: { conversationId: string; postId: string; reason: string }[]): Promise<{ success: number; failed: number; errors: string[] }> {
        try {
            const batch = writeBatch(db);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            // Add all ghost conversations to deletion batch
            ghostConversations.forEach(ghost => {
                try {
                    const convRef = doc(db, 'conversations', ghost.conversationId);
                    batch.delete(convRef);
                } catch (error: any) {
                    failed++;
                    errors.push(`Failed to add ${ghost.conversationId}: ${error.message}`);
                }
            });

            if (ghostConversations.length > 0) {
                // Execute the batch deletion
                await batch.commit();
                success = ghostConversations.length;
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Ghost conversation cleanup failed:', error);
            throw new Error(`Failed to cleanup ghost conversations: ${error.message}`);
        }
    },

    // Clean up orphaned messages
    async cleanupOrphanedMessages(orphanedMessages: { conversationId: string; messageId: string; reason: string }[]): Promise<{ success: number; failed: number; errors: string[] }> {
        try {
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
            }, {} as { [conversationId: string]: typeof orphanedMessages });

            // Delete messages for each conversation
            for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
                try {
                    messages.forEach(message => {
                        const messageRef = doc(db, 'conversations', conversationId, 'messages', message.messageId);
                        batch.delete(messageRef);
                    });
                } catch (error: any) {
                    failed += messages.length;
                    errors.push(`Failed to process conversation ${conversationId}: ${error.message}`);
                }
            }

            if (orphanedMessages.length > 0) {
                // Execute the batch deletion
                await batch.commit();
                success = orphanedMessages.length;
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Orphaned message cleanup failed:', error);
            throw new Error(`Failed to cleanup orphaned messages: ${error.message}`);
        }
    },

    // Validate conversation integrity (for admin use)
    async validateConversationIntegrity(): Promise<{
        totalConversations: number;
        validConversations: number;
        ghostConversations: number;
        orphanedMessages: number;
        details: string[];
    }> {
        try {
            const result: {
                totalConversations: number;
                validConversations: number;
                ghostConversations: number;
                orphanedMessages: number;
                details: string[];
            } = {
                totalConversations: 0,
                validConversations: 0,
                ghostConversations: 0,
                orphanedMessages: 0,
                details: []
            };

            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            result.totalConversations = conversationsSnapshot.docs.length;

            for (const convDoc of conversationsSnapshot.docs) {
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    result.ghostConversations++;
                    result.details.push(`Conversation ${convDoc.id}: Missing postId`);
                    continue;
                }

                try {
                    // Check if post exists
                    const postDoc = await getDoc(doc(db, 'posts', postId));

                    if (!postDoc.exists()) {
                        result.ghostConversations++;
                        result.details.push(`Conversation ${convDoc.id}: Post ${postId} not found`);
                        continue;
                    }

                    // Check for orphaned messages
                    try {
                        const messagesSnapshot = await getDocs(collection(db, 'conversations', convDoc.id, 'messages'));
                        if (messagesSnapshot.docs.length === 0) {
                            result.details.push(`Conversation ${convDoc.id}: No messages found`);
                        }
                    } catch (error: any) {
                        result.orphanedMessages++;
                        result.details.push(`Conversation ${convDoc.id}: Cannot access messages - ${error.message}`);
                    }

                    result.validConversations++;

                } catch (error: any) {
                    result.ghostConversations++;
                    result.details.push(`Conversation ${convDoc.id}: Error checking post - ${error.message}`);
                }
            }

            return result;

        } catch (error: any) {
            console.error('Conversation integrity validation failed:', error);
            throw new Error(`Failed to validate conversation integrity: ${error.message}`);
        }
    },

    // Find all conversations for a specific post
    async findConversationsByPostId(postId: string): Promise<{ conversationId: string; postId: string }[]> {
        try {
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            const matchingConversations: { conversationId: string; postId: string }[] = [];

            // Check each conversation for matching postId
            for (const convDoc of conversationsSnapshot.docs) {
                const convData = convDoc.data();

                if (convData.postId === postId) {
                    matchingConversations.push({
                        conversationId: convDoc.id,
                        postId: postId
                    });
                }
            }

            return matchingConversations;

        } catch (error: any) {
            console.error(`Failed to find conversations for post ${postId}:`, error);
            throw new Error(`Failed to find conversations for post: ${error.message}`);
        }
    }
};

// Background cleanup service for periodic ghost conversation maintenance
export const backgroundCleanupService = {
    // Run periodic cleanup (can be called by admin or scheduled tasks)
    async runPeriodicCleanup(): Promise<{
        timestamp: string;
        ghostsDetected: number;
        ghostsCleaned: number;
        errors: string[];
        duration: number;
    }> {
        const startTime = Date.now();
        const errors: string[] = [];

        try {
            // Detect ghost conversations
            const ghostConversations = await ghostConversationService.detectGhostConversations();

            if (ghostConversations.length === 0) {
                return {
                    timestamp: new Date().toISOString(),
                    ghostsDetected: 0,
                    ghostsCleaned: 0,
                    errors: [],
                    duration: Date.now() - startTime
                };
            }

            // Clean up detected ghosts
            const cleanupResult = await ghostConversationService.cleanupGhostConversations(ghostConversations);

            // Collect any errors
            if (cleanupResult.errors.length > 0) {
                errors.push(...cleanupResult.errors);
            }

            const duration = Date.now() - startTime;

            return {
                timestamp: new Date().toISOString(),
                ghostsDetected: ghostConversations.length,
                ghostsCleaned: cleanupResult.success,
                errors: errors,
                duration: duration
            };

        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error('Periodic cleanup failed:', error);
            errors.push(`Periodic cleanup failed: ${error.message}`);

            return {
                timestamp: new Date().toISOString(),
                ghostsDetected: 0,
                ghostsCleaned: 0,
                errors: errors,
                duration: duration
            };
        }
    },

    // Quick health check (lightweight version of integrity validation)
    async quickHealthCheck(): Promise<{
        healthy: boolean;
        totalConversations: number;
        ghostCount: number;
        issues: string[];
    }> {
        try {
            // Get total conversation count
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            const totalConversations = conversationsSnapshot.docs.length;

            if (totalConversations === 0) {
                return {
                    healthy: true,
                    totalConversations: 0,
                    ghostCount: 0,
                    issues: []
                };
            }

            // Sample check: look at first few conversations for obvious issues
            const sampleSize = Math.min(5, totalConversations);
            const issues: string[] = [];
            let ghostCount = 0;

            for (let i = 0; i < sampleSize; i++) {
                const convDoc = conversationsSnapshot.docs[i];
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    ghostCount++;
                    issues.push(`Conversation ${convDoc.id}: Missing postId`);
                    continue;
                }

                try {
                    const postDoc = await getDoc(doc(db, 'posts', postId));
                    if (!postDoc.exists()) {
                        ghostCount++;
                        issues.push(`Conversation ${convDoc.id}: Post ${postId} not found`);
                    }
                } catch (error: any) {
                    ghostCount++;
                    issues.push(`Conversation ${convDoc.id}: Cannot access post ${postId}`);
                }
            }

            // Estimate total ghosts based on sample
            const estimatedGhosts = Math.ceil((ghostCount / sampleSize) * totalConversations);
            const healthy = estimatedGhosts === 0;

            return {
                healthy: healthy,
                totalConversations: totalConversations,
                ghostCount: estimatedGhosts,
                issues: issues
            };

        } catch (error: any) {
            console.error('Quick health check failed:', error);
            return {
                healthy: false,
                totalConversations: 0,
                ghostCount: 0,
                issues: [`Health check failed: ${error.message}`]
            };
        }
    }
};
