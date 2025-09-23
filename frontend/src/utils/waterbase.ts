// Firebase configuration and initialization
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    sendEmailVerification,
    type User as FirebaseUser,
    type UserCredential
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    writeBatch,
    runTransaction,
    onSnapshot,
    deleteField,
    addDoc,
    arrayUnion,
    increment
} from 'firebase/firestore';
// Note: Firebase Storage imports removed - now using Cloudinary
// import {
//     getStorage,
//     ref,
//     uploadBytes,
//     getDownloadURL,
//     deleteObject
// } from 'firebase/storage';

// Import ListenerManager for centralized listener management
import { listenerManager } from './ListenerManager';

// Firebase configuration from environment variables
// Create a .env file in the frontend folder with your Firebase config:
// VITE_FIREBASE_API_KEY=your-api-key
// VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
// VITE_FIREBASE_PROJECT_ID=your-project-id
// VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
// VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
// VITE_FIREBASE_APP_ID=your-app-id
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCgN70CTX2wQpcgoSZF6AK0fuq7ikcQgNs",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "uniclaim2.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "uniclaim2",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "uniclaim2.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "38339063459",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:38339063459:web:3b5650ebe6fabd352b1916",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-E693CKMPSY"
};

// Initialize Firebase with duplicate check
let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp(); // Use existing app
}

export const auth = getAuth(app);
export const db = getFirestore(app);
// export const storage = getStorage(app); // Removed - using Cloudinary instead

// Import Post interface
import type { Post } from '../types/Post';

// Import Cloudinary service and utility functions
import { cloudinaryService, extractMessageImages, deleteMessageImages } from './cloudinary';

// User data interface for Firestore
export interface UserData {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    contactNum: string;
    studentId: string;
    profilePicture?: string;
    profileImageUrl?: string; // Added to support mobile app field name
    role?: 'user' | 'admin'; // User role for access control
    status?: 'active' | 'deactivated'; // User account status
    banInfo?: any; // Ban information
    emailVerified?: boolean; // Email verification status
    createdAt: any;
    updatedAt: any;
}

