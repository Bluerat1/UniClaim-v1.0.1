// Post service for Firebase - handles all post-related operations
import {
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    onSnapshot,
    getDocs,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    writeBatch,
    orderBy,
    limit as firestoreLimit
} from 'firebase/firestore';
import { DEFAULT_PROFILE_PICTURE } from '../../types/User';

// Import Firebase instances and types
import { db } from './config';
import type { Post } from '../../types/Post';
import { getAuth } from 'firebase/auth';

// Import ListenerManager for centralized listener management
import { listenerManager } from '../../utils/ListenerManager';

// Import Cloudinary service and utility functions
import { cloudinaryService, extractMessageImages, deleteMessageImages } from '../../utils/cloudinary';
// Helper function to extract Cloudinary public ID from URL
function extractCloudinaryPublicId(url: string): string | null {
    try {
        // Handle different Cloudinary URL formats
        if (url.includes('res.cloudinary.com')) {
            // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image_name.jpg
            const urlParts = url.split('/');
            const uploadIndex = urlParts.findIndex(part => part === 'upload');

            if (uploadIndex !== -1) {
                // Get everything after 'upload' but before any version number
                let publicIdParts = urlParts.slice(uploadIndex + 1);

                // Remove version number if present (starts with 'v' followed by numbers)
                const versionIndex = publicIdParts.findIndex(part => /^v\d+$/.test(part));
                if (versionIndex !== -1) {
                    publicIdParts = publicIdParts.slice(versionIndex + 1);
                }

                // Remove file extension from the last part
                if (publicIdParts.length > 0) {
                    const lastPart = publicIdParts[publicIdParts.length - 1];
                    const extensionIndex = lastPart.lastIndexOf('.');
                    if (extensionIndex !== -1) {
                        publicIdParts[publicIdParts.length - 1] = lastPart.substring(0, extensionIndex);
                    }
                }

                const publicId = publicIdParts.join('/');
                return publicId;
            }
        } else if (url.includes('api.cloudinary.com')) {
            // Format: https://api.cloudinary.com/v1_1/cloud_name/image/upload/...
            const urlParts = url.split('/');
            const uploadIndex = urlParts.findIndex(part => part === 'upload');

            if (uploadIndex !== -1) {
                const publicIdParts = urlParts.slice(uploadIndex + 1);
                const publicId = publicIdParts.join('/');
                return publicId;
            }
        }

        return null;

    } catch (error) {
        return null;
    }
}

// Import other services
import { notificationSender } from './notificationSender';
import { adminNotificationService } from './adminNotifications';
import { notificationService } from './notifications';

// Import caching system
import { postCache, userCache, cacheKeys, cacheInvalidation } from '../../utils/advancedCache';

