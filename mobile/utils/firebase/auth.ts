// Authentication service for user management
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    updateProfile,
    sendPasswordResetEmail,
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
        const startTime = Date.now();
        console.log('🔑 Starting user registration...', {
            email,
            firstName,
            timestamp: new Date().toISOString()
        });

        try {
            console.log('1️⃣ Creating user in Firebase Authentication...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const authTime = Date.now();

            console.log('✅ User created in Firebase Auth', {
                uid: userCredential.user.uid,
                email: userCredential.user.email,
                timeTaken: `${authTime - startTime}ms`
            });

            // Update profile with additional user data
            if (userCredential.user) {
                console.log('2️⃣ Updating user profile with display name...');
                const profileStart = Date.now();
                await updateProfile(userCredential.user, {
                    displayName: `${firstName} ${lastName}`
                });
                console.log('✅ Profile updated', {
                    displayName: `${firstName} ${lastName}`,
                    timeTaken: `${Date.now() - profileStart}ms`
                });

                // Send email verification
                console.log('3️⃣ Sending email verification...');
                const verificationStart = Date.now();
                try {
                    await sendEmailVerification(userCredential.user, {
                        url: 'https://uniclaim2.firebaseapp.com/__/auth/action', // Replace with your actual verification URL
                        handleCodeInApp: true
                    });
                    console.log('📧 Email verification sent successfully', {
                        email: userCredential.user.email,
                        timeTaken: `${Date.now() - verificationStart}ms`,
                        uid: userCredential.user.uid,
                        timestamp: new Date().toISOString(),
                        emailVerified: userCredential.user.emailVerified
                    });
                } catch (verificationError) {
                    console.error('❌ Failed to send verification email:', {
                        error: verificationError,
                        email: userCredential.user.email,
                        uid: userCredential.user.uid,
                        timestamp: new Date().toISOString()
                    });
                    throw verificationError;
                }

                // Create Firestore user document with all registration data
                console.log('4️⃣ Creating Firestore user document...');
                const firestoreStart = Date.now();
                try {
                    const userData: UserData = {
                        uid: userCredential.user.uid,
                        email: userCredential.user.email || '',
                        firstName: firstName,
                        lastName: lastName,
                        contactNum: contactNum,
                        studentId: studentId,
                        role: 'user', // This is now type-checked against the UserData interface
                        status: 'active',
                        emailVerified: false,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    await userService.createUser(userCredential.user.uid, userData);
                    console.log('✅ Firestore user document created', {
                        uid: userCredential.user.uid,
                        timeTaken: `${Date.now() - firestoreStart}ms`,
                        documentData: userData
                    });

                    // Store credentials for auto-login
                    console.log('5️⃣ Storing credentials for auto-login...');
                    const credentialsStart = Date.now();
                    try {
                        await credentialStorage.saveCredentials(email, password);
                        console.log('🔐 Credentials stored', {
                            timeTaken: `${Date.now() - credentialsStart}ms`
                        });
                    } catch (credentialError) {
                        console.warn('⚠️ Failed to store credentials for auto-login:', {
                            error: credentialError,
                            timeTaken: `${Date.now() - credentialsStart}ms`
                        });
                        // Continue with registration even if credential storage fails
                        // The user can still login manually
                    }
                } catch (firestoreError) {
                    console.error('❌ Failed to create Firestore user document:', {
                        error: firestoreError,
                        uid: userCredential.user.uid,
                        timeTaken: `${Date.now() - firestoreStart}ms`,
                        timestamp: new Date().toISOString()
                    });
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
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('No authenticated user found');
        }

        // Use default settings - no custom domain or action URL
        await sendEmailVerification(currentUser);
    },

    // Handle email verification completion
    async handleEmailVerification(userId: string): Promise<void> {
        console.log('🔍 Processing email verification completion', {
            userId,
            timestamp: new Date().toISOString()
        });

        try {
            const userDocRef = doc(db, 'users', userId);
            const updateData = {
                emailVerified: true,
                updatedAt: serverTimestamp()
            };

            console.log('🔄 Updating user document with verification status', {
                userId,
                updates: updateData,
                timestamp: new Date().toISOString()
            });

            await updateDoc(userDocRef, updateData);

            console.log('✅ Successfully updated email verification status', {
                userId,
                timestamp: new Date().toISOString()
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
