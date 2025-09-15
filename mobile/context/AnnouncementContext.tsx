import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { announcementService, type Announcement } from '../utils/firebase/announcements';
import { useAuth } from './AuthContext';

interface AnnouncementContextType {
  // State
  announcements: Announcement[];
  activeAnnouncements: Announcement[];
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshAnnouncements: () => Promise<void>;
  createAnnouncement: (data: {
    message: string;
    priority: 'normal' | 'urgent';
    isActive: boolean;
    expiresAt?: Date;
  }) => Promise<string>;
  updateAnnouncement: (id: string, data: {
    message?: string;
    priority?: 'normal' | 'urgent';
    isActive?: boolean;
    expiresAt?: Date;
  }) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  toggleAnnouncementStatus: (id: string) => Promise<void>;
  
  // Utility functions
  getCurrentAnnouncement: () => Announcement | null;
  hasActiveAnnouncements: () => boolean;
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

interface AnnouncementProviderProps {
  children: ReactNode;
}

export function AnnouncementProvider({ children }: AnnouncementProviderProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  // Load all announcements on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      loadAllAnnouncements();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user?.uid]);

  // Set up real-time subscription for active announcements
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('🔔 User not authenticated, skipping announcement subscription');
      setLoading(false);
      return;
    }

    console.log('🔔 Setting up announcement subscription for user:', user.uid);
    
    const unsubscribe = announcementService.subscribeToActiveAnnouncements((announcements) => {
      console.log('📢 Received announcements:', announcements);
      setActiveAnnouncements(announcements);
      setLoading(false);
      setError(null);
    });

    // Set a timeout to ensure loading state doesn't stay forever
    const timeout = setTimeout(() => {
      console.log('⏰ Announcement subscription timeout - setting loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [isAuthenticated, user?.uid]);

  const loadAllAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allAnnouncements = await announcementService.getAllAnnouncements();
      setAnnouncements(allAnnouncements);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load announcements';
      setError(errorMessage);
      console.error('Error loading announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAnnouncements = useCallback(async () => {
    await loadAllAnnouncements();
  }, [loadAllAnnouncements]);

  const createAnnouncement = useCallback(async (data: {
    message: string;
    priority: 'normal' | 'urgent';
    isActive: boolean;
    expiresAt?: Date;
  }): Promise<string> => {
    try {
      setError(null);
      const currentUser = JSON.parse(JSON.stringify(user));
      const adminId = currentUser?.uid || 'unknown';
      
      const announcementId = await announcementService.createAnnouncement({
        ...data,
        createdBy: adminId
      });
      
      // Refresh announcements to get the latest data
      await loadAllAnnouncements();
      
      return announcementId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create announcement';
      setError(errorMessage);
      console.error('Error creating announcement:', err);
      throw err;
    }
  }, [user, loadAllAnnouncements]);

  const updateAnnouncement = useCallback(async (id: string, data: {
    message?: string;
    priority?: 'normal' | 'urgent';
    isActive?: boolean;
    expiresAt?: Date;
  }): Promise<void> => {
    try {
      setError(null);
      await announcementService.updateAnnouncement(id, data);
      
      // Refresh announcements to get the latest data
      await loadAllAnnouncements();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update announcement';
      setError(errorMessage);
      console.error('Error updating announcement:', err);
      throw err;
    }
  }, [loadAllAnnouncements]);

  const deleteAnnouncement = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await announcementService.deleteAnnouncement(id);
      
      // Refresh announcements to get the latest data
      await loadAllAnnouncements();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete announcement';
      setError(errorMessage);
      console.error('Error deleting announcement:', err);
      throw err;
    }
  }, [loadAllAnnouncements]);

  const toggleAnnouncementStatus = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      // Find the announcement and toggle its status
      const announcement = announcements.find(a => a.id === id);
      if (announcement) {
        await announcementService.updateAnnouncement(id, {
          isActive: !announcement.isActive
        });
        
        // Refresh announcements to get the latest data
        await loadAllAnnouncements();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle announcement status';
      setError(errorMessage);
      console.error('Error toggling announcement status:', err);
      throw err;
    }
  }, [announcements, loadAllAnnouncements]);

  // Utility functions
  const getCurrentAnnouncement = useCallback((): Announcement | null => {
    return activeAnnouncements.length > 0 ? activeAnnouncements[0] : null;
  }, [activeAnnouncements]);

  const hasActiveAnnouncements = useCallback((): boolean => {
    return activeAnnouncements.length > 0;
  }, [activeAnnouncements]);

  const value: AnnouncementContextType = {
    // State
    announcements,
    activeAnnouncements,
    loading,
    error,
    
    // Actions
    refreshAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementStatus,
    
    // Utility functions
    getCurrentAnnouncement,
    hasActiveAnnouncements,
  };

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements(): AnnouncementContextType {
  const context = useContext(AnnouncementContext);
  if (context === undefined) {
    throw new Error('useAnnouncements must be used within an AnnouncementProvider');
  }
  return context;
}

// Hook for getting just the current announcement (for banner display)
export function useCurrentAnnouncement() {
  const { getCurrentAnnouncement, hasActiveAnnouncements, loading } = useAnnouncements();
  
  return {
    currentAnnouncement: getCurrentAnnouncement(),
    hasActiveAnnouncements: hasActiveAnnouncements(),
    loading
  };
}
