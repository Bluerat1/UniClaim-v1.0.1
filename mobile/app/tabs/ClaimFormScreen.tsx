import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import PageLayout from '../../layout/PageLayout';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types/type';

type ClaimFormScreenRouteProp = RouteProp<RootStackParamList, 'ClaimFormScreen'>;

export default function ClaimFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ClaimFormScreenRouteProp>();
  const { user, userData } = useAuth();
  
  const { conversationId, postId, postTitle, postOwnerId } = route.params;

  // Form state
  const [claimReason, setClaimReason] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<{
    claimReason?: string;
    confirmation?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!claimReason.trim()) {
      newErrors.claimReason = 'Please provide a reason for your claim';
    }

    if (!isConfirmed) {
      newErrors.confirmation = 'Please confirm that you are the rightful owner';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user || !userData) {
      Alert.alert('Error', 'User data not available');
      return;
    }

    setIsSubmitting(true);

    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to photo capture screen
      navigation.navigate('PhotoCaptureScreen', {
        conversationId,
        postId,
        postTitle,
        postOwnerId,
        claimReason,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to proceed to photo verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (claimReason.trim() || isConfirmed) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <PageLayout>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center">
          <TouchableOpacity onPress={handleBack} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800 flex-1">
            Claim Item
          </Text>
        </View>

        <ScrollView className="flex-1 bg-gray-50 px-4 py-6">
          {/* Item Info */}
          <View className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <Text className="text-sm text-gray-500 mb-1">Claiming Item</Text>
            <Text className="text-lg font-semibold text-gray-800">{postTitle}</Text>
          </View>

          {/* Claim Reason */}
          <View className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <Text className="text-base font-medium text-gray-800 mb-3">
              Why are you claiming this item?
            </Text>
            <TextInput
              value={claimReason}
              onChangeText={setClaimReason}
              placeholder="Describe why this item belongs to you..."
              multiline
              numberOfLines={4}
              className={`border rounded-lg p-3 text-base ${
                errors.claimReason ? 'border-red-300' : 'border-gray-300'
              }`}
              textAlignVertical="top"
            />
            {errors.claimReason && (
              <Text className="text-red-500 text-sm mt-2">{errors.claimReason}</Text>
            )}
          </View>

          {/* Confirmation Checkbox */}
          <View className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <TouchableOpacity
              onPress={() => setIsConfirmed(!isConfirmed)}
              className="flex-row items-center"
            >
              <View
                className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
                  isConfirmed ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                }`}
              >
                {isConfirmed && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
              <Text className="text-base text-gray-800 flex-1">
                I confirm that I am the rightful owner of this item
              </Text>
            </TouchableOpacity>
            {errors.confirmation && (
              <Text className="text-red-500 text-sm mt-2">{errors.confirmation}</Text>
            )}
          </View>

          {/* Photo Requirements Info */}
          <View className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-blue-800 font-medium mb-2">
                  Photo Verification Required
                </Text>
                <Text className="text-blue-700 text-sm">
                  You&apos;ll need to provide photos to verify your claim:
                </Text>
                <Text className="text-blue-700 text-sm mt-1">
                  • A photo of your ID
                </Text>
                <Text className="text-blue-700 text-sm">
                  • Photos showing proof of ownership
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View className="bg-white border-t border-gray-200 px-4 py-4">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`py-3 rounded-lg items-center ${
              isSubmitting ? 'bg-gray-400' : 'bg-blue-500'
            }`}
          >
            {isSubmitting ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-white font-medium ml-2">Processing...</Text>
              </View>
            ) : (
              <Text className="text-white font-medium text-base">
                Continue to Photo Verification
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </PageLayout>
  );
}
