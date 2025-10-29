import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth, authService, type UserData, getFirebaseErrorMessage, db } from "../utils/firebase";
import { listenerManager } from "../utils/ListenerManager";
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { notificationService } from "../services/firebase/notifications";
import { notificationSubscriptionService } from "../services/firebase/notificationSubscriptions";

interface AuthContextType {
  isAuthenticated: boolean;
  user: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  isBanned: boolean;
  banInfo: any;
  needsEmailVerification: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, contactNum: string, studentId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  handleEmailVerificationComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<any>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [banListenerUnsubscribe, setBanListenerUnsubscribe] = useState<(() => void) | null>(null);
  const [periodicCheckInterval, setPeriodicCheckInterval] = useState<NodeJS.Timeout | null>(null);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsAuthenticated(true);
        
        try {
          // Fetch user data from Firestore
          const fetchedUserData = await authService.getUserData(firebaseUser.uid);
          setUserData(fetchedUserData);
          
          // Check deactivation status efficiently (with backward compatibility)
          if (fetchedUserData && (fetchedUserData.status === 'deactivated' || (fetchedUserData as any).status === 'banned')) {
            setIsBanned(true);
            setBanInfo(fetchedUserData.banInfo || {});
          } else {
            setIsBanned(false);
            setBanInfo(null);
          }

          // Check email verification status
          if (fetchedUserData) {
            const needsVerification = await authService.needsEmailVerification(firebaseUser, fetchedUserData);
            setNeedsEmailVerification(needsVerification);

            // If Firebase email is verified but Firestore is not, update Firestore
            if (firebaseUser.emailVerified && !fetchedUserData.emailVerified) {
              try {
                await authService.updateEmailVerificationStatus(firebaseUser.uid, true);
                console.log('Updated Firestore email verification status to true');
              } catch (error) {
                console.error('Failed to update email verification status:', error);
              }
            }
          } else {
            setNeedsEmailVerification(false);
          }
          
          // Initialize notifications for authenticated user (only if email is verified)
          if (fetchedUserData && fetchedUserData.emailVerified) {
            try {
              const messagingInitialized = await notificationService.initializeMessaging();
              if (messagingInitialized) {
                // Get FCM token and save it
                const fcmToken = (notificationService as any).fcmToken;
                if (fcmToken) {
                  await notificationService.saveFCMToken(firebaseUser.uid, fcmToken);
                  console.log('FCM notifications initialized for user:', firebaseUser.uid);
                }
                // Set up message listener for foreground notifications
                notificationService.setupMessageListener();
              }
            } catch (error) {
              console.error('Error initializing notifications:', error);
            }
          } else {
            console.log('📧 User email not verified, skipping notification initialization');
          }
          
          // Start monitoring this specific user for ban status changes
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const banUnsubscribe = onSnapshot(userDocRef, 
            (docSnapshot) => {
              if (docSnapshot.exists()) {
                const userData = docSnapshot.data() as UserData;
                
                // Check if user just got deactivated (with backward compatibility)
                if (userData.status === 'deactivated' || (userData as any).status === 'banned') {
                  console.log('User banned detected in real-time');
                  
                  // IMMEDIATELY stop listening to prevent permission errors
                  banUnsubscribe();
                  setBanListenerUnsubscribe(null);
                  
                  // Update state
                  setIsBanned(true);
                  setBanInfo(userData.banInfo || {});
                  
                  // Logout user immediately when banned
                  handleImmediateBanLogout(userData);
                } else if (userData.status === 'active') {
                  // User was unbanned
                  setIsBanned(false);
                  setBanInfo(null);
                }

                // Update user data and check email verification status
                setUserData(userData);
                if (firebaseUser) {
                  // Check email verification status asynchronously
                  authService.needsEmailVerification(firebaseUser, userData)
                    .then(needsVerification => {
                      setNeedsEmailVerification(needsVerification);
                    })
                    .catch(error => {
                      console.error('Error checking email verification status in listener:', error);
                    });
                }
              } else {
                // Document doesn't exist - account has been deleted
                console.log('🚨 User document deleted - account has been deleted from web');

                // IMMEDIATELY stop listening to prevent permission errors
                banUnsubscribe();
                setBanListenerUnsubscribe(null);

                // Use the dedicated account deletion logout function
                handleAccountDeletionLogout();
              }
            },
              (error) => {
              // Error handler - if listener fails, clean up gracefully
              console.warn('Ban listener error:', error);

              // Check if this is a permission error indicating account deletion
              const isPermissionError = error?.code === 'permission-denied' ||
                error?.message?.includes('Missing or insufficient permissions') ||
                error?.message?.includes('No document to update') ||
                error?.message?.includes('not found') ||
                error?.message?.includes('does not exist') ||
                error?.code === 'not-found';

              if (isPermissionError && firebaseUser) {
                console.log('🚨 Permission denied - account may have been deleted from web');

                // IMMEDIATELY stop listening
                banUnsubscribe();
                setBanListenerUnsubscribe(null);

                // Use the dedicated account deletion logout function
                handleAccountDeletionLogout();
              } else {
                // For other errors, just clean up and start periodic checking
                banUnsubscribe();
                setBanListenerUnsubscribe(null);

                // Fallback: start periodic ban checking
                startPeriodicBanCheck();
              }
            }
          );
          
          // Store unsubscribe function for cleanup
          setBanListenerUnsubscribe(() => banUnsubscribe);
          
        } catch (error: any) {
          console.error('AuthContext: Error fetching user data:', error);
          setUserData(null);
          setIsBanned(false);
          setBanInfo(null);
        }
      } else {
        // User logged out - clean up all listeners first
        try {
          listenerManager.removeAllListeners();
        } catch (error) {
          console.error('AuthContext: Error during listener cleanup:', error);
          // Force cleanup if normal cleanup fails
          listenerManager.forceCleanup();
        }
        
        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      
      // First, authenticate with Firebase
      await authService.login(email, password);
      
      // Get the current user to check ban status
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          // Fetch user data to check ban status
          const userData = await authService.getUserData(currentUser.uid);
          
          // Check if user is deactivated (with backward compatibility)
          if (userData && (userData.status === 'deactivated' || (userData as any).status === 'banned')) {
            // User is banned - log them out immediately
            await authService.logout();
            
            // Set ban status for potential UI display
            setIsBanned(true);
            setBanInfo(userData.banInfo || {});
            setIsAuthenticated(false);
            setUser(null);
            setUserData(null);
            
            // Show ban toast message instead of redirecting
            showBanToast(userData);
            return;
          }
        } catch (error: any) {
          // If there's an error checking ban status, still allow login
          // (fail-safe approach - don't block users due to technical issues)
          console.warn('AuthContext: Could not verify ban status, allowing login:', error);
        }
      }
      
      // onAuthStateChanged will handle updating the state for non-banned users
    } catch (error: any) {
      console.error('AuthContext: Login failed:', error);
      setLoading(false);
      throw new Error(getFirebaseErrorMessage(error));
    }
  };

  const register = async (
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string, 
    contactNum: string,
    studentId: string
  ): Promise<void> => {
    try {
      setLoading(true);
      await authService.register(email, password, firstName, lastName, contactNum, studentId);
      // onAuthStateChanged will handle updating the state
    } catch (error: any) {
      console.error('AuthContext: Registration failed:', error);
      setLoading(false);
      throw new Error(getFirebaseErrorMessage(error));
    }
  };


  const logout = async (): Promise<void> => {
    try {
      setLoading(true);

      // Clean up ban listener
      if (banListenerUnsubscribe) {
        banListenerUnsubscribe();
        setBanListenerUnsubscribe(null);
      }

      // Clean up periodic check interval
      if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
        setPeriodicCheckInterval(null);
      }

      // Clean up listeners before logout
      try {
        listenerManager.removeAllListeners();
      } catch (error) {
        console.error('AuthContext: Error during pre-logout cleanup:', error);
        listenerManager.forceCleanup();
      }

      await authService.logout();
      // onAuthStateChanged will handle updating the state
    } catch (error: any) {
      console.error('AuthContext: Logout failed:', error);
      setLoading(false);
      throw new Error(getFirebaseErrorMessage(error));
    }
  };

  const refreshUserData = async (): Promise<void> => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data() as UserData);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const handleEmailVerificationComplete = async (): Promise<void> => {
    if (!user) return;

    try {
      // Update the user's email verification status in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        emailVerified: true,
        updatedAt: serverTimestamp()
      });

      // Check if user already has a notification subscription
      try {
        const existingSubscription = await notificationSubscriptionService.getSubscription(user.uid);
        
        if (!existingSubscription) {
          await notificationSubscriptionService.createSubscription({
            userId: user.uid,
            isActive: true,
            preferences: {
              newPosts: true,
              messages: true,
              claimUpdates: true,
              adminAlerts: true
            }
          });
          console.log('📱 Created new notification subscription after email verification');
        }
      } catch (subscriptionError) {
        console.error('Failed to create notification subscription after email verification:', subscriptionError);
        // Don't fail email verification if subscription fails
      }

      // Initialize notifications now that email is verified
      try {
        const messagingInitialized = await notificationService.initializeMessaging();
        if (messagingInitialized) {
          const fcmToken = (notificationService as any).fcmToken;
          if (fcmToken) {
            await notificationService.saveFCMToken(user.uid, fcmToken);
            console.log('FCM notifications initialized after email verification');
          }
          notificationService.setupMessageListener();
        }
      } catch (notificationError) {
        console.error('Error initializing notifications after email verification:', notificationError);
      }

      // Refresh user data to get the updated document
      await refreshUserData();

      console.log('Email verification completed successfully');
    } catch (error: any) {
      console.error('Failed to complete email verification:', error);
      throw new Error('Failed to complete email verification');
    }
  };

  const handleImmediateBanLogout = async (bannedUserData: UserData) => {
    try {
      console.log('Immediate logout due to ban detected');

      // Clean up ban listener
      if (banListenerUnsubscribe) {
        banListenerUnsubscribe();
        setBanListenerUnsubscribe(null);
      }

      // Logout user immediately
      await authService.logout();

      // Reset all auth state
      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setIsBanned(true);
      setBanInfo(bannedUserData.banInfo || {});

      // Show ban toast message
      showBanToast(bannedUserData);

    } catch (error) {
      console.error('Error during immediate ban logout:', error);
    }
  };

  const handleAccountDeletionLogout = async () => {
    try {
      console.log('Account deletion detected - logging out user');

      // Clean up ban listener
      if (banListenerUnsubscribe) {
        banListenerUnsubscribe();
        setBanListenerUnsubscribe(null);
      }

      // Clean up periodic check interval
      if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
        setPeriodicCheckInterval(null);
      }

      // Clear all user data and force logout
      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setIsBanned(false);
      setBanInfo(null);
      setNeedsEmailVerification(false);

      // Clean up listeners
      try {
        listenerManager.removeAllListeners();
      } catch (error) {
        console.error('AuthContext: Error during listener cleanup:', error);
        listenerManager.forceCleanup();
      }

      // Force logout from Firebase
      await authService.logout();

    } catch (error) {
      console.error('Error during account deletion logout:', error);
    }
  };

  const showBanToast = (bannedUserData: UserData) => {
    // Create a custom toast notification for ban
    const banReason = bannedUserData.banInfo?.reason || 'No reason provided';
    const banDuration = bannedUserData.banInfo?.duration || 'Unknown';
    const banEndDate = bannedUserData.banInfo?.banEndDate;

    let banMessage = `🚫 Account Banned\nReason: ${banReason}\nDuration: ${banDuration === 'permanent' ? 'Permanent' : 'Temporary'}`;

    if (banEndDate && banDuration === 'temporary') {
      const endDate = new Date(banEndDate.toDate ? banEndDate.toDate() : banEndDate);
      banMessage += `\nExpires: ${endDate.toLocaleDateString()}`;
    }

    // Create and show the toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md';
    toast.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="flex-shrink-0">
          <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div class="flex-1">
          <div class="font-medium">Account Banned</div>
          <div class="text-sm opacity-90">${banMessage.replace(/\n/g, '<br>')}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;

    // Add to page
    document.body.appendChild(toast);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 10000);
  };

  const startPeriodicBanCheck = () => {
    // SMART BAN CHECKING: Only run periodic checks if real-time listener fails
    // This prevents unnecessary quota consumption for non-banned users
    console.log('🔄 Starting smart ban check system (frontend)');

    const intervalId = setInterval(async () => {
      if (!auth.currentUser) {
        clearInterval(intervalId);
        return;
      }

      try {
        const userData = await authService.getUserData(auth.currentUser.uid);
        if (userData && (userData.status === 'deactivated' || (userData as any).status === 'banned')) {
          console.log('Ban detected via periodic check');
          clearInterval(intervalId);
          handleImmediateBanLogout(userData);
        }
        // Also check if current user is still valid (tokens not revoked)
        else if (auth.currentUser) {
          try {
            // Test if current token is still valid
            await auth.currentUser.getIdToken();
          } catch (tokenError: any) {
            if (tokenError.code === 'auth/id-token-revoked' || tokenError.code === 'auth/user-token-expired') {
              console.log('🚨 Token revoked or expired - account may have been deleted');
              clearInterval(intervalId);
              handleAccountDeletionLogout();
            }
          }
        }
      } catch (error: any) {
        // Handle quota errors gracefully - don't spam the console
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          console.warn('Periodic ban check quota exceeded - will retry later');
          // Don't clear interval - let it retry when quota resets
        } else if (error?.code === 'permission-denied' ||
                   error?.message?.includes('Missing or insufficient permissions') ||
                   error?.message?.includes('not found') ||
                   error?.message?.includes('does not exist') ||
                   error?.code === 'not-found') {
          // Account may have been deleted - force logout
          console.log('🚨 Periodic check: Account may have been deleted from web');
          clearInterval(intervalId);
          handleAccountDeletionLogout();
        } else {
          console.warn('Periodic ban check error:', error);
        }
        // Continue checking - don't stop on errors
      }
    }, 300000); // Check every 5 minutes (300,000 ms)

    // Store interval ID for cleanup
    setPeriodicCheckInterval(intervalId);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        userData,
        loading,
        isBanned,
        banInfo,
        needsEmailVerification,
        login,
        register,
        logout,
        refreshUserData,
        handleEmailVerificationComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
