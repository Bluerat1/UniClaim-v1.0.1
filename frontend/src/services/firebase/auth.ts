// Authentication service for Firebase
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    sendEmailVerification as firebaseSendEmailVerification,
    sendPasswordResetEmail,
    type User as FirebaseUser,
    type UserCredential
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from 'firebase/firestore';

// Import Firebase instances and types
import { auth, db } from './config';
import { notificationSubscriptionService } from './notificationSubscriptions';
import { getFirebaseErrorMessage } from './utils';
import type { UserData } from './types';

// Feature flag for new auth flow
const USE_SIMPLIFIED_AUTH = true; // Set to false to revert to old flow

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
    ): Promise<{ user: FirebaseUser }> {
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

            // Create user document in users collection
            const userData = {
                email: user.email!,
                firstName,
                lastName,
                contactNum,
                studentId,
                status: 'active',
                emailVerified: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                profilePicture: '/src/assets/empty_profile.jpg'
            };

            // Store user data in users collection
            await setDoc(doc(db, 'users', user.uid), userData);

            // Send email verification
            await firebaseSendEmailVerification(user);

            return { user };
        } catch (error: any) {
            throw new Error(getFirebaseErrorMessage(error));
        }
    },

    // Login user
    async login(email: string, password: string, isAdminLogin: boolean = false): Promise<FirebaseUser> {
        try {
            // Sign in the user
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Check if user is verified (skip for admin users)
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            const isAdminUser = userData?.role === 'admin' || userData?.role === 'campus_security';
            
            if (!user.emailVerified && !isAdminUser) {
                await signOut(auth);
                throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
            }
            
            if (isAdminLogin) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
                    await signOut(auth);
                    throw new Error('Access denied. This account does not have admin privileges.');
                }
            }
            
            // Ensure notification subscription
            try {
                const subscription = await notificationSubscriptionService.getSubscription(user.uid);
                if (!subscription) {
                    await notificationSubscriptionService.createSubscription({
                        userId: user.uid,
                        isActive: true
                    });
                }
            } catch (subscriptionError) {
                console.error('Error with notification subscription:', subscriptionError);
                // Continue login even if subscription fails
            }
            
            return user;
        } catch (error: any) {
            throw new Error(getFirebaseErrorMessage(error));
        }
    },

    // Logout user
    async logout(): Promise<void> {
        try {
            await signOut(auth);
        } catch (error: any) {
            throw new Error(getFirebaseErrorMessage(error));
        }
    },

    // Send password reset email
    async sendPasswordResetEmail(email: string): Promise<void> {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error: any) {
            throw new Error(getFirebaseErrorMessage(error));
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

            // Create notification subscription for the new admin user
            try {
                await notificationSubscriptionService.createSubscription({
                    userId: user.uid,
                    isActive: true
                });
                console.log('✅ Created notification subscription for new admin user:', user.uid);
            } catch (subscriptionError) {
                console.error('❌ Failed to create notification subscription for admin:', subscriptionError);
                // Don't fail admin creation if subscription creation fails
            }

            return { user, userData };
        } catch (error: any) {
            throw new Error(error.message || 'Admin user creation failed');
        }
    },

    // Create campus security user (for campus security access)
    async createCampusSecurityUser(
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

            // Create campus security user document in Firestore
            const userData: UserData = {
                uid: user.uid,
                email: user.email!,
                firstName,
                lastName,
                contactNum,
                studentId,
                role: 'campus_security', // Set as campus security
                status: 'active', // Ensure campus security users also have active status
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Ensure the status field is explicitly set to prevent permission issues
            if (!userData.status) {
                userData.status = 'active';
            }

            await setDoc(doc(db, 'users', user.uid), userData);

            // Create notification subscription for the new campus security user
            try {
                await notificationSubscriptionService.createSubscription({
                    userId: user.uid,
                    isActive: true
                });
                console.log('✅ Created notification subscription for new campus security user:', user.uid);
            } catch (subscriptionError) {
                console.error('❌ Failed to create notification subscription for campus security:', subscriptionError);
                // Don't fail campus security creation if subscription creation fails
            }

            return { user, userData };
        } catch (error: any) {
            throw new Error(error.message || 'Campus security user creation failed');
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
                await firebaseSendEmailVerification(user);
                console.log('Verification email sent to:', email);
            }

            // Sign out after sending verification
            await signOut(auth);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to send verification email');
        }
    },

    // Get all admin users from database
    async getAllAdminUsers(): Promise<UserData[]> {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('role', '==', 'admin'));
            const querySnapshot = await getDocs(q);

            const adminUsers: UserData[] = [];
            querySnapshot.forEach((doc) => {
                adminUsers.push({ uid: doc.id, ...doc.data() } as UserData);
            });

            return adminUsers;
        } catch (error: any) {
            console.error('Error getting admin users:', error);
            return [];
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
    },

    // Send email verification (resend)
    async sendEmailVerificationToCurrentUser(): Promise<void> {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user is currently signed in.');
        }
        try {
            await firebaseSendEmailVerification(user);
            
            // Update Firestore if using simplified auth
            if (USE_SIMPLIFIED_AUTH) {
                await this.updateEmailVerificationStatus(user.uid, false);
            }
        } catch (error: any) {
            throw new Error(getFirebaseErrorMessage(error));
        }
    },
    
};
