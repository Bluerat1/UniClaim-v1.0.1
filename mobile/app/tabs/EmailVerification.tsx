import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/type";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../utils/firebase";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { useToast } from "../../context/ToastContext";

type EmailVerificationNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EmailVerification"
>;

// Constants
const RESEND_COOLDOWN_DURATION = 30; // seconds
const VERIFICATION_CHECK_TIMEOUT = 30000; // 30 seconds

export default function EmailVerification() {
  const navigation = useNavigation<EmailVerificationNavigationProp>();
  const { user, refreshUserData, handleEmailVerificationComplete, logout } =
    useAuth();
  const { showToastMessage } = useToast();

  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationResult, setVerificationResult] = useState<
    "pending" | "success" | "failed" | null
  >(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Track if we've started the completion process to prevent duplicate runs
  const isCompletingRef = useRef(false);

  // Format time in MM:SS format
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Handle email verification completion
  const completeVerification = useCallback(async () => {
    console.log("[DEBUG] Starting completeVerification");

    // Prevent multiple simultaneous completions using ref
    if (isCompletingRef.current) {
      console.log(
        "[DEBUG] Already completing verification, skipping duplicate"
      );
      return;
    }

    if (!user?.uid) {
      console.log("[DEBUG] No user found, redirecting to login");
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
      return;
    }

    isCompletingRef.current = true;
    setIsNavigating(true);

    try {
      console.log("[DEBUG] Starting email verification completion...");
      console.log(`[DEBUG] User ID: ${user.uid}, Email: ${user.email}`);

      console.log("[DEBUG] Updating verification status in Firestore...");
      await authService.handleEmailVerification(user.uid);
      console.log("[DEBUG] Email verification status updated in Firestore");

      console.log("[DEBUG] Refreshing user data...");
      await refreshUserData();
      console.log("[DEBUG] User data refreshed");

      console.log(
        "[DEBUG] Marking verification as complete in auth context..."
      );
      await handleEmailVerificationComplete();
      console.log("[DEBUG] Email verification marked as complete");

      console.log("[DEBUG] Setting verification result to success");
      setVerificationResult("success");
      
      // Show success toast
      showToastMessage("Account successfully verified!", "success");

      // Add a small delay to ensure state updates are processed
      console.log("[DEBUG] Preparing to navigate to RootBottomTabs...");
      // Small delay to ensure UI updates are processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reset the navigation stack to RootBottomTabs which contains the Home screen
      navigation.reset({
        index: 0,
        routes: [{ name: "RootBottomTabs" }],
      });

      console.log("[DEBUG] Navigation to RootBottomTabs (Home) completed");
    } catch (error) {
      console.error("[ERROR] Error in completeVerification:", error);
      setVerificationResult("failed");
      Alert.alert(
        "Error",
        "Failed to complete email verification. Please try again."
      );
      console.log("[DEBUG] Verification completion failed");
    } finally {
      // Don't reset isCompletingRef - keep it true to prevent re-triggering
      setIsNavigating(false);
    }
  }, [user?.uid, refreshUserData, handleEmailVerificationComplete, navigation]);

  // Monitor auth state changes
  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      navigation.replace("Login");
      return;
    }

    // If email is already verified, handle completion
    if (currentUser.emailVerified) {
      completeVerification().catch(console.error);
      return;
    }

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigation.replace("Login");
        return;
      }

      if (user.emailVerified) {
        await completeVerification();
      }
    });

    return () => unsubscribe();
  }, [completeVerification, navigation]);

  const handleResendVerification = useCallback(async () => {
    if (resendCooldown > 0) return;

    try {
      await authService.resendEmailVerification();
      setResendCooldown(RESEND_COOLDOWN_DURATION);
      Alert.alert("Success", "Verification email has been resent.");
    } catch (error) {
      console.error("Error resending verification email:", error);
      Alert.alert(
        "Error",
        "Failed to resend verification email. Please try again later."
      );
    }
  }, [resendCooldown]);

  // Check verification status
  const checkVerificationStatus = useCallback(async () => {
    console.log("[DEBUG] checkVerificationStatus called");

    if (!user?.uid) {
      console.log("[DEBUG] No user found, redirecting to login");
      navigation.replace("Login");
      return;
    }

    // Prevent multiple simultaneous checks
    if (isChecking || isNavigating) {
      console.log(
        "[DEBUG] Verification or navigation already in progress, skipping"
      );
      return;
    }

    if (verificationResult === "success") {
      console.log("[DEBUG] Verification already successful, skipping");
      return;
    }

    try {
      console.log("[DEBUG] Starting verification check...");
      console.log(`[DEBUG] User ID: ${user.uid}, Email: ${user.email}`);

      setIsChecking(true);
      setVerificationResult("pending");

      // Set a timeout for the verification check
      console.log(
        `[DEBUG] Setting verification timeout to ${VERIFICATION_CHECK_TIMEOUT}ms`
      );
      const timeout = setTimeout(() => {
        console.log("[DEBUG] Verification check timeout reached");
        setIsChecking(false);
        setVerificationResult("failed");
        Alert.alert(
          "Timeout",
          "Verification check timed out. Please try again."
        );
      }, VERIFICATION_CHECK_TIMEOUT);

      // Force refresh the user's token
      console.log("[DEBUG] Reloading user data...");
      await user.reload();
      const currentUser = getAuth().currentUser;

      console.log(
        "[DEBUG] Current user email verified status:",
        currentUser?.emailVerified
      );

      if (currentUser?.emailVerified) {
        console.log("[DEBUG] Email is verified, completing verification...");
        clearTimeout(timeout);
        await completeVerification();
      } else {
        console.log("[DEBUG] Email not yet verified");
        clearTimeout(timeout);
        setVerificationResult("failed");
        Alert.alert(
          "Email Not Verified",
          "Please check your email and click the verification link. If you don't see the email, check your spam folder.",
          [
            {
              text: "Resend Email",
              onPress: handleResendVerification,
            },
            {
              text: "OK",
              style: "default",
            },
          ]
        );
      }
    } catch (error) {
      console.error("[ERROR] Error in checkVerificationStatus:", error);
      setVerificationResult("failed");
      Alert.alert(
        "Verification Error",
        "Failed to check verification status. Please try again."
      );
    } finally {
      console.log("[DEBUG] Verification check completed");
      setIsChecking(false);
    }
  }, [
    user,
    isChecking,
    verificationResult,
    completeVerification,
    navigation,
    handleResendVerification,
    isNavigating
  ]);


  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown, setResendCooldown]);

  const handleLogout = useCallback(async () => {
    try {
      setVerificationResult(null);
      setResendCooldown(0);
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  }, [logout, navigation, setVerificationResult, setResendCooldown]);

  // Loading overlay component
  if (isNavigating || isChecking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: "white",
            padding: 30,
            borderRadius: 15,
            alignItems: "center",
            width: "80%",
            maxWidth: 300,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <ActivityIndicator size="large" color="#007AFF" />
          <Text
            style={{
              marginTop: 20,
              fontSize: 16,
              color: "#333",
              fontWeight: "500",
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            {isNavigating ? "Almost there..." : "Verifying your email..."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center px-6">
        {/* Header */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 bg-brand/10 rounded-full items-center justify-center mb-6">
            <Ionicons name="mail" size={40} color="#2563eb" />
          </View>
          <Text className="text-3xl font-albert-bold text-brand mb-2 text-center">
            Verify Your Email
          </Text>
          <Text className="text-base font-manrope-medium text-gray-600 text-center">
            We&apos;ve sent a verification email to
          </Text>
          <Text className="text-lg font-manrope-semibold text-black text-center mt-1">
            {user?.email}
          </Text>
        </View>

        {/* Instructions */}
        <View className="bg-blue-50 p-6 rounded-lg mb-8">
          <Text className="text-base font-manrope-medium text-blue-800 mb-3">
            Check Your Email
          </Text>
          <Text className="text-blue-700 font-manrope-medium mb-2">
            Please check your email inbox and click the verification link to
            activate your account.
          </Text>
          <Text className="text-blue-700 font-manrope-medium mb-2">
            After clicking the link, tap the button below to confirm your email
            verification.
          </Text>
          <Text className="text-sm font-manrope-medium text-blue-600 text-center">
            You may need to check your spam folder.
          </Text>
        </View>

        {/* I've verified my email Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-4 ${
            isChecking || verificationResult === "success"
              ? "bg-gray-400"
              : "bg-blue-600"
          }`}
          onPress={checkVerificationStatus}
          disabled={isChecking || verificationResult === "success"}
        >
          <Text className="text-white text-lg font-manrope-semibold text-center">
            I&apos;ve verified my email
          </Text>
        </TouchableOpacity>

        {/* Verification Result */}
        {verificationResult && (
          <View
            className={`p-4 rounded-lg mb-4 ${
              verificationResult === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <View className="flex-row items-center">
              <Ionicons
                name={
                  verificationResult === "success"
                    ? "checkmark-circle"
                    : "close-circle"
                }
                size={20}
                color={verificationResult === "success" ? "#10b981" : "#ef4444"}
              />
              <Text
                className={`ml-2 font-manrope-medium ${
                  verificationResult === "success"
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {verificationResult === "success"
                  ? "Email verified successfully! Redirecting to app..."
                  : "Email not verified yet. Please check your email and try again."}
              </Text>
            </View>
          </View>
        )}

        {/* Resend Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-4 ${
            resendCooldown > 0 || isChecking ? "bg-gray-300" : "bg-brand"
          }`}
          onPress={handleResendVerification}
          disabled={resendCooldown > 0 || isChecking}
        >
          <Text className="text-white text-lg font-manrope-semibold text-center">
            {resendCooldown > 0
              ? `Resend Email (${formatTime(resendCooldown)})`
              : "Resend Verification Email"}
          </Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          className="py-4 rounded-xl mb-6 border border-gray-300"
          onPress={handleLogout}
          disabled={isChecking}
        >
          <Text className="text-brand text-lg font-manrope-semibold text-center">
            Logout & Use Different Account
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <View className="items-center">
          <Text className="text-sm font-manrope-medium text-gray-500 text-center">
            Having trouble? Contact support if you need help with verification.
          </Text>
        </View>
      </View>

      {/* Loading Overlay */}
      <Modal
        key={`loading-modal-${isChecking}`}
        visible={isChecking}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}} // Prevent closing by back button
      >
        <View className="flex-1 bg-black/30 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-8 items-center shadow-lg w-full max-w-sm">
            <View className="w-16 h-16 bg-brand/10 rounded-full items-center justify-center mb-4">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
            <Text className="text-xl font-albert-bold text-gray-800 mb-2 text-center">
              Checking Verification
            </Text>
            <Text className="text-base font-manrope-medium text-gray-600 text-center mb-2">
              Please wait while we verify your email...
            </Text>
            <Text className="text-sm font-manrope-medium text-gray-500 text-center">
              This may take a few seconds
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
