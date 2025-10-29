// Notification service for web app using Firebase Cloud Messaging
import { db } from './config';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { SoundUtils } from '../../utils/soundUtils';
import { notificationSubscriptionService } from './notificationSubscriptions';

// Notification types
export interface NotificationData {
  id: string;
  userId: string;
  type: 'new_post' | 'message' | 'claim_update' | 'admin_alert' | 'conversation_deleted' | 'claim_response' | 'handover_response' | 'status_change' | 'post_activated' | 'post_reverted' | 'post_deleted' | 'post_restored';
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
  claimResponses: boolean;
  handoverResponses: boolean;
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
            await SoundUtils.playNotificationSoundByType();
          }
        } else {
          // Fallback: play sound if no userId provided
          await SoundUtils.playNotificationSoundByType();
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
        limit(Math.min(limitCount, 15)) // Limit to 15 notifications max to enforce the limit at query level
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
      // Allow the notification system to access preferences for any user (for notification filtering)
      // This is needed when sending notifications to check if users have enabled specific notification types
      const { auth } = await import('./config');

      // For now, allow any authenticated user to check preferences for notification filtering
      // In a production system, you might want to restrict this further
      if (!auth.currentUser) {
        console.warn('🔒 No authenticated user in getNotificationPreferences');
        return this.getDefaultPreferences();
      }

      // Get user data from users collection
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();

        const preferences = userData.notificationPreferences || this.getDefaultPreferences();

        // Ensure user has a subscription record (background operation) - only for current user
        if (auth.currentUser && auth.currentUser.uid === userId) {
          this.ensureUserHasSubscription(userId).catch(error => {
            console.error('Background subscription check failed:', error);
          });
        }

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
      // Security check: ensure the requested userId matches the current authenticated user
      const { auth } = await import('./config');
      if (!auth.currentUser || auth.currentUser.uid !== userId) {
        console.warn('🔒 Security check failed: Current user does not match requested userId in updateNotificationPreferences');
        throw new Error('Unauthorized: Cannot update preferences for another user');
      }

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
    const subscriptionPreferences: any = {
      // Always set default values to ensure proper structure
      newPosts: preferences.newPosts ?? true,
      messages: preferences.messages ?? true,
      claimUpdates: preferences.claimUpdates ?? true,
      adminAlerts: preferences.adminAlerts ?? true,
      claimResponses: preferences.claimResponses ?? true,
      handoverResponses: preferences.handoverResponses ?? true,
      categories: preferences.categoryFilter ?? [],
      locations: [], // Initialize empty locations array for future use
      quietHours: preferences.quietHours ?? { enabled: false, start: '22:00', end: '08:00' },
      soundEnabled: preferences.soundEnabled ?? true
    };

    return subscriptionPreferences;
  }

  // Ensure user has a subscription record (for existing users)
  async ensureUserHasSubscription(userId: string): Promise<void> {
    try {
      // Allow the notification system to create subscriptions for any user

      // First check if user's email is verified
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists() || !userDoc.data().emailVerified) {
        console.log('📧 User email not verified, skipping subscription creation');
        return;
      }

      // Check if subscription exists
      const existingSubscription = await notificationSubscriptionService.getSubscription(userId);

      if (!existingSubscription) {
        // Get user's current preferences directly from user document instead of calling getNotificationPreferences
        const userData = userDoc.data();
        const userPreferences = userData.notificationPreferences || this.getDefaultPreferences();

        // Create subscription with current preferences
        const subscriptionPreferences = this.convertToSubscriptionPreferences(userPreferences);
        await notificationSubscriptionService.createSubscription({
          userId: userId,
          preferences: subscriptionPreferences,
          isActive: true
        });
      }
    } catch (error) {
      console.error('Error ensuring user subscription:', error);
      // Don't throw here to prevent blocking other operations
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

  // Delete all notifications for a specific post
  async deleteNotificationsByPostId(postId: string): Promise<void> {
    if (!postId) {
      console.warn('No postId provided to deleteNotificationsByPostId');
      return;
    }

    console.log(`Deleting notifications for post: ${postId}`);
    
    try {
      // Query all notifications for this post
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('postId', '==', postId));
      
      // Get all matching notifications
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('No notifications found for post:', postId);
        return;
      }

      console.log(`Found ${snapshot.size} notifications to delete for post: ${postId}`);
      
      // Delete all matching notifications in a batch
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Successfully deleted ${snapshot.size} notifications for post: ${postId}`);
    } catch (error) {
      console.error('Error deleting notifications for post:', postId, error);
      // Don't throw the error to prevent the post deletion from failing
      // due to notification cleanup issues
    }
  }

  // Delete all notifications for a user
  async deleteAllNotifications(userId: string): Promise<void> {
    try {
      // Security check: ensure the requested userId matches the current authenticated user
      const { auth } = await import('./config');
      if (!auth.currentUser || auth.currentUser.uid !== userId) {
        console.warn('🔒 Security check failed: Current user does not match requested userId in deleteAllNotifications');
        throw new Error('Unauthorized: Cannot delete notifications for another user');
      }

      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('No notifications found for user:', userId);
        return;
      }

      console.log(`Found ${snapshot.size} notifications to delete for user:`, userId);

      // Delete notifications individually to handle permission errors gracefully
      const deletePromises = snapshot.docs.map(async (doc) => {
        try {
          await deleteDoc(doc.ref);
          return { success: true, id: doc.id };
        } catch (error) {
          console.warn(`Failed to delete notification ${doc.id}:`, error);
          return { success: false, id: doc.id, error };
        }
      });

      const results = await Promise.all(deletePromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      console.log(`Successfully deleted ${successful.length} notifications for user:`, userId);
      if (failed.length > 0) {
        console.warn(`Failed to delete ${failed.length} notifications:`, failed);
        throw new Error(`Failed to delete ${failed.length} out of ${snapshot.size} notifications. Check console for details.`);
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error;
    }
  }

  // Create a new notification
  async createNotification(notificationData: {
    userId: string;
    type: 'new_post' | 'message' | 'claim_update' | 'admin_alert' | 'conversation_deleted' | 'claim_response' | 'handover_response' | 'status_change' | 'post_activated' | 'post_reverted' | 'post_deleted' | 'post_restored';
    title: string;
    body: string;
    data?: any;
    postId?: string;
    conversationId?: string;
  }): Promise<string> {
    try {
      const notificationsRef = collection(db, 'notifications');

      // Filter out undefined values from data object
      const cleanData = notificationData.data ? Object.fromEntries(
        Object.entries(notificationData.data).filter(([_, value]) => value !== undefined)
      ) : {};

      const docRef = await addDoc(notificationsRef, {
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        body: notificationData.body,
        data: cleanData,
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

  // Check if user should receive notification based on preferences
  async shouldSendNotification(userId: string, type: string): Promise<boolean> {
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
        case 'claim_response':
          if (!preferences.claimResponses) return false;
          break;
        case 'handover_response':
          if (!preferences.handoverResponses) return false;
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

    // Security check: ensure the requested userId matches the current authenticated user
    try {
      import('./config').then(({ auth }) => {
        if (!auth.currentUser || auth.currentUser.uid !== userId) {
          console.warn('🔒 Security check failed: Current user does not match requested userId in setupRealtimeListener');
          onError(new Error('Unauthorized: Cannot set up listener for another user'));
          return () => { };
        }
      });
    } catch (error) {
      console.error('Error checking authentication in setupRealtimeListener:', error);
      onError(error);
      return () => { };
    }

    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(15) // Limit to 15 most recent notifications
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

  // Admin: Delete all notifications (for system cleanup)
  async deleteAllSystemNotifications(): Promise<void> {
    try {
      // Security check: ensure current user is an admin
      const { auth } = await import('./config');
      if (!auth.currentUser) {
        throw new Error('Unauthorized: User must be authenticated');
      }

      // Check if user is admin (you can implement proper admin check here)
      // For now, assuming admin check is handled in the UI component
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef); // Get all notifications

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('No notifications found to delete');
        return;
      }

      console.log(`Found ${snapshot.size} notifications to delete`);

      // Delete in batches to avoid Firestore limits
      const batchSize = 500;
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = snapshot.docs.slice(i, i + batchSize);
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted batch of ${batchDocs.length} notifications`);
      }

      console.log(`Successfully deleted all ${snapshot.size} notifications`);
    } catch (error) {
      console.error('Error deleting all system notifications:', error);
      throw error;
    }
  }

  // Cleanup old notifications for a specific user (separate from message sending)
  async cleanupOldUserNotifications(userId: string, keepCount: number = 14): Promise<void> {
    try {
      if (keepCount <= 0) return;

      const notificationsRef = collection(db, 'notifications');

      // Get all notifications for this user
      const userQuery = query(
        notificationsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(userQuery);

      if (snapshot.size <= keepCount) {
        console.log(`No cleanup needed for user ${userId} - only ${snapshot.size} notifications`);
        return;
      }

      const notificationsToDelete = snapshot.docs.slice(0, snapshot.size - keepCount);

      if (notificationsToDelete.length > 0) {
        const batch = writeBatch(db);

        notificationsToDelete.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`🧹 Cleaned up ${notificationsToDelete.length} old notifications for user ${userId}`);
      }
    } catch (error) {
      console.error(`Error cleaning up old notifications for user ${userId}:`, error);
      // Don't throw to avoid breaking other operations
    }
  }

  // Cleanup old notifications for multiple users (can be called periodically)
  async cleanupOldNotificationsForUsers(userIds: string[], keepCount: number = 14): Promise<void> {
    try {
      console.log(`🧹 Starting cleanup for ${userIds.length} users`);

      const cleanupPromises = userIds.map(userId =>
        this.cleanupOldUserNotifications(userId, keepCount)
      );

      await Promise.allSettled(cleanupPromises);

      console.log('✅ Completed notification cleanup for all users');
    } catch (error) {
      console.error('Error during bulk notification cleanup:', error);
    }
  }

  // Get default notification preferences
  private getDefaultPreferences(): NotificationPreferences {
    return {
      newPosts: true,
      messages: true,
      claimUpdates: true,
      adminAlerts: true,
      claimResponses: true,
      handoverResponses: true,
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
}

export const notificationService = NotificationService.getInstance();
