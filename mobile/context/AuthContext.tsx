import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, authService, UserData, db, userService } from '../utils/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { credentialStorage } from '../utils/credentialStorage';
import { notificationService } from '../utils/firebase/notifications';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  banInfo: any;
  showBanNotification: boolean;
  setShowBanNotification: (show: boolean) => void;
  needsEmailVerification: boolean;
  loginAttemptFailed: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  handleEmailVerificationComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [banInfo, setBanInfo] = useState<any>(null);
  const [showBanNotification, setShowBanNotification] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);

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
      setLoading(true); // Ensure loading state is true during auto-login

            const storedCredentials = await credentialStorage.getStoredCredentials();

      if (!storedCredentials) {
                setLoading(false); // Set loading false if no credentials
        return false;
      }

      
      // Attempt login with stored credentials
      const userCredential = await signInWithEmailAndPassword(
        auth,
        storedCredentials.email,
        storedCredentials.password
      );

            // Keep loading true - onAuthStateChanged will handle setting it false
      return true;

    } catch (error: any) {
      console.error('❌ AuthContext: Auto-login failed:', error);

      // Clear invalid credentials
      try {
        await credentialStorage.clearCredentials();
              } catch (clearError) {
        console.error('❌ AuthContext: Failed to clear invalid credentials:', clearError);
      }

      setLoading(false); // Set loading false on error
      return false;
    } finally {
      setIsAutoLogging(false);
    }
  };

  // Listen for authentication state changes
  useEffect(() => {
    let hasAttemptedAutoLogin = false;
    let isProcessingAutoLogin = false;
    let autoLoginTimeout: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      console.log('Auth state changed, user:', firebaseUser ? firebaseUser.uid : 'null');
      
      // Clear any existing auto-login timeout
      if (autoLoginTimeout) {
        clearTimeout(autoLoginTimeout);
      }
      
      // Handle null user (signed out) case first
      if (!firebaseUser) {
        console.log('No user signed in, resetting auth state');
        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
        setIsBanned(false);
        setIsAdmin(false);
        setBanInfo(null);
        setNeedsEmailVerification(false);
        setLoading(false);
        return;
      }

      if (firebaseUser) {
                setUser(firebaseUser);
        // Don't set isAuthenticated yet - wait for verification check

        // SET LOADING TO TRUE: Start processing user authentication
        setLoading(true);

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

          // Check email verification status
          if (fetchedUserData) {
                        // IMPORTANT: Add a small delay to ensure Firebase Auth state is fully updated
            await new Promise(resolve => setTimeout(resolve, 500));

            // Reload user data to get the latest email verification status from Firebase Auth
            await firebaseUser.reload();

            const needsVerification = await userService.needsEmailVerification(firebaseUser, fetchedUserData);
                                                setNeedsEmailVerification(needsVerification);

            // If Firebase email is verified but Firestore is not, update Firestore and authenticate user
            if (firebaseUser.emailVerified && !fetchedUserData.emailVerified) {
              try {
                console.log('🔄 Firebase Auth shows verified but Firestore shows unverified - updating Firestore...');
                await userService.updateUserData(firebaseUser.uid, { emailVerified: true });
                // Update local userData to reflect the change
                setUserData({ ...fetchedUserData, emailVerified: true });
                console.log('✅ Firestore updated - user is now fully authenticated');
                // Since email is verified, set authenticated immediately
                setIsAuthenticated(true);
                setNeedsEmailVerification(false);
              } catch (error) {
                console.error('Failed to update email verification status in Firestore:', error);
                // Continue with authentication even if Firestore update fails
                // Firebase verification is what matters for authentication
                setIsAuthenticated(true);
                setNeedsEmailVerification(false);
              }
            }

            // Set authenticated state based on verification check (skip if already set above)
            if (!needsVerification && !isAuthenticated) {
              setIsAuthenticated(true);
            } else if (needsVerification && isAuthenticated) {
              // User needs verification, ensure they're not authenticated
              setIsAuthenticated(false);
            }
          } else {
                        // NEW USER: Immediately set verification requirement to prevent race condition
            setNeedsEmailVerification(true);
            setIsAuthenticated(false); // Explicitly set to false for new users

            // User document should already be created by the register function
            // Only create it here as a fallback if it somehow doesn't exist
            try {
              // Get user profile data from Firebase Auth
              const displayName = firebaseUser.displayName || '';
              const nameParts = displayName.split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';

              // Create user document with unverified email status (fallback)
              await userService.createUser(firebaseUser.uid, {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                firstName: firstName,
                lastName: lastName,
                contactNum: '', // Will be updated later if needed
                studentId: '', // Will be updated later if needed
                emailVerified: false, // New users need to verify their email
                createdAt: new Date(),
                updatedAt: new Date()
              });

                            // Note: needsEmailVerification is already set to true above

              // Set the newly created user data
              const newUserData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                firstName: firstName,
                lastName: lastName,
                contactNum: '',
                studentId: '',
                emailVerified: false,
                createdAt: new Date(),
                updatedAt: new Date()
              };
              setUserData(newUserData);

            } catch (createError) {
              console.error('Failed to create fallback user document:', createError);
              // Keep needsEmailVerification as true even if document creation fails
              setIsAuthenticated(false);
            }
          }

          // Set loading to false after successful authentication and data fetch
          // Only set loading to false after all authentication checks are complete
          setLoading(false);

          // Initialize notifications for authenticated user (only if email is verified)
          // For new users, fetch user data again after creating the document
          let userDataForNotifications = fetchedUserData;
          if (!fetchedUserData) {
            // Try to fetch user data again after creating the document
            try {
              userDataForNotifications = await authService.getUserData(firebaseUser.uid);
              setUserData(userDataForNotifications);
            } catch (error) {
              console.error('Failed to fetch user data after creation:', error);
            }
          }

          if (userDataForNotifications && userDataForNotifications.emailVerified) {
            try {
              const pushToken = await notificationService.registerForPushNotifications();
              if (pushToken) {
                await notificationService.savePushToken(firebaseUser.uid, pushToken);
              }
            } catch (error) {
              console.error('Error initializing notifications:', error);
            }
          }

          // Start monitoring this specific user for ban status changes
          // Only set up listener if user is authenticated to prevent permission errors during logout
          if (firebaseUser && firebaseUser.uid && !needsEmailVerification) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const banUnsubscribe = onSnapshot(userDocRef,
              (docSnapshot: any) => {
                if (docSnapshot.exists()) {
                  const userData = docSnapshot.data() as UserData & { status?: 'active' | 'deactivated' | 'banned' };

                  // Check if user just got deactivated (with backward compatibility)
                  if (userData.status === 'deactivated' || userData.status === 'banned') {
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
                } else {
                  // Document doesn't exist - account has been deleted
                  console.log('🚨 User document deleted - account has been deleted from web');

                  // IMMEDIATELY stop listening to prevent permission errors
                  banUnsubscribe();
                  banListenerRef.current = null;

                  // Clear all user data and force logout
                  setUser(null);
                  setUserData(null);
                  setIsAuthenticated(false);
                  setIsBanned(false);
                  setIsAdmin(false);
                  setBanInfo(null);
                  setNeedsEmailVerification(false);
                  setLoginAttemptFailed(false);

                  // Clear stored credentials
                  credentialStorage.clearCredentials().catch(error => {
                    console.warn('Error clearing credentials during account deletion:', error);
                  });

                  // Force navigation to login by triggering Firebase logout
                  authService.logout().catch(error => {
                    console.error('Error during forced logout after account deletion:', error);
                  });
                }
              },
              (error: any) => {
                // Error handler - if listener fails, clean up gracefully
                const isPermissionError = error?.code === 'permission-denied' ||
                  error?.message?.includes('Missing or insufficient permissions') ||
                  error?.message?.includes('No document to update') ||
                  error?.message?.includes('not found') ||
                  error?.message?.includes('does not exist') ||
                  error?.code === 'not-found';

                if (isPermissionError && firebaseUser) {
                  // Permission denied - account may have been deleted from web
                  console.log('🚨 Permission denied - account may have been deleted from web');

                  // IMMEDIATELY stop listening to prevent further errors
                  banUnsubscribe();
                  banListenerRef.current = null;

                  // Clear all user data and force logout
                  setUser(null);
                  setUserData(null);
                  setIsAuthenticated(false);
                  setIsBanned(false);
                  setIsAdmin(false);
                  setBanInfo(null);
                  setNeedsEmailVerification(false);
                  setLoginAttemptFailed(false);

                  // Clear stored credentials
                  credentialStorage.clearCredentials().catch(credentialError => {
                    console.warn('Error clearing credentials during account deletion:', credentialError);
                  });

                  // Force logout from Firebase
                  authService.logout().catch(logoutError => {
                    console.error('Error during forced logout after account deletion:', logoutError);
                  });
                } else {
                  // For other errors, clean up and start fallback
                  console.warn('Ban listener error (mobile):', error);

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
        // User logged out or no user - clean up all listeners
        
        // Clean up ban listener if it exists
        if (banListenerRef.current) {
          banListenerRef.current();
          banListenerRef.current = null;
        }

        // Clean up smart ban check if it exists
        if (smartBanCheckRef.current) {
          smartBanCheckRef.current.deactivatePeriodicChecks();
          smartBanCheckRef.current = null;
        }

        // Reset all auth state immediately when user logs out
        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
        setIsBanned(false);
        setIsAdmin(false);
        setBanInfo(null);
        setNeedsEmailVerification(false);
        setLoginAttemptFailed(false);

        // No authenticated user - try auto-login with improved logic
        if (!hasAttemptedAutoLogin && !isProcessingAutoLogin) {
          hasAttemptedAutoLogin = true;
          isProcessingAutoLogin = true;

          
          // Add a small delay to ensure Firebase Auth state is fully settled
          autoLoginTimeout = setTimeout(async () => {
            try {
              const autoLoginSuccess = await attemptAutoLogin();

              if (autoLoginSuccess) {
                                // If auto-login succeeds, onAuthStateChanged will be called again with the user
                // We don't need to do anything here - the next call will handle the authenticated state
                // Loading state will be managed by the authenticated user branch
              } else {
                                // Auto-login failed or no credentials - user needs to login manually
                setLoading(false);
              }
            } catch (error) {
              console.error('❌ Auto-login error:', error);
              setLoading(false);
            } finally {
              isProcessingAutoLogin = false;
            }
          }, 1000);
        } else {
                    // Already attempted auto-login, user is truly not authenticated
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribe();

      // Clean up auto-login timeout
      if (autoLoginTimeout) {
        clearTimeout(autoLoginTimeout);
        autoLoginTimeout = null;
      }

      // Clean up ban listener on component unmount
      if (banListenerRef.current) {
        banListenerRef.current();
        banListenerRef.current = null;
      }

      // Clean up smart ban check on component unmount
      if (smartBanCheckRef.current) {
        smartBanCheckRef.current.deactivatePeriodicChecks();
        smartBanCheckRef.current = null;
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    // Reset login attempt flag and any previous auth state before attempting login
    setLoginAttemptFailed(false);
    setUser(null);
    setUserData(null);
    setIsAuthenticated(false);
    setIsBanned(false);
    setIsAdmin(false);
    setBanInfo(null);
    setNeedsEmailVerification(false);

    try {
      setLoading(true);

      // First check if user exists and get their data BEFORE Firebase login
      // We need to check verification status before allowing Firebase Auth login
      try {
        // Try to find user document by email (this is a workaround since we can't query by email directly)
        // For now, we'll proceed with Firebase login and check immediately after
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user data to check verification status
        const userData = await authService.getUserData(user.uid);

        // Check email verification status and logout unverified users
        if (userData) {
          const needsVerification = await userService.needsEmailVerification(user, userData);

          if (needsVerification) {
            // Keep user logged in but mark as needing verification
            // Don't set isAuthenticated to true, but also don't log them out
            setUser(user);
            setUserData(userData);
            setIsAuthenticated(false); // Explicitly set to false
            setNeedsEmailVerification(true);

            // Store credentials for auto-login (even for unverified users)
            try {
              await credentialStorage.saveCredentials(email, password);
            } catch (storageError) {
              console.warn('Failed to store credentials for auto-login:', storageError);
              // Continue with verification flow even if credential storage fails
            }

            // Throw error to prevent normal login flow
            throw new Error('EMAIL_VERIFICATION_REQUIRED');
          } else {
            // Store credentials for auto-login
            try {
              await credentialStorage.saveCredentials(email, password);
            } catch (storageError) {
              console.warn('Failed to store credentials for auto-login:', storageError);
              // Continue with login even if credential storage fails
            }
          }
        } else {
          // User document should already exist from registration
          // Only create it here as a fallback if it somehow doesn't exist
          try {
            // Get user profile data from Firebase Auth
            const displayName = user.displayName || '';
            const nameParts = displayName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Create user document with unverified email status (fallback)
            await userService.createUser(user.uid, {
              uid: user.uid,
              email: user.email || '',
              firstName: firstName,
              lastName: lastName,
              contactNum: '', // Will be updated later if needed
              studentId: '', // Will be updated later if needed
              emailVerified: false, // New users need to verify their email
              createdAt: new Date(),
              updatedAt: new Date()
            });

            setUser(user);
            setUserData({
              uid: user.uid,
              email: user.email || '',
              firstName: firstName,
              lastName: lastName,
              contactNum: '',
              studentId: '',
              emailVerified: false,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            setNeedsEmailVerification(true);
            setIsAuthenticated(false);

            // Throw error to prevent normal login flow
            throw new Error('EMAIL_VERIFICATION_REQUIRED');
          } catch (createError) {
            console.error('Failed to create user document during login:', createError);
            setNeedsEmailVerification(false);
            setIsAuthenticated(false);
          }
        }

        // User is verified, login will be handled by onAuthStateChanged listener
      } catch (verificationError: any) {
        // If it's our verification error, re-throw it
        if (verificationError.message.includes('Email verification required') ||
            verificationError.message.includes('User account not found')) {
          throw verificationError;
        }
        // Otherwise, it's a Firebase login error, throw it
        throw verificationError;
      }

    } catch (error: any) {
      // Only set login attempt failed flag for actual login failures, not EMAIL_VERIFICATION_REQUIRED
      if (!error.message || !error.message.includes('EMAIL_VERIFICATION_REQUIRED')) {
        setLoginAttemptFailed(true);
      }

      // Don't reset user/userData for EMAIL_VERIFICATION_REQUIRED errors
      // as this state should persist to show the verification UI
      if (!error.message || !error.message.includes('EMAIL_VERIFICATION_REQUIRED')) {
        // Reset auth state on login failure to ensure user stays on login screen
        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
        setIsBanned(false);
        setIsAdmin(false);
        setBanInfo(null);
        setNeedsEmailVerification(false);
      } else {
        // For EMAIL_VERIFICATION_REQUIRED, ensure needsEmailVerification is set to true
        setNeedsEmailVerification(true);
        setIsAuthenticated(false); // User is logged in but not verified
      }

      // Don't log EMAIL_VERIFICATION_REQUIRED as an error since it's expected behavior
      if (!error.message || !error.message.includes('EMAIL_VERIFICATION_REQUIRED')) {
        console.error('Login error:', error);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    console.log('Logout initiated');
    try {
      setLoading(true);
      
      // 1. Clean up ban listener to prevent permission errors during logout
      if (banListenerRef.current) {
        console.log('Cleaning up ban listener');
        banListenerRef.current();
        banListenerRef.current = null;
      }
      
      // 2. Clear stored credentials for auto-login
      try {
        console.log('Clearing stored credentials');
        await credentialStorage.clearCredentials();
      } catch (credentialError) {
        console.warn('Error clearing stored credentials:', credentialError);
        // Continue with logout even if clearing credentials fails
      }
      
      // 3. Clear stored user preferences and data
      try {
        console.log('Clearing AsyncStorage data');
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
      } catch (storageError) {
        console.log('Error clearing some stored data:', storageError);
        // Continue with logout even if clearing storage fails
      }
      
      // 4. Sign out from Firebase
      try {
        console.log('Signing out from Firebase');
        await authService.logout();
      } catch (error) {
        console.error('Error during Firebase sign out:', error);
        // Continue with local state cleanup even if Firebase sign out fails
      }
      
      // 5. Force reset auth state immediately
      console.log('Resetting auth state');
      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setIsBanned(false);
      setIsAdmin(false);
      setBanInfo(null);
      setNeedsEmailVerification(false);
      
      console.log('Logout completed successfully');
    } catch (error: any) {
      console.error('Logout error:', error);
      // Even if logout fails, ensure loading state is reset
      setLoading(false);
      throw new Error(error.message || 'Failed to logout');
    } finally {
      // Ensure loading state is reset in all cases
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const refreshUserData = async (): Promise<void> => {
    if (user && isAuthenticated) {
      try {
        const fetchedUserData = await authService.getUserData(user.uid);

        if (fetchedUserData) {
          setUserData(fetchedUserData);

          // Update deactivation status when refreshing user data (with backward compatibility)
          if (fetchedUserData && (fetchedUserData.status === 'deactivated' || fetchedUserData.status === 'banned')) {
            setIsBanned(true);
            setBanInfo(fetchedUserData.banInfo || {});
          } else {
            setIsBanned(false);
            setBanInfo(null);
          }

          // Check email verification status
          if (fetchedUserData) {
            // Add a small delay to ensure Firebase Auth state is fully updated
            await new Promise(resolve => setTimeout(resolve, 300));

            await user.reload();
            const needsVerification = await userService.needsEmailVerification(user, fetchedUserData);
            setNeedsEmailVerification(needsVerification);

            // If Firebase email is verified but Firestore is not, update Firestore and authenticate user
            if (user.emailVerified && !fetchedUserData.emailVerified) {
              try {
                console.log('🔄 refreshUserData: Firebase Auth shows verified but Firestore shows unverified - updating Firestore...');
                await userService.updateUserData(user.uid, { emailVerified: true });
                // Update local userData to reflect the change
                setUserData({ ...fetchedUserData, emailVerified: true });
                console.log('✅ refreshUserData: Firestore updated - user is now fully authenticated');
                // Since email is verified, set authenticated immediately
                setIsAuthenticated(true);
                setNeedsEmailVerification(false);
              } catch (error) {
                console.error('refreshUserData: Failed to update email verification status in Firestore:', error);
                // Continue with authentication even if Firestore update fails
                setIsAuthenticated(true);
                setNeedsEmailVerification(false);
              }
            } else {
              // If user is now verified but was not authenticated, update auth state
              if (!needsVerification && !isAuthenticated) {
                setIsAuthenticated(true);
              }
            }
          }
        } else {
          // User document doesn't exist - account has been deleted
          console.log('🚨 refreshUserData: User document deleted - account has been deleted from web');

          // Clear all user data and force logout
          setUser(null);
          setUserData(null);
          setIsAuthenticated(false);
          setIsBanned(false);
          setIsAdmin(false);
          setBanInfo(null);
          setNeedsEmailVerification(false);
          setLoginAttemptFailed(false);

          // Clear stored credentials
          credentialStorage.clearCredentials().catch(error => {
            console.warn('Error clearing credentials during account deletion:', error);
          });

          // Force logout from Firebase
          authService.logout().catch(error => {
            console.error('Error during forced logout after account deletion:', error);
          });
        }
      } catch (error: any) {
        // Check if this is a permission error indicating account deletion
        if (error?.code === 'permission-denied' ||
            error?.message?.includes('Missing or insufficient permissions') ||
            error?.message?.includes('not found') ||
            error?.message?.includes('does not exist') ||
            error?.code === 'not-found') {
          console.log('🚨 refreshUserData: Permission denied - account may have been deleted from web');

          // Clear all user data and force logout
          setUser(null);
          setUserData(null);
          setIsAuthenticated(false);
          setIsBanned(false);
          setIsAdmin(false);
          setBanInfo(null);
          setNeedsEmailVerification(false);
          setLoginAttemptFailed(false);

          // Clear stored credentials
          credentialStorage.clearCredentials().catch(credentialError => {
            console.warn('Error clearing credentials during account deletion:', credentialError);
          });

          // Force logout from Firebase
          authService.logout().catch(logoutError => {
            console.error('Error during forced logout after account deletion:', logoutError);
          });
        } else {
          console.error('Error refreshing user data:', error);
          setIsBanned(false);
          setBanInfo(null);
        }
      }
    }
  };

  const handleEmailVerificationComplete = async (): Promise<void> => {
    if (!user || !userData) {
      return;
    }

    try {
      // Reload user to get latest Firebase Auth state
      await user.reload();

      // Check if email is actually verified in Firebase Auth
      if (!user.emailVerified) {
        console.log('❌ Firebase Auth still shows unverified');
        setIsAuthenticated(false);
        setNeedsEmailVerification(true);
        setLoading(false);
        throw new Error('Email verification failed - please try again');
      }

      // Update Firestore email verification status (with error handling for concurrent updates)
      try {
        await userService.updateUserData(user.uid, { emailVerified: true });
        console.log('✅ Firestore email verification updated successfully');
      } catch (firestoreError: any) {
        // If Firestore update fails due to concurrent update (already verified), that's okay
        if (firestoreError?.code === 'already-exists' ||
            firestoreError?.message?.includes('already verified') ||
            firestoreError?.code === 'permission-denied') {
          console.log('✅ Firestore already updated (likely by web), continuing with authentication');
        } else {
          console.warn('Firestore update warning:', firestoreError);
          // Continue anyway - Firebase Auth verification is what matters
        }
      }

      // Refresh user data to get updated verification status
      const updatedUserData = await authService.getUserData(user.uid);
      setUserData(updatedUserData);

      // Update authentication state since email is now verified
      setIsAuthenticated(true);
      setNeedsEmailVerification(false);

      // CRITICAL: Ensure loading state is reset after verification
      setLoading(false);

      console.log('✅ Email verification completed successfully');
      console.log('🔄 AuthContext state updated: isAuthenticated:', true, 'needsEmailVerification:', false);

      // Add small delay to ensure state propagation before Navigation routes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now that email is verified, save push token
      try {
        const pushToken = await notificationService.registerForPushNotifications();
        if (pushToken) {
          await notificationService.savePushToken(user.uid, pushToken);
        }
      } catch (notificationError) {
        console.error('Error saving push token after verification:', notificationError);
        // Don't fail verification if push token saving fails
      }
    } catch (error: any) {
      console.error('❌ Failed to complete email verification:', error);

      // If Firestore update fails, check if Firebase Auth is actually verified
      try {
        await user.reload();
        if (user.emailVerified) {
          // Still set authenticated since Firebase verification is what matters
          console.log('✅ Firebase Auth verified despite Firestore error, setting authenticated');
          console.log('🔄 AuthContext state updated: isAuthenticated:', true, 'needsEmailVerification:', false);
          setIsAuthenticated(true);
          setNeedsEmailVerification(false);
          setLoading(false);

          // Add small delay to ensure state propagation
          await new Promise(resolve => setTimeout(resolve, 100));

          // Try to update Firestore again in background
          userService.updateUserData(user.uid, { emailVerified: true }).catch(updateError => {
            console.error('Background Firestore update also failed:', updateError);
          });
        } else {
          console.error('❌ Firebase Auth still shows unverified');
          setIsAuthenticated(false);
          setNeedsEmailVerification(true);
          setLoading(false);
          throw new Error('Email verification failed - please try again');
        }
      } catch (reloadError) {
        console.error('❌ Error reloading user after verification failure:', reloadError);
        setIsAuthenticated(false);
        setNeedsEmailVerification(true);
        setLoading(false);
        throw new Error('Verification check failed - please try again');
      }
    }
  };

  const handleImmediateBanLogout = async (bannedUserData: UserData & { status?: 'active' | 'deactivated' | 'banned' }) => {
    try {
      // Clean up ban listener before logout to prevent permission errors
      if (banListenerRef.current) {
        banListenerRef.current();
        banListenerRef.current = null;
      }

      // Clear stored credentials for auto-login (banned users shouldn't auto-login)
      try {
        await credentialStorage.clearCredentials();
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
    const intervalId = setInterval(async () => {
      if (!auth.currentUser) {
        clearInterval(intervalId);
        return;
      }

      try {
        const userData = await authService.getUserData(auth.currentUser.uid);
        if (userData && (userData.status === 'deactivated' || userData.status === 'banned')) {
          clearInterval(intervalId);
          handleImmediateBanLogout(userData);
        }
      } catch (error: any) {
        // Handle quota errors gracefully - don't spam the console
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          console.warn('Periodic ban check quota exceeded (mobile) - will retry later');
          // Don't clear interval - let it retry when quota resets
        } else if (error?.code === 'permission-denied' ||
                   error?.message?.includes('Missing or insufficient permissions') ||
                   error?.message?.includes('not found') ||
                   error?.message?.includes('does not exist') ||
                   error?.code === 'not-found') {
          // Account may have been deleted - force logout
          console.log('🚨 Periodic check: Account may have been deleted from web');
          clearInterval(intervalId);
          handleImmediateBanLogout({} as UserData);
        } else {
          console.warn('Periodic ban check error (mobile):', error);
        }
        // Continue checking - don't stop on errors
      }
    }, 300000); // Check every 5 minutes (300,000 ms)
  };

  // NEW: Smart ban checking that only runs when needed
  const startSmartBanCheck = () => {
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
              // Clear all user data and force logout for account deletion
              setUser(null);
              setUserData(null);
              setIsAuthenticated(false);
              setIsBanned(false);
              setIsAdmin(false);
              setBanInfo(null);
              setNeedsEmailVerification(false);
              setLoginAttemptFailed(false);

              // Clear stored credentials
              credentialStorage.clearCredentials().catch(credentialError => {
                console.warn('Error clearing credentials during account deletion:', credentialError);
              });

              // Force logout from Firebase
              authService.logout().catch(logoutError => {
                console.error('Error during forced logout after account deletion:', logoutError);
              });
            }
          }
        }
      } catch (error: any) {
        // Handle quota errors gracefully - don't spam the console
        if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
          console.warn('Periodic ban check quota exceeded (mobile) - will retry later');
          // Don't clear interval - let it retry when quota resets
        } else if (error?.code === 'permission-denied' ||
                   error?.message?.includes('Missing or insufficient permissions') ||
                   error?.message?.includes('not found') ||
                   error?.message?.includes('does not exist') ||
                   error?.code === 'not-found') {
          // Account may have been deleted - force logout
          console.log('🚨 Smart check: Account may have been deleted from web');
          clearInterval(intervalId);
          handleImmediateBanLogout({} as UserData);
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
      },
      deactivatePeriodicChecks: () => {
        periodicCheckActive = false;
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
        needsEmailVerification,
        loginAttemptFailed,
        login,
        logout,
        refreshUserData,
        handleEmailVerificationComplete
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
