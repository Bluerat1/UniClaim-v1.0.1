// Firebase configuration and initialization
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, onMessage } from 'firebase/messaging';

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

// Export Firebase instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize messaging for push notifications (only in browser, not server)
let messaging = null;
if (typeof window !== 'undefined') {
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.warn('Firebase messaging not available:', error);
    }
}

export { messaging };

// Export onMessage for handling foreground messages
export { onMessage };
