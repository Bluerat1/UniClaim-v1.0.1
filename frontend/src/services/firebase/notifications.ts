// Notification service for web app using Firebase Cloud Messaging
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from './config';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, deleteDoc, onSnapshot } from 'firebase/firestore';
import { SoundUtils } from '../../utils/soundUtils';
import { notificationSubscriptionService } from './notificationSubscriptions';

// Notification types
export interface NotificationData {
  id: string;
  userId: string;
  type: 'new_post' | 'message' | 'claim_update' | 'admin_alert' | 'conversation_deleted';
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
  soundEnabled: boolean;
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

      // For now, skip FCM setup and just use browser notifications
      // This allows the notification system to work without push notifications
      console.log('Notification permission granted, using browser notifications');
      return true;
    } catch (error) {
      console.error('Error initializing messaging:', error);
      return false;
    }
  }

  // Save FCM token to user's document
  async saveFCMToken(userId: string, token: string): Promise<void> {
    try {
      // For now, just log that we would save the token
      // In a real implementation, you would save the FCM token here
      console.log('Would save FCM token for user:', userId, 'Token:', token);

      // Uncomment this when you have a proper VAPID key:
      // await updateDoc(doc(db, 'users', userId), {
      //   fcmToken: token,
      //   fcmTokenUpdatedAt: serverTimestamp()
      // });
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  // Setup message listener for foreground notifications
  setupMessageListener(): void {
    // For now, skip FCM message listener setup
    // This will be enabled when FCM is properly configured
    console.log('Message listener setup skipped (FCM not configured)');
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

      // Play notification sound (if enabled in user preferences)
      try {
        const userId = data?.userId;
        if (userId) {
          const userPreferences = await this.getNotificationPreferences(userId);
          if (userPreferences.soundEnabled) {
            const notificationType = data?.type || 'new_post';
            await SoundUtils.playNotificationSoundByType(notificationType);
          }
        } else {
          // Fallback: play sound if no userId provided
          const notificationType = data?.type || 'new_post';
          await SoundUtils.playNotificationSoundByType(notificationType);
        }
      } catch (error) {
        console.error('Error playing notification sound:', error);
      }
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

        // Check if user's email is verified before proceeding
        if (!userData.emailVerified) {
          console.log('📧 User email not verified, skipping notification preferences');
          return this.getDefaultPreferences();
        }

        const preferences = userData.notificationPreferences || this.getDefaultPreferences();

        // Ensure user has a subscription record (background operation)
        this.ensureUserHasSubscription(userId).catch(error => {
          console.error('Background subscription check failed:', error);
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
  async updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    try {
      // Update the user's notification preferences in the users collection
      await updateDoc(doc(db, 'users', userId), {
        notificationPreferences: preferences
      });

      // Also update the subscription record for optimized queries
      try {
        const subscriptionPreferences = this.convertToSubscriptionPreferences(preferences);
        await notificationSubscriptionService.updateSubscription(userId, {
          preferences: subscriptionPreferences
        });
        console.log('✅ Updated notification subscription for user:', userId);
      } catch (subscriptionError) {
        console.error('❌ Failed to update notification subscription:', subscriptionError);
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
      soundEnabled: preferences.soundEnabled
    };
  }

  // Ensure user has a subscription record (for existing users)
  async ensureUserHasSubscription(userId: string): Promise<void> {
    try {
      // First check if user's email is verified
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists() || !userDoc.data().emailVerified) {
        console.log('📧 User email not verified, skipping subscription creation');
        return;
      }

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

        console.log('✅ Created missing subscription for existing user:', userId);
      }
    } catch (error) {
      console.error('❌ Error ensuring user has subscription:', error);
      // Don't throw - this is a background operation
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
      const deletePromises = snapshot.docs.map(doc =>
        deleteDoc(doc.ref)
      );

      await Promise.all(deletePromises);
      console.log(`Successfully deleted ${snapshot.size} notifications for user:`, userId);
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
      },
      soundEnabled: true
    };
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

export const notificationService = NotificationService.getInstance();
