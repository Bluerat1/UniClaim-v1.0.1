// app/tabs/ForgotPassword.tsx
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { authService } from "../../utils/firebase/auth";

const ForgotPassword = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    
    // Validation checks
    if (!trimmedEmail) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    try {
      setIsLoading(true);
      await authService.sendPasswordResetEmail(trimmedEmail);
      
      // Success message
      Alert.alert(
        "Password Reset Sent",
        "If an account exists for this email, a password reset link has been sent. Please check your email (including spam/junk folder) and follow the instructions to reset your password.",
        [
          {
            text: "OK",
            onPress: () => {
              setEmail("");
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error: any) {
      // Handle specific Firebase errors
      let errorMessage = "Failed to send password reset email.";
      
      if (error.message) {
        if (error.message.includes("user-not-found")) {
          errorMessage = "No account found with this email address.";
        } else if (error.message.includes("invalid-email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (error.message.includes("too-many-requests")) {
          errorMessage = "Too many requests. Please try again later.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Please check your internet connection.";
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6">
      <Text className="text-2xl font-manrope-bold text-gray-800 mb-6">
        Forgot Password
      </Text>
      <Text className="text-base font-manrope text-gray-600 mb-6">
        Enter your email address to receive a password reset link. Don&apos;t forget to check your spam/junk folder if you don&apos;t see the email.
      </Text>

      <TextInput
        className="bg-white border border-gray-300 rounded-lg h-[3.5rem] px-4 mb-4 text-gray-800 font-[ManropeRegular]"
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity
        className="mt-4 items-center justify-center bg-brand rounded-lg h-[3.5rem] px-4 mb-4"
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        <Text className="text-white font-[ManropeSemiBold]">
          {isLoading ? "Sending..." : "Send Reset Link"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="h-[3.5rem] mt-1 items-center justify-center border border-brand rounded-lg"
        onPress={() => navigation.goBack()}
      >
        <Text className="text-brand text-center font-[ManropeSemiBold]">
          Back to Login
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default ForgotPassword;