// Auth utility functions
export const authService = {
    // Register new user
    async register(
        email: string,
        password: string,
        firstName: string,
        lastName: string,
        contactNum: string,
        studentId: string
    ): Promise<{ user: FirebaseUser; userData: UserData }> {
        try {
            // Create user with email and password
            const userCredential: UserCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            // Update user profile with display name
            await updateProfile(user, {
                displayName: `${firstName} ${lastName}`
            });

            // Create user document in Firestore
            const userData: UserData = {
                uid: user.uid,
                email: user.email!,
                firstName,
                lastName,
                contactNum,
                studentId,
                profilePicture: '/src/assets/empty_profile.jpg', // Set default profile picture
                status: 'active', // Set default status to active - CRITICAL for permissions
                emailVerified: false, // New users need to verify their email
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Ensure the status field is explicitly set to prevent permission issues
            if (!userData.status) {
                userData.status = 'active';
            }

            await setDoc(doc(db, 'users', user.uid), userData);

            // Send email verification
            await sendEmailVerification(user);

            return { user, userData };
        } catch (error: any) {
            throw new Error(error.message || 'Registration failed');
        }
    },

    // Login user
    async login(email: string, password: string): Promise<FirebaseUser> {
        try {
            const userCredential: UserCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );
            return userCredential.user;
        } catch (error: any) {
            throw new Error(error.message || 'Login failed');
        }
    },

    // Logout user
    async logout(): Promise<void> {
        try {
            await signOut(auth);
        } catch (error: any) {
            throw new Error(error.message || 'Logout failed');
        }
    },

    // Get user data from Firestore
    async getUserData(uid: string): Promise<UserData | null> {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            return userDoc.exists() ? userDoc.data() as UserData : null;
        } catch (error: any) {
            console.error('Error fetching user data:', error);
            return null;
        }
    },

    // Update user data in Firestore
    async updateUserData(uid: string, data: Partial<UserData>): Promise<void> {
        try {
            await setDoc(doc(db, 'users', uid), {
                ...data,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to update user data');
        }
    },

    // Get current authenticated user
    getCurrentUser(): FirebaseUser | null {
        return auth.currentUser;
    },

    // Check if user is admin
    async isAdmin(uid: string): Promise<boolean> {
        try {
            const userData = await this.getUserData(uid);
            return userData?.role === 'admin';
        } catch (error: any) {
            console.error('Error checking admin status:', error);
            return false;
        }
    },

    // Create admin user (for initial setup)
    async createAdminUser(
        email: string,
        password: string,
        firstName: string,
        lastName: string,
        contactNum: string,
        studentId: string
    ): Promise<{ user: FirebaseUser; userData: UserData }> {
        try {
            // Create user with email and password
            const userCredential: UserCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = userCredential.user;

            // Update user profile with display name
            await updateProfile(user, {
                displayName: `${firstName} ${lastName}`
            });

            // Create admin user document in Firestore
            const userData: UserData = {
                uid: user.uid,
                email: user.email!,
                firstName,
                lastName,
                contactNum,
                studentId,
                role: 'admin', // Set as admin
                status: 'active', // Ensure admin users also have active status
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Ensure the status field is explicitly set to prevent permission issues
            if (!userData.status) {
                userData.status = 'active';
            }

            await setDoc(doc(db, 'users', user.uid), userData);

            return { user, userData };
        } catch (error: any) {
            throw new Error(error.message || 'Admin user creation failed');
        }
    },

    // Force email verification (for development)
    async forceEmailVerification(email: string, password: string): Promise<void> {
        try {
            // Sign in to get the user
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Force email verification
            if (!user.emailVerified) {
                // This will send a verification email
                await sendEmailVerification(user);
                console.log('Verification email sent to:', email);
            }

            // Sign out after sending verification
            await signOut(auth);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send verification email');
        }
    },

    // Check if user needs email verification
    async needsEmailVerification(user: FirebaseUser, userData: UserData): Promise<boolean> {
        try {
            // Admin and campus security users don't need email verification
            if (userData.role === 'admin' || userData.role === 'campus_security') {
                return false;
            }

            // Check Firebase Auth email verification status
            const firebaseEmailVerified = user.emailVerified;

            // Check Firestore email verification status
            // If emailVerified field is missing, assume true (grandfathered user)
            const firestoreEmailVerified = userData.emailVerified !== undefined ? userData.emailVerified : true;

            // User needs verification if either Firebase or Firestore shows unverified
            return !firebaseEmailVerified || !firestoreEmailVerified;
        } catch (error: any) {
            console.error('Error checking email verification status:', error);
            // Default to requiring verification if there's an error
            return true;
        }
    },

    // Update email verification status in Firestore
    async updateEmailVerificationStatus(uid: string, verified: boolean): Promise<void> {
        try {
            await updateDoc(doc(db, 'users', uid), {
                emailVerified: verified,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error('Error updating email verification status:', error);
            throw new Error('Failed to update email verification status');
        }
    }
};

// Message service functions
export const messageService = {
    // Create a new conversation
    async createConversation(postId: string, postTitle: string, postOwnerId: string, currentUserId: string, currentUserData: UserData, postOwnerUserData?: any): Promise<string> {
        try {
            // Fetch post details to get type, status, and creator ID
            let postType: "lost" | "found" = "lost";
            let postStatus: "pending" | "resolved" | "rejected" = "pending";
            let postCreatorId = postOwnerId; // Default to post owner ID
            let foundAction: "keep" | "turnover to OSA" | "turnover to Campus Security" | null = null;

            try {
                const postDoc = await getDoc(doc(db, 'posts', postId));
                if (postDoc.exists()) {
                    const postData = postDoc.data();
                    postType = postData.type || "lost";
                    postStatus = postData.status || "pending";
                    postCreatorId = postData.creatorId || postOwnerId;
                    // Only set foundAction if it exists and is valid, otherwise keep as null
                    if (postData.foundAction && typeof postData.foundAction === 'string') {
                        // Validate that foundAction is one of the expected values
                        const validFoundActions = ["keep", "turnover to OSA", "turnover to Campus Security"];
                        if (validFoundActions.includes(postData.foundAction)) {
                            foundAction = postData.foundAction as "keep" | "turnover to OSA" | "turnover to Campus Security";
                        }
                    }
                }
            } catch (error) {
                console.warn('Could not fetch post data:', error);
                // Continue with default values if fetch fails
            }

            // Use passed post owner user data or fallback to fetching from users collection
            let postOwnerFirstName = '';
            let postOwnerLastName = '';
            let postOwnerProfilePicture = '';
            // Note: contact number not used in conversation document

            if (postOwnerUserData && postOwnerUserData.firstName && postOwnerUserData.lastName) {
                // Use the passed user data from the post
                postOwnerFirstName = postOwnerUserData.firstName;
                postOwnerLastName = postOwnerUserData.lastName;
                postOwnerProfilePicture = postOwnerUserData.profilePicture || '';

            } else {
                // Fallback: try to fetch from users collection
                try {
                    const postOwnerDoc = await getDoc(doc(db, 'users', postOwnerId));
                    if (postOwnerDoc.exists()) {
                        const postOwnerData = postOwnerDoc.data();
                        postOwnerFirstName = postOwnerData.firstName || '';
                        postOwnerLastName = postOwnerData.lastName || '';
                        postOwnerProfilePicture = postOwnerData.profilePicture || '';
                    }
                } catch (error) {
                    console.warn('Could not fetch post owner data:', error);
                    // Continue with empty values if fetch fails
                }
            }

            // Always ensure we have profile pictures - fetch fresh data if missing
            let currentUserProfilePicture = currentUserData.profilePicture || currentUserData.profileImageUrl || '';
            if (!currentUserProfilePicture) {
                try {
                    const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
                    if (currentUserDoc.exists()) {
                        const freshUserData = currentUserDoc.data();
                        currentUserProfilePicture = freshUserData.profilePicture || freshUserData.profileImageUrl || '';
                    }
                } catch (error) {
                    console.warn('Could not fetch current user data for profile picture:', error);
                }
            }

            if (!postOwnerProfilePicture) {
                try {
                    const postOwnerDoc = await getDoc(doc(db, 'users', postOwnerId));
                    if (postOwnerDoc.exists()) {
                        const freshPostOwnerData = postOwnerDoc.data();
                        postOwnerProfilePicture = freshPostOwnerData.profilePicture || freshPostOwnerData.profileImageUrl || '';
                    }
                } catch (error) {
                    console.warn('Could not fetch post owner data for profile picture:', error);
                }
            }

            // Simple duplicate check: get all user conversations and filter in JavaScript
            const userConversationsQuery = query(
                collection(db, 'conversations'),
                where(`participants.${currentUserId}`, '!=', null)
            );
            const userConversationsSnapshot = await getDocs(userConversationsQuery);
            const existingConversation = userConversationsSnapshot.docs.find((docSnap) => {
                const data: any = docSnap.data();
                return data.postId === postId && data.participants && data.participants[postOwnerId];
            });
            if (existingConversation) {
                console.log('Reusing existing conversation:', existingConversation.id);
                return existingConversation.id;
            }

            const conversationData = {
                postId,
                postTitle,
                // New fields for handover button functionality
                postType,
                postStatus,
                postCreatorId,
                foundAction, // Include foundAction for found items
                participants: {
                    [currentUserId]: {
                        uid: currentUserId,
                        firstName: currentUserData.firstName,
                        lastName: currentUserData.lastName,
                        profilePicture: currentUserProfilePicture || null,
                        joinedAt: serverTimestamp()
                    },
                    [postOwnerId]: {
                        uid: postOwnerId,
                        firstName: postOwnerFirstName,
                        lastName: postOwnerLastName,
                        profilePicture: postOwnerProfilePicture || null,
                        joinedAt: serverTimestamp()
                    }
                },
                createdAt: serverTimestamp()
            };

            // Sanitize conversation data before saving to Firestore
            const sanitizedConversationData = sanitizePostData(conversationData);

            const conversationRef = await addDoc(collection(db, 'conversations'), sanitizedConversationData);

            return conversationRef.id;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create conversation');
        }
    },

    // Send a message
    async sendMessage(conversationId: string, senderId: string, senderName: string, text: string, senderProfilePicture?: string): Promise<void> {
        try {
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            await addDoc(messagesRef, {
                senderId,
                senderName,
                senderProfilePicture: senderProfilePicture || null,
                text,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: "text" // Default message type
            });

            // Get conversation data to find other participants
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();
            const participantIds = Object.keys(conversationData.participants || {});

            // Increment unread count for all participants except the sender
            const otherParticipantIds = participantIds.filter(id => id !== senderId);

            // Prepare unread count updates for each receiver
            const unreadCountUpdates: { [key: string]: any } = {};
            otherParticipantIds.forEach(participantId => {
                unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
            });

            // Update conversation with last message and increment unread counts for other participants
            // Use current timestamp for lastMessage to prevent jumping during sorting
            const currentTimestamp = new Date();
            await updateDoc(conversationRef, {
                lastMessage: {
                    text,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates
            });

            // 🔒 Cleanup old messages after sending to maintain 50-message limit
            try {
                await this.cleanupOldMessages(conversationId);
            } catch (cleanupError) {
                console.warn('⚠️ [sendMessage] Message cleanup failed, but message was sent successfully:', cleanupError);
                // Don't throw error - cleanup failure shouldn't break message sending
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send message');
        }
    },

    // Send a handover request message
    async sendHandoverRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, handoverReason?: string, idPhotoUrl?: string, itemPhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            // First, check if this conversation already has a handover request
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();

            // Check if this is a lost item (only allow handover for lost items)
            if (conversationData.postType !== 'lost') {
                throw new Error('Handover requests are only allowed for lost items');
            }

            // Check if a handover request already exists
            if (conversationData.handoverRequested === true) {
                throw new Error('You have already requested a handover in this conversation');
            }

            const messagesRef = collection(db, 'conversations', conversationId, 'messages');

            // Validate handover data before creating message
            const isProduction = process.env.NODE_ENV === 'production';
            const logLevel = isProduction ? console.warn : console.log;

            logLevel('🔍 Validating handover data before Firestore storage...');
            logLevel('🔍 ID photo URL provided:', idPhotoUrl ? 'yes' : 'no');
            logLevel('🔍 Item photos array provided:', itemPhotos ? 'yes' : 'no');
            logLevel('🔍 Item photos length:', itemPhotos?.length || 0);

            // Validate ID photo URL
            if (!idPhotoUrl || typeof idPhotoUrl !== 'string' || !idPhotoUrl.includes('cloudinary.com')) {
                console.error('❌ Invalid ID photo URL in sendHandoverRequest:', {
                    idPhotoUrl: idPhotoUrl ? idPhotoUrl.substring(0, 50) + '...' : 'null',
                    type: typeof idPhotoUrl,
                    isCloudinary: idPhotoUrl?.includes('cloudinary.com')
                });
                throw new Error('Invalid ID photo URL provided to sendHandoverRequest');
            }

            // Validate item photos array
            if (!Array.isArray(itemPhotos) || itemPhotos.length === 0) {
                console.error('❌ Invalid item photos array in sendHandoverRequest:', {
                    isArray: Array.isArray(itemPhotos),
                    length: itemPhotos?.length || 0,
                    itemPhotos: itemPhotos
                });
                throw new Error('Invalid item photos array provided to sendHandoverRequest');
            }

            // Validate each item photo object
            itemPhotos.forEach((photo, index) => {
                if (!photo || typeof photo !== 'object') {
                    console.error(`❌ Item photo ${index} is not an object:`, photo);
                    throw new Error(`Invalid item photo object at index ${index}`);
                }

                if (!photo.url || typeof photo.url !== 'string' || !photo.url.includes('cloudinary.com')) {
                    console.error(`❌ Item photo ${index} has invalid URL:`, {
                        url: photo.url ? photo.url.substring(0, 50) + '...' : 'missing',
                        type: typeof photo.url,
                        isCloudinary: photo.url?.includes('cloudinary.com'),
                        photo: photo
                    });
                    throw new Error(`Invalid URL in item photo at index ${index}`);
                }

                logLevel(`✅ Item photo ${index} validation passed:`, photo.url.split('/').pop());
            });

            logLevel('✅ All handover data validated, creating message...');

            const handoverMessage = {
                senderId,
                senderName,
                senderProfilePicture: senderProfilePicture || null,
                text: handoverReason ? `I would like to handover the item "${postTitle}" to you. Reason: ${handoverReason}` : `I would like to handover the item "${postTitle}" to you.`,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: "handover_request",
                handoverData: {
                    postId,
                    postTitle,
                    status: "pending",
                    requestedAt: serverTimestamp(),
                    handoverReason: handoverReason || null,
                    idPhotoUrl: idPhotoUrl,
                    itemPhotos: itemPhotos
                }
            };

            logLevel('💾 Storing handover message in Firestore...');
            await addDoc(messagesRef, handoverMessage);
            logLevel('✅ Handover message stored successfully');

            // Get conversation data to find other participants for unread count updates
            const conversationDataForUnread = await getDoc(conversationRef);
            const participantIds = Object.keys(conversationDataForUnread.data()?.participants || {});

            // Increment unread count for all participants except the sender
            const otherParticipantIds = participantIds.filter(id => id !== senderId);

            // Prepare unread count updates for each receiver
            const unreadCountUpdates: { [key: string]: any } = {};
            otherParticipantIds.forEach(participantId => {
                unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
            });

            // Update conversation with handover request flag, last message, and unread counts
            // Use current timestamp for lastMessage to prevent jumping during sorting
            const currentTimestamp = new Date();
            await updateDoc(conversationRef, {
                handoverRequested: true,
                lastMessage: {
                    text: handoverMessage.text,
                    senderId,
                    timestamp: currentTimestamp
                },
                ...unreadCountUpdates
            });

            // 🔒 Cleanup old messages after sending to maintain 50-message limit
            try {
                await this.cleanupOldMessages(conversationId);
            } catch (cleanupError) {
                console.warn('⚠️ [sendHandoverRequest] Message cleanup failed, but handover request was sent successfully:', cleanupError);
                // Don't throw error - cleanup failure shouldn't break handover request
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send handover request');
        }
    },

    // Send a claim request message
    async sendClaimRequest(conversationId: string, senderId: string, senderName: string, senderProfilePicture: string, postId: string, postTitle: string, claimReason?: string, idPhotoUrl?: string, evidencePhotos?: { url: string; uploadedAt: any; description?: string }[]): Promise<void> {
        try {
            // First, check if this conversation already has a claim request
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();

            // Check if this is a found item with "keep" action (only allow claims for found items that are being kept)
            if (conversationData.postType !== 'found') {
                throw new Error('Claim requests are only allowed for found items');
            }

            if (conversationData.foundAction !== 'keep') {
                throw new Error('Claim requests are only allowed for found items that are being kept');
            }

            // Check if a claim request already exists
            if (conversationData.claimRequested === true) {
                throw new Error('You have already requested to claim this item in this conversation');
            }

            const messagesRef = collection(db, 'conversations', conversationId, 'messages');

            // Validate claim data before creating message
            const isProduction = process.env.NODE_ENV === 'production';
            const logLevel = isProduction ? console.warn : console.log;

            logLevel('🔍 Validating claim data before Firestore storage...');
            logLevel('🔍 ID photo URL provided:', idPhotoUrl ? 'yes' : 'no');
            logLevel('🔍 Evidence photos array provided:', evidencePhotos ? 'yes' : 'no');
            logLevel('🔍 Evidence photos length:', evidencePhotos?.length || 0);

            // Validate ID photo URL
            if (!idPhotoUrl || typeof idPhotoUrl !== 'string' || !idPhotoUrl.includes('cloudinary.com')) {
                console.error('❌ Invalid ID photo URL in sendClaimRequest:', {
                    idPhotoUrl: idPhotoUrl ? idPhotoUrl.substring(0, 50) + '...' : 'null',
                    type: typeof idPhotoUrl,
                    isCloudinary: idPhotoUrl?.includes('cloudinary.com')
                });
                throw new Error('Invalid ID photo URL provided to sendClaimRequest');
            }

            // Validate evidence photos array
            if (!Array.isArray(evidencePhotos) || evidencePhotos.length === 0) {
                console.error('❌ Invalid evidence photos array in sendClaimRequest:', {
                    isArray: Array.isArray(evidencePhotos),
                    length: evidencePhotos?.length || 0,
                    evidencePhotos: evidencePhotos
                });
                throw new Error('Invalid evidence photos array provided to sendClaimRequest');
            }

            // Validate each evidence photo object
            evidencePhotos.forEach((photo, index) => {
                if (!photo || typeof photo !== 'object') {
                    console.error(`❌ Evidence photo ${index} is not an object:`, photo);
                    throw new Error(`Invalid evidence photo object at index ${index}`);
                }

                if (!photo.url || typeof photo.url !== 'string' || !photo.url.includes('cloudinary.com')) {
                    console.error(`❌ Evidence photo ${index} has invalid URL:`, {
                        url: photo.url ? photo.url.substring(0, 50) + '...' : 'missing',
                        type: typeof photo.url,
                        isCloudinary: photo.url?.includes('cloudinary.com'),
                        photo: photo
                    });
                    throw new Error(`Invalid URL in evidence photo at index ${index}`);
                }

                logLevel(`✅ Evidence photo ${index} validation passed:`, photo.url.split('/').pop());
            });

            logLevel('✅ All claim data validated, creating message...');

            const claimMessage = {
                senderId,
                senderName,
                senderProfilePicture: senderProfilePicture || null,
                text: `I would like to claim the item "${postTitle}" as my own.`,
                timestamp: serverTimestamp(),
                readBy: [senderId],
                messageType: "claim_request",
                claimData: {
                    postId,
                    postTitle,
                    status: "pending",
                    requestedAt: serverTimestamp(),
                    claimReason: claimReason || null,
                    idPhotoUrl: idPhotoUrl,
                    evidencePhotos: evidencePhotos
                }
            };

            logLevel('💾 Storing claim message in Firestore...');
            await addDoc(messagesRef, claimMessage);
            logLevel('✅ Claim message stored successfully');

            // Get conversation data to find other participants for unread count updates
            const conversationDataForUnread = await getDoc(conversationRef);
            const participantIds = Object.keys(conversationDataForUnread.data()?.participants || {});

            // Increment unread count for all participants except the sender
            const otherParticipantIds = participantIds.filter(id => id !== senderId);

            // Prepare unread count updates for each receiver
            const unreadCountUpdates: { [key: string]: any } = {};
            otherParticipantIds.forEach(participantId => {
                unreadCountUpdates[`unreadCounts.${participantId}`] = increment(1);
            });

            // Update conversation with claim request flag, last message, and unread counts
            await updateDoc(conversationRef, {
                claimRequested: true,
                lastMessage: {
                    text: claimMessage.text,
                    senderId,
                    timestamp: claimMessage.timestamp
                },
                ...unreadCountUpdates
            });

            // 🔒 Cleanup old messages after sending to maintain 50-message limit
            try {
                await this.cleanupOldMessages(conversationId);
            } catch (cleanupError) {
                console.warn('⚠️ [sendClaimRequest] Message cleanup failed, but claim request was sent successfully:', cleanupError);
                // Don't throw error - cleanup failure shouldn't break claim request
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send claim request');
        }
    },

    // Update claim response
    async updateClaimResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', responderId: string, idPhotoUrl?: string): Promise<void> {
        try {
            console.log('🔄 Firebase: updateClaimResponse called with:', { conversationId, messageId, status, responderId, idPhotoUrl });
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // Update the claim message with the response
            const updateData: any = {
                'claimData.status': status,
                'claimData.respondedAt': serverTimestamp(),
                'claimData.responderId': responderId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                updateData['claimData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with separate field name
                updateData['claimData.status'] = 'pending_confirmation'; // New status for photo confirmation
            }

            await updateDoc(messageRef, updateData);

            // If claim is rejected, delete all photos and reset the claimRequested flag
            if (status === 'rejected') {
                console.log('🗑️ Firebase: Claim rejected, starting photo deletion process...');
                try {
                    // Step 1: Extract all photos from the claim message
                    const messageDoc = await getDoc(messageRef);
                    if (messageDoc.exists()) {
                        const messageData = messageDoc.data();
                        console.log('🗑️ Firebase: Message data retrieved:', messageData);
                        const imageUrls = extractMessageImages(messageData);
                        console.log('🗑️ Firebase: Extracted image URLs:', imageUrls);

                        // Step 2: Delete photos from Cloudinary
                        if (imageUrls.length > 0) {
                            try {
                                console.log('🗑️ Attempting to delete photos:', imageUrls);
                                const deletionResult = await deleteMessageImages(imageUrls);
                                console.log('🗑️ Deletion result:', deletionResult);
                                console.log('✅ Photos deleted after claim rejection:', imageUrls.length);

                                // Step 3: Clear photo URLs from the message data in database
                                const photoCleanupData: any = {};

                                // Clear ID photo URL
                                if (messageData.claimData?.idPhotoUrl) {
                                    photoCleanupData['claimData.idPhotoUrl'] = null;
                                }

                                // Clear owner's ID photo URL
                                if (messageData.claimData?.ownerIdPhoto) {
                                    photoCleanupData['claimData.ownerIdPhoto'] = null;
                                }

                                // Clear evidence photos array
                                if (messageData.claimData?.evidencePhotos && messageData.claimData.evidencePhotos.length > 0) {
                                    photoCleanupData['claimData.evidencePhotos'] = [];
                                }

                                // Clear legacy verification photos array
                                if (messageData.claimData?.verificationPhotos && messageData.claimData.verificationPhotos.length > 0) {
                                    photoCleanupData['claimData.verificationPhotos'] = [];
                                }

                                // Add photos deleted indicator to the message
                                photoCleanupData['claimData.photosDeleted'] = true;
                                photoCleanupData['claimData.photosDeletedAt'] = serverTimestamp();

                                // Update the message to remove photo references and add deletion indicator
                                if (Object.keys(photoCleanupData).length > 0) {
                                    await updateDoc(messageRef, photoCleanupData);
                                    console.log('✅ Photo URLs cleared from database and deletion indicator added:', photoCleanupData);
                                }

                            } catch (photoError: any) {
                                console.warn('⚠️ Failed to delete photos after rejection:', photoError.message);
                                // Continue with rejection even if photo cleanup fails
                            }
                        }
                    }
                } catch (photoExtractionError: any) {
                    console.warn('⚠️ Failed to extract photos for deletion:', photoExtractionError.message);
                    // Continue with rejection even if photo extraction fails
                }

                // Step 4: Reset conversation flags
                const conversationRef = doc(db, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    claimRequested: false
                });
            }

            // Note: No new chat bubble is created - only the status is updated
            // The existing claim request message will show the updated status

        } catch (error: any) {
            throw new Error(error.message || 'Failed to update claim response');
        }
    },

    // Confirm ID photo for claim
    async confirmClaimIdPhoto(conversationId: string, messageId: string, confirmBy: string): Promise<void> {
        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // STEP 1: Update the claim message to confirm the ID photo
            await updateDoc(messageRef, {
                'claimData.idPhotoConfirmed': true,
                'claimData.idPhotoConfirmedAt': serverTimestamp(),
                'claimData.idPhotoConfirmedBy': confirmBy,
                'claimData.status': 'accepted' // Final status after confirmation
            });

            console.log('✅ Claim ID photo confirmed successfully');

            // STEP 2: Get conversation data to retrieve postId and prepare claim details
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationSnap = await getDoc(conversationRef);

            if (conversationSnap.exists()) {
                const conversationData = conversationSnap.data();
                const postId = conversationData.postId;

                if (postId) {
                    // STEP 3: Get the claim message data to extract claim details
                    const messageSnap = await getDoc(messageRef);
                    if (messageSnap.exists()) {
                        const messageData = messageSnap.data();
                        const claimData = messageData.claimData;

                        if (claimData) {
                            // STEP 4: Get claimer user data
                            const claimerId = messageData.senderId;
                            const claimerDoc = await getDoc(doc(db, 'users', claimerId));
                            const claimerData = claimerDoc.exists() ? claimerDoc.data() : null;

                            // STEP 5: Get owner user data
                            const ownerDoc = await getDoc(doc(db, 'users', confirmBy));
                            const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;
                            const ownerName = ownerData ? `${ownerData.firstName || ''} ${ownerData.lastName || ''}`.trim() : 'Unknown';

                            // STEP 6: Prepare claim request details for the post
                            const claimRequestDetails = {
                                // Original message details
                                messageId: messageId,
                                messageText: messageData.text || '',
                                messageTimestamp: messageData.timestamp,
                                senderId: messageData.senderId,
                                senderName: messageData.senderName || '',
                                senderProfilePicture: messageData.senderProfilePicture || '',

                                // Claim data from the message
                                claimReason: claimData.claimReason || '',
                                claimRequestedAt: claimData.requestedAt || null,
                                claimRespondedAt: claimData.respondedAt || null,
                                claimResponseMessage: claimData.responseMessage || '',

                                // ID photo verification details
                                idPhotoUrl: claimData.idPhotoUrl || '',
                                idPhotoConfirmed: true,
                                idPhotoConfirmedAt: serverTimestamp(),
                                idPhotoConfirmedBy: confirmBy,

                                // Evidence photos
                                evidencePhotos: claimData.evidencePhotos || [],
                                evidencePhotosConfirmed: claimData.evidencePhotosConfirmed || false,
                                evidencePhotosConfirmedAt: claimData.evidencePhotosConfirmedAt || null,
                                evidencePhotosConfirmedBy: claimData.evidencePhotosConfirmedBy || '',

                                // Owner verification details
                                ownerIdPhoto: claimData.ownerIdPhoto || '',
                                ownerIdPhotoConfirmed: claimData.ownerIdPhotoConfirmed || false,
                                ownerIdPhotoConfirmedAt: claimData.ownerIdPhotoConfirmedAt || null,
                                ownerIdPhotoConfirmedBy: claimData.ownerIdPhotoConfirmedBy || ''
                            };

                            // STEP 7: Add claim confirmed timestamp to request details
                            claimRequestDetails.claimConfirmedAt = serverTimestamp();
                            claimRequestDetails.claimConfirmedBy = confirmBy;

                            // Prepare claim details for the post
                            const claimDetails = {
                                claimerName: claimerData ? `${claimerData.firstName || ''} ${claimerData.lastName || ''}`.trim() : 'Unknown',
                                claimerContact: claimerData?.contactNum || '',
                                claimerStudentId: claimerData?.studentId || '',
                                claimerEmail: claimerData?.email || '',
                                evidencePhotos: claimData.evidencePhotos || [],
                                claimerIdPhoto: claimData.idPhotoUrl || '',
                                ownerIdPhoto: claimData.ownerIdPhoto || '',
                                claimConfirmedAt: serverTimestamp(),
                                claimConfirmedBy: confirmBy,
                                ownerName: ownerName,
                                // Store the complete claim request chat bubble details
                                claimRequestDetails: claimRequestDetails
                            };

                            // STEP 8: Get all messages from the conversation to preserve the chat history
                            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                            const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
                            const messagesSnap = await getDocs(messagesQuery);

                            const conversationMessages = messagesSnap.docs.map(doc => ({
                                id: doc.id,
                                ...doc.data()
                            }));

                            // STEP 9: Prepare conversation data, ensuring no undefined values
                            const conversationUpdateData: any = {
                                conversationId: conversationId,
                                messages: conversationMessages,
                                participants: conversationData.participants || {},
                                createdAt: conversationData.createdAt || serverTimestamp()
                            };
                            
                            // Only include lastMessage if it exists
                            if (conversationData.lastMessage) {
                                conversationUpdateData.lastMessage = conversationData.lastMessage;
                            }

                            // Update post with claim details, status, and conversation data
                            await updateDoc(doc(db, 'posts', postId), {
                                status: 'resolved',
                                claimDetails: claimDetails,
                                conversationData: conversationUpdateData,
                                updatedAt: serverTimestamp()
                            });

                            console.log('✅ Post updated with complete claim details and conversation data:', postId);
                            console.log('✅ Claim request chat bubble details preserved in post');

                            // STEP 10: Delete the conversation after successful data preservation
                            try {
                                console.log('🗑️ Starting conversation deletion after successful claim confirmation...');

                                // Delete all messages in the conversation first
                                const messagesToDelete = messagesSnap.docs.map(doc => doc.ref);
                                if (messagesToDelete.length > 0) {
                                    const deleteBatch = writeBatch(db);
                                    messagesToDelete.forEach(messageRef => {
                                        deleteBatch.delete(messageRef);
                                    });
                                    await deleteBatch.commit();
                                    console.log(`✅ Deleted ${messagesToDelete.length} messages from conversation`);
                                }

                                // Delete the conversation document
                                await deleteDoc(conversationRef);
                                console.log('✅ Conversation deleted successfully');

                            } catch (deleteError: any) {
                                console.error('❌ Failed to delete conversation after claim confirmation:', deleteError);
                                // Don't throw error here as the main operation (claim confirmation) was successful
                            }

                        } else {
                            console.warn('⚠️ No claim data found in message, cannot store claim details');
                            // Fallback: just update post status
                            await this.updatePostStatus(postId, 'resolved');
                        }
                    } else {
                        console.warn('⚠️ Message not found, cannot store claim details');
                        // Fallback: just update post status
                        await this.updatePostStatus(postId, 'resolved');
                    }
                } else {
                    console.warn('⚠️ No postId found in conversation, cannot auto-resolve');
                }
            } else {
                console.warn('⚠️ Conversation not found, cannot auto-resolve post');
            }

        } catch (error: any) {
            throw new Error(error.message || 'Failed to confirm claim ID photo');
        }
    },

    // Update handover response with ID photo
    async updateHandoverResponse(conversationId: string, messageId: string, status: 'accepted' | 'rejected', responderId: string, idPhotoUrl?: string): Promise<void> {
        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // Update the handover message with the response and ID photo
            const updateData: any = {
                'handoverData.status': status,
                'handoverData.respondedAt': serverTimestamp(),
                'handoverData.responderId': responderId
            };

            // If accepting with ID photo, add the owner photo URL and change status to pending confirmation
            if (status === 'accepted' && idPhotoUrl) {
                updateData['handoverData.ownerIdPhoto'] = idPhotoUrl; // Store owner's photo with correct field name
                updateData['handoverData.status'] = 'pending_confirmation'; // New status for photo confirmation
            }

            await updateDoc(messageRef, updateData);

            // If handover is rejected, delete all photos and reset the handoverRequested flag
            if (status === 'rejected') {
                console.log('🗑️ Firebase: Handover rejected, starting photo deletion process...');
                try {
                    // Step 1: Extract all photos from the handover message
                    const messageDoc = await getDoc(messageRef);
                    if (messageDoc.exists()) {
                        const messageData = messageDoc.data();
                        console.log('🗑️ Firebase: Message data retrieved:', messageData);
                        const imageUrls = extractMessageImages(messageData);
                        console.log('🗑️ Firebase: Extracted image URLs:', imageUrls);

                        // Step 2: Delete photos from Cloudinary
                        if (imageUrls.length > 0) {
                            try {
                                console.log('🗑️ Attempting to delete photos:', imageUrls);
                                const deletionResult = await deleteMessageImages(imageUrls);
                                console.log('🗑️ Deletion result:', deletionResult);
                                console.log('✅ Photos deleted after handover rejection:', imageUrls.length);

                                // Step 3: Clear photo URLs from the message data in database
                                const photoCleanupData: any = {};

                                // Clear ID photo URL
                                if (messageData.handoverData?.idPhotoUrl) {
                                    photoCleanupData['handoverData.idPhotoUrl'] = null;
                                }

                                // Clear owner's ID photo URL
                                if (messageData.handoverData?.ownerIdPhoto) {
                                    photoCleanupData['handoverData.ownerIdPhoto'] = null;
                                }

                                // Clear item photos array
                                if (messageData.handoverData?.itemPhotos && messageData.handoverData.itemPhotos.length > 0) {
                                    photoCleanupData['handoverData.itemPhotos'] = [];
                                }

                                // Add photos deleted indicator to the message
                                photoCleanupData['handoverData.photosDeleted'] = true;
                                photoCleanupData['handoverData.photosDeletedAt'] = serverTimestamp();

                                // Update the message to remove photo references and add deletion indicator
                                if (Object.keys(photoCleanupData).length > 0) {
                                    await updateDoc(messageRef, photoCleanupData);
                                    console.log('✅ Photo URLs cleared from database and deletion indicator added:', photoCleanupData);
                                }

                            } catch (photoError: any) {
                                console.warn('⚠️ Failed to delete photos after rejection:', photoError.message);
                                // Continue with rejection even if photo cleanup fails
                            }
                        }
                    }
                } catch (photoExtractionError: any) {
                    console.warn('⚠️ Failed to extract photos for deletion:', photoExtractionError.message);
                    // Continue with rejection even if photo extraction fails
                }

                // Step 4: Reset conversation flags
                const conversationRef = doc(db, 'conversations', conversationId);
                await updateDoc(conversationRef, {
                    handoverRequested: false
                });
            }

            // Note: No new chat bubble is created - only the status is updated
            // The existing handover request message will show the updated status

        } catch (error: any) {
            throw new Error(error.message || 'Failed to update handover response');
        }
    },

    // Confirm ID photo for handover
    async confirmHandoverIdPhoto(conversationId: string, messageId: string, confirmBy: string): Promise<{ success: boolean; conversationDeleted: boolean; postId?: string; error?: string }> {
        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // Update the handover message to confirm the ID photo
            await updateDoc(messageRef, {
                'handoverData.idPhotoConfirmed': true,
                'handoverData.idPhotoConfirmedAt': serverTimestamp(),
                'handoverData.idPhotoConfirmedBy': confirmBy,
                'handoverData.status': 'accepted' // Final status after confirmation
            });

            // STEP 2: Get conversation data to retrieve postId and handover details
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationSnap = await getDoc(conversationRef);

            if (conversationSnap.exists()) {
                const conversationData = conversationSnap.data();
                const postId = conversationData.postId;

                if (postId) {
                    // Get the handover message data to extract handover details
                    const messageSnap = await getDoc(messageRef);
                    if (messageSnap.exists()) {
                        const messageData = messageSnap.data();
                        const handoverData = messageData.handoverData;

                        if (handoverData) {
                            // Get the handover person's user data
                            const handoverPersonId = messageData.senderId;
                            const handoverPersonDoc = await getDoc(doc(db, 'users', handoverPersonId));

                            if (handoverPersonDoc.exists()) {
                                const handoverPersonData = handoverPersonDoc.data();

                                // Get the owner's user data (the person who confirmed the handover)
                                const ownerDoc = await getDoc(doc(db, 'users', confirmBy));
                                let ownerName = 'Unknown';
                                if (ownerDoc.exists()) {
                                    const ownerData = ownerDoc.data();
                                    ownerName = `${ownerData.firstName} ${ownerData.lastName}`;
                                }

                                // STEP 3: Extract the complete handover request chat bubble details
                                // This preserves all the information from the chat bubble before it gets cleaned up
                                const handoverRequestDetails = {
                                    // Original message details
                                    messageId: messageId,
                                    messageText: messageData.text || '',
                                    messageTimestamp: messageData.timestamp,
                                    senderId: messageData.senderId,
                                    senderName: messageData.senderName || '',
                                    senderProfilePicture: messageData.senderProfilePicture || '',

                                    // Handover data from the message
                                    handoverReason: handoverData.handoverReason || '',
                                    handoverRequestedAt: handoverData.requestedAt || null,
                                    handoverRespondedAt: handoverData.respondedAt || null,
                                    handoverResponseMessage: handoverData.responseMessage || '',

                                    // ID photo verification details
                                    idPhotoUrl: handoverData.idPhotoUrl || '',
                                    idPhotoConfirmed: true,
                                    idPhotoConfirmedAt: serverTimestamp(),
                                    idPhotoConfirmedBy: confirmBy,

                                    // Item photos
                                    itemPhotos: handoverData.itemPhotos || [],
                                    itemPhotosConfirmed: handoverData.itemPhotosConfirmed || false,
                                    itemPhotosConfirmedAt: handoverData.itemPhotosConfirmedAt || null,
                                    itemPhotosConfirmedBy: handoverData.itemPhotosConfirmedBy || '',

                                    // Owner verification details
                                    ownerIdPhoto: handoverData.ownerIdPhoto || '',
                                    ownerIdPhotoConfirmed: handoverData.ownerIdPhotoConfirmed || false,
                                    ownerIdPhotoConfirmedAt: handoverData.ownerIdPhotoConfirmedAt || null,
                                    ownerIdPhotoConfirmedBy: handoverData.ownerIdPhotoConfirmedBy || ''
                                };

                                // STEP 4: Prepare handover details for the post
                                const handoverDetails = {
                                    handoverPersonName: `${handoverPersonData.firstName || ''} ${handoverPersonData.lastName || ''}`,
                                    handoverPersonContact: handoverPersonData.contactNum || '',
                                    handoverPersonStudentId: handoverPersonData.studentId || '',
                                    handoverPersonEmail: handoverPersonData.email || '',
                                    handoverItemPhotos: handoverData.itemPhotos || [],
                                    handoverIdPhoto: handoverData.idPhotoUrl || '',
                                    ownerIdPhoto: handoverData.ownerIdPhoto || '',
                                    handoverConfirmedAt: serverTimestamp(),
                                    handoverConfirmedBy: confirmBy,
                                    ownerName: ownerName || 'Unknown',
                                    // Store the complete handover request chat bubble details
                                    handoverRequestDetails: handoverRequestDetails
                                };

                                // STEP 5: Get all messages from the conversation to preserve the chat history
                                const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                                const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
                                const messagesSnap = await getDocs(messagesQuery);

                                const conversationMessages = messagesSnap.docs.map(doc => ({
                                    id: doc.id,
                                    ...doc.data()
                                }));

                                // STEP 6: Update post with handover details, status, and conversation data
                                await updateDoc(doc(db, 'posts', postId), {
                                    status: 'resolved',
                                    handoverDetails: handoverDetails,
                                    conversationData: {
                                        conversationId: conversationId,
                                        messages: conversationMessages,
                                        participants: conversationData.participants,
                                        createdAt: conversationData.createdAt,
                                        lastMessage: conversationData.lastMessage
                                    },
                                    updatedAt: serverTimestamp()
                                });

                                console.log('✅ Post updated with complete handover details and conversation data:', postId);
                                console.log('✅ Handover request chat bubble details preserved in post');

                                // STEP 7: Delete the conversation after successful data preservation
                                try {
                                    console.log('🗑️ Starting conversation deletion after successful handover confirmation...');

                                    // Delete all messages in the conversation first
                                    const messagesToDelete = messagesSnap.docs.map(doc => doc.ref);
                                    if (messagesToDelete.length > 0) {
                                        const deleteBatch = writeBatch(db);
                                        messagesToDelete.forEach(messageRef => {
                                            deleteBatch.delete(messageRef);
                                        });
                                        await deleteBatch.commit();
                                        console.log(`✅ Deleted ${messagesToDelete.length} messages from conversation`);
                                    }

                                    // Delete the conversation document
                                    await deleteDoc(conversationRef);
                                    console.log('✅ Conversation deleted successfully');

                                    // Return success with conversation deleted
                                    return {
                                        success: true,
                                        conversationDeleted: true,
                                        postId: postId
                                    };

                                } catch (deletionError: any) {
                                    console.warn('⚠️ Failed to delete conversation after handover confirmation:', deletionError.message);
                                    // Don't throw error here - the handover was successful, conversation deletion is cleanup
                                    // The conversation will remain but all important data is already preserved in the post

                                    // Return success but conversation not deleted
                                    return {
                                        success: true,
                                        conversationDeleted: false,
                                        postId: postId
                                    };
                                }

                            } else {
                                console.warn('⚠️ Handover person not found, updating post status only');
                                // Update post status to resolved even if handover person data not found
                                await this.updatePostStatus(postId, 'resolved');

                                return {
                                    success: true,
                                    conversationDeleted: false,
                                    postId: postId
                                };
                            }
                        } else {
                            console.warn('⚠️ No handover data found, updating post status only');
                            // Update post status to resolved even if handover data not found
                            await this.updatePostStatus(postId, 'resolved');

                            return {
                                success: true,
                                conversationDeleted: false,
                                postId: postId
                            };
                        }
                    } else {
                        console.warn('⚠️ Handover message not found, updating post status only');
                        // Update post status to resolved even if message not found
                        await this.updatePostStatus(postId, 'resolved');

                        return {
                            success: true,
                            conversationDeleted: false,
                            postId: postId
                        };
                    }
                } else {
                    console.warn('⚠️ No postId found in conversation, cannot update post');

                    return {
                        success: false,
                        conversationDeleted: false,
                        error: 'No postId found in conversation'
                    };
                }
            } else {
                console.warn('⚠️ Conversation not found, cannot update post');

                return {
                    success: false,
                    conversationDeleted: false,
                    error: 'Conversation not found'
                };
            }

        } catch (error: any) {
            throw new Error(error.message || 'Failed to confirm handover ID photo');
        }
    },

    // Get user's conversations (real-time listener)
    getUserConversations(userId: string, callback: (conversations: any[]) => void, errorCallback?: (error: any) => void) {
        const q = query(
            collection(db, 'conversations'),
            where(`participants.${userId}`, '!=', null)
            // Removed orderBy to avoid composite index requirement
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter out conversations where the user is the only participant
            const validConversations = conversations.filter((conv: any) => {
                const participantIds = Object.keys(conv.participants || {});
                return participantIds.length > 1; // Must have at least 2 participants
            });

            // Check and recover missing profile pictures for each conversation
            validConversations.forEach((conversation: any) => {
                if (profilePictureRecoveryService.needsProfilePictureRecovery(conversation)) {
                    // Attempt to recover profile pictures in the background
                    profilePictureRecoveryService.recoverProfilePictures(conversation.id, conversation)
                        .then(() => {
                            // Profile pictures recovered successfully
                        })
                        .catch((error) => {
                            console.error('❌ Failed to recover profile pictures for conversation:', conversation.id, error);
                        });
                }
            });

            // Return conversations without sorting - let the UI component handle sorting
            callback(validConversations);
        }, (error) => {
            // Handle listener errors gracefully
            console.log('🔧 MessageService: Listener error:', error?.message || 'Unknown error');
            if (errorCallback) {
                errorCallback(error);
            }
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'MessageService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // NEW: Get current conversations (one-time query, not a listener)
    async getCurrentConversations(userId: string): Promise<any[]> {
        try {
            console.log('🔧 MessageService: Performing one-time query for current conversations...');

            const q = query(
                collection(db, 'conversations'),
                where(`participants.${userId}`, '!=', null)
            );

            const snapshot = await getDocs(q);
            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter out conversations where the user is the only participant
            const validConversations = conversations.filter((conv: any) => {
                const participantIds = Object.keys(conv.participants || {});
                return participantIds.length > 1; // Must have at least 2 participants
            });

            // Return conversations without sorting - let the UI component handle sorting
            console.log(`🔧 MessageService: One-time query found ${validConversations.length} conversations`);
            return validConversations;

        } catch (error: any) {
            console.error('❌ MessageService: One-time query failed:', error);
            throw new Error(error.message || 'Failed to get current conversations');
        }
    },

    // Get messages for a conversation with 50-message limit
    getConversationMessages(conversationId: string, callback: (messages: any[]) => void) {
        const q = query(
            collection(db, 'conversations', conversationId, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(50) // 🔒 Limit to 50 messages for performance
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        });

        // Register with ListenerManager for tracking
        const listenerId = listenerManager.addListener(unsubscribe, 'MessageService');

        // Return a wrapped unsubscribe function that also removes from ListenerManager
        return () => {
            listenerManager.removeListener(listenerId);
        };
    },

    // 🔒 Cleanup old messages when conversation exceeds 50 messages
    async cleanupOldMessages(conversationId: string): Promise<void> {
        try {
            console.log('🔧 [cleanupOldMessages] Starting cleanup for conversation:', conversationId);

            // Get all messages ordered by timestamp (oldest first)
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            const messagesQuery = query(
                messagesRef,
                orderBy('timestamp', 'asc')
            );

            const messagesSnapshot = await getDocs(messagesQuery);
            const totalMessages = messagesSnapshot.docs.length;

            // If we have more than 50 messages, delete the oldest ones
            if (totalMessages > 50) {
                const messagesToDelete = totalMessages - 50;
                console.log(`🔧 [cleanupOldMessages] Found ${totalMessages} messages, deleting ${messagesToDelete} oldest messages`);

                // Get the oldest messages to delete
                const oldestMessages = messagesSnapshot.docs.slice(0, messagesToDelete);

                // Delete oldest messages in batch
                const deletePromises = oldestMessages.map(doc => {
                    console.log(`🗑️ [cleanupOldMessages] Deleting message: ${doc.id}`);
                    return deleteDoc(doc.ref);
                });

                await Promise.all(deletePromises);
                console.log(`✅ [cleanupOldMessages] Successfully deleted ${messagesToDelete} old messages`);
            } else {
                console.log(`🔧 [cleanupOldMessages] No cleanup needed - only ${totalMessages} messages`);
            }
        } catch (error: any) {
            console.error('❌ [cleanupOldMessages] Failed to cleanup old messages:', error);
            // Don't throw error - cleanup failure shouldn't break chat functionality
        }
    },

    // Mark conversation as read
    async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
        try {
            // Reset the unread count for the specific user who is reading the conversation
            await updateDoc(doc(db, 'conversations', conversationId), {
                [`unreadCounts.${userId}`]: 0
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to mark conversation as read');
        }
    },

    // Mark message as read
    async markMessageAsRead(conversationId: string, messageId: string, userId: string): Promise<void> {
        try {
            // Get the message document reference
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // Add the user to the readBy array if they're not already there
            await updateDoc(messageRef, {
                readBy: arrayUnion(userId)
            });
        } catch (error: any) {
            throw new Error(error.message || 'Failed to mark message as read');
        }
    },

    // Mark all unread messages as read automatically when chat opens
    async markAllUnreadMessagesAsRead(conversationId: string, userId: string): Promise<void> {
        try {
            // Get all messages in the conversation
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

            const messagesSnapshot = await getDocs(messagesQuery);

            // Find ALL unread messages (any type) that haven't been read by this user
            const unreadMessages = messagesSnapshot.docs.filter(doc => {
                const messageData = doc.data();
                const notReadByUser = !messageData.readBy?.includes(userId);

                return notReadByUser; // Include ALL message types
            });

            // Mark each unread message as read
            const updatePromises = unreadMessages.map(doc => {
                return updateDoc(doc.ref, {
                    readBy: arrayUnion(userId)
                });
            });

            // Execute all updates
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                console.log(`✅ Marked ${updatePromises.length} unread messages as read for user ${userId}`);
            }
        } catch (error: any) {
            console.error('Failed to mark unread messages as read:', error);
            // Don't throw error - just log it to avoid breaking the chat experience
        }
    },

    // Update existing conversations with missing post data
    async updateConversationPostData(conversationId: string): Promise<void> {
        try {
            const conversationRef = doc(db, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationRef);

            if (!conversationDoc.exists()) {
                throw new Error('Conversation not found');
            }

            const conversationData = conversationDoc.data();

            // Check if conversation already has the new fields
            if (conversationData.postType && conversationData.postStatus && conversationData.postCreatorId) {
                return; // Already updated
            }

            // Fetch post data to populate missing fields
            const postId = conversationData.postId;
            if (!postId) {
                throw new Error('Conversation missing postId');
            }

            const postDoc = await getDoc(doc(db, 'posts', postId));
            if (!postDoc.exists()) {
                throw new Error('Post not found');
            }

            const postData = postDoc.data();

            // Update conversation with missing fields
            await updateDoc(conversationRef, {
                postType: postData.type || "lost",
                postStatus: postData.status || "pending",
                postCreatorId: postData.creatorId || conversationData.participants?.[Object.keys(conversationData.participants)[0]]?.uid
            });

            console.log(`✅ Updated conversation ${conversationId} with post data`);
        } catch (error: any) {
            console.error('❌ Failed to update conversation post data:', error);
            throw new Error(error.message || 'Failed to update conversation post data');
        }
    },

    // Update post status
    async updatePostStatus(postId: string, status: 'pending' | 'resolved' | 'unclaimed'): Promise<void> {
        try {
            const postRef = doc(db, 'posts', postId);

            await updateDoc(postRef, {
                status,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error('❌ Firebase updatePostStatus failed:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                name: error.name
            });
            throw new Error(error.message || 'Failed to update post status');
        }
    },

    // Revert post resolution - change resolved post back to pending and reset related claim request
    async revertPostResolution(postId: string, adminId: string, reason?: string): Promise<void> {
        try {
            // STEP 3: Change post status back to pending
            await this.updatePostStatus(postId, 'pending');
            console.log('✅ Post status reverted to pending:', postId);

            // STEP 4: Find and reset related claim/handover request
            // Query conversations that reference this postId
            const conversationsQuery = query(
                collection(db, 'conversations'),
                where('postId', '==', postId)
            );
            const conversationsSnap = await getDocs(conversationsQuery);

            if (!conversationsSnap.empty) {
                // Process each conversation (there should typically be only one)
                for (const conversationDoc of conversationsSnap.docs) {
                    const conversationId = conversationDoc.id;

                    // Query messages in this conversation to find claim/handover requests
                    const messagesQuery = query(
                        collection(db, 'conversations', conversationId, 'messages'),
                        where('messageType', 'in', ['claim_request', 'handover_request'])
                    );
                    const messagesSnap = await getDocs(messagesQuery);

                    // Reset the most recent claim/handover request
                    for (const messageDoc of messagesSnap.docs) {
                        const messageData = messageDoc.data();
                        const messageId = messageDoc.id;

                        if (messageData.claimData?.status === 'accepted' && messageData.claimData?.idPhotoConfirmed) {
                            // Reset claim request
                            await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
                                'claimData.status': 'pending_confirmation',
                                'claimData.idPhotoConfirmed': false,
                                'claimData.idPhotoConfirmedAt': null,
                                'claimData.idPhotoConfirmedBy': null,
                                updatedAt: serverTimestamp()
                            });
                            console.log('✅ Claim request reset for message:', messageId);
                        } else if (messageData.handoverData?.status === 'accepted' && messageData.handoverData?.idPhotoConfirmed) {
                            // Reset handover request
                            await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
                                'handoverData.status': 'pending_confirmation',
                                'handoverData.idPhotoConfirmed': false,
                                'handoverData.idPhotoConfirmedAt': null,
                                'handoverData.idPhotoConfirmedBy': null,
                                updatedAt: serverTimestamp()
                            });
                            console.log('✅ Handover request reset for message:', messageId);
                        }
                    }
                }
            }



        } catch (error: any) {
            console.error('❌ Failed to revert post resolution:', error);
            throw new Error(error.message || 'Failed to revert post resolution');
        }
    },

    // Delete a message (only the sender can delete their own messages)
    async deleteMessage(conversationId: string, messageId: string, currentUserId: string): Promise<void> {
        try {
            const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);

            // Get the message to verify ownership
            const messageDoc = await getDoc(messageRef);
            if (!messageDoc.exists()) {
                throw new Error('Message not found');
            }

            const messageData = messageDoc.data();

            // Security check: Only the sender can delete their message
            if (messageData.senderId !== currentUserId) {
                throw new Error('You can only delete your own messages');
            }

            // Validate retrieved message data structure
            const isProduction = process.env.NODE_ENV === 'production';
            const logLevel = isProduction ? console.warn : console.log;

            // Additional validation for handover messages
            if (messageData.messageType === 'handover_request' && messageData.handoverData) {
                logLevel('🔍 Validating handover message data...');
                logLevel('🔍 Handover ID photo URL exists:', !!messageData.handoverData.idPhotoUrl);
                logLevel('🔍 Handover item photos array exists:', !!messageData.handoverData.itemPhotos);
                logLevel('🔍 Handover item photos length:', messageData.handoverData.itemPhotos?.length || 0);

                // Validate handover ID photo URL
                if (messageData.handoverData.idPhotoUrl) {
                    if (typeof messageData.handoverData.idPhotoUrl !== 'string' || !messageData.handoverData.idPhotoUrl.includes('cloudinary.com')) {
                        console.warn('⚠️ Retrieved handover ID photo URL is invalid:', {
                            url: messageData.handoverData.idPhotoUrl?.substring(0, 50) + '...',
                            type: typeof messageData.handoverData.idPhotoUrl,
                            isCloudinary: messageData.handoverData.idPhotoUrl?.includes('cloudinary.com')
                        });
                    }
                }

                // Validate handover item photos array
                if (messageData.handoverData.itemPhotos) {
                    if (!Array.isArray(messageData.handoverData.itemPhotos)) {
                        console.warn('⚠️ Retrieved handover itemPhotos is not an array:', messageData.handoverData.itemPhotos);
                    } else {
                        messageData.handoverData.itemPhotos.forEach((photo: any, index: number) => {
                            if (!photo?.url || typeof photo.url !== 'string' || !photo.url.includes('cloudinary.com')) {
                                console.warn(`⚠️ Retrieved handover item photo ${index} is invalid:`, {
                                    url: photo?.url?.substring(0, 50) + '...',
                                    type: typeof photo?.url,
                                    isCloudinary: photo?.url?.includes('cloudinary.com'),
                                    photo: photo
                                });
                            } else {
                                console.log(`✅ Retrieved handover item photo ${index} is valid:`, photo.url.split('/').pop());
                            }
                        });
                    }
                }
            }

            // Additional validation for claim messages
            if (messageData.messageType === 'claim_request' && messageData.claimData) {
                console.log('🔍 Validating claim message data...');
                console.log('🔍 Claim ID photo URL exists:', !!messageData.claimData.idPhotoUrl);
                console.log('🔍 Claim evidence photos array exists:', !!messageData.claimData.evidencePhotos);
                console.log('🔍 Claim evidence photos length:', messageData.claimData.evidencePhotos?.length || 0);

                // Similar validation logic for claim data...
                if (messageData.claimData.idPhotoUrl) {
                    if (typeof messageData.claimData.idPhotoUrl !== 'string' || !messageData.claimData.idPhotoUrl.includes('cloudinary.com')) {
                        console.warn('⚠️ Retrieved claim ID photo URL is invalid:', {
                            url: messageData.claimData.idPhotoUrl?.substring(0, 50) + '...',
                            type: typeof messageData.claimData.idPhotoUrl,
                            isCloudinary: messageData.claimData.idPhotoUrl?.includes('cloudinary.com')
                        });
                    }
                }

                if (messageData.claimData.evidencePhotos) {
                    if (!Array.isArray(messageData.claimData.evidencePhotos)) {
                        console.warn('⚠️ Retrieved claim evidencePhotos is not an array:', messageData.claimData.evidencePhotos);
                    } else {
                        messageData.claimData.evidencePhotos.forEach((photo: any, index: number) => {
                            if (!photo?.url || typeof photo.url !== 'string' || !photo.url.includes('cloudinary.com')) {
                                console.warn(`⚠️ Retrieved claim evidence photo ${index} is invalid:`, {
                                    url: photo?.url?.substring(0, 50) + '...',
                                    type: typeof photo?.url,
                                    isCloudinary: photo?.url?.includes('cloudinary.com'),
                                    photo: photo
                                });
                            } else {
                                console.log(`✅ Retrieved claim evidence photo ${index} is valid:`, photo.url.split('/').pop());
                            }
                        });
                    }
                }
            }

            // NEW: Extract and delete images from Cloudinary before deleting the message
            try {
                const { extractMessageImages, deleteMessageImages } = await import('./cloudinary');
                const imageUrls = extractMessageImages(messageData);

                logLevel(`🗑️ Found ${imageUrls.length} images to delete`);
                if (imageUrls.length > 0) {
                    logLevel('🗑️ Images to delete:', imageUrls.map(url => url.split('/').pop()));
                    const imageDeletionResult = await deleteMessageImages(imageUrls);

                    if (!imageDeletionResult.success) {
                        console.warn(`⚠️ Image deletion completed with some failures. Deleted: ${imageDeletionResult.deleted.length}, Failed: ${imageDeletionResult.failed.length}`);
                    }
                }
            } catch (imageError: any) {
                console.warn('Failed to delete images from Cloudinary, but continuing with message deletion:', imageError.message);
                // Continue with message deletion even if image deletion fails
            }

            // Check message types before deleting
            const isHandoverRequest = messageData.messageType === 'handover_request';
            const isClaimRequest = messageData.messageType === 'claim_request';

            // Delete the message
            await deleteDoc(messageRef);

            // Reset flags based on message type
            const conversationRef = doc(db, 'conversations', conversationId);

            if (isHandoverRequest) {
                await updateDoc(conversationRef, {
                    handoverRequested: false
                });
                console.log('🗑️ Reset handoverRequested flag');
            } else if (isClaimRequest) {
                await updateDoc(conversationRef, {
                    claimRequested: false
                });
                console.log('🗑️ Reset claimRequested flag');
            }

            // Update the conversation's lastMessage with the most recent remaining message
            try {
                const messagesRef = collection(db, 'conversations', conversationId, 'messages');
                const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
                const messagesSnapshot = await getDocs(messagesQuery);

                if (!messagesSnapshot.empty) {
                    const lastMessageDoc = messagesSnapshot.docs[0];
                    const lastMessageData = lastMessageDoc.data();

                    await updateDoc(conversationRef, {
                        lastMessage: {
                            text: lastMessageData.text,
                            senderId: lastMessageData.senderId,
                            timestamp: lastMessageData.timestamp
                        }
                    });
                    console.log('🔄 Updated conversation lastMessage after deletion');
                } else {
                    // No messages left, clear the lastMessage
                    await updateDoc(conversationRef, {
                        lastMessage: null
                    });
                    console.log('🗑️ Cleared conversation lastMessage - no messages remaining');
                }
            } catch (updateError: any) {
                console.warn('Failed to update conversation lastMessage after deletion:', updateError.message);
                // Continue even if lastMessage update fails
            }

        } catch (error: any) {
            throw new Error(error.message || 'Failed to delete message');
        }
    }
};

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

