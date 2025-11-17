import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { authService } from "../../utils/firebase/auth";

const ForgotPassword = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    try {
      setIsLoading(true);
      await authService.sendPasswordResetEmail(trimmedEmail);

      Alert.alert(
        "Password Reset Sent",
        "If an account exists for this email, a reset link has been sent.",
        [
          {
            text: "OK",
            onPress: () => {
              setEmail("");
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      let errorMessage = "Failed to send password reset email.";

      if (error.message) {
        if (error.message.includes("user-not-found")) {
          errorMessage = "No account found with this email address.";
        } else if (error.message.includes("invalid-email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (error.message.includes("too-many-requests")) {
          errorMessage = "Too many requests. Please try again later.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Check your connection.";
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
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center", // centers vertically
          paddingHorizontal: 24,
          paddingVertical: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text className="text-2xl font-manrope-bold text-gray-800 mb-6">
            Forgot Password
          </Text>

          <Text className="text-base font-manrope text-gray-600 mb-6">
            Enter your email address to receive a password reset link.
            <Text className="text-blue-600 font-manrope-medium">
              {" "}
              Don&apos;t forget to check your spam/junk folder if you don&apos;t
              see the email.
            </Text>
          </Text>

          <TextInput
            className="bg-white border border-gray-300 rounded-xl h-[3.5rem] px-4 mb-4 text-gray-800 font-[ManropeRegular]"
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            className="mt-4 items-center justify-center bg-brand rounded-xl h-[3.5rem] px-4 mb-4"
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            <Text className="text-white font-[ManropeSemiBold]">
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="h-[3.5rem] mt-1 items-center justify-center border border-brand rounded-xl"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-brand text-center font-[ManropeSemiBold]">
              Back to Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ForgotPassword;