// Post service functions
export const postService = {
    // Create a new post
    async createPost(postData: Omit<Post, 'id' | 'createdAt' | 'creatorId'>, creatorId: string): Promise<string> {
        const startTime = performance.now();
        console.log(`🚀 [PERF] Starting post creation for user ${creatorId}`);

        try {
            // Step 1: Generate unique post ID
            const postIdStart = performance.now();
            const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const postIdEnd = performance.now();
            console.log(`⚡ [PERF] Post ID generation: ${(postIdEnd - postIdStart).toFixed(2)}ms`);

            // Step 2: Upload images if any
            const imageUploadStart = performance.now();
            const imageUrls = postData.images.length > 0
                ? await cloudinaryService.uploadImages(postData.images)
                : [];
            const imageUploadEnd = performance.now();
            console.log(`📸 [PERF] Image upload (${postData.images.length} images): ${(imageUploadEnd - imageUploadStart).toFixed(2)}ms`);

            // Step 3: Sanitize post data
            const sanitizeStart = performance.now();
            const sanitizedPostData = this.sanitizePostData(postData);
            const sanitizeEnd = performance.now();
            console.log(`🧹 [PERF] Data sanitization: ${(sanitizeEnd - sanitizeStart).toFixed(2)}ms`);

            // Step 4: Prepare post data
            const prepareStart = performance.now();
            // Convert turnoverDecisionAt to Firebase timestamp if it exists
            if (sanitizedPostData.turnoverDetails?.turnoverDecisionAt) {
                sanitizedPostData.turnoverDetails.turnoverDecisionAt = serverTimestamp();
            }

            // Calculate expiry date (30 days from creation) before creating the post
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            // Create post document with expiry date included
            const post: Post = {
                ...sanitizedPostData,
                id: postId,
                creatorId: creatorId, // Add the creator ID
                images: imageUrls,
                createdAt: serverTimestamp(),
                status: 'pending',
                // Initialize 30-day lifecycle fields
                isExpired: false,
                movedToUnclaimed: false,
                originalStatus: 'pending',
                // Include expiry date in initial creation to avoid permission issues
                expiryDate: expiryDate
            };
            const prepareEnd = performance.now();
            console.log(`📋 [PERF] Post data preparation: ${(prepareEnd - prepareStart).toFixed(2)}ms`);

            // Step 5: Save to Firestore
            const dbSaveStart = performance.now();
            await setDoc(doc(db, 'posts', postId), post);
            const dbSaveEnd = performance.now();
            console.log(`💾 [PERF] Firestore save: ${(dbSaveEnd - dbSaveStart).toFixed(2)}ms`);

            // Invalidate relevant caches after successful post creation
            cacheInvalidation.invalidatePostsByType('all');
            console.log(`🔄 [CACHE] Invalidated post caches after creating post ${postId}`);

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            console.log(`✅ [PERF] Post creation completed successfully in ${totalTime.toFixed(2)}ms`);
            console.log(`📊 [PERF] Performance breakdown:
  - Post ID generation: ${(postIdEnd - postIdStart).toFixed(2)}ms
  - Image upload: ${(imageUploadEnd - imageUploadStart).toFixed(2)}ms
  - Data sanitization: ${(sanitizeEnd - sanitizeStart).toFixed(2)}ms
  - Data preparation: ${(prepareEnd - prepareStart).toFixed(2)}ms
  - Firestore save: ${(dbSaveEnd - dbSaveStart).toFixed(2)}ms
  - Total: ${totalTime.toFixed(2)}ms`);

            // Start notifications in the background
            this._sendPostNotificationsInBackground(postId, post, creatorId);

            return postId;
        } catch (error: any) {
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            console.error(`❌ [PERF] Post creation failed after ${totalTime.toFixed(2)}ms:`, error);
            throw new Error(error.message || 'Failed to create post');
        }
    },

    // Send post notifications in the background without blocking the UI
    async _sendPostNotificationsInBackground(postId: string, post: Post, creatorId: string): Promise<void> {
        // Run in background without awaiting
        (async () => {
            const notificationStart = performance.now();
            try {
                // Get creator information for the notification (with caching)
                const creatorCacheKey = cacheKeys.user(creatorId);
                let creatorData = userCache.get(creatorCacheKey);

                if (!creatorData) {
                    const creatorDoc = await getDoc(doc(db, 'users', creatorId));
                    creatorData = creatorDoc.exists() ? creatorDoc.data() as any : null;

                    if (creatorData) {
                        userCache.set(creatorCacheKey, creatorData);
                        console.log(`💾 [CACHE] User ${creatorId} cached`);
                    }
                } else {
                    console.log(`💾 [CACHE] User ${creatorId} retrieved from cache`);
                }

                const creatorName = creatorData ? `${(creatorData as any).firstName || ''} ${(creatorData as any).lastName || ''}`.trim() : 'Someone';
                const creatorEmail = (creatorData as any)?.email || 'Unknown';

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

                const notificationEnd = performance.now();
                console.log(`🔔 [PERF] Background notifications sent: ${(notificationEnd - notificationStart).toFixed(2)}ms`);
            } catch (notificationError) {
                console.error('❌ [PERF] Error sending background notifications for post:', postId, notificationError);
            }
        })();
    },

    // Create a new post with concurrent image upload and progress tracking
    async createPostWithConcurrentUpload(
        postData: Omit<Post, 'id' | 'createdAt' | 'creatorId'>,
        creatorId: string,
        uploadOptions?: { 
            onProgress?: (progress: any[]) => void,
            onSuccess?: (postId: string, post: Post) => Promise<void> | void
        }
    ): Promise<string> {
        const startTime = performance.now();
        let postId = ''; // Track the post ID for error handling
        
        console.log(`🚀 [CONCURRENT] Starting concurrent post creation for user ${creatorId}`);

        try {
            // Step 1: Generate unique post ID
            const postIdStart = performance.now();
            postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Assign to outer scope
            const postIdEnd = performance.now();
            console.log(`⚡ [CONCURRENT] Post ID generation: ${(postIdEnd - postIdStart).toFixed(2)}ms`);

            // Step 2: Upload images concurrently with progress tracking
            const imageUploadStart = performance.now();

            let imageUrls: string[] = [];
            if (postData.images && postData.images.length > 0) {
                console.log(`🖼️ [CONCURRENT] Starting concurrent upload of ${postData.images.length} images`);

                // Use the concurrent upload method
                imageUrls = await cloudinaryService.uploadImagesConcurrently(
                    postData.images,
                    'posts',
                    {
                        onProgress: uploadOptions?.onProgress,
                        onFileComplete: (fileName, success, error) => {
                            console.log(`📸 [CONCURRENT] ${fileName}: ${success ? '✓' : '✗'} ${success ? '' : error}`);
                        }
                    }
                );
            }

            const imageUploadEnd = performance.now();
            console.log(`📸 [CONCURRENT] Image upload completed: ${(imageUploadEnd - imageUploadStart).toFixed(2)}ms`);

            // Step 3: Sanitize post data
            const sanitizeStart = performance.now();
            const sanitizedPostData = this.sanitizePostData(postData);
            const sanitizeEnd = performance.now();
            console.log(`🧹 [CONCURRENT] Data sanitization: ${(sanitizeEnd - sanitizeStart).toFixed(2)}ms`);

            // Step 4: Prepare post data
            const prepareStart = performance.now();
            // Convert turnoverDecisionAt to Firebase timestamp if it exists
            if (sanitizedPostData.turnoverDetails?.turnoverDecisionAt) {
                sanitizedPostData.turnoverDetails.turnoverDecisionAt = serverTimestamp();
            }

            // Calculate expiry date (30 days from creation) before creating the post
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            // Create post document with expiry date included
            const post: Post = {
                ...sanitizedPostData,
                id: postId,
                creatorId: creatorId, // Add the creator ID
                images: imageUrls,
                createdAt: serverTimestamp(),
                status: 'pending',
                // Initialize 30-day lifecycle fields
                isExpired: false,
                movedToUnclaimed: false,
                originalStatus: 'pending',
                // Include expiry date in initial creation to avoid permission issues
                expiryDate: expiryDate
            };
            const prepareEnd = performance.now();
            console.log(`📋 [CONCURRENT] Post data preparation: ${(prepareEnd - prepareStart).toFixed(2)}ms`);

            // Step 5: Save to Firestore
            const dbSaveStart = performance.now();
            await setDoc(doc(db, 'posts', postId), post);
            const dbSaveEnd = performance.now();
            console.log(`💾 [CONCURRENT] Firestore save: ${(dbSaveEnd - dbSaveStart).toFixed(2)}ms`);

            // Call onSuccess callback if provided (run in background without awaiting)
            if (uploadOptions?.onSuccess) {
                try {
                    const result = uploadOptions.onSuccess(postId, post);
                    if (result && typeof result.catch === 'function') {
                        result.catch((error: Error) => {
                            console.error('Error in onSuccess callback:', error);
                        });
                    }
                } catch (error) {
                    console.error('Error executing onSuccess callback:', error);
                }
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            console.log(`✅ [CONCURRENT] Post creation completed successfully in ${totalTime.toFixed(2)}ms`);
            console.log(`📊 [CONCURRENT] Performance breakdown:
  - Post ID generation: ${(postIdEnd - postIdStart).toFixed(2)}ms
  - Image upload: ${(imageUploadEnd - imageUploadStart).toFixed(2)}ms
  - Data sanitization: ${(sanitizeEnd - sanitizeStart).toFixed(2)}ms
  - Data preparation: ${(prepareEnd - prepareStart).toFixed(2)}ms
  - Firestore save: ${(dbSaveEnd - dbSaveStart).toFixed(2)}ms
  - Total: ${totalTime.toFixed(2)}ms`);

            return postId;
        } catch (error: any) {
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            console.error(`❌ [CONCURRENT] Post creation failed after ${totalTime.toFixed(2)}ms:`, error);
            
            // Clean up any uploaded images if the post creation failed
            if (postId) {
                try {
                    // No need to clean up images here as they haven't been uploaded yet
                    // The error likely occurred before image upload started
                    console.log('⚠️ [CLEANUP] No images to clean up - error occurred before upload');
                } catch (cleanupError) {
                    console.error('❌ [CLEANUP] Error during cleanup:', cleanupError);
                }
            }
            
            throw new Error(error.message || 'Failed to create post');
        }
    },

    // Get all posts with real-time updates (DEPRECATED - use getActivePosts for better performance)
    getAllPosts(callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts')
            // orderBy('createdAt', 'desc') // Temporarily commented out
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Sort posts by createdAt in JavaScript instead
            const sortedPosts = posts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            });

            callback(sortedPosts);
        }, (error) => {
            console.error('PostService: Error fetching posts:', error);
            callback([]);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get only active (non-expired) posts with real-time updates - OPTIMIZED FOR PERFORMANCE
    getActivePosts(callback: (posts: Post[]) => void) {
        const now = new Date();

        // Create query for active posts only
        const q = query(
            collection(db, 'posts'),
            where('movedToUnclaimed', '==', false), // Only posts not moved to unclaimed
            orderBy('createdAt', 'desc') // Sort by createdAt in descending order (newest first) for better pagination
            // Note: We can't use where('expiryDate', '>', now) in the same query with movedToUnclaimed
            // due to Firestore limitations, so we'll filter expiryDate in the callback
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out expired, resolved, and soft-deleted posts on the client side (this is fast since we're only processing ~20-50 posts)
            const activePosts = posts.filter(post => {
                if (post.movedToUnclaimed) return false;

                // Exclude resolved posts from active sections
                if (post.status === 'resolved') return false;

                // Exclude hidden posts (flagged posts that admin chose to hide)
                if (post.isHidden === true) return false;

                // Exclude soft-deleted posts
                if (post.deletedAt) return false;

                // Exclude items with turnoverStatus: "declared" ONLY for OSA turnover (awaiting OSA confirmation)
                // Campus Security items with "transferred" status should be visible
                if (post.turnoverDetails &&
                    post.turnoverDetails.turnoverStatus === "declared" &&
                    post.turnoverDetails.turnoverAction === "turnover to OSA") {
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

                    // Return false if post has expired
                    if (expiryDate < now) return false;
                }

                return true;
            });

            // Sort posts by createdAt (most recent first)
            const sortedPosts = activePosts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime();
            });

            callback(sortedPosts);
        }, (error) => {
            console.error('PostService: Error fetching active posts:', error);
            callback([]);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get all posts for admin use (includes items awaiting turnover confirmation)
    getAllPostsForAdmin(callback: (posts: Post[]) => void) {
        const now = new Date();

        // Create query for all posts (no filtering at database level)
        const q = query(
            collection(db, 'posts'),
            where('movedToUnclaimed', '==', false) // Only posts not moved to unclaimed
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out expired posts and resolved posts on the client side
            // BUT include items with turnoverStatus: "declared" for admin use
            const adminPosts = posts.filter(post => {
                if (post.movedToUnclaimed) return false;

                // Exclude resolved posts from active sections
                if (post.status === 'resolved') return false;

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

                    // Return false if post has expired
                    if (expiryDate < now) return false;
                }

                return true;
            });

            // Sort posts by createdAt (most recent first)
            const sortedPosts = adminPosts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime();
            });

            callback(sortedPosts);
        }, (error) => {
            console.error('PostService: Error fetching admin posts:', error);
            callback([]);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get posts by type (lost/found)
    getPostsByType(type: 'lost' | 'found', callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('type', '==', type)
            // Removed orderBy to avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out resolved posts and hidden posts from active sections
            const filteredPosts = posts.filter(post => post.status !== 'resolved' && post.isHidden !== true);

            // Sort posts by createdAt in JavaScript instead
            const sortedPosts = filteredPosts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            });

            callback(sortedPosts);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get resolved posts for completed reports section
    getResolvedPosts(callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('status', '==', 'resolved')
            // Removed orderBy to avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Sort posts by createdAt in JavaScript instead (most recent first for completed reports)
            const sortedPosts = posts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            });

            callback(sortedPosts);
        }, (error) => {
            console.error('PostService: Error fetching resolved posts:', error);
            callback([]);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get posts by category
    getPostsByCategory(category: string, callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('category', '==', category)
            // Removed orderBy to avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out resolved posts and hidden posts from active sections
            const filteredPosts = posts.filter(post => post.status !== 'resolved' && post.isHidden !== true);

            // Sort posts by createdAt in JavaScript instead
            const sortedPosts = filteredPosts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            });

            callback(sortedPosts);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get posts by user email
    getUserPosts(userEmail: string, callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('user.email', '==', userEmail)
            // Removed orderBy to avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Sort posts by createdAt in JavaScript instead
            const sortedPosts = posts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            });

            callback(sortedPosts);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get a single post by ID (with caching)
    async getPostById(postId: string): Promise<Post | null> {
        try {
            // Try cache first
            const cacheKey = cacheKeys.post(postId);
            const cachedPost = postCache.get<Post>(cacheKey);
            if (cachedPost) {
                console.log(`💾 [CACHE] Post ${postId} retrieved from cache`);
                return cachedPost;
            }

            // Fetch from database
            console.log(`🔍 [CACHE] Post ${postId} not in cache, fetching from database`);
            const postDoc = await getDoc(doc(db, 'posts', postId));
            if (postDoc.exists()) {
                const data = postDoc.data();
                const post = {
                    id: postDoc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt
                } as Post;

                // Cache the result
                postCache.set(cacheKey, post);
                console.log(`💾 [CACHE] Post ${postId} cached`);
                return post;
            }
            return null;
        } catch (error: any) {
            console.error('Error fetching post:', error);
            throw new Error(error.message || 'Failed to fetch post');
        }
    },

    // Update post status
    async updatePostStatus(postId: string, status: 'pending' | 'resolved' | 'unclaimed'): Promise<void> {
        try {
            await updateDoc(doc(db, 'posts', postId), {
                status,
                updatedAt: serverTimestamp()
            });

            // If status is changed to 'unclaimed', automatically delete all related conversations
            if (status === 'unclaimed') {
                console.log(`🗑️ Post marked as unclaimed, deleting all related conversations for post: ${postId}`);
                await this.deleteConversationsByPostId(postId);
                console.log(`✅ Successfully deleted conversations for unclaimed post: ${postId}`);
            }
        } catch (error: any) {
            console.error('Error updating post status:', error);
            throw new Error(error.message || 'Failed to update post status');
        }
    },

    // Update turnover confirmation status
    async updateTurnoverStatus(postId: string, status: 'confirmed' | 'not_received', confirmedBy: string, notes?: string): Promise<void> {
        try {
            const updateData: any = {
                'turnoverDetails.turnoverStatus': status,
                'turnoverDetails.confirmedBy': confirmedBy,
                'turnoverDetails.confirmedAt': serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Add notes if provided
            if (notes) {
                updateData['turnoverDetails.confirmationNotes'] = notes;
            }

            // When OSA admin confirms receipt, change the creator to the admin
            if (status === 'confirmed') {
                // Fetch real admin user data using the confirmedBy parameter (actual admin user ID)
                const adminUserId = confirmedBy;
                console.log(`🔍 Fetching admin data for user ID: ${adminUserId}`);

                const adminDocRef = doc(db, 'users', adminUserId);
                const adminDoc = await getDoc(adminDocRef);

                let osaAdminData;
                if (adminDoc.exists()) {
                    const adminData = adminDoc.data();
                    console.log(`✅ Admin data found:`, {
                        firstName: adminData.firstName,
                        lastName: adminData.lastName,
                        email: adminData.email,
                        profilePicture: adminData.profilePicture,
                        profileImageUrl: adminData.profileImageUrl
                    });

                    osaAdminData = {
                        firstName: adminData.firstName || "System",
                        lastName: adminData.lastName || "Administrator",
                        email: adminData.email || "admin@uniclaim.com",
                        contactNum: "", // Don't show admin contact
                        studentId: "", // Don't show admin ID
                        profilePicture: adminData.profilePicture || adminData.profileImageUrl || DEFAULT_PROFILE_PICTURE
                    };

                    console.log(`📸 Final profile picture URL: ${osaAdminData.profilePicture}`);
                } else {
                    console.warn(`⚠️ Admin document not found for user ID: ${adminUserId}`);
                    // Fallback if admin data not found
                    osaAdminData = {
                        firstName: "System",
                        lastName: "Administrator",
                        email: "admin@uniclaim.com",
                        contactNum: "",
                        studentId: "",
                        profilePicture: DEFAULT_PROFILE_PICTURE
                    };
                }

                updateData.creatorId = confirmedBy;
                updateData.user = osaAdminData;
            }

            // Get the post data before updating to get the original creator
            const postDoc = await getDoc(doc(db, 'posts', postId));
            const originalCreatorId = postDoc.data()?.creatorId;

            // Update the document
            await updateDoc(doc(db, 'posts', postId), updateData);

            console.log(`✅ Turnover status updated for post ${postId}: ${status}`);
            if (status === 'confirmed') {
                console.log(`✅ Creator changed to admin: ${confirmedBy}`);
                console.log(`✅ User field updated to OSA admin data`);

                // Send notification to the original creator
                if (originalCreatorId && originalCreatorId !== confirmedBy) {
                    try {
                        const adminDoc = await getDoc(doc(db, 'users', confirmedBy));
                        const adminData = adminDoc.data();
                        const adminName = adminData ?
                            `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim() || 'an administrator' :
                            'an administrator';

                        const notificationTitle = 'Item Received';
                        const notificationBody = `Your item "${postDoc.data()?.title || 'item'}" has been received by ${adminName}.`;
                        const notificationData = {
                            userId: originalCreatorId,
                            type: 'claim_update',
                            postId: postId,
                            action: 'item_received',
                            adminId: confirmedBy
                        };

                        // Show the notification
                        await notificationService.showNotification(notificationTitle, notificationBody, notificationData);

                        // Also create a notification record in the database
                        await notificationService.createNotification({
                            userId: originalCreatorId,
                            type: 'claim_update',
                            title: notificationTitle,
                            body: notificationBody,
                            data: notificationData,
                            postId: postId
                        });

                        console.log(`📬 Sent receipt confirmation notification to user ${originalCreatorId}`);
                    } catch (notifError) {
                        console.error('Failed to send receipt confirmation notification:', notifError);
                        // Don't fail the whole operation if notification fails
                    }
                }
            }
        } catch (error: any) {
            console.error('Error updating turnover status:', error);
            throw new Error(error.message || 'Failed to update turnover status');
        }
    },

    // Update post
    async updatePost(postId: string, updates: Partial<Post>): Promise<void> {
        try {
            // Get the original post data first to compare images
            const originalPost = await this.getPostById(postId);
            if (!originalPost) {
                throw new Error('Post not found');
            }

            const updateData = {
                ...updates,
                updatedAt: serverTimestamp()
            };

            // Handle image updates if needed
            if (updates.images) {
                // Compare original images with new images to find deleted ones
                const originalImages = originalPost.images || [];
                const newImages = updates.images;

                // Find images that were deleted (exist in original but not in new)
                const deletedImages: string[] = [];
                originalImages.forEach((originalImg: string | File) => {
                    // Only process string URLs (Cloudinary URLs) for deletion
                    if (typeof originalImg === 'string') {
                        // Check if this original image is still in the new list
                        const stillExists = newImages.some((newImg: any) => {
                            // If newImg is a string (URL), compare directly
                            if (typeof newImg === 'string') {
                                return newImg === originalImg;
                            }
                            // If newImg is a File, it's a new upload, so original was deleted
                            return false;
                        });

                        if (!stillExists) {
                            deletedImages.push(originalImg);
                        }
                    }
                    // Skip File objects as they can't be deleted from Cloudinary
                });

                // Delete removed images from Cloudinary first
                if (deletedImages.length > 0) {
                    console.log(`🗑️ Deleting ${deletedImages.length} removed images from Cloudinary:`, deletedImages);

                    // Delete images one by one with proper public ID extraction
                    for (const imageUrl of deletedImages) {
                        try {
                            // Extract public ID from the full URL
                            const publicId = extractCloudinaryPublicId(imageUrl);

                            if (publicId) {
                                console.log(`🗑️ Deleting removed image: ${imageUrl.split('/').pop()} (Public ID: ${publicId})`);
                                await cloudinaryService.deleteImage(publicId);
                                console.log(`✅ Successfully deleted removed image: ${imageUrl.split('/').pop()}`);
                            } else {
                                console.warn(`⚠️ Could not extract public ID from removed image URL: ${imageUrl}`);
                            }
                        } catch (error) {
                            console.error('❌ Failed to delete removed image:', imageUrl, error);
                            // Continue with other images even if one fails
                        }
                    }
                }

                // Upload new images and get URLs
                const imageUrls = await cloudinaryService.uploadImages(newImages);
                updateData.images = imageUrls;
            }

            await updateDoc(doc(db, 'posts', postId), updateData);
        } catch (error: any) {
            console.error('Error updating post:', error);
            throw new Error(error.message || 'Failed to update post');
        }
    },

    // Soft delete post (moves to deleted collection instead of permanent deletion)
    async deletePost(postId: string, hardDelete: boolean = false, deletedBy?: string): Promise<void> {
        try {
            // First try to get the post from the main collection
            let postRef = doc(db, 'posts', postId);
            let postSnap = await getDoc(postRef);
            let isFromDeletedCollection = false;

            // If not found in posts, check deleted_posts
            if (!postSnap.exists()) {
                postRef = doc(db, 'deleted_posts', postId);
                postSnap = await getDoc(postRef);
                isFromDeletedCollection = true;

                if (!postSnap.exists()) {
                    throw new Error('Post not found in active or deleted posts');
                }

                // If we're not doing a hard delete and found in deleted_posts, it's an error
                if (!hardDelete) {
                    throw new Error('Cannot soft delete an already deleted post');
                }
            }

            // Get post data
            const postData = postSnap.data() as Post;
            
            // Add original post images to delete list
            const allImagesToDelete: string[] = [];
            
            if (postData.images && postData.images.length > 0) {
                allImagesToDelete.push(...postData.images as string[]);
            }

            // Add handover and claim images if they exist
            if (postData.handoverDetails?.handoverItemPhotos) {
                postData.handoverDetails.handoverItemPhotos.forEach((photo: { url: string }) => {
                    if (photo.url) allImagesToDelete.push(photo.url);
                });
                if (postData.handoverDetails.handoverIdPhoto) {
                    allImagesToDelete.push(postData.handoverDetails.handoverIdPhoto);
                }
                if (postData.handoverDetails.ownerIdPhoto) {
                    allImagesToDelete.push(postData.handoverDetails.ownerIdPhoto);
                }
            }

            // Delete all collected images from Cloudinary if any exist
            if (allImagesToDelete.length > 0) {
                console.log(`🗑️ Deleting ${allImagesToDelete.length} total images from Cloudinary`);
                // Run in background without awaiting
                Promise.all(
                    allImagesToDelete.map(async (imageUrl: string) => {
                        try {
                            const publicId = extractCloudinaryPublicId(imageUrl);
                            if (publicId) {
                                await cloudinaryService.deleteImage(publicId);
                            }
                        } catch (error) {
                            console.error('Failed to delete image:', imageUrl, error);
                        }
                    })
                ).catch(console.error);
            }

            if (hardDelete) {
                // Hard delete - remove completely
                await deleteDoc(postRef);

                // Delete all conversations related to this post
                await this.deleteConversationsByPostId(postId);

                // Delete all notifications related to this post
                try {
                    await notificationService.deleteNotificationsByPostId(postId);
                } catch (notificationError) {
                    console.error('Failed to delete notifications for post:', postId, notificationError);
                }
            } else {
                // Soft delete - move to deleted collection
                const deletedAt = new Date().toISOString();
                const deletedByUser = deletedBy || 'system';

                // Add to deleted collection with deletion metadata
                await setDoc(doc(db, 'deleted_posts', postId), {
                    ...postData,
                    deletedAt,
                    deletedBy: deletedByUser,
                    originalId: postId, // Keep reference to original ID
                });

                // Remove from active posts
                await deleteDoc(postRef);

                // Log the deletion
                console.log(`♻️ Post ${postId} moved to deleted_posts collection`);
            }
        } catch (error: any) {
            console.error('Post deletion failed:', error);
            throw new Error(error.message || 'Failed to delete post');
        }
    },

    // Delete all conversations related to a specific post
    async deleteConversationsByPostId(postId: string): Promise<void> {
        try {
            // STEP 1: Query conversations by postId
            const conversationsQuery = query(
                collection(db, 'conversations'),
                where('postId', '==', postId)
            );

            const conversationsSnapshot = await getDocs(conversationsQuery);

            if (conversationsSnapshot.docs.length === 0) {
                return;
            }

            // STEP 2: Extract all images from all messages before deletion
            console.log(`🗑️ Starting image cleanup for ${conversationsSnapshot.docs.length} conversations`);
            const allImageUrls: string[] = [];

            for (const convDoc of conversationsSnapshot.docs) {
                const conversationId = convDoc.id;

                try {
                    // Get all messages in this conversation
                    const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    if (messagesSnapshot.docs.length > 0) {
                        console.log(`🗑️ Processing ${messagesSnapshot.docs.length} messages in conversation ${conversationId}`);

                        // Extract images from each message
                        for (const messageDoc of messagesSnapshot.docs) {
                            const messageData = messageDoc.data();

                            try {
                                const messageImages = extractMessageImages(messageData);

                                if (messageImages.length > 0) {
                                    console.log(`🗑️ Found ${messageImages.length} images in message ${messageDoc.id}`);
                                    allImageUrls.push(...messageImages);
                                }
                            } catch (imageError: any) {
                                console.warn(`Failed to extract images from message ${messageDoc.id}:`, imageError.message);
                                // Continue with other messages even if one fails
                            }
                        }
                    }
                } catch (error: any) {
                    console.warn(`Failed to process conversation ${conversationId} for image extraction:`, error.message);
                    // Continue with other conversations even if one fails
                }
            }

            // STEP 3: Delete all extracted images from Cloudinary
            if (allImageUrls.length > 0) {
                console.log(`🗑️ Attempting to delete ${allImageUrls.length} total images from Cloudinary`);

                try {
                    const imageDeletionResult = await deleteMessageImages(allImageUrls);

                    if (imageDeletionResult.success) {
                        console.log(`✅ Successfully deleted ${imageDeletionResult.deleted.length} images from Cloudinary`);
                    } else {
                        console.warn(`⚠️ Image deletion completed with some failures. Deleted: ${imageDeletionResult.deleted.length}, Failed: ${imageDeletionResult.failed.length}`);
                    }
                } catch (imageError: any) {
                    console.warn('Failed to delete images from Cloudinary, but continuing with database cleanup:', imageError.message);
                    // Continue with database cleanup even if image deletion fails
                }
            } else {
                console.log('🗑️ No images found in conversations to delete');
            }

            // STEP 4: Create a batch operation for atomic deletion of database records
            const batch = writeBatch(db);

            // STEP 5: Delete messages and conversations in the correct order
            for (const convDoc of conversationsSnapshot.docs) {
                const conversationId = convDoc.id;

                try {
                    // STEP 5a: Delete all messages in the subcollection first
                    const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    if (messagesSnapshot.docs.length > 0) {
                        // Add all messages to the deletion batch
                        messagesSnapshot.docs.forEach(messageDoc => {
                            batch.delete(messageDoc.ref);
                        });
                    }

                    // STEP 5b: Add conversation document to deletion batch
                    batch.delete(convDoc.ref);

                } catch (error: any) {
                    throw new Error(`Failed to process conversation ${conversationId}: ${error.message}`);
                }
            }

            // STEP 6: Execute the batch operation atomically
            await batch.commit();

            // STEP 7: Verify deletion was successful
            const verifyQuery = query(
                collection(db, 'conversations'),
                where('postId', '==', postId)
            );
            const verifySnapshot = await getDocs(verifyQuery);

            if (verifySnapshot.docs.length > 0) {
                throw new Error('Conversation deletion verification failed');
            }

            console.log(`✅ Successfully deleted ${conversationsSnapshot.docs.length} conversations and their messages`);

        } catch (error: any) {
            console.error('Error deleting conversations for post:', error);
            throw new Error(`Failed to delete conversations: ${error.message}`);
        }
    },

    // Search posts by title or description
    async searchPosts(searchTerm: string): Promise<Post[]> {
        try {
            // Note: This is a simple implementation. For better search,
            // consider using Algolia or implement a more sophisticated search
            const postsSnapshot = await getDocs(collection(db, 'posts'));
            const posts = postsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            const searchTermLower = searchTerm.toLowerCase();
            return posts.filter(post =>
                post.isHidden !== true && (
                    post.title.toLowerCase().includes(searchTermLower) ||
                    post.description.toLowerCase().includes(searchTermLower) ||
                    post.category.toLowerCase().includes(searchTermLower) ||
                    post.location.toLowerCase().includes(searchTermLower)
                )
            );
        } catch (error: any) {
            console.error('Error searching posts:', error);
            throw new Error(error.message || 'Failed to search posts');
        }
    },

    // Get posts by location
    getPostsByLocation(location: string, callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('location', '==', location)
            // Removed orderBy to avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out resolved posts and hidden posts from active sections
            const filteredPosts = posts.filter(post => post.status !== 'resolved' && post.isHidden !== true);

            // Sort posts by createdAt in JavaScript instead
            const sortedPosts = filteredPosts.sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime(); // Most recent first
            });

            callback(sortedPosts);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Move post to unclaimed status (expired posts)
    async movePostToUnclaimed(postId: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();

            await updateDoc(postRef, {
                isExpired: true,
                movedToUnclaimed: true,
                originalStatus: postData.status || 'pending'
            });

            console.log(`Post ${postId} moved to unclaimed status`);
        } catch (error: any) {
            console.error('Error moving post to unclaimed:', error);
            throw new Error(error.message || 'Failed to move post to unclaimed');
        }
    },

    // Activate ticket (move back to active from unclaimed)
    async activateTicket(postId: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();

            // Check if post can actually be activated
            if (!postData.movedToUnclaimed && postData.status !== 'unclaimed') {
                throw new Error('Post is not in unclaimed status and cannot be activated');
            }

            // Calculate new expiry date (30 days from now)
            const newExpiryDate = new Date();
            newExpiryDate.setDate(newExpiryDate.getDate() + 30);

            // Determine the status to restore to
            let statusToRestore = 'pending';
            if (postData.originalStatus && postData.originalStatus !== 'unclaimed') {
                statusToRestore = postData.originalStatus;
            }

            await updateDoc(postRef, {
                isExpired: false,
                movedToUnclaimed: false,
                status: statusToRestore,
                expiryDate: newExpiryDate,
                updatedAt: serverTimestamp()
            });

            console.log(`Post ${postId} activated and moved back to active status with status: ${statusToRestore}`);
        } catch (error: any) {
            console.error('Error activating ticket:', error);
            throw new Error(error.message || 'Failed to activate ticket');
        }
    },

    // Helper function to sanitize post data (moved from utils)
    sanitizePostData(postData: any): any {
        if (!postData) return postData;

        const sanitized = { ...postData };

        // Remove undefined values
        Object.keys(sanitized).forEach(key => {
            if (sanitized[key] === undefined) {
                delete sanitized[key];
            }
        });

        return sanitized;
    },

    // Cleanup handover details and photos
    async cleanupHandoverDetailsAndPhotos(postId: string): Promise<{ photosDeleted: number; errors: string[] }> {
        try {
            console.log('🔄 Firebase: cleanupHandoverDetailsAndPhotos called for post:', postId);

            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();
            const handoverDetails = postData.handoverDetails;

            if (!handoverDetails) {
                console.log('ℹ️ No handover details to cleanup for post:', postId);
                return { photosDeleted: 0, errors: [] };
            }

            const photoUrlsToDelete: string[] = [];

            // Collect all photo URLs from handover details
            if (handoverDetails.handoverIdPhoto) {
                photoUrlsToDelete.push(handoverDetails.handoverIdPhoto);
            }
            if (handoverDetails.ownerIdPhoto) {
                photoUrlsToDelete.push(handoverDetails.ownerIdPhoto);
            }
            if (handoverDetails.handoverItemPhotos && Array.isArray(handoverDetails.handoverItemPhotos)) {
                handoverDetails.handoverItemPhotos.forEach((photo: any) => {
                    if (photo.url) {
                        photoUrlsToDelete.push(photo.url);
                    }
                });
            }

            // Delete photos from Cloudinary
            let deletionResult: { deleted: string[]; failed: string[]; success: boolean } = { deleted: [], failed: [], success: false };
            if (photoUrlsToDelete.length > 0) {
                const { deleteMessageImages } = await import('../../utils/cloudinary');
                deletionResult = await deleteMessageImages(photoUrlsToDelete);
            }

            // Clear handover details from post
            await updateDoc(postRef, {
                handoverDetails: null,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Cleaned up handover details for post ${postId}. Photos deleted: ${deletionResult.deleted.length}, Failed: ${deletionResult.failed.length}`);

            return {
                photosDeleted: deletionResult.deleted.length,
                errors: deletionResult.failed
            };
        } catch (error: any) {
            console.error('❌ Firebase cleanupHandoverDetailsAndPhotos failed:', error);
            throw new Error(error.message || 'Failed to cleanup handover details and photos');
        }
    },

    // Cleanup claim details and photos
    async cleanupClaimDetailsAndPhotos(postId: string): Promise<{ photosDeleted: number; errors: string[] }> {
        try {
            console.log('🔄 Firebase: cleanupClaimDetailsAndPhotos called for post:', postId);

            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();
            const claimDetails = postData.claimDetails;

            if (!claimDetails) {
                console.log('ℹ️ No claim details to cleanup for post:', postId);
                return { photosDeleted: 0, errors: [] };
            }

            const photoUrlsToDelete: string[] = [];

            // Collect all photo URLs from claim details
            if (claimDetails.claimerIdPhoto) {
                photoUrlsToDelete.push(claimDetails.claimerIdPhoto);
            }
            if (claimDetails.ownerIdPhoto) {
                photoUrlsToDelete.push(claimDetails.ownerIdPhoto);
            }
            if (claimDetails.evidencePhotos && Array.isArray(claimDetails.evidencePhotos)) {
                claimDetails.evidencePhotos.forEach((photo: any) => {
                    if (photo.url) {
                        photoUrlsToDelete.push(photo.url);
                    }
                });
            }

            // Delete photos from Cloudinary
            let deletionResult: { deleted: string[]; failed: string[]; success: boolean } = { deleted: [], failed: [], success: false };
            if (photoUrlsToDelete.length > 0) {
                const { deleteMessageImages } = await import('../../utils/cloudinary');
                deletionResult = await deleteMessageImages(photoUrlsToDelete);
            }

            // Clear claim details from post
            await updateDoc(postRef, {
                claimDetails: null,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Cleaned up claim details for post ${postId}. Photos deleted: ${deletionResult.deleted.length}, Failed: ${deletionResult.failed.length}`);

            return {
                photosDeleted: deletionResult.deleted.length,
                errors: deletionResult.failed
            };
        } catch (error: any) {
            console.error('❌ Firebase cleanupClaimDetailsAndPhotos failed:', error);
            throw new Error(error.message || 'Failed to cleanup claim details and photos');
        }
    },

    // Flag a post
    async flagPost(postId: string, userId: string, reason: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data() as Post;

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

    // Get soft-deleted posts (admin only)
    async getDeletedPosts(limit: number = 50): Promise<Post[]> {
        try {
            // Create a base query for deleted posts, ordered by deletion date
            const deletedPostsQuery = query(
                collection(db, 'deleted_posts'),
                orderBy('deletedAt', 'desc'),
                firestoreLimit(limit)
            );

            const querySnapshot = await getDocs(deletedPostsQuery);
            const deletedPosts: Post[] = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data() as Post;
                const post: Post = {
                    ...data,
                    id: doc.id,
                    isDeleted: true, // Mark as deleted for UI filtering
                    deletedAt: data.deletedAt || null,
                    deletedBy: data.deletedBy || 'system',
                    // Ensure required fields have defaults if missing
                    title: data.title || 'Untitled Post',
                    description: data.description || '',
                    category: data.category || 'other',
                    location: data.location || 'Unknown location',
                    type: data.type || 'lost',
                    images: data.images || [],
                    creatorId: data.creatorId || 'unknown',
                    user: data.user || {
                        firstName: 'Unknown',
                        lastName: 'User',
                        email: '',
                        contactNum: '',
                        studentId: '',
                        role: 'user'
                    },
                    status: data.status || 'pending',
                    createdAt: data.createdAt || new Date().toISOString(),
                    updatedAt: data.updatedAt || new Date().toISOString()
                };

                deletedPosts.push(post);
            });

            return deletedPosts;
        } catch (error) {
            console.error('Error fetching deleted posts:', error);
            throw new Error('Failed to fetch deleted posts');
        }
    },

    // Restore a soft-deleted post
    async restorePost(postId: string): Promise<void> {
        try {
            const deletedPostRef = doc(db, 'deleted_posts', postId);
            const deletedPostSnap = await getDoc(deletedPostRef);

            if (!deletedPostSnap.exists()) {
                throw new Error('Deleted post not found');
            }

            const postData = deletedPostSnap.data() as Post;
            const originalId = postData.originalId || postId;

            // Remove deleted-specific fields before restoring
            const { deletedAt, deletedBy, originalId: _, isDeleted, ...restoredData } = postData;

            // Create a new post document with the restored data
            const postToRestore: Post = {
                ...restoredData,
                id: originalId,
                updatedAt: serverTimestamp(),
                status: 'pending', // Reset status to pending on restore
                isRestored: true, // Mark as restored for tracking
                // Ensure required fields have values
                title: restoredData.title || 'Restored Post',
                description: restoredData.description || '',
                category: restoredData.category || 'other',
                location: restoredData.location || 'Unknown location',
                type: restoredData.type || 'lost',
                images: restoredData.images || [],
                creatorId: restoredData.creatorId || 'unknown',
                user: restoredData.user || {
                    firstName: 'Unknown',
                    lastName: 'User',
                    email: '',
                    contactNum: '',
                    studentId: '',
                    role: 'user'
                },
                restoredAt: serverTimestamp(), // Track when the post was restored
                restoredBy: getAuth().currentUser?.email || 'admin', // Track who restored the post
                createdAt: restoredData.createdAt || serverTimestamp(),
                // Reset expiry date when restoring
                expiryDate: (() => {
                    const expiry = new Date();
                    expiry.setDate(expiry.getDate() + 30); // 30 days from now
                    return expiry;
                })()
            };

            // Use a batch to ensure atomicity
            const batch = writeBatch(db);

            // Add the post back to the main collection
            const postRef = doc(db, 'posts', originalId);
            batch.set(postRef, postToRestore);

            // Remove from deleted_posts
            batch.delete(deletedPostRef);

            // Commit the batch
            await batch.commit();

            console.log(`♻️ Post ${postId} restored from deleted_posts`);
        } catch (error) {
            console.error('Error restoring post:', error);
            throw new Error('Failed to restore post');
        }
    },

    // Permanently delete a post (from deleted_posts collection)
    async permanentlyDeletePost(postId: string): Promise<void> {
        try {
            // Call the deletePost function directly with hardDelete=true
            await postService.deletePost(postId, true);

            // Also remove from deleted_posts if it exists there
            const deletedPostRef = doc(db, 'deleted_posts', postId);
            await deleteDoc(deletedPostRef).catch(() => {
                // Ignore if not found in deleted_posts
            });

            console.log(`🗑️ Post ${postId} permanently deleted`);
        } catch (error) {
            console.error('Error permanently deleting post:', error);
            throw error; // Re-throw the original error to preserve the error message
        }
    },

    // Get flagged posts (admin only)
    async getFlaggedPosts(): Promise<Post[]> {
        try {
            const q = query(
                collection(db, 'posts'),
                where('isFlagged', '==', true)
            );

            const querySnapshot = await getDocs(q);
            const flaggedPosts: Post[] = [];

            querySnapshot.forEach((doc) => {
                flaggedPosts.push({
                    id: doc.id,
                    ...doc.data()
                } as Post);
            });

            // Sort by flaggedAt (most recently flagged first)
            flaggedPosts.sort((a: Post, b: Post) => {
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
