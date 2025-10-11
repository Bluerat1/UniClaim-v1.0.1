import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, authService, UserData, db } from '../utils/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { credentialStorage } from '../utils/credentialStorage';
import { notificationService } from '../utils/firebase/notifications';

interface AuthContextType {
  isAuthenticated: boolean;
  user: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  banInfo: any;
  showBanNotification: boolean;
  setShowBanNotification: (show: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [banInfo, setBanInfo] = useState<any>(null);
  const [showBanNotification, setShowBanNotification] = useState(false);
  const [isAutoLogging, setIsAutoLogging] = useState(false);

  // Track ban listener to clean up on logout
  const banListenerRef = useRef<(() => void) | null>(null);
  // Track smart ban check system
  const smartBanCheckRef = useRef<{ activatePeriodicChecks: () => void; deactivatePeriodicChecks: () => void } | null>(null);

  // Helper function to check if user is admin
  const checkIfAdmin = (email: string | null): boolean => {
    if (!email) return false;
    const adminEmails = ['admin@ustp.edu.ph', 'superadmin@ustp.edu.ph', 'admin@uniclaim.com'];
    return adminEmails.includes(email.toLowerCase());
  };

  // Auto-login function
  const attemptAutoLogin = async (): Promise<boolean> => {
    try {
      setIsAutoLogging(true);
      console.log('Attempting auto-login...');
      
      const storedCredentials = await credentialStorage.getStoredCredentials();
      
      if (!storedCredentials) {
        console.log('No stored credentials found');
        return false;
      }
      
      // Attempt login with stored credentials
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        storedCredentials.email, 
        storedCredentials.password
      );
      
      console.log('Auto-login successful');
      return true;
      
    } catch (error: any) {
      console.log('Auto-login failed:', error.message);
      
      // Clear invalid credentials
      await credentialStorage.clearCredentials();
      return false;
    } finally {
      setIsAutoLogging(false);
    }
  };

