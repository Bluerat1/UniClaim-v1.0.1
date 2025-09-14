// Notification service for mobile app using Expo Notifications
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from './config';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, deleteDoc, onSnapshot } from 'firebase/firestore';
import { NotificationData, NotificationPreferences } from '../../types/Notification';
import { notificationSubscriptionService } from './notificationSubscriptions';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});


export class NotificationService {
    private static instance: NotificationService;
    private expoPushToken: string | null = null;

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    // Register for push notifications
    async registerForPushNotifications(): Promise<string | null> {
        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return null;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        try {
            // Try multiple approaches to get the project ID
            let projectId = "9ee38d41-83ad-4306-bff2-97c396db3856";

            // Try to get from Constants
            const constantsProjectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (constantsProjectId) {
                projectId = constantsProjectId;
                console.log('Using project ID from Constants:', projectId);
            } else {
                console.log('Using hardcoded project ID:', projectId);
            }

            // Try with project ID first
            try {
                const token = (await Notifications.getExpoPushTokenAsync({
                    projectId: projectId
                })).data;

                this.expoPushToken = token;
                console.log('Expo push token (with project ID):', token);
                return token;
            } catch (projectIdError) {
                console.log('Failed with project ID, trying without:', projectIdError);

                // Try without project ID as fallback
                const token = (await Notifications.getExpoPushTokenAsync()).data;

                this.expoPushToken = token;
                console.log('Expo push token (without project ID):', token);
                return token;
            }
        } catch (error) {
            console.error('Error getting push token:', error);
            return null;
        }
    }