// Profile picture recovery function for conversations
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

            // Re-throw other errors so the calling function can handle them
            throw new Error(`Failed to delete profile picture from Cloudinary: ${error.message}`);
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

    // Get all posts with real-time updates (DEPRECATED - use getActivePosts for better performance)
    getAllPosts(callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('deletedAt', '==', null) // Only include non-deleted posts
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

    // Get posts by type (lost/found)
    getPostsByType(type: 'lost' | 'found', callback: (posts: Post[]) => void) {
        const q = query(
            collection(db, 'posts'),
            where('type', '==', type),
            where('deletedAt', '==', null) // Only non-deleted posts
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
            where('status', '==', 'resolved'),
            where('deletedAt', '==', null) // Only non-deleted posts
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
            where('category', '==', category),
            where('deletedAt', '==', null) // Only non-deleted posts
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
    getUserPosts(userEmail: string, callback: (posts: Post[]) => void, includeDeleted: boolean = false) {
        let q;
        
        if (includeDeleted) {
            q = query(
                collection(db, 'posts'),
                where('user.email', '==', userEmail)
                // Removed orderBy to avoid composite index requirement
            );
        } else {
            q = query(
                collection(db, 'posts'),
                where('user.email', '==', userEmail),
                where('deletedAt', '==', null) // Only non-deleted posts
                // Removed orderBy to avoid composite index requirement
            );
        }

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

// Ghost conversation detection and cleanup utilities
export const ghostConversationService = {
    // Detect ghost conversations (conversations without corresponding posts)
    async detectGhostConversations(): Promise<{ conversationId: string; postId: string; reason: string }[]> {
        try {
            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            const ghostConversations: { conversationId: string; postId: string; reason: string }[] = [];

            // Check each conversation
            for (const convDoc of conversationsSnapshot.docs) {
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    ghostConversations.push({
                        conversationId: convDoc.id,
                        postId: 'unknown',
                        reason: 'Missing postId field'
                    });
                    continue;
                }

                try {
                    // Check if the post still exists
                    const postDoc = await getDoc(doc(db, 'posts', postId));

                    if (!postDoc.exists()) {
                        ghostConversations.push({
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: 'Post no longer exists'
                        });
                    }
                } catch (error: any) {
                    if (error.code === 'permission-denied') {
                        ghostConversations.push({
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: 'Cannot access post (permission denied)'
                        });
                    } else {
                        ghostConversations.push({
                            conversationId: convDoc.id,
                            postId: postId,
                            reason: `Error checking post: ${error.message}`
                        });
                    }
                }
            }

            return ghostConversations;

        } catch (error: any) {
            console.error('Ghost conversation detection failed:', error);
            throw new Error(`Failed to detect ghost conversations: ${error.message}`);
        }
    },

    // Detect orphaned messages (messages without parent conversations)
    async detectOrphanedMessages(): Promise<{ conversationId: string; messageId: string; reason: string }[]> {
        try {
            const orphanedMessages: { conversationId: string; messageId: string; reason: string }[] = [];

            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));

            for (const convDoc of conversationsSnapshot.docs) {
                const conversationId = convDoc.id;

                try {
                    // Check if conversation still exists
                    const convCheck = await getDoc(convDoc.ref);
                    if (!convCheck.exists()) {
                        // Conversation was deleted, check for orphaned messages
                        const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                        const messagesSnapshot = await getDocs(messagesQuery);

                        if (messagesSnapshot.docs.length > 0) {
                            messagesSnapshot.docs.forEach(messageDoc => {
                                orphanedMessages.push({
                                    conversationId: conversationId,
                                    messageId: messageDoc.id,
                                    reason: 'Parent conversation was deleted'
                                });
                            });
                        }
                    }
                } catch (error: any) {
                    // If we can't access the conversation, it might be deleted
                    try {
                        const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'));
                        const messagesSnapshot = await getDocs(messagesQuery);

                        if (messagesSnapshot.docs.length > 0) {
                            messagesSnapshot.docs.forEach(messageDoc => {
                                orphanedMessages.push({
                                    conversationId: conversationId,
                                    messageId: messageDoc.id,
                                    reason: 'Cannot access parent conversation'
                                });
                            });
                        }
                    } catch (messageError: any) {
                        // Silent fail for message access errors
                    }
                }
            }

            return orphanedMessages;

        } catch (error: any) {
            console.error('Orphaned message detection failed:', error);
            throw new Error(`Failed to detect orphaned messages: ${error.message}`);
        }
    },

    // Clean up ghost conversations
    async cleanupGhostConversations(ghostConversations: { conversationId: string; postId: string; reason: string }[]): Promise<{ success: number; failed: number; errors: string[] }> {
        try {
            const batch = writeBatch(db);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            // Add all ghost conversations to deletion batch
            ghostConversations.forEach(ghost => {
                try {
                    const convRef = doc(db, 'conversations', ghost.conversationId);
                    batch.delete(convRef);
                } catch (error: any) {
                    failed++;
                    errors.push(`Failed to add ${ghost.conversationId}: ${error.message}`);
                }
            });

            if (ghostConversations.length > 0) {
                // Execute the batch deletion
                await batch.commit();
                success = ghostConversations.length;
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Ghost conversation cleanup failed:', error);
            throw new Error(`Failed to cleanup ghost conversations: ${error.message}`);
        }
    },

    // Clean up orphaned messages
    async cleanupOrphanedMessages(orphanedMessages: { conversationId: string; messageId: string; reason: string }[]): Promise<{ success: number; failed: number; errors: string[] }> {
        try {
            const batch = writeBatch(db);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];

            // Group messages by conversation for efficient deletion
            const messagesByConversation = orphanedMessages.reduce((acc, message) => {
                if (!acc[message.conversationId]) {
                    acc[message.conversationId] = [];
                }
                acc[message.conversationId].push(message);
                return acc;
            }, {} as { [conversationId: string]: typeof orphanedMessages });

            // Delete messages for each conversation
            for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
                try {
                    messages.forEach(message => {
                        const messageRef = doc(db, 'conversations', conversationId, 'messages', message.messageId);
                        batch.delete(messageRef);
                    });
                } catch (error: any) {
                    failed += messages.length;
                    errors.push(`Failed to process conversation ${conversationId}: ${error.message}`);
                }
            }

            if (orphanedMessages.length > 0) {
                // Execute the batch deletion
                await batch.commit();
                success = orphanedMessages.length;
            }

            return { success, failed, errors };

        } catch (error: any) {
            console.error('Orphaned message cleanup failed:', error);
            throw new Error(`Failed to cleanup orphaned messages: ${error.message}`);
        }
    },

    // Validate conversation integrity (for admin use)
    async validateConversationIntegrity(): Promise<{
        totalConversations: number;
        validConversations: number;
        ghostConversations: number;
        orphanedMessages: number;
        details: string[];
    }> {
        try {
            const result: {
                totalConversations: number;
                validConversations: number;
                ghostConversations: number;
                orphanedMessages: number;
                details: string[];
            } = {
                totalConversations: 0,
                validConversations: 0,
                ghostConversations: 0,
                orphanedMessages: 0,
                details: []
            };

            // Get all conversations
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            result.totalConversations = conversationsSnapshot.docs.length;

            for (const convDoc of conversationsSnapshot.docs) {
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    result.ghostConversations++;
                    result.details.push(`Conversation ${convDoc.id}: Missing postId`);
                    continue;
                }

                try {
                    // Check if post exists
                    const postDoc = await getDoc(doc(db, 'posts', postId));

                    if (!postDoc.exists()) {
                        result.ghostConversations++;
                        result.details.push(`Conversation ${convDoc.id}: Post ${postId} not found`);
                        continue;
                    }

                    // Check for orphaned messages
                    try {
                        const messagesSnapshot = await getDocs(collection(db, 'conversations', convDoc.id, 'messages'));
                        if (messagesSnapshot.docs.length === 0) {
                            result.details.push(`Conversation ${convDoc.id}: No messages found`);
                        }
                    } catch (error: any) {
                        result.orphanedMessages++;
                        result.details.push(`Conversation ${convDoc.id}: Cannot access messages - ${error.message}`);
                    }

                    result.validConversations++;

                } catch (error: any) {
                    result.ghostConversations++;
                    result.details.push(`Conversation ${convDoc.id}: Error checking post - ${error.message}`);
                }
            }

            return result;

        } catch (error: any) {
            console.error('Conversation integrity validation failed:', error);
            throw new Error(`Failed to validate conversation integrity: ${error.message}`);
        }
    }
};

