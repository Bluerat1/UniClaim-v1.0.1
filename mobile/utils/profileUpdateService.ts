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

    // Update conversations where the user participates (SIMPLIFIED VERSION)
    async updateUserConversations(userId: string, updates: UserProfileUpdate): Promise<void> {
        try {
            // Early return if no relevant updates for conversations
            if (!updates.firstName && !updates.lastName && !updates.email &&
                !updates.contactNum && !updates.studentId && !updates.profilePicture) {
                return;
            }

            // Get all conversations where user is a participant (using participantIds array)
            const conversationsQuery = query(
                collection(db, 'conversations'),
                where('participantIds', 'array-contains', userId)
            );
            const conversationsSnapshot = await getDocs(conversationsQuery);

            if (conversationsSnapshot.empty) {
                return;
            }

            // Single batch for all conversation updates
            const batch = writeBatch(db);
            let updateCount = 0;

            // Update conversations - simplified approach
            conversationsSnapshot.forEach((conversationDoc) => {
                const conversationData = conversationDoc.data();

                // Check if user is actually a participant (handle both object and array structures)
                const isParticipant = conversationData.participants &&
                    (conversationData.participants[userId] ||
                     (Array.isArray(conversationData.participants) && conversationData.participants.includes(userId)));

                if (!isParticipant) {
                    return; // Skip if user not actually a participant
                }

                const currentParticipant = conversationData.participants[userId] || {};
                const updatedParticipant = {
                    ...currentParticipant,
                    ...(updates.firstName !== undefined && { firstName: updates.firstName }),
                    ...(updates.lastName !== undefined && { lastName: updates.lastName }),
                    ...(updates.email !== undefined && { email: updates.email }),
                    ...(updates.contactNum !== undefined && { contactNum: updates.contactNum }),
                    ...(updates.studentId !== undefined && { studentId: updates.studentId }),
                    ...(updates.profilePicture !== undefined && { profilePicture: updates.profilePicture })
                };

                // Only update if there are actual changes
                const hasChanges = Object.keys(updatedParticipant).some(key =>
                    updatedParticipant[key] !== currentParticipant[key]
                );

                if (hasChanges) {
                    const conversationRef = doc(db, 'conversations', conversationDoc.id);
                    batch.update(conversationRef, { 
                        [`participants.${userId}`]: updatedParticipant,
                        participantIds: arrayUnion(userId) // Ensure user is in participantIds
                    });
                    updateCount++;
                }
            });

            // Execute batch update
            if (updateCount > 0) {
                await batch.commit();
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
                console.warn('Failed to update user conversations:', conversationsResult.reason);
            }

        } catch (error: any) {
            console.error('Error in comprehensive user data update:', error);
            throw new Error(`Failed to update all user data: ${error.message}`);
        }
    }
};

export default profileUpdateService;