  // Listen for authentication state changes
  useEffect(() => {
    let hasAttemptedAutoLogin = false;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsAuthenticated(true);

        // Check if user is admin
        const userIsAdmin = checkIfAdmin(firebaseUser.email);

        // Fetch user data from Firestore
        try {
          const fetchedUserData = await authService.getUserData(firebaseUser.uid);
          setUserData(fetchedUserData);
          
          // Update admin status based on role data (includes campus_security)
          const isAdminOrCampusSecurity = userIsAdmin || 
            fetchedUserData?.role === 'admin' || 
            fetchedUserData?.role === 'campus_security';
          setIsAdmin(isAdminOrCampusSecurity);

          // Check deactivation status efficiently (with backward compatibility)
          if (fetchedUserData && (fetchedUserData.status === 'deactivated' || fetchedUserData.status === 'banned')) {
            setIsBanned(true);
            setBanInfo(fetchedUserData.banInfo || {});
          } else {
            setIsBanned(false);
            setBanInfo(null);
          }
          
          // Set loading to false after successful authentication and data fetch
          setLoading(false);
          
          // Initialize notifications for authenticated user
          try {
            const pushToken = await notificationService.registerForPushNotifications();
            if (pushToken) {
              await notificationService.savePushToken(firebaseUser.uid, pushToken);
              console.log('Push notifications initialized for user:', firebaseUser.uid);
            }
          } catch (error) {
            console.error('Error initializing notifications:', error);
          }
          
          // Start monitoring this specific user for ban status changes
          // Only set up listener if user is authenticated to prevent permission errors during logout
          if (firebaseUser && firebaseUser.uid) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const banUnsubscribe = onSnapshot(userDocRef,
              (docSnapshot) => {
                if (docSnapshot.exists()) {
                  const userData = docSnapshot.data() as UserData & { status?: 'active' | 'deactivated' | 'banned' };

                  // Check if user just got deactivated (with backward compatibility)
                  if (userData.status === 'deactivated' || userData.status === 'banned') {
                    console.log('User banned detected in real-time (mobile)');

                    // IMMEDIATELY stop listening to prevent permission errors
                    banUnsubscribe();
                    banListenerRef.current = null;

                    // Update state
                    setIsBanned(true);
                    setBanInfo(userData.banInfo || {});

                    // Logout user immediately when banned
                    handleImmediateBanLogout(userData);
                  } else if (userData.status === 'active') {
                    // User was unbanned
                    setIsBanned(false);
                    setBanInfo(null);
                    
                    // Deactivate periodic checks since real-time listener is working
                    if (smartBanCheckRef.current) {
                      smartBanCheckRef.current.deactivatePeriodicChecks();
                    }
                  }
                }
              },
              (error) => {
                // Error handler - if listener fails, clean up gracefully
                const isPermissionError = error?.code === 'permission-denied' ||
                  error?.message?.includes('Missing or insufficient permissions');

                if (isPermissionError) {
                  // This is expected during logout - don't log as error
                  // Only log if we're still authenticated (not during logout)
                  if (isAuthenticated) {
                    console.log('Ban listener permission error (expected during logout):', error.message);
                  }
                } else {
                  console.warn('Ban listener error (mobile):', error);
                }

                // Clean up the listener
                banUnsubscribe();
                banListenerRef.current = null;

                // Only start fallback if still authenticated
                if (isAuthenticated) {
                  // Start smart ban check system
                  const smartBanCheck = startSmartBanCheck();
                  smartBanCheckRef.current = smartBanCheck;
                  smartBanCheck.activatePeriodicChecks();
                }
              }
            );

            // Store the unsubscribe function for cleanup on logout
            banListenerRef.current = banUnsubscribe;
            
            // Deactivate periodic checks since real-time listener is working
            if (smartBanCheckRef.current) {
              smartBanCheckRef.current.deactivatePeriodicChecks();
            }
          }
          
        } catch (error: any) {
          console.error('Error fetching user data:', error);
          setUserData(null);
          setIsBanned(false);
          setBanInfo(null);
          // Set loading to false even if there's an error fetching user data
          setLoading(false);
        }
      } else {
        // User logged out - clean up all listeners
        console.log('User logged out - cleaning up listeners');

        // Clean up ban listener if it exists
        if (banListenerRef.current) {
          console.log('Cleaning up ban listener');
          banListenerRef.current();
          banListenerRef.current = null;
        }

        // Clean up smart ban check if it exists
        if (smartBanCheckRef.current) {
          console.log('Cleaning up smart ban check system');
          smartBanCheckRef.current.deactivatePeriodicChecks();
          smartBanCheckRef.current = null;
        }

        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
        setIsBanned(false);
        setIsAdmin(false);
        setBanInfo(null);
        setShowBanNotification(false);
        
        // No authenticated user - try auto-login once
        if (!hasAttemptedAutoLogin) {
          hasAttemptedAutoLogin = true;
          const autoLoginSuccess = await attemptAutoLogin();
          
          if (!autoLoginSuccess) {
            // Auto-login failed or no credentials - user needs to login manually
            setLoading(false);
          }
          // If auto-login succeeds, onAuthStateChanged will be called again with the user
        } else {
          // Already attempted auto-login, user is truly not authenticated
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribe();

      // Clean up ban listener on component unmount
      if (banListenerRef.current) {
        console.log('Cleaning up ban listener on unmount');
        banListenerRef.current();
        banListenerRef.current = null;
      }

      // Clean up smart ban check on component unmount
      if (smartBanCheckRef.current) {
        console.log('Cleaning up smart ban check on unmount');
        smartBanCheckRef.current.deactivatePeriodicChecks();
        smartBanCheckRef.current = null;
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user data to check ban status
      const userData = await authService.getUserData(user.uid);
      
      if (userData && (userData.status === 'deactivated' || userData.status === 'banned')) {
        // User is banned, logout immediately
        await authService.logout();
        setIsBanned(true);
        setBanInfo(userData.banInfo || {});
        setShowBanNotification(false);
        // Don't throw error - let the component handle it
        return;
      }
      
      // User is not banned, proceed with login
      setUser(user);
      setUserData(userData);
      setIsAuthenticated(true);
      setIsBanned(false);
      setIsAdmin(checkIfAdmin(user.email));
      setBanInfo(null);
      setShowBanNotification(false);
      
      // Save credentials for auto-login (only for successful, non-banned logins)
      try {
        await credentialStorage.saveCredentials(email, password);
        console.log('Credentials saved for auto-login');
      } catch (saveError) {
        console.warn('Failed to save credentials for auto-login:', saveError);
        // Don't throw error - login was successful, credential saving is optional
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Immediately clean up ban listener to prevent permission errors during logout
      // This prevents the race condition where the listener tries to access user data after logout
      if (banListenerRef.current) {
        console.log('Immediately cleaning up ban listener during logout');
        banListenerRef.current();
        banListenerRef.current = null;
      }
      
      // Clear stored credentials for auto-login
      try {
        await credentialStorage.clearCredentials();
        console.log('Stored credentials cleared during logout');
      } catch (credentialError) {
        console.warn('Error clearing stored credentials:', credentialError);
        // Continue with logout even if clearing credentials fails
      }
      
      // Clear stored user preferences and data
      try {
        await AsyncStorage.multiRemove([
          'user_preferences',
          'search_history',
          'recent_items',
          'filter_preferences',
          'sort_preferences',
          'cached_posts',
          'user_profile_cache',
          'message_cache',
          'coordinates_cache'
        ]);
        console.log('User preferences and data cleared successfully');
      } catch (storageError) {
        console.log('Error clearing some stored data:', storageError);
        // Continue with logout even if clearing storage fails
      }
      
      await authService.logout();
      // onAuthStateChanged will handle updating the state
    } catch (error: any) {
      setLoading(false);
      throw new Error(error.message);
    }
  };

  const refreshUserData = async (): Promise<void> => {
    if (user) {
      try {
        const fetchedUserData = await authService.getUserData(user.uid);
        setUserData(fetchedUserData);
        
        // Update deactivation status when refreshing user data (with backward compatibility)
        if (fetchedUserData && (fetchedUserData.status === 'deactivated' || fetchedUserData.status === 'banned')) {
          setIsBanned(true);
          setBanInfo(fetchedUserData.banInfo || {});
        } else {
          setIsBanned(false);
          setBanInfo(null);
        }
      } catch (error: any) {
        console.error('Error refreshing user data:', error);
        setIsBanned(false);
        setBanInfo(null);
      }
    }
  };

  const handleImmediateBanLogout = async (bannedUserData: UserData & { status?: 'active' | 'deactivated' | 'banned' }) => {
    try {
      console.log('Immediate logout due to ban detected (mobile)');

      // Clean up ban listener before logout to prevent permission errors
      if (banListenerRef.current) {
        console.log('Cleaning up ban listener during ban logout');
        banListenerRef.current();
        banListenerRef.current = null;
      }

      // Clear stored credentials for auto-login (banned users shouldn't auto-login)
      try {
        await credentialStorage.clearCredentials();
        console.log('Stored credentials cleared during ban logout');
      } catch (credentialError) {
        console.warn('Error clearing stored credentials during ban:', credentialError);
        // Continue with logout even if clearing credentials fails
      }

      // Logout user immediately
      await authService.logout();

      // Reset all auth state completely
      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setIsBanned(true);
      setIsAdmin(false);
      setBanInfo(bannedUserData.banInfo || {});

      // Don't show ban notification - user will be redirected to login
      setShowBanNotification(false);

      // Force navigation to login by setting user to null
      // This will trigger the navigation logic to redirect to login
      console.log('User logged out due to ban (mobile):', bannedUserData.banInfo);

    } catch (error) {
      console.error('Error during immediate ban logout (mobile):', error);

      // Clean up ban listener even if logout fails
      if (banListenerRef.current) {
        banListenerRef.current();
        banListenerRef.current = null;
      }

      // Clear credentials even if logout fails
      try {
        await credentialStorage.clearCredentials();
      } catch (credentialError) {
        console.warn('Error clearing credentials during ban logout error:', credentialError);
      }

      // Even if logout fails, reset the state to force redirect
      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setIsBanned(true);
      setIsAdmin(false);
      setBanInfo(bannedUserData.banInfo || {});
    }
  };

  const startPeriodicBanCheck = () => {
    // SMART BAN CHECKING: Only run periodic checks if real-time listener fails
    // This prevents unnecessary quota consumption for non-banned users
    console.log('🔄 Starting smart ban check system (mobile)');
    
    const intervalId = setInterval(async () => {
      if (!auth.currentUser) {
        clearInterval(intervalId);
        return;
      }
      
      try {
        const userData = await authService.getUserData(auth.currentUser.uid);
        if (userData && (userData.status === 'deactivated' || userData.status === 'banned')) {
          console.log('Ban detected via periodic check (mobile)');
          clearInterval(intervalId);
          handleImmediateBanLogout(userData);
        }
      } catch (error: any) {
        // Handle quota errors gracefully - don't spam the console
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          console.warn('Periodic ban check quota exceeded (mobile) - will retry later');
          // Don't clear interval - let it retry when quota resets
        } else {
          console.warn('Periodic ban check error (mobile):', error);
        }
        // Continue checking - don't stop on errors
      }
    }, 300000); // Check every 5 minutes (300,000 ms)
  };

  // NEW: Smart ban checking that only runs when needed
  const startSmartBanCheck = () => {
    console.log('🧠 Starting smart ban check system (mobile)');
    
    // Only start periodic checks if real-time listener fails
    // This prevents unnecessary quota consumption for non-banned users
    let periodicCheckActive = false;
    
    const intervalId = setInterval(async () => {
      if (!auth.currentUser) {
        clearInterval(intervalId);
        return;
      }
      
      // Skip periodic checks if real-time listener is working
      if (!periodicCheckActive) {
        return;
      }
      
      try {
        const userData = await authService.getUserData(auth.currentUser.uid);
        if (userData && (userData.status === 'deactivated' || userData.status === 'banned')) {
          console.log('Ban detected via periodic check (mobile)');
          clearInterval(intervalId);
          handleImmediateBanLogout(userData);
        }
      } catch (error: any) {
        // Handle quota errors gracefully - don't spam the console
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          console.warn('Periodic ban check quota exceeded (mobile) - will retry later');
          // Don't clear interval - let it retry when quota resets
        } else {
          console.warn('Periodic ban check error (mobile):', error);
        }
        // Continue checking - don't stop on errors
      }
    }, 300000); // Check every 5 minutes (300,000 ms)
    
    // Return function to activate periodic checks only when needed
    return {
      activatePeriodicChecks: () => {
        periodicCheckActive = true;
        console.log('⚠️ Activating periodic ban checks due to real-time listener failure');
      },
      deactivatePeriodicChecks: () => {
        periodicCheckActive = false;
        console.log('✅ Deactivating periodic ban checks - real-time listener working');
      }
    };
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        userData,
        loading,
        isBanned,
        isAdmin,
        banInfo,
        showBanNotification,
        setShowBanNotification,
        login,
        logout,
        refreshUserData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
