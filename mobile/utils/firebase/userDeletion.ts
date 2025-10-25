// User deletion service - handles complete account and data removal
import {
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider,
    type User as FirebaseUser
} from 'firebase/auth';
import {
    doc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    writeBatch,
    serverTimestamp
} from 'firebase/firestore';

// Import Firebase instances and services
import { auth, db } from './config';
import { cloudinaryService } from '../../utils/cloudinary';
import { imageService } from './images';
import { notificationService } from './notifications';

// Helper function to extract Cloudinary public ID from URL
function extractCloudinaryPublicId(url: string): string | null {
    try {
        if (url.includes('res.cloudinary.com')) {
            const urlParts = url.split('/');
            const uploadIndex = urlParts.findIndex(part => part === 'upload');

            if (uploadIndex !== -1) {
                let publicIdParts = urlParts.slice(uploadIndex + 1);

                // Remove version number if present
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
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Helper function to extract all image URLs from a post
function extractPostImages(post: any): string[] {
    const images: string[] = [];

    // Add main post images
    if (post.images && Array.isArray(post.images)) {
        images.push(...post.images);
    }

    // Add single image if exists
    if (post.image && typeof post.image === 'string') {
        images.push(post.image);
    }

    return images.filter(img => img && img.includes('cloudinary.com'));
}

// Helper function to extract images from messages
function extractMessageImages(message: any): string[] {
    const images: string[] = [];

    // Check for handover data images
    if (message.handoverData) {
        if (message.handoverData.idPhotoUrl) {
            images.push(message.handoverData.idPhotoUrl);
        }
        if (message.handoverData.itemPhotos && Array.isArray(message.handoverData.itemPhotos)) {
            message.handoverData.itemPhotos.forEach((photo: any) => {
                if (photo.url) {
                    images.push(photo.url);
                }
            });
        }
    }

    // Check for claim data images
    if (message.claimData) {
        if (message.claimData.idPhotoUrl) {
            images.push(message.claimData.idPhotoUrl);
        }
        if (message.claimData.itemPhotos && Array.isArray(message.claimData.itemPhotos)) {
            message.claimData.itemPhotos.forEach((photo: any) => {
                if (photo.url) {
                    images.push(photo.url);
                }
            });
        }
    }

    return images.filter(img => img && img.includes('cloudinary.com'));
}

// Main user deletion service
export const userDeletionService = {
    // Delete user account and all associated data
    async deleteUserAccount(user: FirebaseUser, password?: string): Promise<void> {
        const userId = user.uid;
        console.log(`🗑️ Starting complete deletion for user: ${userId}`);

        try {
            // Step 0: Re-authenticate user if password is provided
            if (password) {
                console.log(`🔐 Re-authenticating user: ${userId}`);
                const credential = EmailAuthProvider.credential(user.email!, password);
                await reauthenticateWithCredential(user, credential);
                console.log(`✅ User re-authenticated successfully`);
            }

            // Step 1: Delete user's posts and associated images
            await this.deleteUserPosts(userId);

            // Step 2: Delete conversations and notify participants
            await this.deleteUserConversations(userId);

            // Step 3: Delete notifications and subscriptions
            await this.deleteUserNotifications(userId);

            // Step 4: Delete ban records
            await this.deleteUserBanRecords(userId);

            // Step 5: Delete user document
            await this.deleteUserDocument(userId);

            // Step 6: Wait a moment to allow other clients (web app) to detect the document deletion
            console.log('⏳ Waiting for other platforms to detect account deletion...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

            // Step 7: Force token refresh and cleanup to invalidate sessions on other devices
            console.log('🔐 Cleaning up auth tokens and forcing logout on all devices...');
            try {
                // Get a fresh token which will help invalidate old sessions
                await user.getIdToken(true);
            } catch (tokenError) {
                console.warn('Could not refresh token (this is normal during deletion):', tokenError);
            }

            // Step 8: Delete Firebase Auth account
            await deleteUser(user);

            console.log(`✅ Complete deletion successful for user: ${userId}`);

        } catch (error: any) {
            console.error(`❌ Error during user deletion for ${userId}:`, error);

            // Check if it's a re-authentication error
            if (error.code === 'auth/requires-recent-login') {
                throw new Error('Please re-enter your password to confirm account deletion. This is required for security purposes.');
            }

            throw new Error(`Failed to delete user account: ${error.message}`);
        }
    },

    // Delete all posts created by the user
    async deleteUserPosts(userId: string): Promise<void> {
        console.log(`📝 Deleting posts for user: ${userId}`);

        try {
            const postsRef = collection(db, 'posts');
            const userPostsQuery = query(postsRef, where('user.uid', '==', userId));
            const postsSnapshot = await getDocs(userPostsQuery);

            if (postsSnapshot.empty) {
                console.log(`No posts found for user: ${userId}`);
                return;
            }

            const batch = writeBatch(db);
            const allImages: string[] = [];

            // Collect all images and prepare batch delete
            postsSnapshot.docs.forEach(doc => {
                const post = doc.data();
                const postImages = extractPostImages(post);
                allImages.push(...postImages);

                // Add to batch delete
                batch.delete(doc.ref);
            });

            // Execute batch delete
            await batch.commit();
            console.log(`Deleted ${postsSnapshot.docs.length} posts for user: ${userId}`);

            // Delete all images from Cloudinary
            if (allImages.length > 0) {
                await imageService.deleteImages(allImages);
                console.log(`Deleted ${allImages.length} post images from Cloudinary`);
            }

        } catch (error: any) {
            console.error(`Error deleting posts for user ${userId}:`, error);
            throw error;
        }
    },

    // Delete conversations and notify participants
    async deleteUserConversations(userId: string): Promise<void> {
        console.log(`💬 Deleting conversations for user: ${userId}`);

        try {
            const conversationsRef = collection(db, 'conversations');
            const userConversationsQuery = query(conversationsRef, where('participants', 'array-contains', userId));
            const conversationsSnapshot = await getDocs(userConversationsQuery);

            if (conversationsSnapshot.empty) {
                console.log(`No conversations found for user: ${userId}`);
                return;
            }

            const batch = writeBatch(db);
            const allMessageImages: string[] = [];

            // Process each conversation
            for (const conversationDoc of conversationsSnapshot.docs) {
                const conversation = conversationDoc.data();
                const conversationId = conversationDoc.id;

                // Get all participants except the deleting user
                const otherParticipants = conversation.participants.filter((id: string) => id !== userId);

                // Notify other participants about conversation deletion
                if (otherParticipants.length > 0) {
                    await this.notifyConversationDeletion(conversationId, otherParticipants, userId);
                }

                // Delete all messages in the conversation
                const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                const messagesSnapshot = await getDocs(messagesRef);

                // Collect message images and delete messages
                messagesSnapshot.docs.forEach(messageDoc => {
                    const message = messageDoc.data();
                    const messageImages = extractMessageImages(message);
                    allMessageImages.push(...messageImages);

                    batch.delete(messageDoc.ref);
                });

                // Delete the conversation
                batch.delete(conversationDoc.ref);
            }

            // Execute batch delete
            await batch.commit();
            console.log(`Deleted ${conversationsSnapshot.docs.length} conversations for user: ${userId}`);

            // Delete all message images from Cloudinary
            if (allMessageImages.length > 0) {
                await imageService.deleteImages(allMessageImages);
                console.log(`Deleted ${allMessageImages.length} message images from Cloudinary`);
            }

        } catch (error: any) {
            console.error(`Error deleting conversations for user ${userId}:`, error);
            throw error;
        }
    },

    // Notify other participants about conversation deletion
    async notifyConversationDeletion(conversationId: string, participants: string[], deletedUserId: string): Promise<void> {
        try {
            // Create notification for each participant
            const notificationPromises = participants.map(participantId =>
                notificationService.createNotification({
                    userId: participantId,
                    type: 'conversation_deleted',
                    title: 'Conversation Deleted',
                    body: 'A conversation was deleted because one of the participants deleted their account.',
                    data: {
                        conversationId,
                        deletedUserId,
                        timestamp: new Date().toISOString()
                    },
                    conversationId: conversationId
                })
            );

            await Promise.all(notificationPromises);
            console.log(`Notified ${participants.length} participants about conversation deletion`);

        } catch (error: any) {
            console.error('Error notifying participants about conversation deletion:', error);
            // Don't throw error - notification failure shouldn't stop deletion
        }
    },

    // Delete user notifications and subscriptions
    async deleteUserNotifications(userId: string): Promise<void> {
        console.log(`🔔 Deleting notifications for user: ${userId}`);

        try {
            // Delete all notifications for the user
            await notificationService.deleteAllNotifications(userId);

            // Delete notification subscription
            const subscriptionRef = doc(db, 'notifications_subscriptions', userId);
            await deleteDoc(subscriptionRef);

            console.log(`Deleted notifications and subscription for user: ${userId}`);

        } catch (error: any) {
            console.error(`Error deleting notifications for user ${userId}:`, error);
            throw error;
        }
    },

    // Delete user ban records (optional - may fail due to permissions)
    async deleteUserBanRecords(userId: string): Promise<void> {
        console.log(`🚫 Attempting to delete ban records for user: ${userId}`);

        try {
            const userBansRef = collection(db, 'userBans');
            const userBansQuery = query(userBansRef, where('userId', '==', userId));
            const bansSnapshot = await getDocs(userBansQuery);

            if (bansSnapshot.empty) {
                console.log(`No ban records found for user: ${userId}`);
                return;
            }

            const batch = writeBatch(db);
            bansSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log(`Deleted ${bansSnapshot.docs.length} ban records for user: ${userId}`);

        } catch (error: any) {
            // Don't throw error - ban record deletion is optional
            // Users may not have permission to delete ban records
            console.warn(`Could not delete ban records for user ${userId} (this is optional):`, error.message);
            console.log('Continuing with account deletion...');
        }
    },

    // Delete user document and profile picture
    async deleteUserDocument(userId: string): Promise<void> {
        console.log(`👤 Deleting user document for user: ${userId}`);

        try {
            // Get user document to extract profile picture
            const userRef = doc(db, 'users', userId);

            // Try to get the user document first to extract profile picture
            try {
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // Delete profile picture from Cloudinary
                    if (userData.profilePicture && userData.profilePicture.includes('cloudinary.com')) {
                        const publicId = extractCloudinaryPublicId(userData.profilePicture);
                        if (publicId) {
                            await cloudinaryService.deleteImage(publicId);
                            console.log(`Deleted profile picture for user: ${userId}`);
                        }
                    }
                }
            } catch (getError: any) {
                // If we can't get the document, continue anyway - it might already be deleted
                console.warn(`Could not retrieve user document for profile picture cleanup: ${getError.message}`);
            }

            // Delete user document
            await deleteDoc(userRef);
            console.log(`Deleted user document for user: ${userId}`);

        } catch (error: any) {
            console.error(`Error deleting user document for user ${userId}:`, error);
            throw error;
        }
    }
};
