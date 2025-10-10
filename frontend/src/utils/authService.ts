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
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';

// Firebase configuration from environment variables
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
    role?: 'user' | 'admin' | 'campus_security'; // User role for access control
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
