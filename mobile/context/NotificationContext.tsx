// Notification context for managing notification state (Mobile)
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { notificationService } from '../utils/firebase/notifications';
import { NotificationData } from '../types/Notification';

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
  showLocalNotification: (title: string, body: string, data?: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, userData } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notifications when user is authenticated
  useEffect(() => {
    if (isAuthenticated && userData?.uid) {
      // Add a small delay to ensure authentication is fully processed
      const timer = setTimeout(() => {
        loadNotifications();
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      // User logged out - reset state
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, userData?.uid]);

  // Set up real-time listener for notifications
  useEffect(() => {
    if (!isAuthenticated || !userData?.uid) return;

    // Set up real-time Firestore listener instead of polling
    const unsubscribe = notificationService.setupRealtimeListener(
      userData.uid,
      async (newNotifications) => {
        // Enforce 15-notification limit by deleting oldest notifications if needed
        const enforcedNotifications = await enforceNotificationLimit(newNotifications);
        
        // Update notifications when they change
        setNotifications(prevNotifications => {
          const newNotificationsList = enforcedNotifications.filter(newNotif => 
            !prevNotifications.some(prevNotif => prevNotif.id === newNotif.id)
          );
          
          // Play sound for new notifications
          if (newNotificationsList.length > 0) {
            newNotificationsList.forEach(async (notification) => {
              try {
                await notificationService.sendLocalNotification(
                  notification.title,
                  notification.body,
                  {
                    type: notification.type,
                    postId: notification.postId,
                    conversationId: notification.conversationId
                  }
                );
              } catch (error) {
                console.error('Error playing notification sound:', error);
              }
            });
          }
          
          return enforcedNotifications;
        });
        
        // Update unread count
        const unread = enforcedNotifications.filter(notif => !notif.read).length;
        setUnreadCount(unread);
      },
      (error) => {
        console.error('Notification listener error:', error);
        setError('Failed to load notifications');
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isAuthenticated, userData?.uid]);

  // Helper function to enforce 15-notification limit by deleting oldest notifications
  const enforceNotificationLimit = async (notifications: NotificationData[]): Promise<NotificationData[]> => {
    if (notifications.length <= 15) return notifications;

    try {
      // Instead of deleting notifications (which causes permission errors),
      // we'll just return the latest 15 and log that we're limiting them
      const sortedNotifications = [...notifications].sort((a, b) =>
        new Date(b.createdAt?.seconds * 1000).getTime() - new Date(a.createdAt?.seconds * 1000).getTime()
      );

      const limitedNotifications = sortedNotifications.slice(0, 15);

      // Log that we're limiting notifications without deleting them
      console.log(`📋 Notification limit enforced: showing ${limitedNotifications.length} of ${notifications.length} notifications (oldest ${notifications.length - limitedNotifications.length} hidden due to limit)`);

      return limitedNotifications;
    } catch (error) {
      console.error('Error enforcing notification limit:', error);
      // Return original notifications if enforcement fails
      return notifications;
    }
  };

  const loadNotifications = async () => {
    if (!userData?.uid) return;

    try {
      setLoading(true);
      setError(null);
      
      const userNotifications = await notificationService.getUserNotifications(userData.uid, 50);
      
      // Enforce 15-notification limit by limiting in memory (not deleting from database)
      const enforcedNotifications = await enforceNotificationLimit(userNotifications);
      
      // Check for new notifications and play sound
      setNotifications(prevNotifications => {
        const newNotifications = enforcedNotifications.filter(newNotif => 
          !prevNotifications.some(prevNotif => prevNotif.id === newNotif.id)
        );
        
        // Play sound for new notifications
        if (newNotifications.length > 0) {
          newNotifications.forEach(async (notification) => {
            try {
              await notificationService.sendLocalNotification(
                notification.title,
                notification.body,
                {
                  type: notification.type,
                  postId: notification.postId,
                  conversationId: notification.conversationId
                }
              );
            } catch (error) {
              console.error('Error playing notification sound:', error);
            }
          });
        }
        
        return enforcedNotifications;
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
      throw err;
    }
  };

  const deleteAllNotifications = async () => {
    if (!userData?.uid) return;

    try {
      await notificationService.deleteAllNotifications(userData.uid);
      
      // Clear local state
      setNotifications([]);
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error deleting all notifications:', err);
      throw err;
    }
  };

  const showLocalNotification = async (title: string, body: string, data?: any) => {
    try {
      await notificationService.sendLocalNotification(title, body, data);
    } catch (err: any) {
      console.error('Error showing local notification:', err);
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
    showLocalNotification
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
