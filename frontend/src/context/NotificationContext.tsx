// Notification context for managing notification state
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/firebase/notifications';
import { SoundUtils } from '../utils/soundUtils';
import type { NotificationData as ServiceNotificationData } from '../services/firebase/notifications';

// Use the service notification data type directly
type NotificationData = ServiceNotificationData;

interface NotificationContextType {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  showNotification: (title: string, body: string, data?: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, userData } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notifications when user is authenticated and email verified
  useEffect(() => {
    if (isAuthenticated && userData?.uid && userData?.emailVerified) {
      // Add a small delay to ensure authentication is fully processed
      const timer = setTimeout(() => {
        loadNotifications();
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, userData?.uid, userData?.emailVerified]);

  // Helper function to check if browser notification should be shown for notification type
  const shouldShowBrowserNotification = (notificationType: string, preferences: any): boolean => {
    switch (notificationType) {
      case 'status_change':
      case 'post_activated':
      case 'post_reverted':
      case 'post_deleted':
      case 'post_restored':
        return preferences.claimUpdates || preferences.adminAlerts;
      case 'new_post':
        return preferences.newPosts;
      case 'message':
        return preferences.messages;
      case 'claim_request':
      case 'claim_response':
        return preferences.claimResponses || preferences.claimUpdates;
      case 'handover_response':
        return preferences.handoverResponses || preferences.claimUpdates;
      case 'admin_alert':
        return preferences.adminAlerts;
      case 'claim_update':
        return preferences.claimUpdates;
      default:
        return true; // Show by default for unknown types
    }
  };

  // Set up real-time listener for notifications
  useEffect(() => {
    if (!isAuthenticated || !userData?.uid || !userData?.emailVerified) return;

    console.log('🔄 Setting up real-time notification listener for user:', userData.uid);

    const unsubscribe = notificationService.setupRealtimeListener(
      userData.uid,
      async (newNotifications) => {
        
        // Enforce 15-notification limit by deleting oldest notifications if needed
        const enforcedNotifications = await enforceNotificationLimit(newNotifications);
        
        // Update notifications state
        setNotifications(enforcedNotifications);

        // Calculate unread count
        const unread = enforcedNotifications.filter(n => !n.read).length;
        setUnreadCount(unread);

        // Show browser notifications for new notifications (if permission granted)
        const previousCount = notifications.length;
        const newCount = enforcedNotifications.length;

        if (newCount > previousCount) {
          const newNotifs = enforcedNotifications.slice(0, newCount - previousCount);
          
          newNotifs.forEach(async (notification) => {
            try {
              // Check if user has notifications enabled for this type
              const preferences = await notificationService.getNotificationPreferences(userData.uid);
              if (shouldShowBrowserNotification(notification.type, preferences)) {
                await notificationService.showNotification(
                  notification.title,
                  notification.body,
                  {
                    ...notification.data,
                    userId: userData.uid,
                    type: notification.type
                  }
                );
                console.log('✅ Browser notification shown for:', notification.title);
              }
            } catch (error) {
              console.error('❌ Error showing browser notification:', error);
            }
          });
        }
      },
      (error) => {
        console.error('❌ Real-time notification listener error:', error);
      }
    );

    return unsubscribe;
  }, [isAuthenticated, userData?.uid, userData?.emailVerified]);

  // Helper function to enforce 15-notification limit by deleting oldest notifications
  const enforceNotificationLimit = async (notifications: NotificationData[]): Promise<NotificationData[]> => {
    if (notifications.length <= 15) return notifications;

    try {
      // Sort notifications by createdAt (newest first) to maintain correct order
      const sortedNotifications = [...notifications].sort((a, b) =>
        new Date(b.createdAt?.seconds * 1000).getTime() - new Date(a.createdAt?.seconds * 1000).getTime()
      );

      // Identify oldest notifications to delete (keep only the latest 15)
      const notificationsToDelete = sortedNotifications.slice(15);

      // Delete excess notifications
      const deletePromises = notificationsToDelete.map(notif => notificationService.deleteNotification(notif.id));
      await Promise.all(deletePromises);

      console.log(`Deleted ${notificationsToDelete.length} old notifications to enforce 15-limit`);

      // Return only the latest 15 notifications (already in newest-first order)
      return sortedNotifications.slice(0, 15);
    } catch (error) {
      console.error('Error enforcing notification limit:', error);
      // Return original notifications if deletion fails
      return notifications;
    }
  };

  const loadNotifications = async () => {
    if (!userData?.uid) return;

    try {
      setLoading(true);
      setError(null);
      
      const userNotifications = await notificationService.getUserNotifications(userData.uid, 50);
      
            userNotifications.forEach(notif => {
        if (notif.type === 'claim_update' && notif.data?.notificationType === 'claim_confirmed') {
          console.log(`🎉 Found claim confirmation notification:`, notif);
        }
      });
      
      // Enforce 15-notification limit by deleting oldest notifications if needed
      const enforcedNotifications = await enforceNotificationLimit(userNotifications);
      
      // Check for new notifications and play sound
      setNotifications(prevNotifications => {
        const newNotifications = enforcedNotifications.filter((newNotif: NotificationData) =>
          !prevNotifications.some((prevNotif: NotificationData) => prevNotif.id === newNotif.id)
        );
        
        // Play sound for new notifications (if enabled in preferences) - throttled to prevent spam
        if (newNotifications.length > 0) {
          // Handle sound playing asynchronously outside of setState with throttling
          (async () => {
            try {
              const userPreferences = await notificationService.getNotificationPreferences(userData.uid);
              if (userPreferences.soundEnabled && newNotifications.length > 0) {
                // Play sound only for the most recent notification to avoid spam
                try {
                  await SoundUtils.playNotificationSoundByType();
                } catch (error) {
                  // Silent fail for sound errors
                }
              }
            } catch (error) {
              // Silent fail if we can't check preferences
            }
          })();
        }
        
        return userNotifications;
      });
      
      const unread = await notificationService.getUnreadCount(userData.uid);
      setUnreadCount(unread);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshNotifications = async () => {
    await loadNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!userData?.uid) return;

    try {
      await notificationService.markAllNotificationsAsRead(userData.uid);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const showNotification = async (title: string, body: string, data?: any) => {
    try {
      await notificationService.showNotification(title, body, data);
    } catch (err: any) {
      console.error('Error showing notification:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      
      // Update local state - remove the deleted notification
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(notif => notif.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
    }
  };

  const deleteAllNotifications = async () => {
    if (!userData?.uid) return;

    try {
      await notificationService.deleteAllNotifications(userData.uid);
      
      // Update local state - clear all notifications
      setNotifications([]);
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error deleting all notifications:', err);
      setError('Failed to delete all notifications');
    }
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    error,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    showNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
