import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState, useCallback, memo } from "react";
import {
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import type { RootStackParamList } from "../../types/type";
import { useAuth } from "../../context/AuthContext";
import { getFirebaseErrorMessage } from "../../utils/firebase";
import Toast from "../../components/Toast";
import { useToast } from "../../context/ToastContext";

function Login() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { login, loading, isBanned, banInfo, needsEmailVerification, user } = useAuth();
  const { showToastMessage, showToast, toastMessage, toastType, toastDuration } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    navigation.navigate("EmailVerification");
  }, [navigation]);

  const handleForgotPasswordNavigation = useCallback(() => {
    navigation.navigate("ForgotPassword");
  }, [navigation]);

  const handleRegisterNavigation = useCallback(() => {
    navigation.navigate("Register");
  }, [navigation]);

  const handleToastClose = useCallback(() => {
    // Toast is managed by ToastContext, no need to reset state here
  }, []);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleLogin = async () => {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setGeneralError("");

    if (!email.trim()) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    }

    if (!valid) {
      return;
    }

    try {
      await login(email, password);

      showToastMessage("Login successful! Welcome back!", "success");

      // Navigation will be handled automatically by Navigation component based on auth state
      // No manual navigation needed - the Navigation component will show RootBottomTabs when authenticated
    } catch (error: any) {
      if (error.message === 'EMAIL_VERIFICATION_REQUIRED') {
        // User needs email verification - show friendly message
        setGeneralError("");
        showToastMessage("Please verify your email address before logging in. Check your email for the verification link.", "info");

        // Don't navigate automatically - let them use the verification message above
      } else {
        const errorMessage = getFirebaseErrorMessage(error);
        setGeneralError(errorMessage);

        // Determine toast type based on error type
        let toastType: "error" | "warning" | "info" = "error";
        if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
          toastType = "warning";
        } else if (errorMessage.toLowerCase().includes('too many') || errorMessage.toLowerCase().includes('rate limit')) {
          toastType = "warning";
        }

        showToastMessage(errorMessage, toastType);
      }
    }
  };

  return (
    <>
      <SafeAreaView className="flex-1 justify-center bg-white px-6">
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
              Your account has been created successfully! Please check your email and click the verification link to activate your account before logging in.
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
                <Text className="font-manrope-bold">Duration:</Text> {duration}
              </Text>
              {endDate && (
                <Text className="text-xs font-manrope-medium text-gray-700">
                  <Text className="font-manrope-bold">Until:</Text>{" "}
                  {new Date(endDate.seconds * 1000).toLocaleDateString()}
                </Text>
              )}
            </View>
            <Text className="text-xs font-manrope-medium text-red-600 mt-2 text-center">
              You can login with a different account, or contact an administrator
              if you believe this was an error.
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

          {/* Forgot Password */}
          <TouchableOpacity
            className="mt-5 self-end"
            onPress={handleForgotPasswordNavigation}
          >
            <Text className="text-base font-manrope-medium text-brand underline">
              Forgot Password?
            </Text>
          </TouchableOpacity>
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
      </SafeAreaView>

      {/* Toast - positioned outside SafeAreaView for proper absolute positioning */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        duration={toastDuration}
        onClose={handleToastClose}
      />
    </>
  );
}

export default memo(Login);
