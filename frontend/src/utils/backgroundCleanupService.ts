import { conversationValidationService } from './conversationValidationService';
import { conversationCleanupService } from './conversationCleanupService';
import type { PeriodicCleanupResult, HealthCheckResult } from './ghostConversationTypes';
import { GhostConversationError } from './ghostConversationTypes';

/**
 * Background cleanup service for periodic ghost conversation maintenance
 */
export const backgroundCleanupService = {
    /**
     * Run periodic cleanup (can be called by admin or scheduled tasks)
     */
    async runPeriodicCleanup(): Promise<PeriodicCleanupResult> {
        const startTime = Date.now();
        const errors: string[] = [];

        try {
            console.log('Starting periodic ghost conversation cleanup...');

            // Detect ghost conversations and orphaned messages in parallel
            const [ghostConversations, orphanedMessages] = await Promise.all([
                conversationValidationService.detectGhostConversations(),
                conversationValidationService.detectOrphanedMessages()
            ]);

            const totalIssues = ghostConversations.length + orphanedMessages.length;

            if (totalIssues === 0) {
                const duration = Date.now() - startTime;
                console.log(`Periodic cleanup completed in ${duration}ms - No issues found`);

                return {
                    timestamp: new Date().toISOString(),
                    ghostsDetected: 0,
                    ghostsCleaned: 0,
                    errors: [],
                    duration: duration
                };
            }

            console.log(`Found ${ghostConversations.length} ghost conversations and ${orphanedMessages.length} orphaned messages`);

            // Clean up detected issues in parallel
            const [ghostCleanupResult, messageCleanupResult] = await Promise.all([
                conversationCleanupService.cleanupGhostConversations(ghostConversations),
                conversationCleanupService.cleanupOrphanedMessages(orphanedMessages)
            ]);

            // Collect any errors
            if (ghostCleanupResult.errors.length > 0) {
                errors.push(...ghostCleanupResult.errors.map(error => `Ghost cleanup: ${error}`));
            }
            if (messageCleanupResult.errors.length > 0) {
                errors.push(...messageCleanupResult.errors.map(error => `Message cleanup: ${error}`));
            }

            const totalCleaned = ghostCleanupResult.success + messageCleanupResult.success;
            const duration = Date.now() - startTime;

            console.log(`Periodic cleanup completed in ${duration}ms - Cleaned up ${totalCleaned}/${totalIssues} issues`);

            return {
                timestamp: new Date().toISOString(),
                ghostsDetected: totalIssues,
                ghostsCleaned: totalCleaned,
                errors: errors,
                duration: duration
            };

        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error('Periodic cleanup failed:', error);

            const errorMessage = error instanceof GhostConversationError
                ? error.message
                : `Periodic cleanup failed: ${error.message}`;

            errors.push(errorMessage);

            return {
                timestamp: new Date().toISOString(),
                ghostsDetected: 0,
                ghostsCleaned: 0,
                errors: errors,
                duration: duration
            };
        }
    },

    /**
     * Quick health check (lightweight version of integrity validation)
     */
    async quickHealthCheck(): Promise<HealthCheckResult> {
        try {
            console.log('Running quick health check for conversations...');

            // Get total conversation count
            const { db } = await import('./authService');
            const { collection, getDocs } = await import('firebase/firestore');

            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            const totalConversations = conversationsSnapshot.docs.length;

            if (totalConversations === 0) {
                console.log('Health check completed - No conversations found');
                return {
                    healthy: true,
                    totalConversations: 0,
                    ghostCount: 0,
                    issues: []
                };
            }

            // Sample check: look at first few conversations for obvious issues
            const sampleSize = Math.min(10, totalConversations); // Increased sample size for better accuracy
            const issues: string[] = [];
            let ghostCount = 0;

            const sampleConversations = conversationsSnapshot.docs.slice(0, sampleSize);

            // Check sample conversations in parallel
            const sampleChecks = sampleConversations.map(async (convDoc) => {
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    return {
                        conversationId: convDoc.id,
                        isGhost: true,
                        issue: `Missing postId`
                    };
                }

                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const postDoc = await getDoc(doc(db, 'posts', postId));
                    if (!postDoc.exists()) {
                        return {
                            conversationId: convDoc.id,
                            isGhost: true,
                            issue: `Post ${postId} not found`
                        };
                    }
                    return null;
                } catch (error: any) {
                    return {
                        conversationId: convDoc.id,
                        isGhost: true,
                        issue: `Cannot access post ${postId}: ${error.message}`
                    };
                }
            });

            const sampleResults = await Promise.all(sampleChecks);

            // Process results
            sampleResults.forEach(result => {
                if (result?.isGhost) {
                    ghostCount++;
                    issues.push(`Conversation ${result.conversationId}: ${result.issue}`);
                }
            });

            // Estimate total ghosts based on sample
            const estimatedGhosts = Math.ceil((ghostCount / sampleSize) * totalConversations);
            const healthy = estimatedGhosts === 0;

            console.log(`Health check completed - Found approximately ${estimatedGhosts} ghost conversations out of ${totalConversations} total`);

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
    },

    /**
     * Comprehensive health check (more thorough but slower)
     */
    async comprehensiveHealthCheck(): Promise<HealthCheckResult & { orphanedMessages: number }> {
        try {
            console.log('Running comprehensive health check for conversations...');

            const [ghostConversations, orphanedMessages] = await Promise.all([
                conversationValidationService.detectGhostConversations(),
                conversationValidationService.detectOrphanedMessages()
            ]);

            const totalIssues = ghostConversations.length + orphanedMessages.length;

            const healthy = totalIssues === 0;
            const issues = [
                ...ghostConversations.map(ghost => `Ghost conversation: ${ghost.conversationId} (${ghost.reason})`),
                ...orphanedMessages.map(msg => `Orphaned message: ${msg.messageId} in ${msg.conversationId} (${msg.reason})`)
            ];

            console.log(`Comprehensive health check completed - Found ${totalIssues} total issues`);

            return {
                healthy,
                totalConversations: 0, // Would need additional query to get this
                ghostCount: ghostConversations.length,
                issues,
                orphanedMessages: orphanedMessages.length
            };

        } catch (error: any) {
            console.error('Comprehensive health check failed:', error);
            return {
                healthy: false,
                totalConversations: 0,
                ghostCount: 0,
                issues: [`Comprehensive health check failed: ${error.message}`],
                orphanedMessages: 0
            };
        }
    }
};
