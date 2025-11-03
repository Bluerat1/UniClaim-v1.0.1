import {
    doc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    serverTimestamp
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
            console.log('User profile updated successfully');
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
            // Find all posts where the user is the creator or the original finder in turnoverDetails
            const postsQuery = query(
                collection(db, 'posts'),
                where('creatorId', '==', userId)
            );

            // Also find posts where the user is the original finder in turnoverDetails
            const turnoverPostsQuery = query(
                collection(db, 'posts'),
                where('turnoverDetails.originalFinder.uid', '==', userId)
            );

            const [postsSnapshot, turnoverPostsSnapshot] = await Promise.all([
                getDocs(postsQuery),
                getDocs(turnoverPostsQuery)
            ]);

            // Combine post IDs from both queries, removing duplicates
            const allPostIds = new Set([
                ...postsSnapshot.docs.map(doc => doc.id),
                ...turnoverPostsSnapshot.docs.map(doc => doc.id)
            ]);

            if (allPostIds.size === 0) {
                console.log('No posts found for user, skipping post updates');
                return;
            }

            // Prepare batch update
            const batch = writeBatch(db);
            let updateCount = 0;

            // Process each post
            for (const postId of allPostIds) {
                const postRef = doc(db, 'posts', postId);
                const postDoc = postsSnapshot.docs.find(doc => doc.id === postId) || 
                               turnoverPostsSnapshot.docs.find(doc => doc.id === postId);
                
                if (!postDoc) continue;
                
                const postData = postDoc.data();
                const postUpdates: any = {
                    updatedAt: serverTimestamp()
                };

                // Update user data in the post if the user is the creator
                if (postData.creatorId === userId) {
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
                    if (updates.profilePicture !== undefined) {
                        postUpdates['user.profilePicture'] = updates.profilePicture;
                        postUpdates['user.profileImageUrl'] = updates.profilePicture; // For backward compatibility
                    }
                }

                // Update turnoverDetails.originalFinder if the user is the original finder
                if (postData.turnoverDetails?.originalFinder?.uid === userId) {
                    const updatedOriginalFinder = { ...postData.turnoverDetails.originalFinder };
                    
                    if (updates.firstName !== undefined) {
                        updatedOriginalFinder.firstName = updates.firstName;
                    }
                    if (updates.lastName !== undefined) {
                        updatedOriginalFinder.lastName = updates.lastName;
                    }
                    if (updates.email !== undefined) {
                        updatedOriginalFinder.email = updates.email;
                    }
                    if (updates.contactNum !== undefined) {
                        updatedOriginalFinder.contactNum = updates.contactNum;
                    }
                    if (updates.studentId !== undefined) {
                        updatedOriginalFinder.studentId = updates.studentId;
                    }
                    if (updates.profilePicture !== undefined) {
                        updatedOriginalFinder.profilePicture = updates.profilePicture;
                    }
                    
                    postUpdates['turnoverDetails.originalFinder'] = updatedOriginalFinder;
                }

                batch.update(postRef, postUpdates);
                updateCount++;
            }

            // Execute batch update
            await batch.commit();
            console.log(`Updated ${updateCount} posts for user`);

        } catch (error: any) {
            console.error('Error updating user posts:', error);
            throw new Error(`Failed to update user posts: ${error.message}`);
        }
    },

    // Update conversations where the user participates
    async updateUserConversations(userId: string, updates: UserProfileUpdate): Promise<void> {
        try {
            // Find all conversations where the user is a participant
            const conversationsQuery = query(
                collection(db, 'conversations'),
                where(`participants.${userId}`, '!=', null)
            );

            const conversationsSnapshot = await getDocs(conversationsQuery);

            if (conversationsSnapshot.empty) {
                console.log('No conversations found for user, skipping conversation updates');
                return;
            }

            // Prepare batch update for conversations
            const conversationBatch = writeBatch(db);
            let conversationUpdateCount = 0;

            // Prepare batch update for messages
            const messageBatch = writeBatch(db);
            let messageUpdateCount = 0;

            // Process each conversation
            for (const conversationDoc of conversationsSnapshot.docs) {
                const conversationData = conversationDoc.data();

                // Only update if the user is actually a participant
                if (!conversationData.participants || !conversationData.participants[userId]) {
                    console.log(`User ${userId} not found in conversation ${conversationDoc.id}, skipping`);
                    continue;
                }

                // Update the participant data in the conversation
                const conversationUpdates: any = {};

                // Only update if we have actual changes to make
                let hasConversationUpdates = false;

                if (updates.firstName !== undefined || updates.lastName !== undefined ||
                    updates.email !== undefined || updates.contactNum !== undefined ||
                    updates.studentId !== undefined || updates.profilePicture !== undefined) {

                    // Update participants object
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

                    conversationUpdates[`participants.${userId}`] = updatedParticipant;
                    
                    // Also update participantInfo if it exists
                    if (conversationData.participantInfo && conversationData.participantInfo[userId]) {
                        const currentInfo = conversationData.participantInfo[userId] || {};
                        const updatedInfo = {
                            ...currentInfo,
                            ...(updates.firstName !== undefined && { firstName: updates.firstName }),
                            ...(updates.lastName !== undefined && { lastName: updates.lastName }),
                            ...(updates.firstName !== undefined && updates.lastName !== undefined && { 
                                displayName: `${updates.firstName} ${updates.lastName}`.trim() 
                            }),
                            ...(updates.email !== undefined && { email: updates.email }),
                            ...(updates.contactNum !== undefined && { contactNum: updates.contactNum }),
                            ...(updates.profilePicture !== undefined && { 
                                photoURL: updates.profilePicture,
                                photo: updates.profilePicture 
                            })
                        };
                        conversationUpdates[`participantInfo.${userId}`] = updatedInfo;
                    }
                    
                    hasConversationUpdates = true;
                }

                // Add conversation updates to batch
                if (hasConversationUpdates) {
                    const conversationRef = doc(db, 'conversations', conversationDoc.id);
                    conversationBatch.update(conversationRef, conversationUpdates);
                    conversationUpdateCount++;
                }

                // Update messages where the user is the sender
                if (updates.firstName !== undefined || updates.lastName !== undefined || updates.profilePicture !== undefined) {
                    try {
                        const messagesQuery = query(
                            collection(db, 'conversations', conversationDoc.id, 'messages'),
                            where('senderId', '==', userId)
                        );

                        const messagesSnapshot = await getDocs(messagesQuery);

                        if (!messagesSnapshot.empty) {
                            messagesSnapshot.forEach((messageDoc) => {
                                const messageRef = doc(db, 'conversations', conversationDoc.id, 'messages', messageDoc.id);
                                const messageData = messageDoc.data();

                                const messageUpdates: any = {};

                                // Update sender name if it exists in the message
                                if (messageData.senderName && (updates.firstName !== undefined || updates.lastName !== undefined)) {
                                    const currentFirstName = messageData.senderName.split(' ')[0] || '';
                                    const currentLastName = messageData.senderName.split(' ').slice(1).join(' ') || '';

                                    const newFirstName = updates.firstName !== undefined ? updates.firstName : currentFirstName;
                                    const newLastName = updates.lastName !== undefined ? updates.lastName : currentLastName;

                                    messageUpdates.senderName = `${newFirstName} ${newLastName}`.trim();
                                }

                                // Update sender details if they exist
                                if (updates.firstName !== undefined) {
                                    messageUpdates.senderFirstName = updates.firstName;
                                }
                                if (updates.lastName !== undefined) {
                                    messageUpdates.senderLastName = updates.lastName;
                                }
                                if (updates.profilePicture !== undefined) {
                                    messageUpdates.senderProfilePicture = updates.profilePicture;
                                }

                                // Only add to batch if we have updates
                                if (Object.keys(messageUpdates).length > 0) {
                                    messageBatch.update(messageRef, messageUpdates);
                                    messageUpdateCount++;
                                }
                            });
                        }
                    } catch (messageError: any) {
                        console.warn(`Failed to update messages in conversation ${conversationDoc.id}:`, messageError.message);
                        // Continue with other conversations even if message updates fail
                    }
                }
            }

            // Execute conversation updates batch
            if (conversationUpdateCount > 0) {
                await conversationBatch.commit();
                console.log(`Updated ${conversationUpdateCount} conversations for user`);
            }

            // Execute message updates batch
            if (messageUpdateCount > 0) {
                await messageBatch.commit();
                console.log(`Updated ${messageUpdateCount} messages for user`);
            }

            if (conversationUpdateCount === 0 && messageUpdateCount === 0) {
                console.log('No conversation or message updates needed');
            }

        } catch (error: any) {
            console.error('Error updating user conversations:', error);
            // Don't throw error for conversations - just log it
            // This allows profile updates to continue even if conversation updates fail
            console.warn('Conversation updates failed, but profile update will continue');
        }
    },

    // Main function to update all user data across collections
    async updateAllUserData(userId: string, updates: UserProfileUpdate): Promise<void> {
        try {
            console.log('Starting comprehensive user data update...');

            // Update user profile first
            await this.updateUserProfile(userId, updates);

            // Update user posts
            await this.updateUserPosts(userId, updates);

            // Update user conversations (this won't throw errors now)
            await this.updateUserConversations(userId, updates);

            console.log('All user data updated successfully');

        } catch (error: any) {
            console.error('Error in comprehensive user data update:', error);
            throw new Error(`Failed to update all user data: ${error.message}`);
        }
    }
};

export default profileUpdateService;
