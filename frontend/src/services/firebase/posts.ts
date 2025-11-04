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

// Import notification service for notification cleanup
import { notificationService } from './notifications';

import { adminNotificationService } from './adminNotifications';
import { cacheInvalidation, cacheKeys, userCache, postCache } from '../../utils/advancedCache';
import { notificationSender } from './notificationSender';
import { analyticsService } from './analytics';
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

            // Log analytics for the new post creation
            await analyticsService.logPostCreation(postId, post.type);
            console.log(`📊 [ANALYTICS] Logged ${post.type} post creation for analytics`);

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
                // Check if this is a turnover post - if so, skip notifications until approved
                if (post.turnoverDetails && post.turnoverDetails.turnoverAction) {
                    console.log(`📋 Post ${postId} has turnover details (${post.turnoverDetails.turnoverAction}) - skipping notifications until approved`);
                    return;
                }

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

            // Log analytics for the new post creation
            await analyticsService.logPostCreation(postId, post.type);
            console.log(`📊 [CONCURRENT] Logged ${post.type} post creation for analytics`);

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
    getAllPosts(callback: (posts: Post[]) => void, errorCallback?: (error: any) => void, isServerSide: boolean = false) {
        try {
            // Skip authentication check for server-side operations
            if (!isServerSide) {
                const auth = getAuth();
                if (!auth.currentUser) {
                    const error = new Error('User not authenticated');
                    console.error('PostService: Authentication required to fetch posts:', error);
                    if (errorCallback) {
                        errorCallback(error);
                    }
                    return () => {}; // Return empty cleanup function
                }
            }

            const q = query(
                collection(db, 'posts')
                // orderBy('createdAt', 'desc') // Temporarily commented out
            );

            const unsubscribe = onSnapshot(
                q, 
                (snapshot) => {
                    try {
                        const posts = snapshot.docs.map(doc => {
                            const data = doc.data();
                            return {
                                id: doc.id,
                                ...data,
                                createdAt: data.createdAt?.toDate?.() || data.createdAt
                            } as Post;
                        });

                        // Sort posts by createdAt in JavaScript
                        const sortedPosts = posts.sort((a, b) => {
                            const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                            const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                            return dateB.getTime() - dateA.getTime(); // Most recent first
                        });

                        callback(sortedPosts);
                    } catch (error) {
                        console.error('PostService: Error processing posts:', error);
                        if (errorCallback) {
                            errorCallback(error);
                        }
                    }
                },
                (error) => {
                    console.error('PostService: Error in posts snapshot:', error);
                    if (errorCallback) {
                        errorCallback(error);
                    }
                }
            );

            // Register with ListenerManager for tracking
            const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

            // Return a wrapped unsubscribe function that also removes from ListenerManager
            return () => {
                listenerManager.removeListener(listenerId);
            };
        } catch (error) {
            console.error('PostService: Error setting up posts listener:', error);
            if (errorCallback) {
                errorCallback(error);
            }
            return () => {}; // Return empty cleanup function
        }
    },

    // Get only active (non-expired) posts with real-time updates - OPTIMIZED FOR PERFORMANCE
    getActivePosts(callback: (posts: Post[]) => void) {
        const now = new Date();

        // Create query for active posts only (excluding movedToUnclaimed posts for regular users)
        const q = query(
            collection(db, 'posts'),
            where('movedToUnclaimed', '==', false), // Only posts not moved to unclaimed for regular users
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
                // Note: movedToUnclaimed posts are already filtered out by the database query above
                // but we're keeping this check for safety

                // Exclude resolved, completed, and unclaimed posts from active sections
                if (post.status === 'resolved' || post.status === 'completed' || post.status === 'unclaimed') return false;

                // Exclude hidden posts (flagged posts that admin chose to hide)
                if (post.isHidden === true) return false;

                // Exclude soft-deleted posts
                if (post.deletedAt) return false;

                // Exclude items with turnoverStatus: "declared" ONLY for OSA turnover (awaiting OSA confirmation)
                // Campus Security items with "transferred" status should be visible
                if (post.turnoverDetails &&
                    post.turnoverDetails.turnoverStatus === "declared" &&
                    post.turnoverDetails.turnoverAction === "turnover to OSA") {
                    // Show these posts to regular users for confirmation instead of filtering them out
                    // return false; // Commented out to allow these posts through for user confirmation
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

        // Create query for all posts (no filtering at database level for movedToUnclaimed)
        const q = query(
            collection(db, 'posts')
            // Removed the movedToUnclaimed filter to allow these posts through for admin visibility
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out expired posts and resolved/completed posts on the client side
            // BUT include items with turnoverStatus: "declared" for admin use
            // Also include movedToUnclaimed posts for admin visibility in unclaimed section
            const adminPosts = posts.filter(post => {
                // Don't filter out movedToUnclaimed posts - let frontend handle display logic

                // Exclude resolved, completed, and any other final status posts from active sections
                // These should only appear in the resolved posts section
                if (post.status === 'resolved' || post.status === 'completed') {
                    return false;
                }

                // SPECIAL CASE: Include posts with turnoverStatus "declared" for admin use
                // These are posts awaiting OSA confirmation and should be visible to admins
                if (post.turnoverDetails &&
                    post.turnoverDetails.turnoverStatus === "declared") {
                    return true; // Include these posts for admin visibility
                }

                // Check if post has expired (but allow movedToUnclaimed posts through for admin visibility)
                if (post.expiryDate && !post.movedToUnclaimed) {
                    let expiryDate: Date;

                    // Handle Firebase Timestamp
                    if (post.expiryDate && typeof post.expiryDate === 'object' && 'seconds' in post.expiryDate) {
                        expiryDate = new Date(post.expiryDate.seconds * 1000);
                    } else if (post.expiryDate instanceof Date) {
                        expiryDate = post.expiryDate;
                    } else {
                        expiryDate = new Date(post.expiryDate);
                    }

                    // Return false if post has expired (but allow movedToUnclaimed posts through)
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
            where('status', 'in', ['resolved', 'completed']) // Query for both resolved and completed posts
            // Removed orderBy to avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
            })) as Post[];

            // Sort posts by updatedAt in JavaScript instead (most recent resolution first)
            const sortedPosts = posts.sort((a, b) => {
                const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt || a.createdAt);
                const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt || b.createdAt);
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

    // Cleanup orphaned conversations for posts that are already marked as final status
    async cleanupOrphanedConversationsForFinalStatusPosts(): Promise<{ cleanedPosts: number; totalConversationsDeleted: number }> {
        try {
            console.log('🔄 Starting cleanup of orphaned conversations for posts already marked as final status...');

            // Query for posts that are in final status but might have orphaned conversations
            const finalStatusPostsQuery = query(
                collection(db, 'posts'),
                where('status', 'in', ['resolved', 'completed', 'unclaimed'])
            );

            const postsSnapshot = await getDocs(finalStatusPostsQuery);
            let cleanedPosts = 0;
            let totalConversationsDeleted = 0;

            console.log(`📋 Found ${postsSnapshot.docs.length} posts in final status that may need conversation cleanup`);

            for (const postDoc of postsSnapshot.docs) {
                const postId = postDoc.id;
                const postData = postDoc.data();

                try {
                    // Check if this post has any conversations
                    const conversationsQuery = query(
                        collection(db, 'conversations'),
                        where('postId', '==', postId)
                    );

                    const conversationsSnapshot = await getDocs(conversationsQuery);

                    if (conversationsSnapshot.docs.length > 0) {
                        console.log(`🧹 Post ${postId} (${postData.title}) has ${conversationsSnapshot.docs.length} orphaned conversations - cleaning up`);

                        // Clean up conversations for this post
                        await this.deleteConversationsByPostId(postId);
                        cleanedPosts++;
                        totalConversationsDeleted += conversationsSnapshot.docs.length;

                        console.log(`✅ Cleaned up ${conversationsSnapshot.docs.length} conversations for post ${postId}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to cleanup conversations for post ${postId}:`, error);
                    // Continue with other posts even if one fails
                }
            }

            console.log(`🎯 Orphaned conversation cleanup completed: ${cleanedPosts} posts cleaned, ${totalConversationsDeleted} conversations deleted`);
            return { cleanedPosts, totalConversationsDeleted };

        } catch (error: any) {
            console.error('❌ Failed to cleanup orphaned conversations:', error);
            throw new Error(`Failed to cleanup orphaned conversations: ${error.message}`);
        }
    },

    // Update post status
    async updatePostStatus(postId: string, status: 'pending' | 'resolved' | 'unclaimed' | 'completed', adminNotes?: string, revertReason?: string): Promise<void> {
        try {
            const updateData: any = {
                status,
                updatedAt: serverTimestamp()
            };

            // Add admin notes if provided
            if (adminNotes) {
                updateData.adminNotes = adminNotes;
            }

            // Add revert reason if provided (when reverting to pending)
            if (revertReason && status === 'pending') {
                updateData.revertReason = revertReason;
            }

            await updateDoc(doc(db, 'posts', postId), updateData);

            // If status is changed to 'unclaimed', 'completed', or 'resolved', automatically delete all related conversations
            if (status === 'unclaimed' || status === 'completed' || status === 'resolved') {
                console.log(`🗑️ Post marked as ${status}, deleting all related conversations for post: ${postId}`);
                await this.deleteConversationsByPostId(postId);
                console.log(`✅ Successfully deleted conversations for ${status} post: ${postId}`);
            }
        } catch (error: any) {
            console.error('Error updating post status:', error);
            throw new Error(error.message || 'Failed to update post status');
        }
    },

    // Update OSA turnover confirmation status (admin only)
    async updateOSATurnoverStatus(postId: string, status: 'confirmed' | 'not_received', confirmedBy: string, notes?: string): Promise<void> {
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
            const postData = postDoc.data();
            const originalCreatorId = postDoc.data()?.creatorId;

            // Check if this post has been turned over and use the original finder instead
            const notificationRecipientId = postData?.turnoverDetails?.originalFinder?.uid || originalCreatorId;

            // Update the document
            await updateDoc(doc(db, 'posts', postId), updateData);

            console.log(`✅ Turnover status updated for post ${postId}: ${status}`);
            if (status === 'confirmed') {
                console.log(`✅ Creator changed to admin: ${confirmedBy}`);
                console.log(`✅ User field updated to OSA admin data`);

                // Send notification to the original creator
                if (notificationRecipientId && notificationRecipientId !== confirmedBy) {
                    try {
                        const adminDoc = await getDoc(doc(db, 'users', confirmedBy));
                        const adminData = adminDoc.data();
                        const adminName = adminData ?
                            `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim() || 'an administrator' :
                            'an administrator';

                        const notificationTitle = 'Item Received';
                        const notificationBody = `Your item "${postDoc.data()?.title || 'item'}" has been received by ${adminName}.`;
                        const notificationData = {
                            userId: notificationRecipientId,
                            type: 'claim_update',
                            postId: postId,
                            action: 'item_received',
                            adminId: confirmedBy
                        };

                        // Show the notification
                        await notificationService.showNotification(notificationTitle, notificationBody, notificationData);

                        // Also create a notification record in the database
                        await notificationService.createNotification({
                            userId: notificationRecipientId,
                            type: 'claim_update',
                            title: notificationTitle,
                            body: notificationBody,
                            data: notificationData,
                            postId: postId
                        });

                        console.log(`📬 Sent receipt confirmation notification to user ${notificationRecipientId}`);
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

            // STEP 2: Auto-reject all pending requests before deletion and collect notification data
            console.log(`🔄 Auto-rejecting pending requests for ${conversationsSnapshot.docs.length} conversations`);

            const rejectedRequests: Array<{
                conversationId: string;
                messageId: string;
                requesterId: string;
                requesterName: string;
                requestType: 'claim' | 'handover';
                postTitle: string;
            }> = [];

            for (const convDoc of conversationsSnapshot.docs) {
                const conversationId = convDoc.id;

                try {
                    // Get all messages in this conversation to find pending requests
                    const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    if (messagesSnapshot.docs.length > 0) {
                        // Process each message to find and reject pending requests
                        for (const messageDoc of messagesSnapshot.docs) {
                            const messageData = messageDoc.data();

                            // Check for pending claim requests
                            if (messageData.messageType === 'claim_request' &&
                                messageData.claimData?.status === 'pending') {

                                console.log(`🔄 Auto-rejecting pending claim request in conversation ${conversationId}, message ${messageDoc.id}`);

                                // Collect data for notification before updating
                                rejectedRequests.push({
                                    conversationId,
                                    messageId: messageDoc.id,
                                    requesterId: messageData.senderId,
                                    requesterName: messageData.senderName,
                                    requestType: 'claim',
                                    postTitle: messageData.claimData.postTitle || 'Unknown Post'
                                });

                                // Auto-reject the claim request
                                await updateDoc(messageDoc.ref, {
                                    'claimData.status': 'rejected',
                                    'claimData.respondedAt': serverTimestamp(),
                                    'claimData.responderId': 'system',
                                    'claimData.rejectionReason': 'Post has been deleted'
                                });

                                // Update conversation status
                                await updateDoc(convDoc.ref, {
                                    claimRequestStatus: 'rejected',
                                    updatedAt: serverTimestamp()
                                });

                                console.log(`✅ Auto-rejected claim request: ${messageDoc.id}`);
                            }

                            // Check for pending handover requests
                            if (messageData.messageType === 'handover_request' &&
                                messageData.handoverData?.status === 'pending') {

                                console.log(`🔄 Auto-rejecting pending handover request in conversation ${conversationId}, message ${messageDoc.id}`);

                                // Collect data for notification before updating
                                rejectedRequests.push({
                                    conversationId,
                                    messageId: messageDoc.id,
                                    requesterId: messageData.senderId,
                                    requesterName: messageData.senderName,
                                    requestType: 'handover',
                                    postTitle: messageData.handoverData.postTitle || 'Unknown Post'
                                });

                                // Auto-reject the handover request
                                await updateDoc(messageDoc.ref, {
                                    'handoverData.status': 'rejected',
                                    'handoverData.respondedAt': serverTimestamp(),
                                    'handoverData.responderId': 'system',
                                    'handoverData.rejectionReason': 'Post has been deleted'
                                });

                                // Update conversation status
                                await updateDoc(convDoc.ref, {
                                    handoverRequestStatus: 'rejected',
                                    updatedAt: serverTimestamp()
                                });

                                console.log(`✅ Auto-rejected handover request: ${messageDoc.id}`);
                            }
                        }
                    }
                } catch (error: any) {
                    console.warn(`Failed to process conversation ${conversationId} for request rejection:`, error.message);
                    // Continue with other conversations even if one fails
                }
            }

            // STEP 2.5: Send notifications for auto-rejected requests
            if (rejectedRequests.length > 0) {
                console.log(`📨 Sending notifications for ${rejectedRequests.length} auto-rejected requests`);

                // Group requests by user to send batch notifications
                const userNotifications = new Map<string, Array<typeof rejectedRequests[0]>>();

                for (const request of rejectedRequests) {
                    if (!userNotifications.has(request.requesterId)) {
                        userNotifications.set(request.requesterId, []);
                    }
                    userNotifications.get(request.requesterId)!.push(request);
                }

                // Send notification to each user
                for (const [userId, userRequests] of userNotifications) {
                    try {
                        const requestTypeText = userRequests[0].requestType === 'claim' ? 'claim' : 'handover';
                        const postTitles = userRequests.map(r => r.postTitle).join(', ');

                        await notificationSender.sendNotificationToUser(userId, {
                            type: 'claim_response',
                            title: `${userRequests.length} ${requestTypeText}${userRequests.length > 1 ? 's' : ''} auto-rejected`,
                            body: `Your ${requestTypeText} request${userRequests.length > 1 ? 's' : ''} for "${postTitles}" ${userRequests.length > 1 ? 'have' : 'has'} been automatically rejected because the post${userRequests.length > 1 ? 's were' : ' was'} deleted.`,
                            data: {
                                status: 'rejected',
                                postId: '', // We don't have a single post ID for multiple requests
                                postTitle: postTitles,
                                postCategory: '',
                                postLocation: '',
                                postType: 'lost', // Default, not critical for this notification
                                creatorId: 'system',
                                creatorName: 'System',
                                conversationId: userRequests[0].conversationId // Use first conversation ID
                            }
                        });

                        console.log(`✅ Sent auto-rejection notification to user ${userId} for ${userRequests.length} ${requestTypeText}${userRequests.length > 1 ? 's' : ''}`);
                    } catch (notificationError) {
                        console.warn(`Failed to send auto-rejection notification to user ${userId}:`, notificationError);
                        // Continue with other users even if one fails
                    }
                }
            }

            // STEP 3: Extract all images from all messages before deletion
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

            // STEP 4: Delete all extracted images from Cloudinary
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

            // STEP 5: Create a batch operation for atomic deletion of database records
            const batch = writeBatch(db);

            // STEP 6: Delete messages and conversations in the correct order
            for (const convDoc of conversationsSnapshot.docs) {
                const conversationId = convDoc.id;

                try {
                    // STEP 6a: Delete all messages in the subcollection first
                    const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                    const messagesSnapshot = await getDocs(messagesQuery);

                    if (messagesSnapshot.docs.length > 0) {
                        // Add all messages to the deletion batch
                        messagesSnapshot.docs.forEach(messageDoc => {
                            batch.delete(messageDoc.ref);
                        });
                    }

                    // STEP 6b: Add conversation document to deletion batch
                    batch.delete(convDoc.ref);

                } catch (error: any) {
                    throw new Error(`Failed to process conversation ${conversationId}: ${error.message}`);
                }
            }

            // STEP 7: Execute the batch operation atomically
            await batch.commit();

            // STEP 8: Verify deletion was successful
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

    // Unflag a post (admin only) - also unhides if post is hidden
    async unflagPost(postId: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data() as Post;

            // Check if post is currently hidden
            const isCurrentlyHidden = postData.isHidden === true;

            // Prepare update data - clear flag information
            const updateData: any = {
                isFlagged: false,
                flagReason: null,
                flaggedBy: null,
                flaggedAt: null,
                updatedAt: serverTimestamp()
            };

            // If post is hidden, also unhide it when approving
            if (isCurrentlyHidden) {
                updateData.isHidden = false;
                console.log(`✅ Post ${postId} will be unflagged and unhidden`);
            } else {
                console.log(`✅ Post ${postId} will be unflagged`);
            }

            // Clear flag information and unhide if necessary
            await updateDoc(postRef, updateData);

            // Send notifications based on what actions were performed
            try {
                const adminName = getAuth().currentUser?.displayName || getAuth().currentUser?.email || 'an admin';

                // Always send approval notification
                await notificationSender.sendApproveNotification({
                    postId: postId,
                    postTitle: postData.title,
                    postType: postData.type,
                    creatorId: postData.creatorId,
                    creatorName: `${postData.user.firstName} ${postData.user.lastName}`,
                    adminName: adminName
                });
                console.log(`📨 Approval notification sent to post creator`);

                // If post was also unhidden, send unhide notification
                if (isCurrentlyHidden) {
                    await notificationSender.sendUnhideNotification({
                        postId: postId,
                        postTitle: postData.title,
                        postType: postData.type,
                        creatorId: postData.creatorId,
                        creatorName: `${postData.user.firstName} ${postData.user.lastName}`,
                        adminName: adminName
                    });
                    console.log(`📨 Unhide notification sent to post creator`);
                }
            } catch (notificationError) {
                console.error('❌ Failed to send notification(s):', notificationError);
                // Don't fail the operation if notification fails
            }
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

            const postData = postDoc.data() as Post;

            // Hide the post
            await updateDoc(postRef, {
                isHidden: true,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Post ${postId} hidden from public view`);

            // Send notification to the post creator
            try {
                const adminName = getAuth().currentUser?.displayName || getAuth().currentUser?.email || 'an admin';
                await notificationSender.sendHideNotification({
                    postId: postId,
                    postTitle: postData.title,
                    postType: postData.type,
                    creatorId: postData.creatorId,
                    creatorName: `${postData.user.firstName} ${postData.user.lastName}`,
                    adminName: adminName
                });
                console.log(`📨 Hide notification sent to post creator`);
            } catch (notificationError) {
                console.error('❌ Failed to send hide notification:', notificationError);
                // Don't fail the operation if notification fails
            }
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

            const postData = postDoc.data() as Post;

            // Unhide the post
            await updateDoc(postRef, {
                isHidden: false,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Post ${postId} unhidden and visible to public`);

            // Send notification to the post creator
            try {
                const adminName = getAuth().currentUser?.displayName || getAuth().currentUser?.email || 'an admin';
                await notificationSender.sendUnhideNotification({
                    postId: postId,
                    postTitle: postData.title,
                    postType: postData.type,
                    creatorId: postData.creatorId,
                    creatorName: `${postData.user.firstName} ${postData.user.lastName}`,
                    adminName: adminName
                });
                console.log(`📨 Unhide notification sent to post creator`);
            } catch (notificationError) {
                console.error('❌ Failed to send unhide notification:', notificationError);
                // Don't fail the operation if notification fails
            }
        } catch (error: any) {
            console.error('❌ Firebase unhidePost failed:', error);
            throw new Error(error.message || 'Failed to unhide post');
        }
    },

    // Get soft-deleted posts count only (more efficient for counter)
    async getDeletedPostsCount(): Promise<number> {
        try {
            const deletedPostsQuery = query(collection(db, 'deleted_posts'));
            const querySnapshot = await getDocs(deletedPostsQuery);
            return querySnapshot.size;
        } catch (error) {
            console.error('Error fetching deleted posts count:', error);
            throw new Error('Failed to fetch deleted posts count');
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
            // First check if the post is in deleted_posts collection (which it should be for hard delete)
            const deletedPostRef = doc(db, 'deleted_posts', postId);
            const deletedPostSnap = await getDoc(deletedPostRef);

            if (deletedPostSnap.exists()) {
                // Post is in deleted_posts collection - delete from there and clean up
                const postData = deletedPostSnap.data();

                // Delete all images associated with the post from Cloudinary (with graceful 404 handling)
                if (postData.images && Array.isArray(postData.images)) {
                    console.log(`🗑️ Deleting ${postData.images.length} images from Cloudinary for post ${postId}`);

                    // Use Promise.allSettled to handle partial failures gracefully
                    const deleteResults = await Promise.allSettled(
                        postData.images.map((imageUrl: string) => {
                            const publicId = extractCloudinaryPublicId(imageUrl);
                            if (!publicId) {
                                return Promise.resolve({ success: true, reason: 'No public ID found' });
                            }

                            // Create a wrapper that handles 404 errors gracefully
                            return cloudinaryService.deleteImage(publicId).catch((error: any) => {
                                // If it's a 404 error (image doesn't exist), treat it as successful
                                if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
                                    console.log(`✅ Image ${publicId} not found in Cloudinary (404) - treating as successful deletion`);
                                    return { success: true, reason: 'Image not found in Cloudinary' };
                                }
                                // For other errors, re-throw
                                throw error;
                            }).then((result) => {
                                if (typeof result === 'object' && result.success) {
                                    return result;
                                }
                                return { success: true, reason: 'Deleted successfully' };
                            });
                        })
                    );

                    const successful = deleteResults.filter(result => result.status === 'fulfilled').length;
                    const failed = deleteResults.filter(result => result.status === 'rejected').length;

                    console.log(`✅ Cloudinary deletion: ${successful} succeeded, ${failed} failed`);

                    if (failed > 0) {
                        console.warn(`⚠️ Some images failed to delete from Cloudinary for post ${postId}`);
                    }
                }

                // Clean up conversations associated with this post
                try {
                    console.log(`🧹 Cleaning up conversations for post ${postId}`);
                    const { ghostConversationService } = await import('./conversations');
                    const conversations = await ghostConversationService.findConversationsByPostId(postId);

                    if (conversations.length > 0) {
                        console.log(`Found ${conversations.length} conversations to clean up for post ${postId}`);

                        // Clean up each conversation and its messages
                        for (const conversation of conversations) {
                            try {
                                const { conversationCleanupService } = await import('../../utils/conversationCleanupService');
                                await conversationCleanupService.cleanupConversation(conversation.conversationId);
                                console.log(`✅ Cleaned up conversation ${conversation.conversationId}`);
                            } catch (convError: any) {
                                console.warn(`⚠️ Failed to cleanup conversation ${conversation.conversationId}:`, convError);
                                // Continue with other conversations even if one fails
                            }
                        }
                    }
                } catch (error: any) {
                    console.warn(`⚠️ Failed to cleanup conversations for post ${postId}:`, error);
                    // Continue with post deletion even if conversation cleanup fails
                }

                // Clean up notifications associated with this post
                try {
                    console.log(`🧹 Cleaning up notifications for post ${postId}`);
                    const { notificationService } = await import('./notifications');
                    await notificationService.deleteNotificationsByPostId(postId);
                    console.log(`✅ Cleaned up notifications for post ${postId}`);
                } catch (error: any) {
                    console.warn(`⚠️ Failed to cleanup notifications for post ${postId}:`, error);
                    // Continue with post deletion even if notification cleanup fails
                }

                // Now delete from deleted_posts collection (hard delete)
                await deleteDoc(deletedPostRef);
                console.log(`🗑️ Post ${postId} permanently deleted from deleted_posts`);
            } else {
                // Post is not in deleted_posts - it might be in the main posts collection
                // This could happen if someone tries to permanently delete a post that wasn't soft deleted first
                console.log(`Post ${postId} not found in deleted_posts, checking main posts collection`);
                await postService.deletePost(postId, true);
            }

            console.log(`🗑️ Post ${postId} permanently deleted`);
        } catch (error: any) {
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

            console.log(`✅ Retrieved ${flaggedPosts.length} flagged posts`);
            return flaggedPosts;
        } catch (error: any) {
            console.error('❌ Firebase getFlaggedPosts failed:', error);
            throw new Error(error.message || 'Failed to get flagged posts');
        }
    },

    // Cleanup handover details and photos when reverting a resolution
    async cleanupHandoverDetailsAndPhotos(postId: string): Promise<{ photosDeleted: number; errors: string[] }> {
        try {
            console.log(`🧹 Starting cleanup of handover details and photos for post ${postId}...`);

            // Get the post to access handover details
            const postDoc = await getDoc(doc(db, 'posts', postId));
            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data() as Post;
            const handoverDetails = postData.handoverDetails;

            if (!handoverDetails) {
                console.log('ℹ️ No handover details found for cleanup');
                return { photosDeleted: 0, errors: [] };
            }

            let photosDeleted = 0;
            const errors: string[] = [];

            // Collect all image URLs to delete
            const imageUrls: string[] = [];

            // Add handover item photos
            if (handoverDetails.handoverItemPhotos && Array.isArray(handoverDetails.handoverItemPhotos)) {
                handoverDetails.handoverItemPhotos.forEach((photo: any) => {
                    if (photo.url) {
                        imageUrls.push(photo.url);
                    }
                });
            }

            // Add handover ID photo
            if (handoverDetails.handoverIdPhoto) {
                imageUrls.push(handoverDetails.handoverIdPhoto);
            }

            // Add owner ID photo
            if (handoverDetails.ownerIdPhoto) {
                imageUrls.push(handoverDetails.ownerIdPhoto);
            }

            // Add photos from handoverRequestDetails if they exist
            if (handoverDetails.handoverRequestDetails?.itemPhotos) {
                handoverDetails.handoverRequestDetails.itemPhotos.forEach((photo: any) => {
                    if (photo.url) {
                        imageUrls.push(photo.url);
                    }
                });
            }

            if (handoverDetails.handoverRequestDetails?.idPhotoUrl) {
                imageUrls.push(handoverDetails.handoverRequestDetails.idPhotoUrl);
            }

            if (handoverDetails.handoverRequestDetails?.ownerIdPhoto) {
                imageUrls.push(handoverDetails.handoverRequestDetails.ownerIdPhoto);
            }

            // Delete images from Cloudinary
            if (imageUrls.length > 0) {
                console.log(`🗑️ Deleting ${imageUrls.length} handover photos from Cloudinary`);

                try {
                    const { deleteMessageImages } = await import('../../utils/cloudinary');
                    const result = await deleteMessageImages(imageUrls);

                    photosDeleted = result.deleted.length;
                    console.log(`✅ Cloudinary cleanup result: ${result.deleted.length} deleted, ${result.failed.length} failed`);

                    if (result.failed.length > 0) {
                        errors.push(...result.failed.map((fail: any) => `Failed to delete ${fail.url}: ${fail.error}`));
                    }
                } catch (cloudinaryError) {
                    console.error('❌ Cloudinary deletion failed:', cloudinaryError);
                    errors.push(`Cloudinary deletion failed: ${cloudinaryError}`);
                }
            }

            // Clear handover details from post (but keep the basic info for record)
            await updateDoc(doc(db, 'posts', postId), {
                handoverDetails: null,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Handover cleanup completed: ${photosDeleted} photos deleted`);
            return { photosDeleted, errors };

        } catch (error: any) {
            console.error('❌ Failed to cleanup handover details:', error);
            return { photosDeleted: 0, errors: [error.message || 'Failed to cleanup handover details'] };
        }
    },

    // Cleanup claim details and photos when reverting a resolution
    async cleanupClaimDetailsAndPhotos(postId: string): Promise<{ photosDeleted: number; errors: string[] }> {
        try {
            console.log(`🧹 Starting cleanup of claim details and photos for post ${postId}...`);

            // Get the post to access claim details
            const postDoc = await getDoc(doc(db, 'posts', postId));
            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data() as Post;
            const claimDetails = postData.claimDetails;

            if (!claimDetails) {
                console.log('ℹ️ No claim details found for cleanup');
                return { photosDeleted: 0, errors: [] };
            }

            let photosDeleted = 0;
            const errors: string[] = [];

            // Collect all image URLs to delete
            const imageUrls: string[] = [];

            // Add evidence photos
            if (claimDetails.evidencePhotos && Array.isArray(claimDetails.evidencePhotos)) {
                claimDetails.evidencePhotos.forEach((photo: any) => {
                    if (photo.url) {
                        imageUrls.push(photo.url);
                    }
                });
            }

            // Add claimer ID photo
            if (claimDetails.claimerIdPhoto) {
                imageUrls.push(claimDetails.claimerIdPhoto);
            }

            // Add owner ID photo
            if (claimDetails.ownerIdPhoto) {
                imageUrls.push(claimDetails.ownerIdPhoto);
            }

            // Add photos from claimRequestDetails if they exist
            if (claimDetails.claimRequestDetails?.evidencePhotos) {
                claimDetails.claimRequestDetails.evidencePhotos.forEach((photo: any) => {
                    if (photo.url) {
                        imageUrls.push(photo.url);
                    }
                });
            }

            if (claimDetails.claimRequestDetails?.idPhotoUrl) {
                imageUrls.push(claimDetails.claimRequestDetails.idPhotoUrl);
            }

            if (claimDetails.claimRequestDetails?.ownerIdPhoto) {
                imageUrls.push(claimDetails.claimRequestDetails.ownerIdPhoto);
            }

            // Delete images from Cloudinary
            if (imageUrls.length > 0) {
                console.log(`🗑️ Deleting ${imageUrls.length} claim photos from Cloudinary`);

                try {
                    const { deleteMessageImages } = await import('../../utils/cloudinary');
                    const result = await deleteMessageImages(imageUrls);

                    photosDeleted = result.deleted.length;
                    console.log(`✅ Cloudinary cleanup result: ${result.deleted.length} deleted, ${result.failed.length} failed`);

                    if (result.failed.length > 0) {
                        errors.push(...result.failed.map((fail: any) => `Failed to delete ${fail.url}: ${fail.error}`));
                    }
                } catch (cloudinaryError) {
                    console.error('❌ Cloudinary deletion failed:', cloudinaryError);
                    errors.push(`Cloudinary deletion failed: ${cloudinaryError}`);
                }
            }

            // Clear claim details from post (but keep the basic info for record)
            await updateDoc(doc(db, 'posts', postId), {
                claimDetails: null,
                updatedAt: serverTimestamp()
            });

            console.log(`✅ Claim cleanup completed: ${photosDeleted} photos deleted`);
            return { photosDeleted, errors };

        } catch (error: any) {
            console.error('❌ Failed to cleanup claim details:', error);
            return { photosDeleted: 0, errors: [error.message || 'Failed to cleanup claim details'] };
        }
    },

    // Update turnover status for a post (with confirmation notes)
    async updateTurnoverStatus(
        postId: string,
        status: "confirmed" | "not_received" | "transferred" | "declared",
        confirmedBy: string,
        notes?: string
    ): Promise<void> {
        try {
            console.log(`🔄 Updating turnover status for post ${postId} to ${status}`);

            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data() as Post;

            // Prepare update data
            const updateData: any = {
                'turnoverDetails.turnoverStatus': status,
                'turnoverDetails.confirmedBy': confirmedBy,
                'turnoverDetails.confirmedAt': serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Add confirmation notes if provided
            if (notes && notes.trim()) {
                updateData['turnoverDetails.confirmationNotes'] = notes.trim();
                console.log(`📝 Storing confirmation notes: ${notes.trim()}`);
            }

            // If status is "confirmed" and it's an OSA turnover, update post creator to the admin
            if (status === "confirmed" && postData.turnoverDetails?.turnoverAction === "turnover to OSA") {
                // Get the admin's user data
                const adminRef = doc(db, 'users', confirmedBy);
                const adminDoc = await getDoc(adminRef);

                if (adminDoc.exists()) {
                    const adminData = adminDoc.data();
                    // Update the post creator information to the admin who confirmed
                    updateData.creatorId = confirmedBy;
                    updateData.user = {
                        firstName: adminData.firstName || '',
                        lastName: adminData.lastName || '',
                        email: adminData.email || '',
                        contactNum: adminData.contactNum || '',
                        studentId: adminData.studentId || '',
                        profilePicture: adminData.profilePicture || null,
                        profileImageUrl: adminData.profileImageUrl || null,
                        role: adminData.role || 'admin'
                    };

                    console.log(`👤 Updating post creator to admin: ${adminData.firstName} ${adminData.lastName}`);
                }

                // Set status to "transferred" for OSA items after confirmation
                updateData['turnoverDetails.turnoverStatus'] = "transferred";
                console.log(`🔄 Auto-updating status to "transferred" for OSA turnover item`);
            }

            // If this is a Campus Security post being transferred to OSA, store the original action
            if (status === "confirmed" && postData.turnoverDetails?.turnoverAction === "turnover to Campus Security") {
                // Store the original turnover action before changing it
                updateData['turnoverDetails.originalTurnoverAction'] = "turnover to Campus Security";

                // Change the action to OSA since admin is collecting it
                updateData['turnoverDetails.turnoverAction'] = "turnover to OSA";

                // Get the admin's user data for creator update
                const adminRef = doc(db, 'users', confirmedBy);
                const adminDoc = await getDoc(adminRef);

                if (adminDoc.exists()) {
                    const adminData = adminDoc.data();
                    // Update the post creator information to the admin who confirmed
                    updateData.creatorId = confirmedBy;
                    updateData.user = {
                        firstName: adminData.firstName || '',
                        lastName: adminData.lastName || '',
                        email: adminData.email || '',
                        contactNum: adminData.contactNum || '',
                        studentId: adminData.studentId || '',
                        profilePicture: adminData.profilePicture || null,
                        profileImageUrl: adminData.profileImageUrl || null,
                        role: adminData.role || 'admin'
                    };

                    console.log(`👤 Campus Security post collected by admin: ${adminData.firstName} ${adminData.lastName}`);
                }

                // Set status to "transferred" for Campus Security items collected by admin
                updateData['turnoverDetails.turnoverStatus'] = "transferred";
                console.log(`🔄 Campus Security item transferred to OSA by admin`);
            }

            await updateDoc(postRef, updateData);

            console.log(`✅ Turnover status updated successfully for post ${postId}`);

            // Update existing conversations to reflect the new post creator
            if (status === "confirmed" && (postData.turnoverDetails?.turnoverAction === "turnover to OSA" || postData.turnoverDetails?.turnoverAction === "turnover to Campus Security")) {
                try {
                    console.log(`🔄 Updating conversations for post ${postId} to reflect new creator`);

                    // Query all conversations for this post
                    const { collection, query, where, getDocs } = await import('firebase/firestore');
                    const conversationsQuery = query(
                        collection(db, 'conversations'),
                        where('postId', '==', postId)
                    );
                    const conversationsSnapshot = await getDocs(conversationsQuery);

                    if (!conversationsSnapshot.empty) {
                        const { updateDoc, doc } = await import('firebase/firestore');

                        // Update each conversation
                        for (const convDoc of conversationsSnapshot.docs) {
                            const conversationRef = doc(db, 'conversations', convDoc.id);
                            const conversationData = convDoc.data();

                            // Get the new admin's information
                            const adminRef = doc(db, 'users', confirmedBy);
                            const adminDoc = await getDoc(adminRef);

                            if (adminDoc.exists()) {
                                const adminData = adminDoc.data();

                                // Update conversation participants and post creator info
                                const updatedParticipants = {
                                    ...conversationData.participants
                                };

                                // Update the post owner participant with new admin info
                                if (updatedParticipants[postData.creatorId]) {
                                    updatedParticipants[confirmedBy] = {
                                        uid: confirmedBy,
                                        firstName: adminData.firstName || '',
                                        lastName: adminData.lastName || '',
                                        profilePicture: adminData.profilePicture || null,
                                        joinedAt: updatedParticipants[postData.creatorId]?.joinedAt || serverTimestamp()
                                    };
                                    delete updatedParticipants[postData.creatorId];
                                }

                                await updateDoc(conversationRef, {
                                    postOwnerId: confirmedBy,
                                    postCreatorId: confirmedBy,
                                    participants: updatedParticipants,
                                    updatedAt: serverTimestamp()
                                });

                                console.log(`✅ Updated conversation ${convDoc.id} with new creator`);
                            }
                        }
                    }
                } catch (conversationUpdateError) {
                    console.warn(`⚠️ Failed to update conversations for post ${postId}:`, conversationUpdateError);
                    // Don't fail the main operation if conversation updates fail
                }
            }

            // Send notifications to all users about the status change
            if (status === "confirmed" || status === "transferred") {
                try {
                    console.log(`🔔 Sending status change notification for ${status} post ${postId}`);

                    // Get the updated post data for the notification
                    const updatedPostDoc = await getDoc(postRef);
                    if (updatedPostDoc.exists()) {
                        const updatedPostData = updatedPostDoc.data() as Post;

                        // Get the admin's information for the notification
                        let adminName = 'Admin';
                        if (confirmedBy) {
                            const adminRef = doc(db, 'users', confirmedBy);
                            const adminDoc = await getDoc(adminRef);
                            if (adminDoc.exists()) {
                                const adminData = adminDoc.data();
                                adminName = `${adminData.firstName || ''} ${adminData.lastName || ''}`.trim() || 'Admin';
                            }
                        }

                        // Send status change notification instead of new post notification
                        await notificationSender.sendStatusChangeNotification({
                            postId: postId,
                            postTitle: updatedPostData.title,
                            postType: updatedPostData.type,
                            creatorId: updatedPostData.creatorId,
                            creatorName: adminName,
                            oldStatus: postData.turnoverDetails?.turnoverStatus || 'declared',
                            newStatus: status,
                            adminName: adminName
                        });

                        console.log(`✅ Status change notification sent for ${status} post ${postId}`);
                    }
                } catch (notificationError) {
                    console.error(`❌ Failed to send status change notification for ${status} post ${postId}:`, notificationError);
                    // Don't fail the operation if notification fails
                }
            }

        } catch (error: any) {
            console.error('❌ Failed to update turnover status:', error);
            throw new Error(error.message || 'Failed to update turnover status');
        }
    },

    // Update post status for admin operations (used for activation from unclaimed status)
    async updatePostStatusForAdmin(postId: string, newStatus: string, adminNotes?: string): Promise<void> {
        try {
            console.log(`🔄 Updating post ${postId} status to: ${newStatus}`);

            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();

            // Calculate new expiry date (30 days from now) when activating
            const newExpiryDate = new Date();
            newExpiryDate.setDate(newExpiryDate.getDate() + 30);

            // Prepare update data
            const updateData: any = {
                status: newStatus,
                isExpired: false,
                movedToUnclaimed: false,
                expiryDate: newExpiryDate,
                updatedAt: serverTimestamp()
            };

            // Add admin notes if provided
            if (adminNotes && adminNotes.trim()) {
                const actionTimestamp = serverTimestamp();
                updateData.adminNotes = adminNotes.trim();
                updateData.adminAction = 'activated';
                updateData.adminActionAt = actionTimestamp;
                updateData.updatedAt = actionTimestamp; // ✅ Consistent timestamp
            }

            // If this is restoring from unclaimed, preserve the original status in history
            if (postData.status === 'unclaimed' || postData.movedToUnclaimed) {
                const currentTimestamp = serverTimestamp();

                // Create a simple status change record without complex history
                updateData.statusChangedAt = currentTimestamp;
                updateData.statusChangedFrom = postData.status;
                updateData.statusChangedTo = newStatus;
                updateData.activationNotes = adminNotes || '';
                updateData.activatedBy = 'admin';

                updateData.updatedAt = currentTimestamp;
            }

            await updateDoc(postRef, updateData);
            console.log(`✅ Post ${postId} status updated to ${newStatus}`);

        } catch (error: any) {
            console.error('❌ Failed to update post status:', error);
            throw new Error(error.message || 'Failed to update post status');
        }
    },

    // Delete post and associated images from Cloudinary (only for hard deletes)
    async deletePost(postId: string, isHardDelete: boolean = false, deletedBy?: string): Promise<void> {
        let postDoc: any = null;
        try {
            // First get the post
            postDoc = await getDoc(doc(db, 'posts', postId));
            if (postDoc.exists()) {
                const postData = postDoc.data();

                // Only delete images from Cloudinary for hard deletes
                if (isHardDelete && postData.images && Array.isArray(postData.images)) {
                    console.log(`🗑️ Hard delete: Deleting ${postData.images.length} images from Cloudinary for post ${postId}`);

                    // Use Promise.allSettled to handle partial failures gracefully
                    const deleteResults = await Promise.allSettled(
                        postData.images.map((imageUrl: string) => {
                            const publicId = extractCloudinaryPublicId(imageUrl);
                            if (!publicId) {
                                return Promise.resolve({ success: true, reason: 'No public ID found' });
                            }

                            // Create a wrapper that handles 404 errors gracefully
                            return cloudinaryService.deleteImage(publicId).catch((error: any) => {
                                // If it's a 404 error (image doesn't exist), treat it as successful
                                if (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) {
                                    console.log(`✅ Image ${publicId} not found in Cloudinary (404) - treating as successful deletion`);
                                    return { success: true, reason: 'Image not found in Cloudinary' };
                                }
                                // For other errors, re-throw
                                throw error;
                            }).then((result) => {
                                if (typeof result === 'object' && result.success) {
                                    return result;
                                }
                                return { success: true, reason: 'Deleted successfully' };
                            });
                        })
                    );

                    const successful = deleteResults.filter(result => result.status === 'fulfilled').length;
                    const failed = deleteResults.filter(result => result.status === 'rejected').length;

                    console.log(`✅ Cloudinary deletion: ${successful} succeeded, ${failed} failed`);

                    if (failed > 0) {
                        console.warn(`⚠️ Some images failed to delete from Cloudinary for post ${postId}`);
                    }
                } else if (!isHardDelete) {
                    console.log(`♻️ Soft delete: Preserving images in Cloudinary for post ${postId}`);
                }

            }

            // Clean up conversations associated with this post (only for hard delete)
            if (isHardDelete) {
                try {
                    console.log(`🧹 Cleaning up conversations for post ${postId}`);
                    const { ghostConversationService } = await import('./conversations');
                    const conversations = await ghostConversationService.findConversationsByPostId(postId);

                    if (conversations.length > 0) {
                        console.log(`Found ${conversations.length} conversations to clean up for post ${postId}`);

                        // Clean up each conversation and its messages
                        for (const conversation of conversations) {
                            try {
                                const { conversationCleanupService } = await import('../../utils/conversationCleanupService');
                                await conversationCleanupService.cleanupConversation(conversation.conversationId);
                                console.log(`✅ Cleaned up conversation ${conversation.conversationId}`);
                            } catch (convError: any) {
                                console.warn(`⚠️ Failed to cleanup conversation ${conversation.conversationId}:`, convError);
                                // Continue with other conversations even if one fails
                            }
                        }
                    }
                } catch (error: any) {
                    console.warn(`⚠️ Failed to cleanup conversations for post ${postId}:`, error);
                    // Continue with post deletion even if conversation cleanup fails
                }

                // Clean up notifications associated with this post
                try {
                    console.log(`🧹 Cleaning up notifications for post ${postId}`);
                    const { notificationService } = await import('./notifications');
                    await notificationService.deleteNotificationsByPostId(postId);
                    console.log(`✅ Cleaned up notifications for post ${postId}`);
                } catch (error: any) {
                    console.warn(`⚠️ Failed to cleanup notifications for post ${postId}:`, error);
                    // Continue with post deletion even if notification cleanup fails
                }
            }

            if (isHardDelete) {
                // Hard delete: permanently remove from database
                await deleteDoc(doc(db, 'posts', postId));
                console.log(`🗑️ Post ${postId} permanently deleted from database`);
            } else {
                // Soft delete: move to deleted_posts collection
                const postData = postDoc?.data();

                // Move post to deleted_posts collection
                await setDoc(doc(db, 'deleted_posts', postId), {
                    ...postData,
                    deletedAt: serverTimestamp(),
                    deletedBy: deletedBy || 'admin',
                    originalId: postId // Keep track of original ID for restoration
                });

                // Remove from main posts collection
                await deleteDoc(doc(db, 'posts', postId));
                console.log(`♻️ Post ${postId} soft deleted and moved to deleted_posts`);
            }

        } catch (error: any) {
            console.error('❌ Error in deletePost:', error);
            throw new Error(error.message || 'Failed to delete post');
        }
    },
};
