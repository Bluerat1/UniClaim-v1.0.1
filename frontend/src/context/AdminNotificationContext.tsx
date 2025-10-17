// Admin notification context for managing admin notification state
// Separate from user NotificationContext for clean architecture
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { adminNotificationService } from '../services/firebase/adminNotifications';
import type { AdminNotification } from '../types/AdminNotification';

interface AdminNotificationContextType {
  notifications: AdminNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
}

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined);

export const AdminNotificationProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, userData } = useAuth();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if current user is admin or campus security
  const isAdmin = userData?.role === 'admin' || userData?.role === 'campus_security';

  // Debug logging - only log when state actually changes
  useEffect(() => {
    // console.log('🔍 AdminNotificationProvider state:', {
    //   isAuthenticated,
    //   userId: userData?.uid,
    //   userRole: userData?.role,
    //   isAdmin,
    // });
  }, [isAuthenticated, userData?.uid, userData?.role, isAdmin]);

  // Load notifications when user is authenticated and is admin
  useEffect(() => {
    if (isAuthenticated && userData?.uid && isAdmin && userData?.role) {
      // Add a small delay to ensure authentication is fully processed
      const timer = setTimeout(() => {
        loadNotifications();
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, userData?.uid, userData?.role, isAdmin]);

  // Set up real-time listener for admin notifications
  useEffect(() => {
    if (!isAuthenticated || !userData?.uid || !isAdmin || !userData?.role) return;

    // Set up real-time Firestore listener
    const unsubscribe = adminNotificationService.setupRealtimeListener(
      userData.uid,
      (newNotifications) => {
        // Update notifications when they change
        setNotifications(prevNotifications => {
          // Filter out any existing notifications to avoid duplicates
          const filteredNotifications = newNotifications.filter(newNotif => 
            !prevNotifications.some(prevNotif => prevNotif.id === newNotif.id)
          );
          
          // Return combined notifications (existing + new)
          return [...prevNotifications, ...filteredNotifications];
        });
        
        // Update unread count
        const unread = newNotifications.filter(notif => !notif.read).length;
        setUnreadCount(unread);
        setLoading(false);
        setError(null);
      },
      () => {
        setError('Failed to load admin notifications');
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isAuthenticated, userData?.uid, userData?.role, isAdmin]);

  // Enforce 15-notification limit when notifications change
  useEffect(() => {
    if (notifications.length > 15) {
      // Sort notifications by createdAt descending (newest first)
      const sortedNotifications = [...notifications].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      // Keep only the first 15 (most recent) notifications
      const limitedNotifications = sortedNotifications.slice(0, 15);
      setNotifications(limitedNotifications);
    }
  }, [notifications]);

  const loadNotifications = async () => {
    if (!userData?.uid || !isAdmin) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const adminNotifications = await adminNotificationService.getAdminNotifications(userData.uid, 15);
      setNotifications(adminNotifications);
      
      const unread = await adminNotificationService.getUnreadCount(userData.uid);
      setUnreadCount(unread);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin notifications');
    } finally {
      setLoading(false);
    }
  };

  const refreshNotifications = async () => {
    await loadNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await adminNotificationService.markAsRead(notificationId);
      
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
      console.error('Error marking admin notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!userData?.uid || !isAdmin) return;

    try {
      await adminNotificationService.markAllAsRead(userData.uid);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error marking all admin notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await adminNotificationService.deleteNotification(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );
      
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(notif => notif.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      console.error('Error deleting admin notification:', err);
    }
  };

  const deleteAllNotifications = async () => {
    if (!userData?.uid || !isAdmin) return;

    try {
      await adminNotificationService.deleteAllNotifications(userData.uid);
      
      // Update local state - clear all notifications
      setNotifications([]);
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Error deleting all admin notifications:', err);
    }
  };

  const value: AdminNotificationContextType = {
    notifications,
    unreadCount,
    loading,
    error,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  };

  return (
    <AdminNotificationContext.Provider value={value}>
      {children}
    </AdminNotificationContext.Provider>
  );
};

// Hook to use admin notifications
export const useAdminNotifications = (): AdminNotificationContextType => {
  const context = useContext(AdminNotificationContext);
  if (context === undefined) {
    throw new Error('useAdminNotifications must be used within an AdminNotificationProvider');
  }
  return context;
};
