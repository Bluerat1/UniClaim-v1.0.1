import { postService } from './firebase';
import type { Post } from '../types/Post';

// 🚀 AUTOMATIC POST EXPIRATION SERVICE
// This service runs in the background to automatically manage expired posts
// Ensures the homepage stays clean and organized without manual intervention

class ExpirationService {
    private checkInterval: NodeJS.Timeout | null = null;
    private isRunning = false;
    private lastCheckTime: Date | null = null;
    private lastProcessedPosts: Set<string> = new Set(); // Cache to avoid reprocessing the same posts
    private cacheTimeout: NodeJS.Timeout | null = null;

    // Start the automatic expiration checking service
    start() {
        if (this.isRunning) {
            console.log('ExpirationService: Already running');
            return;
        }

        // console.log('ExpirationService: Starting automatic post expiration management');
        this.isRunning = true;

        // Check immediately when starting
        this.checkExpiredPosts();

        // Set up periodic checking every 30 minutes (1800000 ms)
        // This ensures posts are moved to unclaimed status within 30 minutes of expiring
        this.checkInterval = setInterval(() => {
            this.checkExpiredPosts();
        }, 30 * 60 * 1000); // 30 minutes

        // Also check every 5 minutes for posts that are very close to expiring
        // This provides more responsive expiration management
        setInterval(() => {
            this.checkExpiredPosts();
        }, 5 * 60 * 1000); // 5 minutes
    }

    // Stop the automatic expiration checking service
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.cacheTimeout) {
            clearTimeout(this.cacheTimeout);
            this.cacheTimeout = null;
        }
        this.isRunning = false;
        this.lastProcessedPosts.clear();
        console.log('ExpirationService: Stopped automatic post expiration management');
    }

    // Check for expired posts and move them to unclaimed status
    private async checkExpiredPosts() {
        try {
            const now = new Date();
            this.lastCheckTime = now;

            // console.log(`ExpirationService: Checking for expired posts at ${now.toISOString()}`);

            // Get all posts to check for expiration
            // Note: We use a callback approach to avoid blocking the main thread
            postService.getAllPosts((posts) => {
                this.processExpiredPosts(posts, now);
            });

        } catch (error) {
            console.error('ExpirationService: Error checking expired posts:', error);
        }
    }

    // Process posts and move expired ones to unclaimed status
    private async processExpiredPosts(posts: Post[], now: Date) {
        try {
            const expiredPosts = posts.filter(post => {
                // Skip posts already moved to unclaimed
                if (post.movedToUnclaimed) {
                    return false;
                }

                // Check if post has expired
                if (post.expiryDate) {
                    let expiryDate: Date;

                    // Handle Firebase Timestamp
                    if (post.expiryDate && typeof post.expiryDate === 'object' && 'seconds' in post.expiryDate) {
                        expiryDate = new Date(post.expiryDate.seconds * 1000);
                    } else if (post.expiryDate instanceof Date) {
                        expiryDate = post.expiryDate;
                    } else {
                        expiryDate = new Date(post.expiryDate);
                    }

                    // Return true if post has expired
                    return expiryDate < now;
                }

                return false;
            });

            if (expiredPosts.length === 0) {
                console.log('ExpirationService: No expired posts found');
                return;
            }

            console.log(`ExpirationService: Found ${expiredPosts.length} expired posts to move to unclaimed`);

            // Move expired posts to unclaimed status
            let successCount = 0;
            let errorCount = 0;

            for (const post of expiredPosts) {
                // Skip if we've already processed this post recently
                if (this.lastProcessedPosts.has(post.id)) {
                    continue;
                }

                try {
                    await postService.movePostToUnclaimed(post.id);
                    successCount++;

                    // Add to cache to avoid reprocessing
                    this.lastProcessedPosts.add(post.id);

                    console.log(`ExpirationService: Successfully moved post ${post.id} to unclaimed status`);
                } catch (error) {
                    errorCount++;
                    console.error(`ExpirationService: Failed to move post ${post.id} to unclaimed:`, error);
                }
            }

            // Clear cache after 1 hour to allow reprocessing if needed
            if (this.cacheTimeout) {
                clearTimeout(this.cacheTimeout);
            }
            this.cacheTimeout = setTimeout(() => {
                this.lastProcessedPosts.clear();
                console.log('ExpirationService: Cache cleared, ready for next processing cycle');
            }, 60 * 60 * 1000); // 1 hour

            console.log(`ExpirationService: Completed processing expired posts. Success: ${successCount}, Errors: ${errorCount}`);

        } catch (error) {
            console.error('ExpirationService: Error processing expired posts:', error);
        }
    }

    // Get service status information
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastCheckTime: this.lastCheckTime,
            nextCheckTime: this.checkInterval ? new Date(Date.now() + 5 * 60 * 1000) : null
        };
    }

    // Manually trigger a check for expired posts (useful for testing)
    async manualCheck() {
        console.log('ExpirationService: Manual check triggered');
        await this.checkExpiredPosts();
    }
}

// Create and export a singleton instance
export const expirationService = new ExpirationService();

// Auto-start the service when this module is imported
// This ensures the service starts automatically when the app loads
expirationService.start();

// Cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        expirationService.stop();
    });
}
