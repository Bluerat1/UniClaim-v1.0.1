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
  // Cloudinary environment variables
  EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
  EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  EXPO_PUBLIC_CLOUDINARY_API_KEY,
  EXPO_PUBLIC_CLOUDINARY_API_SECRET,
} from '@env';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCgN70CTX2wQpcgoSZF6AK0fuq7ikcQgNs",
    authDomain: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "uniclaim2.firebaseapp.com",
    projectId: EXPO_PUBLIC_FIREBASE_PROJECT_ID || "uniclaim2",
    storageBucket: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "uniclaim2.appspot.com",
    messagingSenderId: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "38339063459",
    appId: EXPO_PUBLIC_FIREBASE_APP_ID || "1:38339063459:web:3b5650ebe6fabd352b1916",
    measurementId: EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-E693CKMPSY"
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