// Background cleanup service for periodic ghost conversation maintenance
export const backgroundCleanupService = {
    // Run periodic cleanup (can be called by admin or scheduled tasks)
    async runPeriodicCleanup(): Promise<{
        timestamp: string;
        ghostsDetected: number;
        ghostsCleaned: number;
        errors: string[];
        duration: number;
    }> {
        const startTime = Date.now();
        const errors: string[] = [];

        try {
            // Detect ghost conversations
            const ghostConversations = await ghostConversationService.detectGhostConversations();

            if (ghostConversations.length === 0) {
                return {
                    timestamp: new Date().toISOString(),
                    ghostsDetected: 0,
                    ghostsCleaned: 0,
                    errors: [],
                    duration: Date.now() - startTime
                };
            }

            // Clean up detected ghosts
            const cleanupResult = await ghostConversationService.cleanupGhostConversations(ghostConversations);

            // Collect any errors
            if (cleanupResult.errors.length > 0) {
                errors.push(...cleanupResult.errors);
            }

            const duration = Date.now() - startTime;

            return {
                timestamp: new Date().toISOString(),
                ghostsDetected: ghostConversations.length,
                ghostsCleaned: cleanupResult.success,
                errors: errors,
                duration: duration
            };

        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error('Periodic cleanup failed:', error);
            errors.push(`Periodic cleanup failed: ${error.message}`);

            return {
                timestamp: new Date().toISOString(),
                ghostsDetected: 0,
                ghostsCleaned: 0,
                errors: errors,
                duration: duration
            };
        }
    },

    // Quick health check (lightweight version of integrity validation)
    async quickHealthCheck(): Promise<{
        healthy: boolean;
        totalConversations: number;
        ghostCount: number;
        issues: string[];
    }> {
        try {
            // Get total conversation count
            const conversationsSnapshot = await getDocs(collection(db, 'conversations'));
            const totalConversations = conversationsSnapshot.docs.length;

            if (totalConversations === 0) {
                return {
                    healthy: true,
                    totalConversations: 0,
                    ghostCount: 0,
                    issues: []
                };
            }

            // Sample check: look at first few conversations for obvious issues
            const sampleSize = Math.min(5, totalConversations);
            const issues: string[] = [];
            let ghostCount = 0;

            for (let i = 0; i < sampleSize; i++) {
                const convDoc = conversationsSnapshot.docs[i];
                const convData = convDoc.data();
                const postId = convData.postId;

                if (!postId) {
                    ghostCount++;
                    issues.push(`Conversation ${convDoc.id}: Missing postId`);
                    continue;
                }

                try {
                    const postDoc = await getDoc(doc(db, 'posts', postId));
                    if (!postDoc.exists()) {
                        ghostCount++;
                        issues.push(`Conversation ${convDoc.id}: Post ${postId} not found`);
                    }
                } catch (error: any) {
                    ghostCount++;
                    issues.push(`Conversation ${convDoc.id}: Cannot access post ${postId}`);
                }
            }

            // Estimate total ghosts based on sample
            const estimatedGhosts = Math.ceil((ghostCount / sampleSize) * totalConversations);
            const healthy = estimatedGhosts === 0;

            return {
                healthy: healthy,
                totalConversations: totalConversations,
                ghostCount: estimatedGhosts,
                issues: issues
            };

        } catch (error: any) {
            console.error('Quick health check failed:', error);
            return {
                healthy: false,
                totalConversations: 0,
                ghostCount: 0,
                issues: [`Health check failed: ${error.message}`]
            };
        }
    }
};

