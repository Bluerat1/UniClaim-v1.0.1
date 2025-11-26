// Firebase Cloud Messaging Service Worker
// This file reads Firebase configuration from URL parameters passed during registration

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Read Firebase config from URL parameters
const urlParams = new URL(location.href).searchParams;
const firebaseConfig = {
    apiKey: urlParams.get('apiKey') || '',
    authDomain: urlParams.get('authDomain') || '',
    projectId: urlParams.get('projectId') || '',
    storageBucket: urlParams.get('storageBucket') || '',
    messagingSenderId: urlParams.get('messagingSenderId') || '',
    appId: urlParams.get('appId') || '',
    measurementId: urlParams.get('measurementId') || ''
};

// Validate required config
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    console.error('❌ Firebase configuration missing in service worker URL parameters');
    console.error('Expected URL format: /firebase-messaging-sw.js?apiKey=...&authDomain=...&projectId=...&storageBucket=...&messagingSenderId=...&appId=...[&measurementId=...]');
} else {
    console.log('✅ Firebase configuration loaded from URL parameters');
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'UniClaim';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/uniclaim_logo.png',
        badge: '/uniclaim_logo.png',
        data: payload.data,
        actions: [
            {
                action: 'view',
                title: 'View'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notification clicked:', event);
    console.log('🔔 Notification data:', event.notification.data);

    event.notification.close();

    if (event.action === 'dismiss') {
        console.log('🚫 Notification dismissed');
        return;
    }

    // Handle the click action
    const data = event.notification.data;
    let url = '/';

    console.log('🔍 Processing notification data:', data);

    if (data?.postId) {
        url = `/post/${data.postId}`;
        console.log('📍 Post URL:', url);
    } else if (data?.conversationId) {
        url = `/messages?conversation=${data.conversationId}`;
        console.log('💬 Conversation URL:', url);
    } else {
        console.log('❌ No postId or conversationId found in notification data');
    }

    console.log('🎯 Final URL to open:', url);

    // Open the app
    event.waitUntil(
        (async () => {
            try {
                console.log('🔍 Attempting to open URL:', url);

                // Try to focus existing window first
                const clientsList = await clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });

                console.log('🔍 Found', clientsList.length, 'clients');

                for (const client of clientsList) {
                    console.log('🔍 Checking client:', client.url);

                    // If we're already on the messages page and have a conversation param, open new window
                    if (url.includes('conversation=') && (client.url.includes('/messages') || client.url.includes('/'))) {
                        console.log('✅ Found suitable window, opening new one for conversation');
                        if (clients.openWindow) {
                            return clients.openWindow(url);
                        }
                    }
                }

                // Otherwise, open in new window
                console.log('🪟 Opening new window');
                if (clients.openWindow) {
                    return clients.openWindow(url);
                } else {
                    console.error('❌ clients.openWindow not available, trying fallback');
                    // Fallback: try to navigate current context
                    if (typeof window !== 'undefined' && window.location) {
                        window.location.href = url;
                    }
                }
            } catch (error) {
                console.error('❌ Error in notification navigation:', error);
                // Last resort fallback
                try {
                    if (clients.openWindow) {
                        clients.openWindow(url);
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError);
                }
            }
        })()
    );
});