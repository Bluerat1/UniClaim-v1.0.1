// Import Firebase instances and auth service from authService
import { auth, db } from './authService';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    serverTimestamp,
    onSnapshot,
    deleteField,
    setDoc
} from 'firebase/firestore';

// Import ListenerManager for centralized listener management
import { listenerManager } from './ListenerManager';

// Import Post interface and UserData type
import type { Post } from '../types/Post';
import type { UserData } from './authService';

// Import Cloudinary service and utility functions
import { cloudinaryService } from './cloudinary';

// Import utility functions from separate files
import { sanitizePostData } from './dataSanitizers';
import { sortPostsByCreatedAt, processPostsFromSnapshot } from './postHelpers';
import { extractCloudinaryPublicId } from './imageUtils';

// Image upload service using Cloudinary
export const imageService = {
    // Upload multiple images and return their URLs
    async uploadImages(files: (File | string)[]): Promise<string[]> {
        try {
            return await cloudinaryService.uploadImages(files, 'posts');
        } catch (error: any) {
            console.error('Error uploading images:', error);
            throw new Error(error.message || 'Failed to upload images');
        }
    },

    // Delete images from storage
    async deleteImages(imageUrls: string[]): Promise<void> {
        try {
            if (imageUrls.length === 0) {
                return;
            }

            const deletePromises = imageUrls.map(async (url) => {
                if (url.includes('cloudinary.com')) {
                    // Extract public ID from Cloudinary URL for deletion
                    const publicId = extractCloudinaryPublicId(url);

                    if (publicId) {
                        await cloudinaryService.deleteImage(publicId);
                    }
                }
            });

            await Promise.all(deletePromises);
        } catch (error: any) {
            // Check if it's a Cloudinary configuration issue
            if (error.message?.includes('not configured') || error.message?.includes('credentials')) {
                throw new Error('Cloudinary API credentials not configured. Images cannot be deleted from storage.');
            }

            // Check if it's a permission issue
            if (error.message?.includes('401') || error.message?.includes('permission')) {
                throw new Error('Cloudinary account permissions insufficient. Images cannot be deleted from storage.');
            }

            // Re-throw other errors so the calling function can handle them
            throw new Error(`Failed to delete images from Cloudinary: ${error.message}`);
        }
    },

    // Delete single profile picture from storage and update user profile
    async deleteProfilePicture(profilePictureUrl: string, userId?: string): Promise<void> {
        try {
            if (!profilePictureUrl || !profilePictureUrl.includes('cloudinary.com')) {
                return; // No Cloudinary image to delete
            }

            // Extract public ID from Cloudinary URL for deletion
            const publicId = extractCloudinaryPublicId(profilePictureUrl);

            if (publicId) {
                await cloudinaryService.deleteImage(publicId);

                // If userId is provided, update the user's profile in Firestore
                if (userId) {
                    try {
                        const userRef = doc(db, 'users', userId);
                        await updateDoc(userRef, {
                            profileImageUrl: null,
                            updatedAt: serverTimestamp()
                        });
                    } catch (updateError: any) {
                        console.error('Failed to update user profile in Firestore:', updateError.message);
                        // Don't throw error - image was deleted from Cloudinary successfully
                    }
                }
            }
        } catch (error: any) {
            // Check if it's a Cloudinary configuration issue
            if (error.message?.includes('not configured') || error.message?.includes('credentials')) {
                throw new Error('Cloudinary API credentials not configured. Profile picture cannot be deleted from storage.');
            }

            // Check if it's a permission issue
            if (error.message?.includes('401') || error.message?.includes('permission')) {
                throw new Error('Cloudinary account permissions insufficient. Profile picture cannot be deleted from storage.');
            }

            throw new Error(`Failed to delete profile picture from Cloudinary: ${error.message}`);
        }
    }
};

// Image upload service using Cloudinary function for conversations
export const profilePictureRecoveryService = {
    // Check if a conversation needs profile picture recovery
    needsProfilePictureRecovery(conversation: any): boolean {
        if (!conversation || !conversation.participants) return false;

        return Object.values(conversation.participants).some((participant: any) => {
            return !participant.profilePicture || participant.profilePicture === null;
        });
    },

    // Recover missing profile pictures for a conversation
    async recoverProfilePictures(conversationId: string, conversation: any): Promise<void> {
        try {
            const updates: any = {};
            let hasUpdates = false;

            // Check each participant for missing profile pictures
            for (const [userId, participant] of Object.entries(conversation.participants)) {
                const participantData = participant as any;

                if (!participantData.profilePicture || participantData.profilePicture === null) {
                    try {
                        // Fetch fresh user data from users collection
                        const userDoc = await getDoc(doc(db, 'users', userId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();

                            // Check both field names since mobile uses profileImageUrl and web uses profilePicture
                            const profilePicture = userData.profilePicture || userData.profileImageUrl;

                            if (profilePicture) {
                                updates[`participants.${userId}.profilePicture`] = profilePicture;
                                hasUpdates = true;
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error fetching user data for profile picture recovery:', userId, error);
                    }
                }
            }

            // Update conversation if we have profile pictures to recover
            if (hasUpdates) {
                await updateDoc(doc(db, 'conversations', conversationId), updates);
            }
        } catch (error: any) {
            console.error('❌ Error during profile picture recovery:', error);
            throw new Error('Failed to recover profile pictures: ' + error.message);
        }
    }
};

// User service functions
export const userService = {
    // Update user profile data
    async updateUserProfile(userId: string, updates: Partial<UserData>): Promise<void> {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error('Error updating user profile:', error);
            throw new Error(error.message || 'Failed to update user profile');
        }
    },

    // Get user data by ID
    async getUserById(userId: string): Promise<UserData | null> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                return userDoc.data() as UserData;
            }
            return null;
        } catch (error: any) {
            console.error('Error getting user data:', error);
            throw new Error(error.message || 'Failed to get user data');
        }
    }
};

