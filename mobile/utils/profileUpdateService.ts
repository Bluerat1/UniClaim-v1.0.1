import {
    doc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    serverTimestamp,
    collectionGroup,
    arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';

// Interface for user data updates
export interface UserProfileUpdate {
    firstName?: string;
    lastName?: string;
    email?: string;
    contactNum?: string;
    studentId?: string;
    profilePicture?: string;
}

// Interface for the profile update service
export interface ProfileUpdateService {
    updateUserProfile: (userId: string, updates: UserProfileUpdate) => Promise<void>;
    updateUserPosts: (userId: string, updates: UserProfileUpdate) => Promise<void>;
    updateUserConversations: (userId: string, updates: UserProfileUpdate) => Promise<void>;
    updateAllUserData: (userId: string, updates: UserProfileUpdate) => Promise<void>;
}

// Main profile update service implementation
export const profileUpdateService: ProfileUpdateService = {

    // Update the main user document
    async updateUserProfile(userId: string, updates: UserProfileUpdate): Promise<void> {
        try {
            const userRef = doc(db, 'users', userId);

            // Filter out undefined values to prevent Firestore errors
            const filteredUpdates = Object.fromEntries(
                Object.entries(updates).filter(([_, value]) => value !== undefined)
            );

            // Ensure we have updates to make
            if (Object.keys(filteredUpdates).length === 0) {
                console.log('No updates to make, skipping profile update');
                return;
            }

            await updateDoc(userRef, {
                ...filteredUpdates,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error('Error updating user profile:', error);

            // Provide more specific error messages
            if (error.code === 'permission-denied') {
                throw new Error('Permission denied: You may not have access to update this profile. Please contact support if this persists.');
            } else if (error.code === 'not-found') {
                throw new Error('User profile not found. Please try logging out and logging back in.');
            } else {
                throw new Error(`Failed to update user profile: ${error.message}`);
            }
        }
    },

    // Update all posts created by the user
    async updateUserPosts(userId: string, updates: UserProfileUpdate): Promise<void> {
        try {
            // Find all posts where the user is the creator
            const postsQuery = query(
                collection(db, 'posts'),
                where('creatorId', '==', userId)
            );

            const postsSnapshot = await getDocs(postsQuery);

            if (postsSnapshot.empty) {
                return;
            }

            // Prepare batch update
            const batch = writeBatch(db);
            let updateCount = 0;

            postsSnapshot.forEach((postDoc) => {
                const postRef = doc(db, 'posts', postDoc.id);

                // Update the embedded user data in the post
                const postUpdates: any = {
                    updatedAt: serverTimestamp()
                };

                // Only update fields that exist in the updates
                if (updates.firstName !== undefined) {
                    postUpdates['user.firstName'] = updates.firstName;
                }
                if (updates.lastName !== undefined) {
                    postUpdates['user.lastName'] = updates.lastName;
                }
                if (updates.email !== undefined) {
                    postUpdates['user.email'] = updates.email;
                }
                if (updates.contactNum !== undefined) {
                    postUpdates['user.contactNum'] = updates.contactNum;
                }
                if (updates.studentId !== undefined) {
                    postUpdates['user.studentId'] = updates.studentId;
                }

                batch.update(postRef, postUpdates);
                updateCount++;
            });

            // Execute batch update
            await batch.commit();

        } catch (error: any) {
            console.error('Error updating user posts:', error);
            throw new Error(`Failed to update user posts: ${error.message}`);
        }
    },

    // Update conversations where the user participates with profile updates
    async updateUserConversations(userId: string, updates: UserProfileUpdate): Promise<void> {
        try {
            // Early return if no relevant updates for conversations
            if (!updates.firstName && !updates.lastName && !updates.email &&
                !updates.contactNum && !updates.studentId && !updates.profilePicture) {
                return;
            }

            // Get all conversations where user is a participant
            const conversationsQuery = query(
                collection(db, 'conversations'),
                where('participantIds', 'array-contains', userId)
            );
            const conversationsSnapshot = await getDocs(conversationsQuery);

            if (conversationsSnapshot.empty) {
                return;
            }

            const batch = writeBatch(db);
            let updateCount = 0;

            // Process each conversation
            conversationsSnapshot.forEach((conversationDoc) => {
                const conversationData = conversationDoc.data();
                const conversationId = conversationDoc.id;
                const conversationRef = doc(db, 'conversations', conversationId);
                const updatesToApply: any = {};
                let hasUpdates = false;

                // 1. Update participants object
                if (conversationData.participants?.[userId]) {
                    const currentParticipant = conversationData.participants[userId] || {};
                    const updatedParticipant = { ...currentParticipant };

                    // Track if we have any changes
                    let participantChanged = false;

                    // Apply updates to participant
                    if (updates.firstName !== undefined) updatedParticipant.firstName = updates.firstName;
                    if (updates.lastName !== undefined) updatedParticipant.lastName = updates.lastName;
                    if (updates.email !== undefined) updatedParticipant.email = updates.email;
                    if (updates.contactNum !== undefined) updatedParticipant.contactNum = updates.contactNum;
                    if (updates.studentId !== undefined) updatedParticipant.studentId = updates.studentId;
                    if (updates.profilePicture !== undefined) updatedParticipant.profilePicture = updates.profilePicture;

                    // Check if there are actual changes
                    participantChanged = Object.keys(updatedParticipant).some(
                        key => updatedParticipant[key] !== currentParticipant[key]
                    );

                    if (participantChanged) {
                        updatesToApply[`participants.${userId}`] = updatedParticipant;
                        hasUpdates = true;
                    }
                }

                // 2. Update participantInfo object (used by frontend)
                if (conversationData.participantInfo?.[userId]) {
                    const currentInfo = conversationData.participantInfo[userId] || {};
                    const updatedInfo = { ...currentInfo };
                    let infoChanged = false;

                    // Apply updates to participant info
                    if (updates.firstName !== undefined) updatedInfo.firstName = updates.firstName;
                    if (updates.lastName !== undefined) updatedInfo.lastName = updates.lastName;
                    if (updates.email !== undefined) updatedInfo.email = updates.email;
                    if (updates.contactNum !== undefined) updatedInfo.contactNum = updates.contactNum;
                    if (updates.studentId !== undefined) updatedInfo.studentId = updates.studentId;
                    if (updates.profilePicture !== undefined) {
                        updatedInfo.profilePicture = updates.profilePicture;
                        updatedInfo.photoURL = updates.profilePicture; // Also update photoURL for backward compatibility
                    }

                    // Check if there are actual changes
                    infoChanged = Object.keys(updatedInfo).some(
                        key => updatedInfo[key] !== currentInfo[key]
                    );

                    if (infoChanged) {
                        updatesToApply[`participantInfo.${userId}`] = updatedInfo;
                        hasUpdates = true;
                    }
                } else if (updates.profilePicture) {
                    // If participantInfo doesn't exist but we have a profile picture update, create it
                    updatesToApply[`participantInfo.${userId}`] = {
                        ...(updates.firstName && { firstName: updates.firstName }),
                        ...(updates.lastName && { lastName: updates.lastName }),
                        ...(updates.email && { email: updates.email }),
                        ...(updates.contactNum && { contactNum: updates.contactNum }),
                        ...(updates.studentId && { studentId: updates.studentId }),
                        profilePicture: updates.profilePicture,
                        photoURL: updates.profilePicture,
                        updatedAt: serverTimestamp()
                    };
                    hasUpdates = true;
                }

                // 3. If we have updates, add them to the batch
                if (hasUpdates) {
                    // Add timestamp to trigger UI updates
                    updatesToApply.updatedAt = serverTimestamp();

                    // Add to batch
                    batch.update(conversationRef, updatesToApply);
                    updateCount++;
                }
            });

            // Execute batch update if we have changes
            if (updateCount > 0) {
                await batch.commit();
                console.log(`Updated ${updateCount} conversations with user profile changes`);
            }

        } catch (error: any) {
            console.error('Error updating user conversations:', error);
            // Don't throw error for conversations - just log it
            // This allows profile updates to continue even if conversation updates fail
        }
    },

    // Main function to update all user data across collections (PARALLEL PROCESSING)
    async updateAllUserData(userId: string, updates: UserProfileUpdate): Promise<void> {
        try {
            // Update user profile first (must be sequential as it's the primary operation)
            await this.updateUserProfile(userId, updates);

            // If we're updating the profile picture, ensure we have the full URL
            if (updates.profilePicture && !updates.profilePicture.startsWith('http')) {
                console.warn('Profile picture URL does not start with http/https, conversations might not update correctly');
            }

            // Run posts and conversations updates in parallel for better performance
            const [postsResult, conversationsResult] = await Promise.allSettled([
                this.updateUserPosts(userId, updates),
                this.updateUserConversations(userId, updates)
            ]);

            // Log any errors but don't fail the entire operation
            if (postsResult.status === 'rejected') {
                console.warn('Failed to update user posts:', postsResult.reason);
            }

            if (conversationsResult.status === 'rejected') {
                console.error('Failed to update user conversations:', conversationsResult.reason);
                // For profile picture updates, we want to know if this fails
                if (updates.profilePicture) {
                    throw new Error(`Failed to update conversations with new profile picture: ${conversationsResult.reason}`);
                }
            }

        } catch (error: any) {
            console.error('Error in comprehensive user data update:', error);
            throw new Error(`Failed to update all user data: ${error.message}`);
        }
    }
};

export default profileUpdateService;
