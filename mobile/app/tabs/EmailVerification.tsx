import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
  const { user, userData, refreshUserData, isAuthenticated, handleEmailVerificationComplete, needsEmailVerification } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);



  // Monitor when user is verified and authenticated to navigate to main app
  useEffect(() => {
    if (isEmailVerified && isAuthenticated && !needsEmailVerification) {
      console.log('🔄 Email verified and user authenticated, navigating to main app');
      const timeout = setTimeout(() => {
        navigation.navigate('RootBottomTabs' as never);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isEmailVerified, isAuthenticated, needsEmailVerification, navigation]);

  // Monitor when user becomes fully authenticated and exit this screen
  useEffect(() => {
    if (isAuthenticated && !needsEmailVerification) {
      console.log('✅ User is now fully authenticated, EmailVerification component should unmount');
      // The Navigation component will automatically handle routing to RootBottomTabs
      // This component will be unmounted and replaced with the main app
    }
  }, [isAuthenticated, needsEmailVerification]);

  // Monitor user's email verification status and update local state
  useEffect(() => {
    if (user && user.emailVerified) {
      setIsEmailVerified(true);
    } else if (user && !user.emailVerified) {
      setIsEmailVerified(false);
    }
  }, [user]);

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

  const checkVerificationStatus = async (retryCount = 0) => {
    if (isChecking) return;

    setIsChecking(true);
    setIsLoading(true);

    try {
      // If we have a user (logged in), check their verification status
      if (user) {
        console.log(`🔍 Checking verification status (attempt ${retryCount + 1})`);

        // IMPORTANT: Reload user data to get the latest email verification status
        await user.reload();

        // Add a small delay to ensure Firebase Auth state is fully updated
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check Firebase Auth email verification status after reload
        const isVerified = user.emailVerified;
        setIsEmailVerified(isVerified);

        if (isVerified) {
          console.log('✅ Email verified in Firebase Auth, updating Firestore...');

          // Ensure user is properly authenticated before Firestore update
          if (user && user.emailVerified) {
            try {
              // Update Firestore email verification status
              await authService.handleEmailVerification(user.uid);
              console.log('Email verification completed successfully');

              // Refresh AuthContext state to ensure user is properly authenticated
              await refreshUserData();

              // Call handleEmailVerificationComplete to update authentication state
              await handleEmailVerificationComplete();

              // Navigate to the main app after a short delay to ensure state is updated
              setTimeout(() => {
                console.log('🔄 Navigating to main app after verification');
                navigation.navigate('RootBottomTabs' as never);
              }, 500);

              // Don't navigate here - let the Navigation component handle routing
              // based on the updated authentication state
              console.log('Email verified, AuthContext will handle navigation');

            } catch (updateError: any) {
              console.error('Error updating email verification status:', updateError);
              // Continue with navigation even if Firestore update fails
              // Firebase email verification is what matters for authentication
            }
          }

          // User is verified, but don't navigate directly
          // The AuthContext onAuthStateChanged will detect the change and navigate appropriately
        } else {
          console.log('❌ Email not yet verified in Firebase Auth');

          // If this is the first attempt and email is not verified, show a helpful message
          if (retryCount === 0) {
            Alert.alert(
              'Not Verified Yet',
              'Your email has not been verified yet. Please check your email and click the verification link, then try again.',
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Still Not Verified',
              'Please make sure you clicked the verification link in your email and try again.',
              [{ text: 'OK' }]
            );
          }
        }
      } else {
        // If no user is logged in, we can't check verification status
        Alert.alert(
          'Login Required',
          'Please log in first to check your verification status.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error(`Error checking verification status (attempt ${retryCount + 1}):`, error);

      // If this is not the last retry attempt, try again
      if (retryCount < 2) {
        console.log(`🔄 Retrying verification check in 2 seconds... (attempt ${retryCount + 2})`);
        setTimeout(() => {
          checkVerificationStatus(retryCount + 1);
        }, 2000);
        return;
      }

      // Final failure after retries
      Alert.alert(
        'Error',
        'Failed to check verification status after multiple attempts. Please check your internet connection and try again.',
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
    } catch {
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

  // If user is fully authenticated, don't render this component
  // Let the Navigation component handle routing to the main app
  if (isAuthenticated && !needsEmailVerification) {
    console.log('EmailVerification: User is authenticated, component should unmount');
    return null; // This will allow the Navigation component to render the main app
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isEmailVerified) {
    // Email is verified, AuthContext will handle automatic navigation
    return null;
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
                Return to the app - you&apos;ll be automatically redirected
              </Text>
            </View>
          </View>
          <Text className="text-sm font-manrope-medium text-blue-600 mt-4 text-center">
            Don&apos;t forget to check your spam/junk folder!
          </Text>
        </View>

        {/* Check Again Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-4 ${
            isLoading ? 'bg-gray-300' : 'bg-brand'
          }`}
          onPress={() => checkVerificationStatus()}
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