// Post service functions
export const postService = {
    // Create a new post
    async createPost(postData: Omit<Post, 'id' | 'createdAt' | 'creatorId'>, creatorId: string): Promise<string> {
        try {
            // Generate a unique post ID
            const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Upload images if any
            const imageUrls = postData.images.length > 0
                ? await imageService.uploadImages(postData.images)
                : [];

            // Sanitize post data to ensure no undefined values are sent to Firestore
            const sanitizedPostData = sanitizePostData(postData);

            // Create post document
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
                originalStatus: 'pending'
            };

            // Calculate expiry date (30 days from creation)
            // Note: We'll set this after the post is created since we need the actual timestamp

            // Debug: Log post data being sent to Firestore
            console.log('Creating post with data:', {
                ...post,
                createdAt: 'serverTimestamp()' // Replace actual timestamp for logging
            });

            await setDoc(doc(db, 'posts', postId), post);

            // Set expiry date (30 days from creation) after post is created
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);

            await updateDoc(doc(db, 'posts', postId), {
                expiryDate: expiryDate
            });

            // Send notifications to all users about the new post
            try {
                // Import notification sender dynamically to avoid circular dependencies
                const { notificationSender } = await import('../services/firebase/notificationSender');
                const { adminNotificationService } = await import('../services/firebase/adminNotifications');

                // Get creator information for the notification
                const creatorDoc = await getDoc(doc(db, 'users', creatorId));
                const creatorData = creatorDoc.exists() ? creatorDoc.data() : null;
                const creatorName = creatorData ? `${creatorData.firstName} ${creatorData.lastName}` : 'Someone';
                const creatorEmail = creatorData?.email || 'Unknown';

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

                console.log('Notifications sent to users and admins for new post:', postId);
            } catch (notificationError) {
                // Don't fail post creation if notifications fail
                console.error('Error sending notifications for post:', postId, notificationError);
            }

            return postId;
        } catch (error: any) {
            console.error('Error in post creation:', error);
            throw error;
        }
    },

    // Get all posts with real-time updates (DEPRECATED - use getActivePosts for better performance and filtering)
    getAllPosts(callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('deletedAt', '==', null) // Only include non-deleted posts
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = processPostsFromSnapshot(snapshot);
            callback(posts);
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

    // Get only active (non-expired, non-deleted) posts with real-time updates - OPTIMIZED FOR PERFORMANCE
    getActivePosts(callback: (posts: Post[]) => void) {
        const now = new Date();

        // Create query for active posts only
        const q = query(
            collection(db, 'posts'),
            where('movedToUnclaimed', '==', false), // Only posts not moved to unclaimed
            where('deletedAt', '==', null) // Only non-deleted posts
            // Note: We can't use where('expiryDate', '>', now) in the same query with movedToUnclaimed
            // due to Firestore limitations, so we'll filter expiryDate in the callback
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out expired posts and resolved posts on the client side (this is fast since we're only processing ~20-50 posts)
            const activePosts = posts.filter(post => {
                if (post.movedToUnclaimed) return false;

                // Exclude resolved posts from active sections
                if (post.status === 'resolved') return false;

                // Exclude hidden posts (flagged posts that admin chose to hide)
                if (post.isHidden === true) return false;

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
            const sortedPosts = sortPostsByCreatedAt(activePosts);

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

    // Get posts by type (lost/found)
    getPostsByType(type: 'lost' | 'found', callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('type', '==', type),
            where('deletedAt', '==', null) // Only non-deleted posts
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out resolved posts and hidden posts from active sections
            const filteredPosts = posts.filter(post => post.status !== 'resolved' && post.isHidden !== true);

            // Sort posts by createdAt (most recent first)
            const sortedPosts = sortPostsByCreatedAt(filteredPosts);

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
            where('status', '==', 'resolved'),
            where('deletedAt', '==', null) // Only non-deleted posts
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = processPostsFromSnapshot(snapshot);
            callback(posts.filter(post => post.isHidden !== true)); // Exclude hidden posts
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
            where('category', '==', category),
            where('deletedAt', '==', null) // Only non-deleted posts
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Filter out resolved posts and hidden posts from active sections
            const filteredPosts = posts.filter(post => post.status !== 'resolved' && post.isHidden !== true);

            // Sort posts by createdAt (most recent first)
            const sortedPosts = sortPostsByCreatedAt(filteredPosts);

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
    getUserPosts(userEmail: string, callback: (posts: Post[]) => void, includeDeleted: boolean = false) {
        let q;

        if (includeDeleted) {
            q = query(
                collection(db, 'posts'),
                where('user.email', '==', userEmail)
            );
        } else {
            q = query(
                collection(db, 'posts'),
                where('user.email', '==', userEmail),
                where('deletedAt', '==', null) // Only non-deleted posts
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            // Sort posts by createdAt in JavaScript instead
            const sortedPosts = sortPostsByCreatedAt(posts);

            callback(sortedPosts);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Get a single post by ID
    async getPostById(postId: string): Promise<Post | null> {
        try {
            const postDoc = await getDoc(doc(db, 'posts', postId));
            if (postDoc.exists()) {
                const data = postDoc.data();
                return {
                    id: postDoc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt
                } as Post;
            }
            return null;
        } catch (error: any) {
            console.error('Error fetching post:', error);
            throw new Error(error.message || 'Failed to fetch post');
        }
    },

    // Get deleted posts (admin only)
    async getDeletedPosts(callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('deletedAt', '!=', null) // Only deleted posts
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
                deletedAt: doc.data().deletedAt?.toDate?.() || doc.data().deletedAt
            })) as Post[];

            // Sort by deletion date (most recent first)
            const sortedPosts = posts.sort((a, b) => {
                const dateA = a.deletedAt instanceof Date ? a.deletedAt : new Date(a.deletedAt || 0);
                const dateB = b.deletedAt instanceof Date ? b.deletedAt : new Date(b.deletedAt || 0);
                return dateB.getTime() - dateA.getTime();
            });

            callback(sortedPosts);
        }, (error) => {
            console.error('Error fetching deleted posts:', error);
            callback([]);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'PostService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // Search posts by title or description (excludes deleted posts by default)
    async searchPosts(searchTerm: string, includeDeleted: boolean = false): Promise<Post[]> {
        // Convert search term to lowercase for case-insensitive search
        const term = searchTerm.toLowerCase();

        try {
            // Get all posts and filter in memory (for small to medium datasets this is fine)
            let q;
            if (includeDeleted) {
                q = query(collection(db, 'posts'));
            } else {
                q = query(
                    collection(db, 'posts'),
                    where('deletedAt', '==', null) // Only non-deleted posts
                );
            }
            const postsSnapshot = await getDocs(q);
            const posts = postsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
            })) as Post[];

            const filteredPosts = posts.filter(post =>
                post.isHidden !== true && (
                    post.title.toLowerCase().includes(term) ||
                    post.description.toLowerCase().includes(term) ||
                    post.category.toLowerCase().includes(term) ||
                    post.location.toLowerCase().includes(term)
                )
            );

            return filteredPosts;
        } catch (error: any) {
            console.error('Error searching posts:', error);
            throw new Error(error.message || 'Failed to search posts');
        }
    },

    // Get posts by location
    getPostsByLocation(location: string, callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('location', '==', location),
            where('deletedAt', '==', null) // Only non-deleted posts
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
            const sortedPosts = sortPostsByCreatedAt(filteredPosts);

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

    // Restore a soft-deleted post
    async restorePost(postId: string, restoredBy?: string): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);
            const postDoc = await getDoc(postRef);

            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();

            // Only proceed if the post is actually soft-deleted
            if (!postData.deletedAt) {
                console.log('Post is not deleted, no action needed');
                return;
            }

            const updateData: any = {
                deletedAt: null,
                updatedAt: serverTimestamp(),
                restoredAt: new Date().toISOString()
            };

            if (restoredBy) {
                updateData.restoredBy = restoredBy;
            } else {
                const currentUser = auth.currentUser;
                if (currentUser) {
                    updateData.restoredBy = currentUser.uid;
                }
            }

            // Remove the deletedBy field
            updateData.deletedBy = deleteField();

            await updateDoc(postRef, updateData);

            console.log(`Post ${postId} restored successfully`);
        } catch (error: any) {
            console.error('Error restoring post:', error);
            throw new Error(error.message || 'Failed to restore post');
        }
    },
};

// Import the refactored ghost conversation services
import { conversationValidationService } from './conversationValidationService';
import { conversationCleanupService } from './conversationCleanupService';
import { backgroundCleanupService } from './backgroundCleanupService';

// Re-export the refactored services for backward compatibility
export const ghostConversationService = conversationValidationService;
export { conversationCleanupService, backgroundCleanupService };
