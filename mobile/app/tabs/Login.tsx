import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useCallback, memo } from "react";
import {
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import type { RootStackParamList } from "../../types/type";
import { useAuth } from "../../context/AuthContext";
import { getFirebaseErrorMessage } from "../../utils/firebase";
import { useToast } from "../../context/ToastContext";

function Login() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login, loading, isBanned, banInfo, needsEmailVerification, user } =
    useAuth();
  const { showToastMessage } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  // NEW: Get ban details for display
  const reason = banInfo?.reason || "No reason provided";
  const duration = banInfo?.duration || "Unknown";
  const endDate = banInfo?.banEndDate;

  // Stable handlers to prevent re-renders
  const handleEmailFocus = useCallback(() => {
    setEmailFocused(true);
    setEmailError("");
  }, []);

  const handleEmailBlur = useCallback(() => {
    setEmailFocused(false);
  }, []);

  const handlePasswordFocus = useCallback(() => {
    setPasswordFocused(true);
    setPasswordError("");
  }, []);

  const handlePasswordBlur = useCallback(() => {
    setPasswordFocused(false);
  }, []);

  const handleEmailVerificationNavigation = useCallback(() => {
    navigation.navigate("EmailVerification", {
      email: email,
      fromLogin: true,
    });
  }, [navigation, email]);

  const handleForgotPasswordNavigation = useCallback(() => {
    navigation.navigate("ForgotPassword");
  }, [navigation]);

  const handleRegisterNavigation = useCallback(() => {
    navigation.navigate("Register");
  }, [navigation]);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleLogin = async () => {
    console.log("[Login] Starting login process", {
      email,
      hasPassword: !!password,
    });
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setGeneralError("");

    // Client-side validation
    if (!email.trim()) {
      console.log("[Login] Email validation failed: Email is required");
      setEmailError("Email is required.");
      valid = false;
    } else if (!validateEmail(email)) {
      console.log("[Login] Email validation failed: Invalid email format");
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    if (!password) {
      console.log("[Login] Password validation failed: Password is required");
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 8) {
      console.log("[Login] Password validation failed: Password too short");
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    }

    if (!valid) {
      console.log("[Login] Validation failed, not proceeding with login");
      return;
    }

    try {
      console.log("[Login] Attempting to login with Firebase Auth");
      const result = await login(email, password, rememberMe, navigation);

      // If we have an error in the result, handle it
      if (result?.error) {
        const errorMessage = getFirebaseErrorMessage({ message: result.error });
        console.log("[Login] Login error:", { message: result.error });
        setGeneralError(errorMessage);

        // Only show toast if it's not an email verification related message
        if (
          !errorMessage.includes("verify your email") &&
          !errorMessage.includes("EMAIL_NOT_VERIFIED")
        ) {
          const toastType =
            errorMessage.toLowerCase().includes("network") ||
            errorMessage.toLowerCase().includes("connection") ||
            errorMessage.toLowerCase().includes("too many") ||
            errorMessage.toLowerCase().includes("rate limit")
              ? "warning"
              : "error";

          console.log(
            `[Login] Showing toast message (type: ${toastType}):`,
            errorMessage
          );
          showToastMessage(errorMessage, toastType, 5000);
        }
        return;
      }

      // Handle successful login
      if (user?.emailVerified) {
        console.log("[Login] Login successful, showing welcome message");
        showToastMessage("Login successful! Welcome back!", "success");
      }
    } catch (error: any) {
      console.log("[Login] Unexpected error during login:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      // This is a fallback for unexpected errors
      const errorMessage = getFirebaseErrorMessage(error);
      setGeneralError(errorMessage);

      // Only show toast if there isn't already one showing
      if (!showToast) {
        showToastMessage(errorMessage, "error", 5000);
      }
    }
  };

  return (
    <>
      <SafeAreaView className="flex-1 justify-center bg-white">
        <KeyboardAwareScrollView
          enableOnAndroid={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className="flex-1 justify-center pt-10 px-6">
            {/* Header */}
            <View className="mb-10">
              <Text className="text-4xl font-manrope-bold text-brand mb-2">
                Welcome Back
              </Text>
              <Text className="text-base font-manrope-medium text-black mt-1">
                Hi, Welcome back, you&apos;ve been missed
              </Text>
            </View>

            {/* Email Verification Message - shows for logged-in users who need verification */}
            {user && needsEmailVerification && !isBanned && (
              <View className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Text className="text-lg font-manrope-bold text-blue-600 mb-2 text-center">
                  🎉 Registration Successful!
                </Text>
                <Text className="text-sm font-manrope-medium text-blue-700 mb-2">
                  Your account has been created successfully! Please check your
                  email and click the verification link to activate your account
                  before logging in.
                </Text>
                <TouchableOpacity
                  className="bg-blue-100 p-3 rounded-lg mt-2"
                  onPress={handleEmailVerificationNavigation}
                >
                  <Text className="text-blue-600 text-sm font-manrope-medium text-center">
                    Go to Email Verification
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* General Error */}
            {generalError !== "" && (
              <Text className="text-red-500 font-manrope-medium mb-4 text-center">
                {generalError}
              </Text>
            )}

            {/* NEW: Ban Message Display */}
            {isBanned && (
              <View className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <Text className="text-lg font-manrope-bold text-red-600 mb-2 text-center">
                  Account Banned
                </Text>
                <Text className="text-sm font-manrope-medium text-red-700 mb-2">
                  The current account has been suspended from using the app.
                </Text>
                <View className="bg-white p-3 rounded border border-red-100">
                  <Text className="text-xs font-manrope-medium text-gray-700 mb-1">
                    <Text className="font-manrope-bold">Reason:</Text> {reason}
                  </Text>
                  <Text className="text-xs font-manrope-medium text-gray-700 mb-1">
                    <Text className="font-manrope-bold">Duration:</Text>{" "}
                    {duration}
                  </Text>
                  {endDate && (
                    <Text className="text-xs font-manrope-medium text-gray-700">
                      <Text className="font-manrope-bold">Until:</Text>{" "}
                      {new Date(endDate.seconds * 1000).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Text className="text-xs font-manrope-medium text-red-600 mt-2 text-center">
                  You can login with a different account, or contact an
                  administrator if you believe this was an error.
                </Text>
              </View>
            )}

            {/* Form */}
            <View>
              {/* Email */}
              <View>
                <Text className="text-base font-medium text-black mb-2 font-manrope-medium">
                  Email
                </Text>
                <TextInput
                  placeholder="Enter email"
                  placeholderTextColor="#747476"
                  style={{
                    fontFamily: "ManropeRegular",
                    fontSize: 15,
                  }}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={handleEmailFocus}
                  onBlur={handleEmailBlur}
                  className={`bg-gray-100 rounded-lg px-5 h-[3.5rem] text-base text-black font-manrope border ${
                    emailError
                      ? "border-red-500"
                      : emailFocused
                      ? "border-navyblue"
                      : "border-gray-300"
                  }`}
                />
                {emailError !== "" && (
                  <Text className="text-red-500 text-sm mt-2 font-manrope-medium">
                    {emailError}
                  </Text>
                )}
              </View>

              {/* Password */}
              <View className="mt-5">
                <Text className="text-base font-medium mb-2 font-manrope-medium">
                  Password
                </Text>
                <View
                  className={`flex-row items-center bg-gray-100 rounded-lg px-4 h-[3.5rem] border ${
                    passwordError
                      ? "border-red-500"
                      : passwordFocused
                      ? "border-navyblue"
                      : "border-gray-300"
                  }`}
                >
                  <TextInput
                    placeholder="Enter password"
                    placeholderTextColor="#747476"
                    style={{
                      fontFamily: "ManropeRegular",
                      fontSize: 15,
                    }}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    secureTextEntry={!showPassword}
                    className="flex-1 text-base text-black"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? "eye" : "eye-off"}
                      size={20}
                      color="#000000"
                    />
                  </Pressable>
                </View>
                {passwordError !== "" && (
                  <Text className="text-red-500 text-sm mt-2 font-manrope-medium">
                    {passwordError}
                  </Text>
                )}
              </View>

              {/* Remember Me & Forgot Password */}
              <View className="flex-row justify-between items-center mt-5">
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  className="flex-row items-center"
                >
                  <View
                    className={`w-5 h-5 rounded border ${
                      rememberMe ? "bg-brand" : "bg-white"
                    } border-gray-300 mr-2 flex items-center justify-center`}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <Text className="text-base font-manrope-medium text-gray-700">
                    Remember me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleForgotPasswordNavigation}>
                  <Text className="text-base font-manrope-medium text-brand underline">
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              className={`flex items-center justify-center py-4 rounded-xl mb-3 mt-6 ${
                loading ? "bg-gray-400" : "bg-brand"
              }`}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-lg font-semibold font-manrope-medium">
                  Login
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="my-5" />

            {/* Register Link */}
            <View className="flex-row justify-center">
              <Text className="text-base text-gray-700 font-manrope-medium">
                New to UniClaim?{" "}
              </Text>
              <Pressable onPress={handleRegisterNavigation}>
                <Text className="text-base font-manrope-medium text-brand font-semibold underline">
                  Register here
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </>
  );
}

export default memo(Login);
