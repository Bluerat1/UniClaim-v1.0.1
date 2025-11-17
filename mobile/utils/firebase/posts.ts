// Posts service for lost and found items - Enhanced with performance optimizations
import { db } from './config';
import { cloudinaryService, extractPublicIdFromUrl } from '../cloudinary';
import { writeBatch, doc, collection, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, where, getDocs, serverTimestamp, limit, startAfter } from 'firebase/firestore';

// Import notification sender (mobile service)
import { notificationSender } from './notificationSender';
import { adminNotificationService } from './adminNotifications';

// Connection state management for optimization
let isOnline = true;
let connectionListeners: (() => void)[] = [];

// Query result cache for frequently accessed data
const queryCache = new Map<string, { data: any, timestamp: number, expiry: number }>();
const CACHE_DURATION = 30 * 1000; // 30 seconds (reduced for more responsive real-time updates)
const MAX_CACHE_SIZE = 50; // Prevent memory leaks

// Cache management functions
const getCacheKey = (collectionName: string, queryConstraints: string[]) => {
    return `${collectionName}:${queryConstraints.join(':')}`;
};

const setCache = (key: string, data: any) => {
    // Clean cache if it gets too large
    if (queryCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = Array.from(queryCache.keys())[0];
        queryCache.delete(oldestKey);
    }

    queryCache.set(key, {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + CACHE_DURATION
    });
};

const getCache = (key: string) => {
    const cached = queryCache.get(key);
    if (cached && Date.now() < cached.expiry) {
        return cached.data;
    }
    if (cached) {
        queryCache.delete(key); // Remove expired cache
    }
    return null;
};

// Centralized cache invalidation function
const invalidatePostCaches = (postId?: string) => {
    // Clear all caches to ensure fresh data
    queryCache.clear();

    // Note: In a production app, we might want to implement a more sophisticated
    // cache invalidation strategy that only clears affected caches
    console.log(`🧹 Invalidated all post caches${postId ? ` after updating post ${postId}` : ''}`);
};

// Connection state management
export const setOnlineStatus = (online: boolean) => {
    isOnline = online;
    if (online) {
        // Clear expired cache when coming back online
        const now = Date.now();
        for (const [key, cached] of queryCache.entries()) {
            if (now >= cached.expiry) {
                queryCache.delete(key);
            }
        }
    }
};

// Export cache invalidation function for use by hooks and other modules
export { invalidatePostCaches };