    // Save push token to user's document
    async savePushToken(userId: string, token: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'users', userId), {
                pushToken: token,
                pushTokenUpdatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving push token:', error);
        }
    }

    // Get user's notification preferences
    async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const preferences = userData.notificationPreferences || this.getDefaultPreferences();

                // Ensure user has a subscription record (background operation)
                this.ensureUserHasSubscription(userId).catch(error => {
                    console.error('Background subscription check failed for mobile user:', error);
                });

                return preferences;
            }
            return this.getDefaultPreferences();
        } catch (error) {
            console.error('Error getting notification preferences:', error);
            return this.getDefaultPreferences();
        }
    }

    // Update user's notification preferences
    async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
        try {
            const currentPrefs = await this.getNotificationPreferences(userId);
            const updatedPrefs = { ...currentPrefs, ...preferences };

            // Update the user's notification preferences in the users collection
            await updateDoc(doc(db, 'users', userId), {
                notificationPreferences: updatedPrefs,
                updatedAt: serverTimestamp()
            });

            // Also update the subscription record for optimized queries
            try {
                const subscriptionPreferences = this.convertToSubscriptionPreferences(updatedPrefs);
                await notificationSubscriptionService.updateSubscription(userId, {
                    preferences: subscriptionPreferences
                });
                console.log('✅ Updated notification subscription for mobile user:', userId);
            } catch (subscriptionError) {
                console.error('❌ Failed to update notification subscription for mobile user:', subscriptionError);
                // Don't fail the main operation if subscription update fails
            }
        } catch (error) {
            console.error('Error updating notification preferences:', error);
            throw error;
        }
    }

    // Convert old notification preferences format to new subscription format
    private convertToSubscriptionPreferences(preferences: NotificationPreferences): any {
        return {
            newPosts: preferences.newPosts,
            messages: preferences.messages,
            claimUpdates: preferences.claimUpdates,
            adminAlerts: preferences.adminAlerts,
            categories: preferences.categoryFilter || [], // Map categoryFilter to categories
            locations: [], // TODO: Add location mapping when location preferences are implemented
            quietHours: preferences.quietHours,
            soundEnabled: true // Mobile doesn't have soundEnabled in preferences, default to true
        };
    }

    // Ensure user has a subscription record (for existing users)
    async ensureUserHasSubscription(userId: string): Promise<void> {
        try {
            // Check if subscription exists
            const existingSubscription = await notificationSubscriptionService.getSubscription(userId);

            if (!existingSubscription) {
                // Get user's current preferences
                const userPreferences = await this.getNotificationPreferences(userId);

                // Create subscription with current preferences
                const subscriptionPreferences = this.convertToSubscriptionPreferences(userPreferences);
                await notificationSubscriptionService.createSubscription({
                    userId: userId,
                    preferences: subscriptionPreferences,
                    isActive: true
                });

                console.log('✅ Created missing subscription for existing mobile user:', userId);
            }
        } catch (error) {
            console.error('❌ Error ensuring mobile user has subscription:', error);
            // Don't throw - this is a background operation
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
                start: "22:00",
                end: "08:00"
            }
        };
    }

    // Send local notification (for testing)
    async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default', // Play default notification sound
            },
            trigger: null, // Show immediately
        });
    }

    // Send push notification to a specific user's device
    async sendPushNotification(userId: string, title: string, body: string, data?: any): Promise<void> {
        try {
            // Get user's push token
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) {
                console.log('User not found for push notification:', userId);
                return;
            }

            const userData = userDoc.data();
            const pushToken = userData.pushToken;

            if (!pushToken) {
                console.log('No push token found for user:', userId);
                return;
            }

            // Send push notification using Expo's push service
            const message = {
                to: pushToken,
                sound: 'default',
                title,
                body,
                data: data || {},
                badge: 1, // Set badge count
            };

            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });

            if (response.ok) {
                console.log('Push notification sent successfully to user:', userId);
            } else {
                console.error('Failed to send push notification:', response.status);
            }
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    }

    // Get user's notifications
    async getUserNotifications(userId: string, limitCount: number = 20): Promise<NotificationData[]> {
        try {
            if (!userId) {
                console.log('No userId provided for getUserNotifications');
                return [];
            }

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
            })) as NotificationData[];
        } catch (error) {
            console.error('Error getting user notifications:', error);
            return [];
        }
    }

    // Mark notification as read
    async markNotificationAsRead(notificationId: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true,
                readAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    // Mark all notifications as read for user
    async markAllNotificationsAsRead(userId: string): Promise<void> {
        try {
            const notifications = await this.getUserNotifications(userId, 100);
            const batch = notifications
                .filter(notif => !notif.read)
                .map(notif => updateDoc(doc(db, 'notifications', notif.id), {
                    read: true,
                    readAt: serverTimestamp()
                }));

            await Promise.all(batch);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Check if user should receive notification based on preferences
    async shouldSendNotification(userId: string, type: string, postData?: any): Promise<boolean> {
        try {
            const preferences = await this.getNotificationPreferences(userId);

            // Check if notification type is enabled
            switch (type) {
                case 'new_post':
                    if (!preferences.newPosts) return false;
                    break;
                case 'message':
                    if (!preferences.messages) return false;
                    break;
                case 'claim_update':
                    if (!preferences.claimUpdates) return false;
                    break;
                case 'admin_alert':
                    if (!preferences.adminAlerts) return false;
                    break;
                default:
                    return false;
            }

            // Check quiet hours
            if (preferences.quietHours.enabled) {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                const startTime = this.timeToMinutes(preferences.quietHours.start);
                const endTime = this.timeToMinutes(preferences.quietHours.end);

                if (startTime > endTime) {
                    // Quiet hours span midnight
                    if (currentTime >= startTime || currentTime <= endTime) {
                        return false;
                    }
                } else {
                    // Normal quiet hours
                    if (currentTime >= startTime && currentTime <= endTime) {
                        return false;
                    }
                }
            }

            // TODO: Add location and category filtering logic here
            // This would require user location data and post location/category matching

            return true;
        } catch (error) {
            console.error('Error checking notification preferences:', error);
            return true; // Default to sending if there's an error
        }
    }

    // Helper function to convert time string to minutes
    private timeToMinutes(timeString: string): number {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Get unread notification count
    async getUnreadCount(userId: string): Promise<number> {
        try {
            const notifications = await this.getUserNotifications(userId, 100);
            return notifications.filter(notif => !notif.read).length;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    // Delete a single notification
    async deleteNotification(notificationId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, 'notifications', notificationId));
            console.log('Successfully deleted notification:', notificationId);
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }

    // Delete all notifications for a user
    async deleteAllNotifications(userId: string): Promise<void> {
        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);

            console.log(`Successfully deleted ${snapshot.docs.length} notifications for user:`, userId);
        } catch (error) {
            console.error('Error deleting all notifications:', error);
            throw error;
        }
    }

    // Create a new notification
    async createNotification(notificationData: {
        userId: string;
        type: 'new_post' | 'message' | 'claim_update' | 'admin_alert' | 'conversation_deleted';
        title: string;
        body: string;
        data?: any;
        postId?: string;
        conversationId?: string;
    }): Promise<string> {
        try {
            const notificationsRef = collection(db, 'notifications');
            const docRef = await addDoc(notificationsRef, {
                userId: notificationData.userId,
                type: notificationData.type,
                title: notificationData.title,
                body: notificationData.body,
                data: notificationData.data || {},
                read: false,
                createdAt: serverTimestamp(),
                postId: notificationData.postId || null,
                conversationId: notificationData.conversationId || null
            });

            console.log('Successfully created notification:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Set up real-time listener for notifications
    setupRealtimeListener(
        userId: string,
        onUpdate: (notifications: NotificationData[]) => void,
        onError: (error: any) => void
    ): () => void {
        if (!userId) {
            console.warn('setupRealtimeListener: userId is required');
            return () => { };
        }

        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(50) // Limit to 50 most recent notifications
            );

            const unsubscribe = onSnapshot(q,
                (snapshot) => {
                    const notifications = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as NotificationData));

                    onUpdate(notifications);
                },
                (error) => {
                    console.error('Real-time notification listener error:', error);
                    onError(error);
                }
            );

            return unsubscribe;
        } catch (error) {
            console.error('Error setting up real-time notification listener:', error);
            onError(error);
            return () => { };
        }
    }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
