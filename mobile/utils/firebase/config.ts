// Firebase configuration and initialization
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import Constants from 'expo-constants';

// Helper function to get environment variables from multiple sources
const getEnvVar = (key: string): string => {
    // 1. Check process.env (works in development)
    if (process.env[key]) return process.env[key] || '';

    // 2. Check expo-constants (works in production with EAS)
    if (Constants.expoConfig?.extra?.[key]) {
        return Constants.expoConfig.extra[key];
    }

    // 3. Check @env (from react-native-dotenv)
    try {
        const env = require('@env');
        if (env[key]) return env[key];
    } catch (e) {
        console.warn('@env not available');
    }

    console.warn(`⚠️ Missing required environment variable: ${key}`);
    return '';
};

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: getEnvVar('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: getEnvVar('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvVar('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVar('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVar('EXPO_PUBLIC_FIREBASE_APP_ID'),
    measurementId: getEnvVar('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID')
};

// Validate required Firebase config
const requiredConfig = [
    'apiKey',
    'authDomain',
    'projectId',
    'appId'
];

const missingConfigs = requiredConfig.filter(key => !firebaseConfig[key]);
if (missingConfigs.length > 0) {
    console.error('❌ Missing required Firebase configs:', missingConfigs);
    throw new Error(`Missing required Firebase configs: ${missingConfigs.join(', ')}`);
}

// Initialize Firebase with error handling
let app;
try {
    if (getApps().length === 0) {
        console.log('Initializing Firebase...');
        app = initializeApp(firebaseConfig);
        console.log('✅ Firebase initialized successfully');
    } else {
        app = getApp();
        console.log('ℹ️ Using existing Firebase app');
    }
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw new Error('Failed to initialize Firebase. Please check your configuration.');
}

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
