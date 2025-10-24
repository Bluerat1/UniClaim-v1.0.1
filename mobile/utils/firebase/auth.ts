// Authentication service for user management
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    sendEmailVerification,
    UserCredential
} from 'firebase/auth';
import { auth, db } from './config';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    where,
    limit,
    getDocs
} from 'firebase/firestore';
import { credentialStorage } from '../credentialStorage';
import { notificationSubscriptionService } from './notificationSubscriptions';

// User data interface for Firestore
export interface UserData {
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
    contactNum: string;
    studentId: string;
    profilePicture?: string;
    profileImageUrl?: string;
    role?: 'user' | 'admin' | 'campus_security';
    status?: 'active' | 'deactivated' | 'banned';
    banInfo?: any;
    emailVerified?: boolean; // Email verification status
    createdAt: any;
    updatedAt: any;
}

// Authentication service
export const authService = {
    // Register new user
    async register(
        email: string,
        password: string,
        firstName: string,
        lastName: string,
        contactNum: string,
        studentId: string
    ): Promise<UserCredential> {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('🔥 Registration successful - user created:', userCredential.user.uid);
            console.log('🔥 User automatically logged in:', userCredential.user.email);

            // Update profile with additional user data
            if (userCredential.user) {
                await updateProfile(userCredential.user, {
                    displayName: `${firstName} ${lastName}`
                });

                // Send email verification
                await sendEmailVerification(userCredential.user);
                console.log('📧 Email verification sent to:', userCredential.user.email);

                // Create Firestore user document with all registration data
                try {
                    await userService.createUser(userCredential.user.uid, {
                        uid: userCredential.user.uid,
                        email: userCredential.user.email || '',
                        firstName: firstName,
                        lastName: lastName,
                        contactNum: contactNum,
                        studentId: studentId,
                        emailVerified: false, // New users need to verify their email
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    console.log('📝 Firestore user document created successfully with profile data');

                    // Store credentials for auto-login
                    try {
                        await credentialStorage.saveCredentials(email, password);
                        console.log('🔐 Credentials stored for auto-login after registration');
                    } catch (credentialError) {
                        console.warn('⚠️ Failed to store credentials for auto-login:', credentialError);
                        // Continue with registration even if credential storage fails
                        // The user can still login manually
                    }
                } catch (firestoreError) {
                    console.error('❌ Failed to create Firestore user document:', firestoreError);
                    // Don't fail the entire registration if Firestore creation fails
                    // The AuthContext will handle creating the document later if needed
                }

            }

            return userCredential;
        } catch (error: any) {
            // Helper function to get readable error messages (inline to avoid circular dependency)
            const getFirebaseErrorMessage = (error: any): string => {
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
                    case 'auth/invalid-credential':
                        return 'Invalid email or password. Please check your credentials and try again.';
                    case 'auth/too-many-requests':
                        return 'Too many failed login attempts. Please try again later.';
                    case 'auth/network-request-failed':
                        return 'Network error. Please check your internet connection.';
                    default:
                        return error.message || 'An unexpected error occurred. Please try again.';
                }
            };
            throw new Error(getFirebaseErrorMessage(error));
        }
    },

    // Sign in user
    async login(email: string, password: string): Promise<UserCredential> {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Ensure the user has a notification subscription
            try {
                await notificationSubscriptionService.ensureUserHasSubscription(userCredential.user.uid);
            } catch (subscriptionError) {
                console.error('Error ensuring notification subscription:', subscriptionError);
                // Don't fail the login if there's an issue with the subscription
                // The user can still use the app, they just might not get notifications
            }
            
            return userCredential;
        } catch (error: any) {
            // Helper function to get readable error messages (inline to avoid circular dependency)
            const getFirebaseErrorMessage = (error: any): string => {
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
                    case 'auth/invalid-credential':
                        return 'Invalid email or password. Please check your credentials and try again.';
                    case 'auth/too-many-requests':
                        return 'Too many failed login attempts. Please try again later.';
                    case 'auth/network-request-failed':
                        return 'Network error. Please check your internet connection.';
                    default:
                        return error.message || 'An unexpected error occurred. Please try again.';
                }
            };
            throw new Error(getFirebaseErrorMessage(error));
        }
    },

    // Sign out user
    async logout(): Promise<void> {
        try {
            await signOut(auth);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to sign out');
        }
    },

    // Send password reset email
    async sendPasswordResetEmail(email: string): Promise<void> {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error: any) {
            // Handle specific Firebase auth errors
            let errorMessage = 'Failed to send password reset email';

            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address format';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many requests. Please try again later';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your internet connection';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Invalid credentials provided';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }

            throw new Error(errorMessage);
        }
    },

    // Resend email verification
    async resendEmailVerification(): Promise<void> {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('No authenticated user found');
            }

            await sendEmailVerification(currentUser);
        } catch (error: any) {
            let errorMessage = 'Failed to resend verification email';

            switch (error.code) {
                case 'auth/too-many-requests':
                    errorMessage = 'Too many requests. Please wait before trying again';
                    break;
                case 'auth/user-token-expired':
                    errorMessage = 'User session expired. Please login again';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your internet connection';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }

            throw new Error(errorMessage);
        }
    },

    // Handle email verification completion
    async handleEmailVerification(userId: string): Promise<void> {
        try {
            // Update Firestore email verification status
            await userService.updateUserData(userId, {
                emailVerified: true
            });

            console.log('Email verification completed for user:', userId);
        } catch (error: any) {
            // Log the error but don't throw it
            // Firebase email verification is what matters for authentication
            // Firestore update failure shouldn't block the user
            console.error('Error updating email verification status in Firestore:', error);

            // Don't throw the error - allow the verification process to continue
            // The user's email is verified at Firebase level, which is sufficient
        }
    },

    // Get user data by ID
    async getUserData(userId: string): Promise<UserData | null> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                return userDoc.data() as UserData;
            }
            return null;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to get user data');
        }
    }
};

