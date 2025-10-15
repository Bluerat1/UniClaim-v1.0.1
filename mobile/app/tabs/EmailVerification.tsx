import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../types/type';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../utils/firebase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EmailVerification() {
  const navigation = useNavigation<NavigationProp>();
  const { user, userData, refreshUserData } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Only check when user manually taps the button (no automatic background checking)
  useEffect(() => {
    // No automatic checking - only manual button presses
  }, [user, userData]);

  // Countdown timer for resend button
  useEffect(() => {
    let interval: any = null;

    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  const checkVerificationStatus = async () => {
    if (isChecking) return;

    setIsChecking(true);
    setIsLoading(true);

    try {
      // If we have a user (logged in), check their verification status
      if (user) {
        // Check Firebase Auth email verification status (without reload for now)
        const isVerified = user.emailVerified;
        setIsEmailVerified(isVerified);

        if (isVerified) {
          // Ensure user is properly authenticated before Firestore update
          if (user && user.emailVerified) {
            try {
              // Update Firestore email verification status
              await authService.handleEmailVerification(user.uid);
              console.log('Email verification completed successfully');
            } catch (updateError: any) {
              console.error('Error updating email verification status:', updateError);
              // Continue with navigation even if Firestore update fails
            }
          }

          // User is verified, navigate to main app
          (navigation as any).replace('RootBottomTabs');
        } else {
          Alert.alert(
            'Not Verified Yet',
            'Your email has not been verified yet. Please check your email and click the verification link, then try again.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // If no user is logged in, we can't check verification status
        Alert.alert(
          'Login Required',
          'Please log in first to check your verification status.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
      Alert.alert(
        'Error',
        'Failed to check verification status. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setIsChecking(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user || resendCooldown > 0) return;

    try {
      setResendLoading(true);
      await authService.resendEmailVerification();
      setResendCooldown(60); // 60 second cooldown

      Alert.alert(
        'Verification Email Sent',
        'A new verification email has been sent to your email address. Please check your inbox and spam folder.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        'Failed to send verification email. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setResendLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);

      // Clear any local state first
      setIsEmailVerified(false);
      setResendCooldown(0);

      // Logout from Firebase Auth
      await authService.logout();

      // Force navigation to ensure we leave the EmailVerification screen
      // Use a small delay to ensure logout is processed
      setTimeout(() => {
        (navigation as any).navigate('Index');
      }, 100);

    } catch (error: any) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isEmailVerified) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center px-6">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-lg font-manrope-medium text-gray-700 mt-4">
            Verifying...
          </Text>
        </View>
      </SafeAreaView>
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
            We've sent a verification email to
          </Text>
          <Text className="text-lg font-manrope-semibold text-black text-center mt-1">
            {user?.email}
          </Text>
        </View>

        {/* Instructions */}
        <View className="bg-blue-50 p-6 rounded-lg mb-8">
          <Text className="text-base font-manrope-medium text-blue-800 mb-3">
            To complete your registration:
          </Text>
          <View className="space-y-2">
            <View className="flex-row items-start">
              <Text className="text-blue-600 mr-2">1.</Text>
              <Text className="text-blue-700 font-manrope-medium flex-1">
                Check your email inbox for a verification message
              </Text>
            </View>
            <View className="flex-row items-start">
              <Text className="text-blue-600 mr-2">2.</Text>
              <Text className="text-blue-700 font-manrope-medium flex-1">
                Click the verification link in the email
              </Text>
            </View>
            <View className="flex-row items-start">
              <Text className="text-blue-600 mr-2">3.</Text>
              <Text className="text-blue-700 font-manrope-medium flex-1">
                Return to the app - you'll be automatically redirected
              </Text>
            </View>
          </View>
          <Text className="text-sm font-manrope-medium text-blue-600 mt-4 text-center">
            Don't forget to check your spam/junk folder!
          </Text>
        </View>

        {/* Check Again Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-4 ${
            isLoading ? 'bg-gray-300' : 'bg-brand'
          }`}
          onPress={checkVerificationStatus}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white text-lg font-manrope-semibold text-center">
              Check Verification Status
            </Text>
          )}
        </TouchableOpacity>

        {/* Resend Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-4 ${
            resendCooldown > 0 || resendLoading
              ? 'bg-gray-300'
              : 'bg-brand'
          }`}
          onPress={handleResendVerification}
          disabled={resendCooldown > 0 || resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white text-lg font-manrope-semibold text-center">
              {resendCooldown > 0
                ? `Resend Email (${formatTime(resendCooldown)})`
                : 'Resend Verification Email'
              }
            </Text>
          )}
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-6 border border-gray-300 ${
            isLoading ? 'opacity-50' : ''
          }`}
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#2563eb" size="small" />
          ) : (
            <Text className="text-brand text-lg font-manrope-semibold text-center">
              Logout & Use Different Account
            </Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View className="items-center">
          <Text className="text-sm font-manrope-medium text-gray-500 text-center">
            Having trouble? Contact support if you need help with verification.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
