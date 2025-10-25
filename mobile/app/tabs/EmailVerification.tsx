import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../utils/firebase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export default function EmailVerification() {
  const { user, refreshUserData, isAuthenticated, handleEmailVerificationComplete, needsEmailVerification, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'pending' | 'success' | 'failed' | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Monitor when user is verified and authenticated to navigate to main app
  useEffect(() => {
    if (isEmailVerified && isAuthenticated && !needsEmailVerification) {
      console.log('🔄 Email verified and user authenticated, letting AuthContext handle navigation');
      // Don't do manual navigation - let AuthContext and Navigation handle it
    }
  }, [isEmailVerified, isAuthenticated, needsEmailVerification]);

  // Monitor when user becomes fully authenticated and exit this screen
  useEffect(() => {
    if (isAuthenticated && !needsEmailVerification) {
      console.log('✅ EmailVerification: User is now fully authenticated, component should unmount');
      console.log('🔄 EmailVerification: isAuthenticated:', isAuthenticated, 'needsEmailVerification:', needsEmailVerification);

      // The Navigation component will automatically handle routing to RootBottomTabs
      // This component will be unmounted and replaced with the main app
    }
  }, [isAuthenticated, needsEmailVerification]);

  // Also monitor user.emailVerified changes to update local state
  useEffect(() => {
    const wasEmailVerified = isEmailVerified;
    const nowEmailVerified = user?.emailVerified || false;

    if (nowEmailVerified !== wasEmailVerified) {
      console.log('🔄 EmailVerification: user.emailVerified changed from', wasEmailVerified, 'to', nowEmailVerified);
      setIsEmailVerified(nowEmailVerified);
    }
  }, [user?.emailVerified, isEmailVerified]);

  // Reset verification result when user or auth state changes
  useEffect(() => {
    setVerificationResult(null);
  }, [user, needsEmailVerification, isAuthenticated]);

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
    setVerificationResult(null); // Reset previous result

    // Set a maximum timeout to ensure modal closes even if something goes wrong
    const maxTimeout = setTimeout(() => {
      console.log('⚠️ EmailVerification: Force closing modal due to timeout');
      setIsChecking(false);
      setIsLoading(false);
      setVerificationResult('failed');
    }, 30000); // 30 second maximum

    try {
      // If we have a user (logged in), check their verification status
      if (user) {
        console.log(`🔍 Checking verification status (attempt ${retryCount + 1})`);

        // Show loading overlay for the checking process
        // The isChecking state will show the full-screen loading overlay

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
              // Update Firestore email verification status only if not already authenticated
              await authService.handleEmailVerification(user.uid);
              console.log('Email verification completed successfully');

              // Refresh AuthContext state to ensure user is properly authenticated
              await refreshUserData();

              // Call handleEmailVerificationComplete to update authentication state
              await handleEmailVerificationComplete();

              // Clear the timeout since we're navigating away
              clearTimeout(maxTimeout);

              // Set success result and wait for navigation
              setVerificationResult('success');

              // Don't navigate manually - let the AuthContext state changes handle navigation
              // The Navigation component will automatically redirect based on authentication state
              console.log('Email verified, AuthContext will handle navigation');

            } catch (updateError: any) {
              console.error('Error updating email verification status:', updateError);
              // Continue with navigation even if Firestore update fails
              // Firebase email verification is what matters for authentication
              setVerificationResult('success'); // Still success since Firebase verification worked
            }
          }

          // User is verified, but don't navigate directly
          // The AuthContext onAuthStateChanged will detect the change and navigate appropriately
        } else {
          console.log('❌ Email not yet verified in Firebase Auth');
          setVerificationResult('failed');

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
        setVerificationResult('failed');
        Alert.alert(
          'Login Required',
          'Please log in first to check your verification status.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error(`Error checking verification status (attempt ${retryCount + 1}):`, error);
      setVerificationResult('failed');

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
      // Always clear timeout and reset states
      clearTimeout(maxTimeout);
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
      console.error('Error resending verification email:', error);
      Alert.alert(
        'Error',
        `Failed to send verification email: ${error.message || 'Please try again later.'}`,
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

      // Use AuthContext logout which will properly handle state and navigation
      await logout();

      // Don't do manual navigation - let AuthContext and Navigation handle it
      // The onAuthStateChanged listener will update state and Navigation will redirect

    } catch (error: any) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
            Please check your email inbox and click the verification link to activate your account.
          </Text>
          <Text className="text-blue-700 font-manrope-medium mb-2">
            After clicking the link, tap the button below to confirm your email verification.
          </Text>
          <Text className="text-sm font-manrope-medium text-blue-600 text-center">
            You may need to check your spam folder.
          </Text>
        </View>

        {/* I've verified my email Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-4 ${
            isLoading || isChecking ? 'bg-gray-300' : 'bg-brand'
          }`}
          onPress={() => checkVerificationStatus()}
          disabled={isLoading || isChecking}
        >
          {isLoading || isChecking ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white text-lg font-manrope-semibold text-center">
              I&apos;ve verified my email
            </Text>
          )}
        </TouchableOpacity>

        {/* Verification Result */}
        {verificationResult && (
          <View className={`p-4 rounded-lg mb-4 ${
            verificationResult === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <View className="flex-row items-center">
              <Ionicons
                name={verificationResult === 'success' ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={verificationResult === 'success' ? '#10b981' : '#ef4444'}
              />
              <Text className={`ml-2 font-manrope-medium ${
                verificationResult === 'success' ? 'text-green-700' : 'text-red-700'
              }`}>
                {verificationResult === 'success'
                  ? 'Email verified successfully! Redirecting to app...'
                  : 'Email not verified yet. Please check your email and try again.'}
              </Text>
            </View>
          </View>
        )}

        {/* Resend Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl mb-4 ${
            resendCooldown > 0 || resendLoading || isChecking
              ? 'bg-gray-300'
              : 'bg-brand'
          }`}
          onPress={handleResendVerification}
          disabled={resendCooldown > 0 || resendLoading || isChecking}
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
            isLoading || isChecking ? 'opacity-50' : ''
          }`}
          onPress={handleLogout}
          disabled={isLoading || isChecking}
        >
          {isLoading || isChecking ? (
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