// Helper function to get readable error messages
export const getFirebaseErrorMessage = (error: any): string => {
    switch (error.code) {
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email address.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters long.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many failed login attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        default:
            return error.message || 'An unexpected error occurred. Please try again.';
    }
};

// Utility function to sanitize user data before saving to Firestore
export const sanitizeUserData = (userData: any): any => {
    if (!userData) return userData;

    const sanitized = { ...userData };

    // Ensure profilePicture is never undefined
    if (sanitized.profilePicture === undefined) {
        sanitized.profilePicture = null;
    }

    // Ensure profileImageUrl is never undefined
    if (sanitized.profileImageUrl === undefined) {
        sanitized.profileImageUrl = null;
    }

    // Ensure all string fields are never undefined
    const stringFields = ['firstName', 'lastName', 'email', 'contactNum', 'studentId'];
    stringFields.forEach(field => {
        if (sanitized[field] === undefined) {
            sanitized[field] = '';
        }
    });

    return sanitized;
};

// Utility function to sanitize post data before saving to Firestore
export const sanitizePostData = (postData: any): any => {
    if (!postData) return postData;

    const sanitized = { ...postData };

    // Sanitize user object within post
    if (sanitized.user) {
        sanitized.user = sanitizeUserData(sanitized.user);
    }

    // Ensure other optional fields are never undefined
    if (sanitized.coordinates === undefined) {
        sanitized.coordinates = null;
    }

    if (sanitized.foundAction === undefined) {
        sanitized.foundAction = null;
    }

    return sanitized;
};