// Post service with performance optimizations
export const postService = {
    // Get all posts (deprecated - use getActivePosts instead)
    getAllPosts(callback: (posts: any[]) => void) {
        // For backward compatibility, call getActivePosts
        return this.getActivePosts(callback);
    },

    // Get only active (non-expired) posts
    getActivePosts(callback: (posts: any[]) => void) {
        const now = new Date();
        const cacheKey = getCacheKey('posts', ['active', now.toISOString().split('T')[0]]);

        // Check cache first for immediate response
        const cachedData = getCache(cacheKey);
        let listenerActive = false;

        // Create query for active posts only (not moved to unclaimed)
        const q = query(
            collection(db, 'posts'),
            where('movedToUnclaimed', '==', false),
            where('status', 'not-in', ['resolved', 'completed']),
            orderBy('createdAt', 'desc'),
            limit(50) // Limit initial load for better performance
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            // Filter out expired posts and hidden posts on the client side (additional safety)
            const activePosts = posts.filter(post => {
                if (post.isHidden === true) return false;

                // Filter out items with turnoverStatus: "declared" for OSA turnover
                if (post.turnoverDetails &&
                    post.turnoverDetails.turnoverStatus === "declared" &&
                    post.turnoverDetails.turnoverAction === "turnover to OSA") {
                    return false;
                }

                // Check if post has expired
                if (post.expiryDate) {
                    const expiryDate = post.expiryDate.toDate ? post.expiryDate.toDate() : new Date(post.expiryDate);
                    return expiryDate > now;
                }

                return true;
            });

            // Cache the results
            setCache(cacheKey, activePosts);

            callback(activePosts);
            listenerActive = true;
        }, (error) => {
            console.error('❌ Firebase getActivePosts failed:', error);
            // Return cached data if available, otherwise empty array
            const cachedData = getCache(cacheKey);
            callback(cachedData || []);
        });

        // If we have cached data, return it immediately but keep the listener active
        if (cachedData && isOnline) {
            // Return cached data immediately
            callback(cachedData);
        }

        return unsubscribe;
    },

    // Get user posts with pagination - optimized with logging and error handling
    async getUserPostsPaginated(userEmail: string, lastDoc: any = null, pageSize = 10) {
        // Log the query for debugging
        const queryId = `user_posts_${Date.now()}`;
        console.log(`[${queryId}] Executing query for user: ${userEmail}`, {
            lastDocId: lastDoc?.id || 'none',
            pageSize,
            timestamp: new Date().toISOString()
        });

        const startTime = Date.now();

        try {
            // Build the base query
            let q = query(
                collection(db, 'posts'),
                where('user.email', '==', userEmail),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
            );

            // Add startAfter if we have a lastDoc
            if (lastDoc) {
                q = query(q, startAfter(lastDoc));
            }

            // Execute the query
            const snapshot = await getDocs(q);

            // Process the results
            const posts = snapshot.docs.map(doc => {
                const data = doc.data();
                // Ensure createdAt is a proper date object
                const postData = {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || new Date()
                };
                return postData;
            });

            const executionTime = Date.now() - startTime;
            console.log(`[${queryId}] Query completed in ${executionTime}ms`, {
                results: posts.length,
                hasMore: posts.length === pageSize,
                firstDocId: posts[0]?.id,
                lastDocId: posts[posts.length - 1]?.id
            });

            return {
                posts,
                lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
                hasMore: snapshot.docs.length === pageSize
            };
        } catch (error: any) {
            const errorTime = Date.now() - startTime;
            console.error(`[${queryId}] Query failed after ${errorTime}ms:`, error);

            // Add more specific error handling
            if (error.code === 'resource-exhausted') {
                console.warn('Firestore quota exceeded. Please check your usage and billing.');
                // You might want to implement a retry with backoff here
            } else if (error.code === 'failed-precondition') {
                console.error('Missing or insufficient permissions, or missing composite index');
                // Guide user to create the required index
                console.info('Ensure you have a composite index on:', {
                    collection: 'posts',
                    fields: [
                        { field: 'user.email', order: 'ASCENDING' },
                        { field: 'createdAt', order: 'DESCENDING' }
                    ]
                });
            }

            // Re-throw the error with additional context
            throw new Error(`Failed to fetch user posts: ${error.message || 'Unknown error'}`);
        }
    },

    // Get posts by type
    getPostsByType(type: string, callback: (posts: any[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('type', '==', type),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(posts);
        });
    },

    // Get posts with pagination support for infinite scroll
    async getPostsPaginated(lastDoc?: any, pageSize: number = 10): Promise<{ posts: any[], hasMore: boolean, lastDoc: any }> {
        const cacheKey = getCacheKey('posts', ['paginated', pageSize.toString(), lastDoc?.id || 'start']);

        // Check cache first
        const cachedData = getCache(cacheKey);
        if (cachedData && isOnline) {
            return cachedData;
        }

        try {
            let q;
            if (lastDoc) {
                q = query(
                    collection(db, 'posts'),
                    where('movedToUnclaimed', '==', false),
                    where('status', 'not-in', ['resolved', 'completed']),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDoc),
                    limit(pageSize)
                );
            } else {
                q = query(
                    collection(db, 'posts'),
                    where('movedToUnclaimed', '==', false),
                    where('status', 'not-in', ['resolved', 'completed']),
                    orderBy('createdAt', 'desc'),
                    limit(pageSize)
                );
            }

            const snapshot = await getDocs(q);
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            // Filter for additional safety
            const filteredPosts = posts.filter(post => !post.isHidden);

            const result = {
                posts: filteredPosts,
                hasMore: snapshot.docs.length === pageSize,
                lastDoc: snapshot.docs[snapshot.docs.length - 1]
            };

            // Cache the results
            setCache(cacheKey, result);

            return result;
        } catch (error) {
            console.error('❌ Firebase getPostsPaginated failed:', error);
            return { posts: [], hasMore: false, lastDoc: null };
        }
    },

    // Batch update multiple posts (optimized for admin operations)
    async batchUpdatePosts(updates: Array<{ id: string, data: any }>): Promise<void> {
        if (updates.length === 0) return;

        try {
            const batch = writeBatch(db);

            updates.forEach(({ id, data }) => {
                const postRef = doc(db, 'posts', id);
                batch.update(postRef, {
                    ...data,
                    updatedAt: serverTimestamp()
                });
            });

            await batch.commit();

            await batch.commit();
            console.log(`✅ Successfully batch updated ${updates.length} posts`);
        } catch (error) {
            console.error('❌ Firebase batchUpdatePosts failed:', error);
            throw new Error('Failed to batch update posts');
        }
    },
    getUserPosts(userEmail: string, callback: (posts: any[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('user.email', '==', userEmail),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q,
            (snapshot) => {
                const posts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(posts);
            },
            (error) => {
                console.error('❌ [ERROR] getUserPosts: Query failed:', error);
                // Return empty array on error to prevent app crash
                callback([]);
            }
        );
    },

    // Get post by ID
    async getPostById(postId: string): Promise<any> {
        try {
            const postDoc = await getDoc(doc(db, 'posts', postId));
            if (postDoc.exists()) {
                return { id: postDoc.id, ...postDoc.data() };
            }
            return null;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to get post');
        }
    },

    // Get resolved posts with caching and optimization
    // Matches web app's implementation for consistent sorting
    getResolvedPosts(callback: (posts: any[]) => void) {
        const cacheKey = getCacheKey('posts', ['resolved']);

        // Check cache first for immediate response
        const cachedData = getCache(cacheKey);

        const q = query(
            collection(db, 'posts'),
            where('status', 'in', ['resolved', 'completed'])
            // Removed orderBy to match web app and avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Ensure dates are properly converted to match web app
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
            })) as any[];

            // Sort posts by updatedAt in JavaScript (most recent first)
            // This matches the web app's implementation exactly
            const sortedPosts = posts.sort((a, b) => {
                const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || a.createdAt);
                const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || b.createdAt);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            });

            // Cache the results
            setCache(cacheKey, sortedPosts);

            callback(sortedPosts);
        }, (error) => {
            console.error('❌ Firebase getResolvedPosts failed:', error);
            const cachedData = getCache(cacheKey);
            callback(cachedData || []);
        });

        // If we have cached data, return it immediately but keep the listener active
        if (cachedData && isOnline) {
            // Return cached data immediately
            callback(cachedData);
        }

        return unsubscribe;
    },

    // Create new post with batched writes
    async createPost(postData: any): Promise<string> {
        try {
            // Upload images to Cloudinary if any
            let imageUrls: string[] = [];
            if (postData.images?.length > 0) {
                try {
                    const { cloudinaryService } = await import('../cloudinary');
                    // Process images in batches to avoid overloading Cloudinary
                    const BATCH_SIZE = 3;
                    for (let i = 0; i < postData.images.length; i += BATCH_SIZE) {
                        const batch = postData.images.slice(i, i + BATCH_SIZE);
                        const uploaded = await cloudinaryService.uploadImages(batch, 'posts');
                        imageUrls = [...imageUrls, ...uploaded];

                        // Add a small delay between batches
                        if (i + BATCH_SIZE < postData.images.length) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                } catch (uploadError: any) {
                    console.error('❌ Failed to upload images to Cloudinary:', uploadError);
                    throw new Error(`Failed to upload images: ${uploadError.message}`);
                }
            }

            // Prepare post data with timestamps
            const now = new Date();
            const expiryDate = new Date();
            expiryDate.setDate(now.getDate() + 30);

            // Extract user data and include all user details in the post
            const { user, ...postDataWithoutUser } = postData;
            const userData = user ? {
                // Include all user data
                user: {
                    ...user,  // Spread all user properties
                    id: user.id || user.uid || postData.creatorId
                },
                // Keep creatorId at the root for backward compatibility
                creatorId: user.id || user.uid || postData.creatorId
            } : {};

            const enhancedPostData = {
                ...postDataWithoutUser,
                ...userData,
                images: imageUrls,
                status: postData.status || 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                expiryDate: expiryDate.toISOString(),
                // Add lifecycle management fields that web expects
                isExpired: false,
                movedToUnclaimed: false,
                isHidden: false,
                originalStatus: postData.status || 'pending',
            };

            console.log('📝 Creating post with data:', {
                title: enhancedPostData.title,
                status: enhancedPostData.status,
                type: enhancedPostData.type,
                creatorId: enhancedPostData.creatorId,
                userEmail: enhancedPostData.user?.email,
                movedToUnclaimed: enhancedPostData.movedToUnclaimed,
                isHidden: enhancedPostData.isHidden,
                isExpired: enhancedPostData.isExpired
            });

            // Add the new post to Firestore
            const docRef = doc(collection(db, 'posts'));
            const postId = docRef.id;
            await setDoc(docRef, {
                ...enhancedPostData,
                id: postId // Ensure the ID is included in the document
            });

            console.log('✅ Post queued for creation with ID:', postId);

            // Send notifications in the background
            this._sendPostNotificationsInBackground(postId, {
                ...enhancedPostData,
                id: postId
            }, postData.creatorId);

            return postId;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create post');
        }
    },

    // Send post notifications in the background without blocking the UI
    async _sendPostNotificationsInBackground(postId: string, post: any, creatorId: string): Promise<void> {
        // Run in background without awaiting
        (async () => {
            try {
                // Skip notifications for turnover posts until approved
                if (post.turnoverDetails?.turnoverAction) {
                    console.log(`📋 Post ${postId} has turnover details (${post.turnoverDetails.turnoverAction}) - skipping notifications until approved`);
                    return;
                }

                // Get creator information for the notification
                const { getDoc, doc } = await import('firebase/firestore');
                const { db } = await import('./config');

                const creatorDoc = await getDoc(doc(db, 'users', creatorId));
                const creatorData = creatorDoc.exists() ? creatorDoc.data() : null;
                const creatorName = creatorData ? `${creatorData.firstName || ''} ${creatorData.lastName || ''}`.trim() : 'Someone';
                const creatorEmail = creatorData?.email || 'Unknown';

                // Import notification services
                const { notificationSender } = await import('./notificationSender');
                const { adminNotificationService } = await import('./adminNotifications');

                // Send notifications to all users
                await notificationSender.sendNewPostNotification({
                    id: postId,
                    title: post.title,
                    category: post.category,
                    location: post.location,
                    type: post.type,
                    creatorId: creatorId,
                    creatorName: creatorName
                });

                // Send notification to admins about the new post
                await adminNotificationService.notifyAdminsNewPost({
                    postId: postId,
                    postTitle: post.title,
                    postType: post.type,
                    postCategory: post.category,
                    postLocation: post.location,
                    creatorId: creatorId,
                    creatorName: creatorName,
                    creatorEmail: creatorEmail
                });

                console.log(`✅ Successfully sent notifications for post: ${postId}`);
            } catch (error) {
                console.error('❌ Error sending notifications for post:', postId, error);
            }
        })();
    },

    // Update post
    async updatePost(postId: string, updates: any): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Post updated: ${postId}`);
        } catch (error) {
            console.error('❌ Error updating post:', error);
            throw error;
        }
    },

    // Delete post
    async deletePost(postId: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            await deleteDoc(postRef);
            console.log(`✅ Post deleted: ${postId}`);

            // Note: If you need to clean up Cloudinary images, do it here
            // but be careful with rate limits
        } catch (error) {
            console.error('❌ Error deleting post:', error);
            throw error;
        }
    },

    // Get posts by category
    getPostsByCategory(category: string, callback: (posts: any[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('category', '==', category),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(posts);
        });
    },

    // Get posts by location
    getPostsByLocation(location: string, callback: (posts: any[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('location', '==', location),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(posts);
        });
    },

    // Get posts by status
    getPostsByStatus(status: string, callback: (posts: any[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('status', '==', status),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(posts);
        });
    },

    // Search posts by title or description
    searchPosts(searchTerm: string, callback: (posts: any[]) => void) {
        // Note: Firestore doesn't support full-text search natively
        // This is a simple implementation - for production, consider using Algolia or similar
        const q = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const allPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter posts that contain the search term in title or description
            const filteredPosts = allPosts.filter((post: any) => {
                const title = (post.title || '').toLowerCase();
                const description = (post.description || '').toLowerCase();
                const search = searchTerm.toLowerCase();

                return title.includes(search) || description.includes(search);
            });

            callback(filteredPosts);
        });
    },

    // Mark post as resolved
    async markPostAsResolved(postId: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'posts', postId), {
                status: 'resolved',
                resolvedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Invalidate caches to ensure fresh data is fetched after updates
            invalidatePostCaches(postId);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to mark post as resolved');
        }
    },

    // Get recent posts (last 24 hours)
    getRecentPosts(callback: (posts: any[]) => void) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const q = query(
            collection(db, 'posts'),
            where('createdAt', '>=', yesterday),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(posts);
        });
    },

    // Flag a post
    async flagPost(postId: string, userId: string, reason: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();

            // Check if post is already flagged by this user
            if (postData.isFlagged && postData.flaggedBy === userId) {
                throw new Error('You have already flagged this post');
            }

            // Update post with flag information
            await updateDoc(postRef, {
                isFlagged: true,
                flagReason: reason,
                flaggedBy: userId,
                flaggedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Invalidate caches to ensure fresh data is fetched after updates
            invalidatePostCaches(postId);

            console.log(`✅ Post ${postId} flagged by user ${userId} for reason: ${reason}`);
        } catch (error: any) {
            console.error('❌ Firebase flagPost failed:', error);
            throw new Error(error.message || 'Failed to flag post');
        }
    },

    // Unflag a post (admin only)
    async unflagPost(postId: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            // Clear flag information
            await updateDoc(postRef, {
                isFlagged: false,
                flagReason: null,
                flaggedBy: null,
                flaggedAt: null,
                updatedAt: serverTimestamp()
            });

            // Invalidate caches to ensure fresh data is fetched after updates
            invalidatePostCaches(postId);

            console.log(`✅ Post ${postId} unflagged`);
        } catch (error: any) {
            console.error('❌ Firebase unflagPost failed:', error);
            throw new Error(error.message || 'Failed to unflag post');
        }
    },

    // Hide a post (admin only)
    async hidePost(postId: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            // Hide the post
            await updateDoc(postRef, {
                isHidden: true,
                updatedAt: serverTimestamp()
            });

            // Invalidate caches to ensure fresh data is fetched after updates
            invalidatePostCaches(postId);

            console.log(`✅ Post ${postId} hidden from public view`);
        } catch (error: any) {
            console.error('❌ Firebase hidePost failed:', error);
            throw new Error(error.message || 'Failed to hide post');
        }
    },

    // Unhide a post (admin only)
    async unhidePost(postId: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            // Unhide the post
            await updateDoc(postRef, {
                isHidden: false,
                updatedAt: serverTimestamp()
            });

            // Invalidate caches to ensure fresh data is fetched after updates
            invalidatePostCaches(postId);

            console.log(`✅ Post ${postId} unhidden and visible to public`);
        } catch (error: any) {
            console.error('❌ Firebase unhidePost failed:', error);
            throw new Error(error.message || 'Failed to unhide post');
        }
    },

    // Get flagged posts (admin only)
    async getFlaggedPosts(): Promise<any[]> {
        try {
            const postsRef = collection(db, 'posts');
            const q = query(postsRef, where('isFlagged', '==', true));
            const querySnapshot = await getDocs(q);

            const flaggedPosts: any[] = [];
            querySnapshot.forEach((doc) => {
                flaggedPosts.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Sort by flaggedAt (most recently flagged first)
            flaggedPosts.sort((a, b) => {
                if (!a.flaggedAt || !b.flaggedAt) return 0;
                const aTime = a.flaggedAt instanceof Date ? a.flaggedAt.getTime() : new Date(a.flaggedAt).getTime();
                const bTime = b.flaggedAt instanceof Date ? b.flaggedAt.getTime() : new Date(b.flaggedAt).getTime();
                return bTime - aTime;
            });

            console.log(`✅ Retrieved ${flaggedPosts.length} flagged posts`);
            return flaggedPosts;
        } catch (error: any) {
            console.error('❌ Firebase getFlaggedPosts failed:', error);
            throw new Error(error.message || 'Failed to get flagged posts');
        }
    }
};
