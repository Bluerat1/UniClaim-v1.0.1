import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import PageLayout from '../../layout/PageLayout';
import { useAuth } from '../../context/AuthContext';
import { useMessage } from '../../context/MessageContext';
import type { RootStackParamList } from '../../types/type';

type PhotoCaptureScreenRouteProp = RouteProp<RootStackParamList, 'PhotoCaptureScreen'>;
type PhotoCaptureScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PhotoData {
  uri: string;
  type: 'id' | 'evidence';
  description?: string;
}

// const { width: screenWidth } = Dimensions.get('window');

export default function PhotoCaptureScreen() {
  const navigation = useNavigation<PhotoCaptureScreenNavigationProp>();
  const route = useRoute<PhotoCaptureScreenRouteProp>();
  const { conversationId, postId, postTitle, postOwnerId, claimReason } = route.params;
  const { user, userData } = useAuth();
  const { sendClaimRequest } = useMessage();

  // Photo state
  const [idPhoto, setIdPhoto] = useState<PhotoData | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<PhotoData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Validation state
  const [errors, setErrors] = useState<{
    idPhoto?: string;
    evidencePhotos?: string;
  }>({});

  const validatePhotos = () => {
    const newErrors: typeof errors = {};

    if (!idPhoto) {
      newErrors.idPhoto = 'Please take a photo of your ID';
    }

    if (evidencePhotos.length === 0) {
      newErrors.evidencePhotos = 'Please take at least one photo showing proof of ownership';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera and photo library permissions to continue.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async (type: 'id' | 'evidence') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets[0]) {
        const photoData: PhotoData = {
          uri: result.assets[0].uri,
          type,
        };

        if (type === 'id') {
          // Check if ID photo already exists
          if (idPhoto) {
            Alert.alert('Photo Limit Reached', 'You can only upload 1 ID photo. Please remove the existing photo first.');
            return;
          }
          setIdPhoto(photoData);
        } else {
          // Check if maximum evidence photos reached
          if (evidencePhotos.length >= 3) {
            Alert.alert('Photo Limit Reached', 'You can only upload a maximum of 3 evidence photos.');
            return;
          }
          setEvidencePhotos(prev => [...prev, photoData]);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const selectFromGallery = async (type: 'id' | 'evidence') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets[0]) {
        const photoData: PhotoData = {
          uri: result.assets[0].uri,
          type,
        };

        if (type === 'id') {
          // Check if ID photo already exists
          if (idPhoto) {
            Alert.alert('Photo Limit Reached', 'You can only upload 1 ID photo. Please remove the existing photo first.');
            return;
          }
          setIdPhoto(photoData);
        } else {
          // Check if maximum evidence photos reached
          if (evidencePhotos.length >= 3) {
            Alert.alert('Photo Limit Reached', 'You can only upload a maximum of 3 evidence photos.');
            return;
          }
          setEvidencePhotos(prev => [...prev, photoData]);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const removePhoto = (type: 'id' | 'evidence', index?: number) => {
    if (type === 'id') {
      setIdPhoto(null);
    } else if (index !== undefined) {
      setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!validatePhotos()) {
      return;
    }

    if (!user || !userData) {
      Alert.alert('Error', 'User data not available');
      return;
    }

    setIsUploading(true);

    try {
      // Upload ID photo to Cloudinary
      let idPhotoUrl = '';
      if (idPhoto) {
        setUploadProgress(25);
        const { cloudinaryService } = await import('../../utils/cloudinary');
        const uploadedUrls = await cloudinaryService.uploadImages([idPhoto.uri], 'id_photos');
        idPhotoUrl = uploadedUrls[0];
        setUploadProgress(50);
      }

      // Upload evidence photos to Cloudinary
      let evidencePhotoUrls: { url: string; uploadedAt: any; description?: string }[] = [];
      if (evidencePhotos.length > 0) {
        const { cloudinaryService } = await import('../../utils/cloudinary');
        const photoUris = evidencePhotos.map(photo => photo.uri);
        const uploadedUrls = await cloudinaryService.uploadImages(photoUris, 'evidence_photos');
        
        evidencePhotoUrls = uploadedUrls.map((url, index) => ({
          url,
          uploadedAt: new Date(),
          description: evidencePhotos[index].description || 'Evidence photo'
        }));
        setUploadProgress(75);
      }

      // Send claim request with uploaded photos
      setUploadProgress(90);
      await sendClaimRequest(
        conversationId,
        user.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || '',
        postId,
        postTitle,
        claimReason,
        idPhotoUrl,
        evidencePhotoUrls
      );
      setUploadProgress(100);

      Alert.alert(
        'Success',
        'Claim request sent successfully! The post owner will review your claim.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to chat screen
              navigation.navigate('Chat', {
                conversationId,
                postId,
                postTitle,
                postOwnerId,
                postOwnerUserData: {}, // Will be fetched in Chat component if needed
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Failed to send claim request:', error);
      Alert.alert('Error', error.message || 'Failed to send claim request. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleBack = () => {
    if (idPhoto || evidencePhotos.length > 0) {
      Alert.alert(
        'Discard Photos?',
        'You have taken photos. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const renderPhotoSection = (
    title: string,
    description: string,
    type: 'id' | 'evidence',
    photo: PhotoData | null,
    photos?: PhotoData[]
  ) => (
    <View className="bg-white rounded-lg p-4 mb-6 shadow-sm">
      <Text className="text-base font-medium text-gray-800 mb-2">{title}</Text>
      <Text className="text-sm text-gray-600 mb-4">{description}</Text>

      {type === 'id' ? (
        // ID Photo Section
        <View>
          {idPhoto ? (
            <View className="relative">
              <Image
                source={{ uri: idPhoto.uri }}
                className="w-full h-48 rounded-lg"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => removePhoto('id')}
                className="absolute top-2 right-2 bg-red-500 rounded-full p-1"
              >
                <Ionicons name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="border-2 border-dashed border-gray-300 rounded-lg p-6 items-center">
              <Ionicons name="camera" size={32} color="#9CA3AF" />
              <Text className="text-gray-500 mt-2 text-center">No photo taken</Text>
            </View>
          )}

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => takePhoto('id')}
              disabled={!!idPhoto}
              className={`flex-1 py-3 rounded-lg items-center ${
                idPhoto ? 'bg-gray-400' : 'bg-blue-500'
              }`}
            >
              <Ionicons name="camera" size={20} color="white" />
              <Text className="text-white font-medium mt-1">Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selectFromGallery('id')}
              disabled={!!idPhoto}
              className={`flex-1 py-3 rounded-lg items-center ${
                idPhoto ? 'bg-gray-400' : 'bg-gray-500'
              }`}
            >
              <Ionicons name="images" size={20} color="white" />
              <Text className="text-white font-medium mt-1">Choose Photo</Text>
            </TouchableOpacity>
          </View>

          {errors.idPhoto && (
            <Text className="text-red-500 text-sm mt-2">{errors.idPhoto}</Text>
          )}
        </View>
      ) : (
        // Evidence Photos Section
        <View>
          {evidencePhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {evidencePhotos.map((photo, index) => (
                <View key={index} className="relative mr-3">
                  <Image
                    source={{ uri: photo.uri }}
                    className="w-32 h-32 rounded-lg"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => removePhoto('evidence', index)}
                    className="absolute top-1 right-1 bg-red-500 rounded-full p-1"
                  >
                    <Ionicons name="close" size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View className="border-2 border-dashed border-gray-300 rounded-lg p-6 items-center">
              <Ionicons name="images" size={32} color="#9CA3AF" />
              <Text className="text-gray-500 mt-2 text-center">No photos taken</Text>
            </View>
          )}

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => takePhoto('evidence')}
              disabled={evidencePhotos.length >= 3}
              className={`flex-1 py-3 rounded-lg items-center ${
                evidencePhotos.length >= 3 ? 'bg-gray-400' : 'bg-blue-500'
              }`}
            >
              <Ionicons name="camera" size={20} color="white" />
              <Text className="text-white font-medium mt-1">Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selectFromGallery('evidence')}
              disabled={evidencePhotos.length >= 3}
              className={`flex-1 py-3 rounded-lg items-center ${
                evidencePhotos.length >= 3 ? 'bg-gray-400' : 'bg-gray-500'
              }`}
            >
              <Ionicons name="images" size={20} color="white" />
              <Text className="text-white font-medium mt-1">Choose Photo</Text>
            </TouchableOpacity>
          </View>

          {errors.evidencePhotos && (
            <Text className="text-red-500 text-sm mt-2">{errors.evidencePhotos}</Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <PageLayout>
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center">
        <TouchableOpacity onPress={handleBack} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800 flex-1">
          Photo Verification
        </Text>
      </View>

      <ScrollView className="flex-1 bg-gray-50 px-4 py-6">
        {/* Item Info */}
        <View className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <Text className="text-sm text-gray-500 mb-1">Claiming Item</Text>
          <Text className="text-lg font-semibold text-gray-800">{postTitle}</Text>
        </View>

        {/* ID Photo Section */}
        {renderPhotoSection(
          'ID Photo',
          'Take a clear photo of your government-issued ID or student ID to verify your identity.',
          'id',
          idPhoto
        )}

        {/* Evidence Photos Section */}
        {renderPhotoSection(
          'Proof of Ownership',
          `Take photos showing proof that this item belongs to you (e.g., receipts, serial numbers, distinctive marks). ${evidencePhotos.length}/3 photos taken.`,
          'evidence',
          null,
          evidencePhotos
        )}

                 {/* Photo Guidelines */}
         <View className="bg-yellow-50 rounded-lg p-4 mb-6 border border-yellow-200">
           <View className="flex-row items-start">
             <Ionicons name="warning" size={20} color="#D97706" />
             <View className="ml-3 flex-1">
               <Text className="text-yellow-800 font-medium mb-2">
                 Photo Guidelines
               </Text>
               <Text className="text-yellow-700 text-sm">
                 • Ensure photos are clear and well-lit
               </Text>
               <Text className="text-yellow-700 text-sm">
                 • ID photo should show your name clearly
               </Text>
               <Text className="text-yellow-700 text-sm">
                 • Maximum of 1 ID photo allowed
               </Text>
               <Text className="text-yellow-700 text-sm">
                 • Evidence photos should clearly show proof of ownership
               </Text>
               <Text className="text-yellow-700 text-sm">
                 • Maximum of 3 evidence photos allowed
               </Text>
               <Text className="text-yellow-700 text-sm">
                 • Full photos will be sent - no cropping required
               </Text>
             </View>
           </View>
         </View>
      </ScrollView>

      {/* Submit Button */}
      <View className="bg-white border-t border-gray-200 px-4 py-4">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isUploading}
          className={`py-3 rounded-lg items-center ${
            isUploading ? 'bg-gray-400' : 'bg-blue-500'
          }`}
        >
                     {isUploading ? (
             <View className="flex-row items-center">
               <ActivityIndicator size="small" color="white" />
               <Text className="text-white font-medium ml-2">
                 {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Sending Claim...'}
               </Text>
             </View>
           ) : (
             <Text className="text-white font-medium text-base">
               Send Claim Request
             </Text>
           )}
        </TouchableOpacity>
      </View>
    </PageLayout>
  );
}