// Helper function to check if error is a permission error (expected during logout)
const isPermissionError = (error: any): boolean => {
    if (!error) return false;

    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';

    // Check for common permission error patterns
    return (
        errorCode === 'permission-denied' ||
        errorCode === 'PERMISSION_DENIED' ||
        errorMessage.includes('Missing or insufficient permissions') ||
        errorMessage.includes('permission-denied') ||
        errorMessage.includes('PERMISSION_DENIED') ||
        errorMessage.includes('not authorized') ||
        errorMessage.includes('authentication required')
    );
};

// NEW: Utility function to check if error is a quota error
const isQuotaError = (error: any): boolean => {
    if (!error) return false;

    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';

    // Check for quota-related error patterns
    return (
        errorCode === 'resource-exhausted' ||
        errorCode === 'RESOURCE_EXHAUSTED' ||
        errorMessage.includes('Quota exceeded') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('resource exhausted') ||
        errorMessage.includes('Quota exceeded')
    );
};

// NEW: Utility function to handle Firebase operations with retry logic
export const firebaseOperationWithRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // Don't retry on permission errors or quota errors
            if (isPermissionError(error) || isQuotaError(error)) {
                throw error;
            }

            // Don't retry on the last attempt
            if (attempt === maxRetries) {
                break;
            }

            // Calculate delay with exponential backoff
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`Firebase operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, error.message);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

// NEW: Quota monitoring and management system
export class QuotaManager {
    private static instance: QuotaManager;
    private quotaErrors: number = 0;
    private lastQuotaError: number = 0;
    private isInQuotaWarning: boolean = false;

    private constructor() { }

    static getInstance(): QuotaManager {
        if (!QuotaManager.instance) {
            QuotaManager.instance = new QuotaManager();
        }
        return QuotaManager.instance;
    }

    // Record a quota error
    recordQuotaError(): void {
        const now = Date.now();
        this.quotaErrors++;
        this.lastQuotaError = now;

        // If we've had multiple quota errors recently, enter warning mode
        if (this.quotaErrors >= 3 && (now - this.lastQuotaError) < 300000) { // 5 minutes
            this.isInQuotaWarning = true;
            console.warn('🚨 Firebase quota warning mode activated - reducing database operations');
        }
    }

    // Check if we should reduce operations due to quota issues
    shouldReduceOperations(): boolean {
        return this.isInQuotaWarning;
    }

    // Reset quota error count (call this when quota resets)
    resetQuotaErrors(): void {
        this.quotaErrors = 0;
        this.isInQuotaWarning = false;
        console.log('✅ Firebase quota errors reset - normal operations resumed');
    }

    // Get current quota status
    getQuotaStatus(): {
        errorCount: number;
        lastError: number;
        inWarningMode: boolean;
        recommendations: string[];
    } {
        const recommendations: string[] = [];

        if (this.isInQuotaWarning) {
            recommendations.push('Consider upgrading Firebase plan');
            recommendations.push('Reduce real-time listeners');
            recommendations.push('Implement caching strategies');
        }

        if (this.quotaErrors > 0) {
            recommendations.push('Monitor Firebase console for usage');
        }

        return {
            errorCount: this.quotaErrors,
            lastError: this.lastQuotaError,
            inWarningMode: this.isInQuotaWarning,
            recommendations
        };
    }
}

// Global quota manager instance
export const quotaManager = QuotaManager.getInstance();
