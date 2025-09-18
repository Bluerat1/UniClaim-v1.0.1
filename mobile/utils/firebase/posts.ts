// Posts service for lost and found items
import { db } from './config';
import {
    doc,
    collection,
    addDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    where,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';

// Import notification sender (mobile service)
import { notificationSender } from './notificationSender';
import { adminNotificationService } from './adminNotifications';

// Post service
export const postService = {
    // Get all posts (deprecated - use getActivePosts instead)
    getAllPosts(callback: (posts: any[]) => void) {
        // For backward compatibility, call getActivePosts
        return this.getActivePosts(callback);
    },

    // Get only active (non-expired) posts
    getActivePosts(callback: (posts: any[]) => void) {
        const now = new Date();
        
        // Create query for active posts only (not moved to unclaimed)
        const q = query(
            collection(db, 'posts'),
            where('movedToUnclaimed', '==', false),
            orderBy('createdAt', 'desc') // Sort by newest first for pagination
        );

        return onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Filter out expired posts and resolved posts on the client side
            const activePosts = posts.filter(post => {
                if (post.movedToUnclaimed) return false;
                if (post.status === 'resolved') return false;
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
            
            callback(activePosts);
        });
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

    // Get user posts
    getUserPosts(userEmail: string, callback: (posts: any[]) => void) {
        console.log('🔍 [DEBUG] getUserPosts: Querying posts for user:', userEmail);

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
                console.log('🔍 [DEBUG] getUserPosts: Found posts count:', posts.length);
                console.log('🔍 [DEBUG] getUserPosts: Sample posts:', posts.slice(0, 2).map((p: any) => ({ id: p.id, title: p.title, userEmail: p.user?.email })));
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

    // Get resolved posts
    getResolvedPosts(callback: (posts: any[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('status', '==', 'resolved'),
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
                originalStatus: postData.status || 'pending',
                // Set expiry date for 30-day lifecycle system
                expiryDate: expiryDate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };



            const postRef = await addDoc(collection(db, 'posts'), enhancedPostData);

            // Send notifications to all users about the new post
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

                console.log('Notifications sent to users and admins for new post:', postRef.id);
            } catch (notificationError) {
                // Don't fail post creation if notifications fail
                console.error('Error sending notifications for post:', postRef.id, notificationError);
            }

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

    // Delete post
    async deletePost(postId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'posts', postId));
        } catch (error: any) {
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
