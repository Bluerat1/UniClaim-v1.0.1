import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
  JSX,
} from "react";
import { unstable_batchedUpdates } from "react-native";
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { CommonActions } from "@react-navigation/native";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, authService, db, userService } from "../utils/firebase";
import type { UserData } from "../utils/firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { credentialStorage } from "../utils/credentialStorage";
import { notificationService } from "../utils/firebase/notifications";
import { notificationSubscriptionService } from "../utils/firebase/notificationSubscriptions";

// Using UserData type from auth service

interface LoginResult {
  error?: string;
  success?: boolean;
}

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
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
    navigation?: any
  ) => Promise<LoginResult | void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  handleEmailVerificationComplete: () => Promise<void>;
}

// Create a navigation ref to handle navigation outside of React components
export const navigationRef = React.createRef<any>();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Ban info type for better type safety
  interface BanInfo {
    reason?: string;
    bannedAt?: Date | null;
    bannedUntil?: Date | null;
    isPermanent?: boolean;
    adminNote?: string;
  }

  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [showBanNotification, setShowBanNotification] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);

  // Track ban listener to clean up on logout
  type Unsubscribe = () => void;
  const banListenerRef = useRef<Unsubscribe | null>(null);

  // Track smart ban check system
  const smartBanCheckRef = useRef<{
    activatePeriodicChecks: () => void;
    deactivatePeriodicChecks: () => void;
  } | null>(null);

  // Track notification subscription cleanup
  const notificationUnsubscribeRef = useRef<(() => void) | null>(null);

  // Refs to track auto-login state
  const isProcessingAutoLoginRef = useRef(false);
  const hasAttemptedAutoLoginRef = useRef(false);
  const autoLoginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Helper function to check if user is admin
  const checkIfAdmin = (email: string | null): boolean => {
    if (!email) return false;
    const adminEmails = [
      "admin@ustp.edu.ph",
      "superadmin@ustp.edu.ph",
      "admin@uniclaim.com",
    ];
    return adminEmails.includes(email.toLowerCase());
  };

  // Auto-login function
  const attemptAutoLogin = useCallback(async () => {
    if (isProcessingAutoLoginRef.current) {
      return false;
    }

    isProcessingAutoLoginRef.current = true;
    setIsAutoLogging(true);

    try {
      const credentials = await credentialStorage.getStoredCredentials();
      if (!credentials) {
        return false;
      }

      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );

      // Get user data directly after successful login
      const userData = await authService.getUserData(userCredential.user.uid);
      if (!userData) {
        throw new Error("User data not found");
      }

      // Update user state
      const isBannedUser = userData.status === "banned";
      const needsVerification = await userService.needsEmailVerification(
        userCredential.user,
        userData
      );
      const isAdminUser = checkIfAdmin(userData.email);

      setUser(userCredential.user);
      setUserData(userData);
      setIsBanned(isBannedUser);
      setNeedsEmailVerification(needsVerification);
      setIsAdmin(isAdminUser);

      // Set authentication state
      const shouldAuthenticate =
        !isBannedUser && (!needsVerification || isAdminUser);
      setIsAuthenticated(shouldAuthenticate);

      return true;
    } catch (error: any) {
      console.error("❌ AuthContext: Auto-login failed:", error);

      // Clear invalid credentials
      try {
        await credentialStorage.clearCredentials();
      } catch (clearError) {
        console.error(
          "❌ AuthContext: Failed to clear invalid credentials:",
          clearError
        );
      }

      setLoading(false); // Set loading false on error
      return false;
    } finally {
      setIsAutoLogging(false);
      isProcessingAutoLoginRef.current = false;
    }
  }, [credentialStorage]);

  // Track render count for debugging
  const renderCount = useRef(0);
  const isMounted = useRef(true);

  // Memoize derived state to prevent unnecessary re-renders
  const authState = useMemo(() => {
    // Ensure we have all required user data before considering authentication complete
    const isFullyAuthenticated =
      !!user &&
      !!userData &&
      isAuthenticated &&
      !isBanned &&
      !needsEmailVerification;

    return {
      isAuthenticated: isFullyAuthenticated,
      isBanned,
      isAdmin,
      needsEmailVerification,
      loading: loading || (!!user && !userData), // Still loading if we have user but no userData
      loginAttemptFailed,
      user: !!user,
      userData: !!userData,
      userId: user?.uid,
    };
  }, [
    isAuthenticated,
    isBanned,
    isAdmin,
    needsEmailVerification,
    loading,
    loginAttemptFailed,
    user,
    userData,
  ]);

  // Log render count and auth state changes
  useEffect(() => {
    if (!isMounted.current) return;

    renderCount.current += 1;

    return () => {
      isMounted.current = false;
    };
  }, [authState, isAutoLogging]);

  // Listen for authentication state changes
  useEffect(() => {
    // Store the current mounted state
    const isMounted = { current: true };

    // Function to handle auto-login attempt
    const handleAutoLogin = async () => {
      if (hasAttemptedAutoLoginRef.current || isProcessingAutoLoginRef.current)
        return;

      hasAttemptedAutoLoginRef.current = true;
      isProcessingAutoLoginRef.current = true;

      // Add a small delay to ensure Firebase Auth state is fully settled
      autoLoginTimeoutRef.current = setTimeout(async () => {
        try {
          const autoLoginSuccess = await attemptAutoLogin();
          if (!autoLoginSuccess && isMounted.current) {
            setLoading(false);
          }
        } catch (error) {
          console.error("❌ Auto-login error:", error);
          if (isMounted.current) {
            setLoading(false);
          }
        } finally {
          if (isMounted.current) {
            isProcessingAutoLoginRef.current = false;
          }
        }
      }, 1000);
    };

    // Set up the auth state listener
    // Firebase will handle cleanup automatically when the component unmounts
    onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up any existing ban listener
      if (banListenerRef.current) {
        banListenerRef.current();
        banListenerRef.current = null;
      }

      // Handle authenticated user
      if (firebaseUser) {
        try {
          setLoading(true);
          const userData = await authService.getUserData(firebaseUser.uid);

          if (userData) {
            // Check if user is banned or needs verification
            const isBannedUser = userData.status === "banned";
            const needsVerification = await userService.needsEmailVerification(
              firebaseUser,
              userData
            );
            const isAdminUser = checkIfAdmin(userData.email);

            // Update user state in batch to prevent multiple re-renders
            unstable_batchedUpdates(() => {
              setUser(firebaseUser);
              setUserData(userData);
              setIsBanned(isBannedUser);
              setNeedsEmailVerification(needsVerification);
              setIsAdmin(isAdminUser);

              // User is considered authenticated if:
              // 1. Not banned
              // 2. Doesn't need email verification (or is an admin)
              const shouldAuthenticate =
                !isBannedUser && (!needsVerification || isAdminUser);

              // Only update isAuthenticated if this is not an auto-login attempt
              // or if we're processing auto-login and the user should be authenticated
              if (!isProcessingAutoLoginRef.current || shouldAuthenticate) {
                setIsAuthenticated(shouldAuthenticate);
              }
            });

            // If banned, set ban info
            if (isBannedUser) {
              const banInfo = {
                reason:
                  userData.banInfo?.reason || "Account has been suspended",
                bannedAt: userData.banInfo?.bannedAt || null,
                bannedUntil: userData.banInfo?.bannedUntil || null,
                isPermanent: userData.banInfo?.isPermanent || false,
                adminNote: userData.banInfo?.adminNote || "",
              };

              unstable_batchedUpdates(() => {
                setBanInfo(banInfo);
                setShowBanNotification(true);
                setIsAuthenticated(false);
              });

              // Set up ban status listener for real-time updates
              if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const unsubscribe = onSnapshot(userDocRef, (doc) => {
                  if (doc.exists()) {
                    const updatedUserData = doc.data() as UserData;
                    if (updatedUserData.status !== "banned") {
                      // User is no longer banned
                      unstable_batchedUpdates(() => {
                        setIsBanned(false);
                        setBanInfo(null);
                        setShowBanNotification(false);
                        setIsAuthenticated(true);
                      });

                      // Clean up the ban listener
                      if (banListenerRef.current) {
                        banListenerRef.current();
                        banListenerRef.current = null;
                      }
                    } else {
                      // Ban info might have been updated
                      const updatedBanInfo = {
                        reason:
                          updatedUserData.banInfo?.reason || banInfo.reason,
                        bannedAt:
                          updatedUserData.banInfo?.bannedAt || banInfo.bannedAt,
                        bannedUntil:
                          updatedUserData.banInfo?.bannedUntil ||
                          banInfo.bannedUntil,
                        isPermanent:
                          updatedUserData.banInfo?.isPermanent ||
                          banInfo.isPermanent,
                        adminNote:
                          updatedUserData.banInfo?.adminNote ||
                          banInfo.adminNote,
                      };
                      unstable_batchedUpdates(() => {
                        setBanInfo(updatedBanInfo);
                      });
                    }
                  }
                });

                // Store the unsubscribe function
                banListenerRef.current = unsubscribe;
              }
            } else if (needsVerification && !isAdminUser) {
              unstable_batchedUpdates(() => {
                setIsAuthenticated(false);
              });
            } else {
              unstable_batchedUpdates(() => {
                setIsAuthenticated(true);
              });
            }
          }
        } catch (error) {
          console.error("❌ Error fetching user data:", error);
          unstable_batchedUpdates(() => {
            setIsAuthenticated(false);
          });
        } finally {
          setLoading(false);
        }
        return;
      }

      // If there's no user and we haven't attempted auto-login yet, try it
      if (!firebaseUser && !hasAttemptedAutoLoginRef.current) {
        hasAttemptedAutoLoginRef.current = true;

        // Add a small delay to ensure Firebase is fully initialized
        autoLoginTimeoutRef.current = setTimeout(async () => {
          try {
            await attemptAutoLogin();
          } catch (error) {
            console.error("❌ Auto-login attempt failed:", error);
          } finally {
            if (isMounted.current) {
              setLoading(false);
            }
          }
        }, 1000);

        return;
      }

      // Clear any existing auto-login timeout
      if (autoLoginTimeoutRef.current) {
        clearTimeout(autoLoginTimeoutRef.current);
      }

      // Handle null user (signed out) case first
      if (!firebaseUser) {
        unstable_batchedUpdates(() => {
          setUser(null);
          setUserData(null);
          setIsAuthenticated(false);
          setIsBanned(false);
          setIsAdmin(false);
          setBanInfo(null);
          setNeedsEmailVerification(false);
          setLoginAttemptFailed(false);
        });

        // No authenticated user - try auto-login with improved logic
        if (
          !hasAttemptedAutoLoginRef.current &&
          !isProcessingAutoLoginRef.current
        ) {
          hasAttemptedAutoLoginRef.current = true;
          isProcessingAutoLoginRef.current = true;

          // Add a small delay to ensure Firebase Auth state is fully settled
          autoLoginTimeoutRef.current = setTimeout(async () => {
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
              console.error("❌ Auto-login error:", error);
              setLoading(false);
            } finally {
              isProcessingAutoLoginRef.current = false;
            }
          }, 1000);
        } else {
          // Already attempted auto-login, user is truly not authenticated
          setLoading(false);
        }
      }
    });

    // Cleanup function
    return () => {
      isMounted.current = false;

      // Firebase will automatically clean up the auth state listener
      // No need for manual cleanup

      // No ban listener to clean up - Firebase handles cleanup automatically

      // Clear any pending timeouts
      if (autoLoginTimeoutRef.current) {
        clearTimeout(autoLoginTimeoutRef.current);
        autoLoginTimeoutRef.current = null;
      }
    };
  }, [attemptAutoLogin]);

  const login = async (
    email: string,
    password: string,
    rememberMe: boolean = false,
    navigation?: any
  ): Promise<void> => {
    console.log("[AUTH] Login attempt started", { email, rememberMe });
    // Reset login attempt flag and any previous auth state before attempting login
    console.log("[AUTH] Resetting auth state");
    unstable_batchedUpdates(() => {
      setLoginAttemptFailed(false);
      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setIsBanned(false);
      setIsAdmin(false);
      setBanInfo(null);
      setNeedsEmailVerification(false);
    });

    // Clear any existing toast messages when starting a new login attempt
    if (navigation?.setParams) {
      navigation.setParams({
        toastMessage: undefined,
        toastType: undefined,
      });
    }

    try {
      setLoading(true);

      // Clear any existing credentials if rememberMe is false
      if (!rememberMe) {
        try {
          await credentialStorage.clearCredentials();
        } catch (error) {
          // Failed to clear credentials
        }
      }

      // First check if user exists and get their data BEFORE Firebase login
      // We need to check verification status before allowing Firebase Auth login
      console.log("[AUTH] Attempting to sign in with email and password");
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;
        console.log("[AUTH] Firebase auth successful", {
          uid: user.uid,
          emailVerified: user.emailVerified,
        });
        // Get user data to check verification status
        const userData = await authService.getUserData(user.uid);

        // Check email verification status and logout unverified users
        if (userData) {
          const needsVerification = await userService.needsEmailVerification(
            user,
            userData
          );

          if (needsVerification) {
            console.log("[AUTH] Email verification required", {
              uid: user.uid,
              emailVerified: user.emailVerified,
              userDataVerified: userData?.emailVerified,
            });
            // Keep user logged in but mark as needing verification
            // Don't set isAuthenticated to true, but also don't log them out
            unstable_batchedUpdates(() => {
              setUser(user);
              setUserData(userData);
              setIsAuthenticated(false); // Explicitly set to false
              setNeedsEmailVerification(true);
            });

            // Store credentials for auto-login if rememberMe is true (even for unverified users)
            if (rememberMe) {
              try {
                await credentialStorage.saveCredentials(email, password);
              } catch (storageError) {
                // Failed to store credentials for auto-login
                // Continue with verification flow even if credential storage fails
              }
            }

            // Throw error to prevent normal login flow
            throw new Error("EMAIL_VERIFICATION_REQUIRED");
          } else {
            // Store credentials for auto-login if rememberMe is true
            if (rememberMe) {
              try {
                await credentialStorage.saveCredentials(email, password);
              } catch (storageError) {
                // Failed to store credentials for auto-login
                // Continue with login even if credential storage fails
              }
            }

            // Explicitly set authentication state for verified users
            unstable_batchedUpdates(() => {
              setUser(user);
              setUserData(userData);
              setIsAuthenticated(true);
              setNeedsEmailVerification(false);
              setIsBanned(false);
              setLoginAttemptFailed(false);
            });
          }
        } else {
          // User document should already exist from registration
          // Only create it here as a fallback if it somehow doesn't exist
          try {
            // Get user profile data from Firebase Auth
            const displayName = user.displayName || "";
            const nameParts = displayName.split(" ");
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            // Create user document with unverified email status (fallback)
            await userService.createUser(user.uid, {
              uid: user.uid,
              email: user.email || "",
              firstName: firstName,
              lastName: lastName,
              contactNum: "", // Will be updated later if needed
              studentId: "", // Will be updated later if needed
              emailVerified: false, // New users need to verify their email
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            setUser(user);
            setUserData({
              uid: user.uid,
              email: user.email || "",
              firstName: firstName,
              lastName: lastName,
              contactNum: "",
              studentId: "",
              emailVerified: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            setNeedsEmailVerification(true);
            setIsAuthenticated(false);

            // Throw error to prevent normal login flow
            throw new Error("EMAIL_VERIFICATION_REQUIRED");
          } catch (createError) {
            console.error(
              "Failed to create user document during login:",
              createError
            );
            unstable_batchedUpdates(() => {
              setNeedsEmailVerification(false);
              setIsAuthenticated(false);
            });
          }
        }

        // User is verified, login will be handled by onAuthStateChanged listener
      } catch (verificationError: any) {
        // If it's our verification error, re-throw it
        if (
          verificationError.message.includes("Email verification required") ||
          verificationError.message.includes("User account not found")
        ) {
          throw verificationError;
        }
        // Otherwise, it's a Firebase login error, throw it
        throw verificationError;
      }
    } catch (error: any) {
      // Only set login attempt failed flag for actual login failures, not EMAIL_VERIFICATION_REQUIRED
      if (
        !error.message ||
        !error.message.includes("EMAIL_VERIFICATION_REQUIRED")
      ) {
        setLoginAttemptFailed(true);
      }

      // Don't reset user/userData for EMAIL_VERIFICATION_REQUIRED errors
      // as this state should persist to show the verification UI
      if (
        !error.message ||
        !error.message.includes("EMAIL_VERIFICATION_REQUIRED")
      ) {
        // Reset auth state on login failure to ensure user stays on login screen
        unstable_batchedUpdates(() => {
          setUser(null);
          setUserData(null);
          setIsAuthenticated(false);
          setIsBanned(false);
          setIsAdmin(false);
          setBanInfo(null);
          setNeedsEmailVerification(false);
        });
      } else {
        // For EMAIL_VERIFICATION_REQUIRED, ensure needsEmailVerification is set to true
        unstable_batchedUpdates(() => {
          setNeedsEmailVerification(true);
          setIsAuthenticated(false); // User is logged in but not verified
        });
      }

      // Don't log EMAIL_VERIFICATION_REQUIRED as an error since it's expected behavior
      if (
        !error.message ||
        !error.message.includes("EMAIL_VERIFICATION_REQUIRED")
      ) {
        console.error("Login error:", error);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Set up notification subscription when user is authenticated
  useEffect(() => {
    if (user && isAuthenticated && !isBanned) {
      try {
        // Clean up any existing subscription
        if (notificationUnsubscribeRef.current) {
          notificationUnsubscribeRef.current();
          notificationUnsubscribeRef.current = null;
        }

        const unsubscribe =
          notificationSubscriptionService.setupSubscriptionListener(
            user.uid,
            (subscription: { id: string } | null) => {
              if (subscription) {
                console.log(
                  "📱 Notification subscription updated:",
                  subscription
                );
              } else {
                console.log(
                  "📱 No notification subscription found, creating default..."
                );
                notificationSubscriptionService.ensureUserHasSubscription(
                  user.uid
                );
              }
            },
            (error: Error) => {
              console.error("❌ Notification subscription error:", error);
            }
          );

        // Store the unsubscribe function in the ref
        notificationUnsubscribeRef.current = unsubscribe;

        // Clean up subscription on unmount
        return () => {
          if (notificationUnsubscribeRef.current) {
            notificationUnsubscribeRef.current();
            notificationUnsubscribeRef.current = null;
          }
        };
      } catch (error) {
        console.error("❌ Error setting up notification subscription:", error);
      }
    }
  }, [user, isAuthenticated, isBanned]);

  const logout = async (): Promise<void> => {
    console.log("🚀 Starting logout process...");

    // Set loading state
    setLoading(true);

    // Clean up ban listener first
    if (banListenerRef.current) {
      console.log("0. Cleaning up ban listener...");
      try {
        banListenerRef.current();
        banListenerRef.current = null;
        console.log("✅ Ban listener cleaned up");
      } catch (error) {
        console.warn("⚠️ Error cleaning up ban listener:", error);
      }
    }

    // Clean up notification subscription
    if (notificationUnsubscribeRef.current) {
      console.log("1. Cleaning up notification subscription...");
      try {
        notificationUnsubscribeRef.current();
        notificationUnsubscribeRef.current = null;
        console.log("✅ Notification subscription cleaned up");
      } catch (error) {
        console.warn("⚠️ Error cleaning up notification subscription:", error);
      }
    }

    // Reset auth state
    unstable_batchedUpdates(() => {
      setUser(null);
      setUserData(null);
      setIsAuthenticated(false);
      setIsBanned(false);
      setBanInfo(null);
      setNeedsEmailVerification(false);
      setLoginAttemptFailed(false);
    });

    // Reset navigation to Index screen
    if (navigationRef.current) {
      navigationRef.current.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Index" }],
        })
      );
    }

    // Start cleanup in the background
    (async () => {
      try {
        // 2. Sign out from Firebase
        console.log("2. Signing out from Firebase...");
        try {
          // Use Promise.race to prevent hanging on Firebase sign out
          await Promise.race([
            authService.logout(),
            new Promise((resolve) => setTimeout(resolve, 3000)), // 3s timeout
          ]);
          console.log("✅ Successfully signed out from Firebase");
        } catch (error) {
          console.warn(
            "⚠️ Non-critical error during Firebase sign out:",
            error
          );
        }

        // 2. Clear stored credentials (non-blocking)
        console.log("2. Starting credential cleanup...");
        try {
          if (typeof credentialStorage.clearCredentials === "function") {
            await credentialStorage.clearCredentials();
            console.log("✅ Credentials cleared successfully");
          }
        } catch (error) {
          console.warn("⚠️ Error clearing credentials:", error);
        }

        // 3. Clear stored user data (non-blocking)
        console.log("3. Starting async data cleanup...");
        try {
          const storageKeys = [
            "user_preferences",
            "search_history",
            "recent_items",
            "filter_preferences",
            "sort_preferences",
            "cached_posts",
            "user_profile_cache",
            "message_cache",
            "coordinates_cache",
          ];
          await AsyncStorage.multiRemove(storageKeys);
          console.log("✅ AsyncStorage cleared");
        } catch (error) {
          console.warn("⚠️ Error clearing AsyncStorage:", error);
        }

        console.log("✅ Logout cleanup completed");
      } catch (error) {
        console.error("❌ Error during background cleanup:", error);
      } finally {
        console.log("🏁 Logout process completed");
        setLoading(false);
      }
    })();
  };

  const refreshUserData = async (): Promise<void> => {
    if (user && isAuthenticated) {
      try {
        const fetchedUserData = await authService.getUserData(user.uid);

        if (fetchedUserData) {
          setUserData(fetchedUserData);

          // Update deactivation status when refreshing user data (with backward compatibility)
          if (
            fetchedUserData &&
            (fetchedUserData.status === "deactivated" ||
              fetchedUserData.status === "banned")
          ) {
            setIsBanned(true);
            setBanInfo(fetchedUserData.banInfo || {});
          } else {
            setIsBanned(false);
            setBanInfo(null);
          }

          // Check email verification status
          if (fetchedUserData) {
            // Add a small delay to ensure Firebase Auth state is fully updated
            await new Promise((resolve) => setTimeout(resolve, 300));

            await user.reload();
            const needsVerification = await userService.needsEmailVerification(
              user,
              fetchedUserData
            );
            setNeedsEmailVerification(needsVerification);

            // If Firebase email is verified but Firestore is not, update Firestore and authenticate user
            if (user.emailVerified && !fetchedUserData.emailVerified) {
              try {
                console.log(
                  "🔄 refreshUserData: Firebase Auth shows verified but Firestore shows unverified - updating Firestore..."
                );
                await userService.updateUserData(user.uid, {
                  emailVerified: true,
                });
                // Update local userData to reflect the change
                setUserData({ ...fetchedUserData, emailVerified: true });
                console.log(
                  "✅ refreshUserData: Firestore updated - user is now fully authenticated"
                );
                // Since email is verified, set authenticated immediately
                setIsAuthenticated(true);
                setNeedsEmailVerification(false);
              } catch (error) {
                console.error(
                  "refreshUserData: Failed to update email verification status in Firestore:",
                  error
                );
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
          // User document doesn't exist
          console.log(
            "🚨 refreshUserData: User document deleted - account has been deleted from web"
          );

          unstable_batchedUpdates(() => {
            setUser(null);
            setUserData(null);
            setIsAuthenticated(false);
            setIsBanned(false);
            setIsAdmin(false);
            setBanInfo(null);
            setNeedsEmailVerification(false);
            setLoginAttemptFailed(false);
          });

          // Clear stored credentials
          credentialStorage.clearCredentials().catch((error) => {
            console.warn(
              "Error clearing credentials during account deletion:",
              error
            );
          });

          // Force logout from Firebase
          authService.logout().catch((error) => {
            console.error(
              "Error during forced logout after account deletion:",
              error
            );
          });
        }
      } catch (error: any) {
        // Check if this is a permission error indicating account deletion
        if (
          error?.code === "permission-denied" ||
          error?.message?.includes("Missing or insufficient permissions") ||
          error?.message?.includes("not found") ||
          error?.message?.includes("does not exist") ||
          error?.code === "not-found"
        ) {
          console.log(
            "🚨 refreshUserData: Permission denied - account may have been deleted from web"
          );

          unstable_batchedUpdates(() => {
            setUser(null);
            setUserData(null);
            setIsAuthenticated(false);
            setIsBanned(false);
            setIsAdmin(false);
            setBanInfo(null);
            setNeedsEmailVerification(false);
            setLoginAttemptFailed(false);
          });

          // Clear stored credentials
          credentialStorage.clearCredentials().catch((credentialError) => {
            console.warn(
              "Error clearing credentials during account deletion:",
              credentialError
            );
          });

          // Force logout from Firebase
          authService.logout().catch((logoutError) => {
            console.error(
              "Error during forced logout after account deletion:",
              logoutError
            );
          });
        } else {
          console.error("Error refreshing user data:", error);
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
        console.log("❌ Firebase Auth still shows unverified");
        unstable_batchedUpdates(() => {
          setIsAuthenticated(false);
          setNeedsEmailVerification(true);
          setLoading(false);
        });
        throw new Error("Email verification failed - please try again");
      }

      // Update Firestore email verification status (with error handling for concurrent updates)
      try {
        await userService.updateUserData(user.uid, { emailVerified: true });
        console.log("✅ Firestore email verification updated successfully");
      } catch (firestoreError: any) {
        // If Firestore update fails due to concurrent update (already verified), that's okay
        if (
          firestoreError?.code === "already-exists" ||
          firestoreError?.message?.includes("already verified") ||
          firestoreError?.code === "permission-denied"
        ) {
          console.log(
            "✅ Firestore already updated (likely by web), continuing with authentication"
          );
        } else {
          console.warn("Firestore update warning:", firestoreError);
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

      console.log("✅ Email verification completed successfully");
      console.log(
        "🔄 AuthContext state updated: isAuthenticated:",
        true,
        "needsEmailVerification:",
        false
      );

      // Add small delay to ensure state propagation before Navigation routes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now that email is verified, save push token
      try {
        const pushToken =
          await notificationService.registerForPushNotifications();
        if (pushToken) {
          await notificationService.savePushToken(user.uid, pushToken);
        }
      } catch (notificationError) {
        console.error(
          "Error saving push token after verification:",
          notificationError
        );
        // Don't fail verification if push token saving fails
      }
    } catch (error: any) {
      console.error("❌ Failed to complete email verification:", error);

      // If Firestore update fails, check if Firebase Auth is actually verified
      try {
        await user.reload();
        if (user.emailVerified) {
          // Still set authenticated since Firebase verification is what matters
          console.log(
            "✅ Firebase Auth verified despite Firestore error, setting authenticated"
          );
          console.log(
            "🔄 AuthContext state updated: isAuthenticated:",
            true,
            "needsEmailVerification:",
            false
          );
          setIsAuthenticated(true);
          setNeedsEmailVerification(false);
          setLoading(false);

          // Add small delay to ensure state propagation
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Try to update Firestore again in background
          userService
            .updateUserData(user.uid, { emailVerified: true })
            .catch((updateError) => {
              console.error(
                "Background Firestore update also failed:",
                updateError
              );
            });
        } else {
          console.error("❌ Firebase Auth still shows unverified");
          unstable_batchedUpdates(() => {
            setIsAuthenticated(false);
            setNeedsEmailVerification(true);
            setLoading(false);
          });
          throw new Error("Email verification failed - please try again");
        }
      } catch (reloadError) {
        console.error(
          "❌ Error reloading user after verification failure:",
          reloadError
        );
        unstable_batchedUpdates(() => {
          setIsAuthenticated(false);
          setNeedsEmailVerification(true);
          setLoading(false);
        });
        throw new Error("Verification check failed - please try again");
      }
    }
  };

  const handleImmediateBanLogout = async (
    bannedUserData: UserData & { status?: "active" | "deactivated" | "banned" }
  ) => {
    try {
      // Cleanup handled by Firebase - no action needed

      // Clear stored credentials for auto-login (banned users shouldn't auto-login)
      try {
        await credentialStorage.clearCredentials();
      } catch (credentialError) {
        console.warn(
          "Error clearing stored credentials during ban:",
          credentialError
        );
        // Continue with logout even if clearing credentials fails
      }

      // Logout user immediately
      await authService.logout();

      // Reset all auth state completely
      unstable_batchedUpdates(() => {
        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
        setIsBanned(true);
        setIsAdmin(false);
        setBanInfo(bannedUserData.banInfo || {});
        setShowBanNotification(false);
      });

      // Force navigation to login by setting user to null
      // This will trigger the navigation logic to redirect to login
    } catch (error) {
      console.error("Error during immediate ban logout (mobile):", error);

      // No ban listener to clean up

      // Clear credentials even if logout fails
      try {
        await credentialStorage.clearCredentials();
      } catch (credentialError) {
        console.warn(
          "Error clearing credentials during ban logout error:",
          credentialError
        );
      }

      // Even if logout fails, reset the state to force redirect
      unstable_batchedUpdates(() => {
        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
        setIsBanned(true);
        setIsAdmin(false);
        setBanInfo(bannedUserData.banInfo || {});
      });
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
        if (
          userData &&
          (userData.status === "deactivated" || userData.status === "banned")
        ) {
          clearInterval(intervalId);
          handleImmediateBanLogout(userData);
        }
      } catch (error: any) {
        // Handle quota errors gracefully - don't spam the console
        if (
          error.code === "resource-exhausted" ||
          error.message?.includes("Quota exceeded")
        ) {
          console.warn(
            "Periodic ban check quota exceeded (mobile) - will retry later"
          );
          // Don't clear interval - let it retry when quota resets
        } else if (
          error?.code === "permission-denied" ||
          error?.message?.includes("Missing or insufficient permissions") ||
          error?.message?.includes("not found") ||
          error?.message?.includes("does not exist") ||
          error?.code === "not-found"
        ) {
          // Account may have been deleted - force logout
          console.log(
            "🚨 Periodic check: Account may have been deleted from web"
          );
          clearInterval(intervalId);
          handleImmediateBanLogout({} as UserData);
        } else {
          console.warn("Periodic ban check error (mobile):", error);
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
        if (
          userData &&
          (userData.status === "deactivated" || userData.status === "banned")
        ) {
          clearInterval(intervalId);
          handleImmediateBanLogout(userData);
        }
        // Also check if current user is still valid (tokens not revoked)
        else if (auth.currentUser) {
          try {
            // Test if current token is still valid
            await auth.currentUser.getIdToken();
          } catch (tokenError: any) {
            if (
              tokenError.code === "auth/id-token-revoked" ||
              tokenError.code === "auth/user-token-expired"
            ) {
              console.log(
                "🚨 Token revoked or expired - account may have been deleted"
              );
              clearInterval(intervalId);
              // Clear all user data and force logout for account deletion
              unstable_batchedUpdates(() => {
                setUser(null);
                setUserData(null);
                setIsAuthenticated(false);
                setIsBanned(false);
                setIsAdmin(false);
                setBanInfo(null);
                setNeedsEmailVerification(false);
                setLoginAttemptFailed(false);
              });

              // Clear stored credentials
              credentialStorage.clearCredentials().catch((credentialError) => {
                console.warn(
                  "Error clearing credentials during account deletion:",
                  credentialError
                );
              });

              // Force logout from Firebase
              authService.logout().catch((logoutError) => {
                console.error(
                  "Error during forced logout after account deletion:",
                  logoutError
                );
              });
            }
          }
        }
      } catch (error: any) {
        // Handle quota errors gracefully - don't spam the console
        if (
          error.code === "resource-exhausted" ||
          error.message?.includes("Quota exceeded")
        ) {
          console.warn(
            "Periodic ban check quota exceeded (mobile) - will retry later"
          );
          // Don't clear interval - let it retry when quota resets
        } else if (
          error?.code === "permission-denied" ||
          error?.message?.includes("Missing or insufficient permissions") ||
          error?.message?.includes("not found") ||
          error?.message?.includes("does not exist") ||
          error?.code === "not-found"
        ) {
          // Account may have been deleted - force logout
          console.log("🚨 Smart check: Account may have been deleted from web");
          clearInterval(intervalId);
          handleImmediateBanLogout({} as UserData);
        } else {
          console.warn("Periodic ban check error (mobile):", error);
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
      },
    };
  };

  // Define all callbacks
  const loginHandler = useCallback(
    async (
      email: string,
      password: string,
      rememberMe = false,
      navigation?: any
    ): Promise<LoginResult> => {
      console.log("🔐 Starting login handler", { email, rememberMe });

      // Reset login attempt flag and any previous auth state
      setLoginAttemptFailed(false);

      try {
        // First try to login with authService
        try {
          const userCredential = await authService.login(email, password);
          console.log("🔍 AuthService login successful", {
            email: userCredential.user?.email,
            emailVerified: userCredential.user?.emailVerified,
          });

          if (rememberMe) {
            await credentialStorage.saveCredentials(email, password);
          } else {
            await credentialStorage.clearCredentials();
          }

          return { success: true };
        } catch (authServiceError) {
          console.log(
            "⚠️ AuthService login failed, falling back to direct Firebase auth",
            authServiceError
          );

          // Fall back to direct Firebase auth
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
          );
          const currentUser = userCredential.user;

          if (!currentUser.emailVerified) {
            console.log(
              "[AUTH] Email not verified, showing verification screen"
            );

            // Store credentials if remember me is checked
            if (rememberMe) {
              await credentialStorage.saveCredentials(email, password);
            }

            // Set flag to show email verification screen
            setNeedsEmailVerification(true);

            return { success: true };
          }

          // If email is verified, handle remember me and proceed
          if (rememberMe) {
            await credentialStorage.saveCredentials(email, password);
          } else {
            await credentialStorage.clearCredentials();
          }

          return { success: true };
        }
      } catch (error: any) {
        console.error("❌ Login error:", {
          code: error.code,
          message: error.message,
          stack: error.stack,
        });
        setLoginAttemptFailed(true);
        // Return the error instead of throwing it
        return { error: error.message };
      }
    },
    []
  );

  const logoutHandler = useCallback(async () => {
    try {
      console.log("Starting logout process...");

      // Store user ID for cleanup before resetting state
      const userId = user?.uid;

      // 1. Clear any stored credentials on logout
      await credentialStorage.clearCredentials();

      // Clear tab state to prevent new users from seeing previous user's last active screen
      await AsyncStorage.removeItem('lastActiveTab');

      // 2. Clear any pending timeouts
      if (autoLoginTimeoutRef.current) {
        clearTimeout(autoLoginTimeoutRef.current);
        autoLoginTimeoutRef.current = null;
      }

      // 3. Clean up notifications before signing out
      if (userId) {
        console.log(`Clearing notifications for user: ${userId}`);
        try {
          await notificationService.deleteAllNotifications(userId);
          console.log("✅ Notifications cleared successfully");
        } catch (notifError) {
          console.warn("Error clearing notifications:", notifError);
        }
      }

      // 4. Sign out from Firebase (this will trigger the auth state listener cleanup)
      console.log("Signing out from Firebase...");
      await authService.logout();

      // 5. Reset all auth state
      console.log("Resetting auth state...");
      unstable_batchedUpdates(() => {
        setUser(null);
        setUserData(null);
        setIsAuthenticated(false);
        setIsBanned(false);
        setIsAdmin(false);
        setBanInfo(null);
        setShowBanNotification(false);
        setNeedsEmailVerification(false);
      });
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }, [user?.uid]);

  const refreshUserDataHandler = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const userDoc = await userService.getUserData(user.uid);
      if (userDoc) {
        setUserData(userDoc);

        // Update ban status using the status field
        const isUserBanned = userDoc.status === "banned";
        setIsBanned(isUserBanned);

        if (isUserBanned) {
          // Use the banInfo object from userDoc if it exists, or create a default one
          const banInfo = userDoc.banInfo || {};
          setBanInfo({
            reason: banInfo.reason || "Account suspended",
            bannedAt: banInfo.bannedAt?.toDate?.() || null,
            bannedUntil: banInfo.bannedUntil?.toDate?.() || null,
            isPermanent: banInfo.isPermanent || false,
            adminNote: banInfo.adminNote || "",
          });
          setShowBanNotification(true);
        } else {
          setBanInfo(null);
          setShowBanNotification(false);
        }
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }, [user?.uid]);

  const handleEmailVerificationCompleteHandler = useCallback(async () => {
    console.log("🔄 handleEmailVerificationComplete called");

    if (!user) {
      console.error("❌ No user found in handleEmailVerificationComplete");
      return;
    }

    try {
      console.log("🔄 Reloading user to get latest verification status...");
      await user.reload();

      if (!user.emailVerified) {
        console.log("❌ Email still not verified after reload");
        unstable_batchedUpdates(() => {
          setNeedsEmailVerification(true);
          setIsAuthenticated(false);
        });
        return;
      }

      console.log("✅ Email verified in Firebase Auth, updating state...");

      // Update Firestore
      try {
        await userService.updateUserData(user.uid, {
          emailVerified: true,
          updatedAt: new Date(),
        });
        console.log("✅ Firestore updated with email verification status");
      } catch (firestoreError) {
        console.warn(
          "⚠️ Could not update Firestore, but continuing:",
          firestoreError
        );
        // Continue even if Firestore update fails
      }

      // Refresh user data BEFORE updating state to avoid multiple renders
      await refreshUserDataHandler();

      // Update local state in a single batch to prevent multiple re-renders
      // This prevents the renderKey from incrementing multiple times
      unstable_batchedUpdates(() => {
        setNeedsEmailVerification(false);
        setIsAuthenticated(true);
      });

      console.log("✅ Email verification flow completed successfully");
    } catch (error) {
      console.error("❌ Error in handleEmailVerificationComplete:", error);
      unstable_batchedUpdates(() => {
        setNeedsEmailVerification(true);
        setIsAuthenticated(false);
      });
    }
  }, [user, refreshUserDataHandler]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
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
      login: loginHandler,
      logout: logoutHandler,
      refreshUserData: refreshUserDataHandler,
      handleEmailVerificationComplete: handleEmailVerificationCompleteHandler,
    }),
    [
      isAuthenticated,
      user,
      userData,
      loading,
      isBanned,
      isAdmin,
      banInfo,
      showBanNotification,
      needsEmailVerification,
      loginAttemptFailed,
      loginHandler,
      logoutHandler,
      refreshUserDataHandler,
      handleEmailVerificationCompleteHandler,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
