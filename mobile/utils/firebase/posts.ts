// Posts service for lost and found items - Enhanced with performance optimizations
import { db } from './config';
import { cloudinaryService, extractPublicIdFromUrl } from '../cloudinary';
import {
    doc,
    collection,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    where,
    getDocs,
    serverTimestamp,
    limit,
    startAfter,
    writeBatch
} from 'firebase/firestore';

// Import notification sender (mobile service)
import { notificationSender } from './notificationSender';
import { adminNotificationService } from './adminNotifications';

// Connection state management for optimization
let isOnline = true;
let connectionListeners: (() => void)[] = [];

// Query result cache for frequently accessed data
const queryCache = new Map<string, { data: any, timestamp: number, expiry: number }>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for query results
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

        // Check cache first
        const cachedData = getCache(cacheKey);
        if (cachedData && isOnline) {
            callback(cachedData);
            return () => {}; // Return empty unsubscribe function
        }

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

            console.log('📱 Mobile getActivePosts:', {
                totalPosts: posts.length,
                activePosts: activePosts.length,
                queryResults: posts.slice(0, 3).map(p => ({
                    id: p.id,
                    title: p.title,
                    status: p.status,
                    type: p.type,
                    creatorId: p.creatorId,
                    userEmail: p.user?.email,
                    movedToUnclaimed: p.movedToUnclaimed,
                    isHidden: p.isHidden
                }))
            });

            callback(activePosts);
        }, (error) => {
            console.error('❌ Firebase getActivePosts failed:', error);
            // Return cached data if available, otherwise empty array
            const cachedData = getCache(cacheKey);
            callback(cachedData || []);
        });

        return unsubscribe;
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
    getResolvedPosts(callback: (posts: any[]) => void) {
        const cacheKey = getCacheKey('posts', ['resolved']);

        // Check cache first
        const cachedData = getCache(cacheKey);
        if (cachedData && isOnline) {
            callback(cachedData);
            return () => {};
        }

        const q = query(
            collection(db, 'posts'),
            where('status', 'in', ['resolved', 'completed']),
            orderBy('updatedAt', 'desc'),
            limit(50)
        );

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            // Cache the results
            setCache(cacheKey, posts);

            callback(posts);
        }, (error) => {
            console.error('❌ Firebase getResolvedPosts failed:', error);
            const cachedData = getCache(cacheKey);
            callback(cachedData || []);
        });
    },

    // Create new post
    async createPost(postData: any): Promise<string> {
        try {
            // Upload images to Cloudinary if any (matching web app pattern)
            let imageUrls: string[] = [];
            if (postData.images && postData.images.length > 0) {
                try {
                    const { cloudinaryService } = await import('../cloudinary');
                    imageUrls = await cloudinaryService.uploadImages(postData.images, 'posts');
                } catch (uploadError: any) {
                    console.error('❌ Failed to upload images to Cloudinary:', uploadError);

                    // Provide more helpful error message for configuration issues
                    if (uploadError.message.includes('Cloudinary cloud name not configured') ||
                        uploadError.message.includes('Cloudinary upload preset not configured')) {
                        throw new Error(`Cloudinary not configured. Please create a .env file in the mobile directory with EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET. Error: ${uploadError.message}`);
                    }

                    throw new Error(`Failed to upload images: ${uploadError.message}`);
                }
            }

            // Calculate expiry date (30 days from creation)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            // Convert turnoverDecisionAt to Firebase timestamp if it exists
            if (postData.turnoverDetails?.turnoverDecisionAt) {
                postData.turnoverDetails.turnoverDecisionAt = serverTimestamp();
            }

            // Ensure all required fields are present for web compatibility
            const enhancedPostData = {
                ...postData,
                // Replace local image URIs with Cloudinary URLs
                images: imageUrls,
                // Ensure status is set to pending for new posts
                status: postData.status || 'pending',
                // Add lifecycle management fields that web expects
                isExpired: false,
                movedToUnclaimed: false,
                isHidden: false,
                originalStatus: postData.status || 'pending',
                // Set expiry date for 30-day lifecycle system
                expiryDate: expiryDate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            console.log('📝 Creating post with data:', {
                title: enhancedPostData.title,
                status: enhancedPostData.status,
                type: enhancedPostData.type,
                category: enhancedPostData.category,
                creatorId: enhancedPostData.creatorId,
                userEmail: enhancedPostData.user?.email,
                movedToUnclaimed: enhancedPostData.movedToUnclaimed,
                isHidden: enhancedPostData.isHidden,
                isExpired: enhancedPostData.isExpired
            });

            const postRef = await addDoc(collection(db, 'posts'), enhancedPostData);

            // Send notifications to all users about the new post in the background
            // This runs asynchronously and doesn't block post creation
            setTimeout(async () => {
                try {
                    // Get creator information for the notification
                    const creatorDoc = await getDoc(doc(db, 'users', postData.creatorId || postData.user?.uid));
                    const creatorData = creatorDoc.exists() ? creatorDoc.data() : null;
                    const creatorName = creatorData ? `${creatorData.firstName} ${creatorData.lastName}` : 'Someone';
                    const creatorEmail = creatorData?.email || 'Unknown';

                    // Send notifications to all users
                    await notificationSender.sendNewPostNotification({
                        id: postRef.id,
                        title: postData.title,
                        category: postData.category,
                        location: postData.location,
                        type: postData.type,
                        creatorId: postData.creatorId || postData.user?.uid,
                        creatorName: creatorName
                    });

                    // Send notification to admins about the new post
                    await adminNotificationService.notifyAdminsNewPost({
                        postId: postRef.id,
                        postTitle: postData.title,
                        postType: postData.type,
                        postCategory: postData.category,
                        postLocation: postData.location,
                        creatorId: postData.creatorId || postData.user?.uid,
                        creatorName: creatorName,
                        creatorEmail: creatorEmail
                    });

                    console.log('✅ Background notifications sent successfully for new post:', postRef.id);
                } catch (notificationError) {
                    // Don't fail post creation if notifications fail - just log the error
                    console.error('❌ Error sending background notifications for post:', postRef.id, notificationError);
                }
            }, 0);

            console.log('✅ Post created successfully:', {
                id: postRef.id,
                title: enhancedPostData.title,
                status: enhancedPostData.status,
                type: enhancedPostData.type,
                creatorId: enhancedPostData.creatorId
            });

            // Clear cache to ensure the new post appears immediately
            queryCache.clear();

            return postRef.id;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create post');
        }
    },

    // Update post
    async updatePost(postId: string, updates: any): Promise<void> {
        try {
            await updateDoc(doc(db, 'posts', postId), {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update post');
        }
    },

    // Delete post and associated images
    async deletePost(postId: string): Promise<void> {
        try {
            // First get the post to delete its images
            const postDoc = await getDoc(doc(db, 'posts', postId));
            if (postDoc.exists()) {
                const postData = postDoc.data();;
                
                // Delete all images associated with the post
                if (postData.images && Array.isArray(postData.images)) {
                    await Promise.all(
                        postData.images.map((imageUrl: string) => {
                            const publicId = extractPublicIdFromUrl(imageUrl);
                            return publicId ? cloudinaryService.deleteImage(publicId).catch(console.error) : Promise.resolve();
                        })
                    );
                }
            }
            
            // Then delete the post document
            await deleteDoc(doc(db, 'posts', postId));
        } catch (error: any) {
            console.error('Error in deletePost:', error);
            throw new Error(error.message || 'Failed to delete post');
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