// User data service for Firestore operations
export const userService = {
    // Create user document in Firestore
    async createUser(userId: string, userData: UserData): Promise<void> {
        try {
            await setDoc(doc(db, 'users', userId), {
                ...userData,
                emailVerified: false, // New users need to verify their email
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Create notification subscription for the new user
            try {
                await notificationSubscriptionService.createSubscription({
                    userId: userId,
                    isActive: true
                });
                console.log('✅ Created notification subscription for new mobile user:', userId);
            } catch (subscriptionError) {
                console.error('❌ Failed to create notification subscription for mobile user:', subscriptionError);
                // Don't fail user creation if subscription creation fails
            }
        } catch (error: any) {
            throw new Error(error.message || 'Failed to create user document');
        }
    },

    // Get user data by ID
    async getUserData(userId: string): Promise<UserData | null> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                return userDoc.data() as UserData;
            }
            return null;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to get user data');
        }
    },

    // Update user data
    async updateUserData(userId: string, updates: Partial<UserData>): Promise<void> {
        try {
            await updateDoc(doc(db, 'users', userId), {
                ...updates,
                updatedAt: serverTimestamp()
            });
        } catch (error: any) {
            // Log the error but don't throw it
            // Firestore update failures shouldn't block the user experience
            console.error('Error updating user data in Firestore:', error);
            // Don't throw the error - allow the process to continue
        }
    },

    // Get Campus Security user from database
    async getCampusSecurityUser(): Promise<UserData | null> {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('role', '==', 'campus_security'), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { uid: doc.id, ...doc.data() } as UserData;
            }

            return null;
        } catch (error: any) {
            console.error('Error getting Campus Security user:', error);
            return null;
        }
    },

    // Check if user needs email verification
    async needsEmailVerification(user: any, userData: UserData): Promise<boolean> {
        try {
          // Admin and campus security users don't need email verification
          if (userData.role === 'admin' || userData.role === 'campus_security') {
            return false;
          }

          // IMPORTANT: Reload user data to get the latest email verification status from Firebase Auth
          await user.reload();

          // Add a small delay to ensure the reload is complete
          await new Promise(resolve => setTimeout(resolve, 200));

          // Check Firebase Auth email verification status after reload
          const firebaseEmailVerified = user.emailVerified;

          // Check Firestore email verification status
          // If emailVerified field is missing, assume true (grandfathered user)
          const firestoreEmailVerified = userData.emailVerified !== undefined ? userData.emailVerified : true;

          // User needs verification if either Firebase or Firestore shows unverified
          return !firebaseEmailVerified || !firestoreEmailVerified;
        } catch (error: any) {
          console.error('Error checking email verification status:', error);

          // If there's an error checking verification status, default to requiring verification
          // This is safer than allowing potentially unverified users through
          console.warn('Defaulting to requiring verification due to error:', error.message);
          return true;
        }
    }
};
