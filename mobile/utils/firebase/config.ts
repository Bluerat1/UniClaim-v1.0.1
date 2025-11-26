// Firebase configuration and initialization
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import environment variables using @env (from react-native-dotenv)
import {
    EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID,
    EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    // Note: Cloudinary variables removed to fix build error - will be imported in cloudinary.ts
} from '@env';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase with duplicate check
let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp(); // Use existing app
}

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export the app instance if needed elsewhere
export { app };

// Note: Firebase Auth in React Native uses local persistence by default
// No need to explicitly set persistence as it works automatically
console.log('🔥 Firebase initialized successfully for React Native');
