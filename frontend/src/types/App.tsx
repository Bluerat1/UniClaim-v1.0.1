import "./App.css";
import PageRoutes from "../types/PageRoutes";

// 🚀 Import the automatic expiration service
// This ensures expired posts are automatically managed when the app starts
import "../utils/expirationService";

import ErrorBoundary from "../components/layout/ErrorBoundary";
import { SoundUtils } from "../utils/soundUtils";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { messaging } from "@/services/firebase/config";
import { onMessage } from "firebase/messaging";

function App() {
  // Initialize audio system on first user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      SoundUtils.markUserInteraction();
      // Remove listeners after first interaction to avoid memory leaks
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    // Add event listeners for user interactions
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Initialize Firebase messaging and service worker
  useEffect(() => {
    if (messaging) {
      // Register service worker for push notifications
      if ('serviceWorker' in navigator) {
        // Build service worker URL with Firebase config parameters
        const swUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
        swUrl.searchParams.set('apiKey', import.meta.env.VITE_FIREBASE_API_KEY || '');
        swUrl.searchParams.set('authDomain', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '');
        swUrl.searchParams.set('projectId', import.meta.env.VITE_FIREBASE_PROJECT_ID || '');
        swUrl.searchParams.set('storageBucket', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '');
        swUrl.searchParams.set('messagingSenderId', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '');
        swUrl.searchParams.set('appId', import.meta.env.VITE_FIREBASE_APP_ID || '');
        swUrl.searchParams.set('measurementId', import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '');

        navigator.serviceWorker
          .register(swUrl.toString())
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      }

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Handle foreground messages
      onMessage(messaging, (payload) => {
        console.log('📨 Foreground message received:', payload);

        // You can customize how foreground notifications are shown
        if (payload.notification) {
          new Notification(payload.notification.title || 'UniClaim', {
            body: payload.notification.body || 'You have a new notification',
            icon: '/uniclaim_logo.png',
            data: payload.data
          });
        }
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <PageRoutes />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </ErrorBoundary>
  );
}

export default App;
