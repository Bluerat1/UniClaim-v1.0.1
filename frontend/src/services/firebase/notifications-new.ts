// Notification service for web app using Firebase Cloud Messaging
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from './config';
import { doc, getDoc, updateDoc, collection, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

// Notification types
export interface NotificationData {
    id: string;
    userId: string;
    type: 'new_post' | 'message' | 'claim_update' | 'admin_alert';
    title: string;
    body: string;
    data?: any;
    read: boolean;
    createdAt: any;
    postId?: string;
    conversationId?: string;
}

// User notification preferences
export interface NotificationPreferences {
    newPosts: boolean;
    messages: boolean;
    claimUpdates: boolean;
    adminAlerts: boolean;
    locationFilter: boolean;
    categoryFilter: string[];
    quietHours: {
        enabled: boolean;
        start: string; // "22:00"
        end: string;   // "08:00"
    };
}

export class NotificationService {
    private static instance: NotificationService;
    private messaging: any = null;
    private fcmToken: string | null = null;

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    // Initialize Firebase Cloud Messaging
    async initializeMessaging(): Promise<boolean> {
        try {
            // Check if service worker is supported
            if (!('serviceWorker' in navigator)) {
                console.log('Service worker not supported');
                return false;
            }

            // Check if notifications are supported
            if (!('Notification' in window)) {
                console.log('Notifications not supported');
                return false;
            }

            // Request notification permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Notification permission denied');
                return false;
            }

            // Initialize messaging
            this.messaging = getMessaging();

            // Get FCM token
            this.fcmToken = await getToken(this.messaging, {
                vapidKey: 'YOUR_VAPID_KEY' // You'll need to add your VAPID key here
            });

            if (this.fcmToken) {
                console.log('FCM token:', this.fcmToken);
                return true;
            } else {
                console.log('No FCM token available');
                return false;
            }
        } catch (error) {
            console.error('Error initializing messaging:', error);
            return false;
        }
    }

    // Save FCM token to user's document
    async saveFCMToken(userId: string, token: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'users', userId), {
                fcmToken: token,
                fcmTokenUpdatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving FCM token:', error);
        }
    }

    // Setup message listener for foreground notifications
    setupMessageListener(): void {
        if (!this.messaging) return;

        onMessage(this.messaging, (payload) => {
            console.log('Message received in foreground:', payload);

            // Show notification
            if (payload.notification) {
                this.showNotification(
                    payload.notification.title || 'New Notification',
                    payload.notification.body || '',
                    payload.data
                );
            }
        });
    }

    // Show browser notification
    async showNotification(title: string, body: string, data?: any): Promise<void> {
        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body,
                icon: '/uniclaim_logo.png',
                data
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }

    // Get user's notifications
    async getUserNotifications(userId: string, limitCount: number = 20): Promise<NotificationData[]> {
        if (!userId) return [];

        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as NotificationData));
        } catch (error) {
            console.error('Error getting user notifications:', error);
            return [];
        }
    }

    // Get unread notification count
    async getUnreadCount(userId: string): Promise<number> {
        if (!userId) return 0;

        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', userId),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);
            return snapshot.size;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    // Mark notification as read
    async markNotificationAsRead(notificationId: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    // Mark all notifications as read
    async markAllNotificationsAsRead(userId: string): Promise<void> {
        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', userId),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);
            const updatePromises = snapshot.docs.map(doc =>
                updateDoc(doc.ref, { read: true })
            );

            await Promise.all(updatePromises);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Get user's notification preferences
    async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.notificationPreferences || this.getDefaultPreferences();
            }
            return this.getDefaultPreferences();
        } catch (error) {
            console.error('Error getting notification preferences:', error);
            return this.getDefaultPreferences();
        }
    }

    // Update user's notification preferences
    async updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
        try {
            await updateDoc(doc(db, 'users', userId), {
                notificationPreferences: preferences
            });
        } catch (error) {
            console.error('Error updating notification preferences:', error);
        }
    }

    // Get default notification preferences
    private getDefaultPreferences(): NotificationPreferences {
        return {
            newPosts: true,
            messages: true,
            claimUpdates: true,
            adminAlerts: true,
            locationFilter: false,
            categoryFilter: [],
            quietHours: {
                enabled: false,
                start: '22:00',
                end: '08:00'
            }
        };
    }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
