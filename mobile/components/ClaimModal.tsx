import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ImagePicker from './ImagePicker';
import { uploadToCloudinary } from '../utils/cloudinary';

interface ClaimModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    claimReason: string;
    idPhotoUrl: string;
    evidencePhotos: { url: string; uploadedAt: any; description?: string }[];
  }) => void;
  isLoading?: boolean;
  postTitle: string;
}

export default function ClaimModal({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
  postTitle,
}: ClaimModalProps) {
  const [claimReason, setClaimReason] = useState('');
  const [idPhotoUrl, setIdPhotoUrl] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<{ url: string; uploadedAt: any; description?: string }[]>([]);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);
  const [isUploadingEvidencePhoto, setIsUploadingEvidencePhoto] = useState(false);
  const [showIdPhotoPicker, setShowIdPhotoPicker] = useState(false);
  const [showEvidencePhotoPicker, setShowEvidencePhotoPicker] = useState(false);

  const handleIdPhotoUpload = async (photoUri: string) => {
    try {
      setIsUploadingIdPhoto(true);
      const uploadedUrl = await uploadToCloudinary(photoUri);
      setIdPhotoUrl(uploadedUrl);
      setShowIdPhotoPicker(false);
      Alert.alert('Success', 'ID photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading ID photo:', error);
      Alert.alert('Error', 'Failed to upload ID photo. Please try again.');
    } finally {
      setIsUploadingIdPhoto(false);
    }
  };

  const handleEvidencePhotoUpload = async (photoUri: string) => {
    try {
      setIsUploadingEvidencePhoto(true);
      const uploadedUrl = await uploadToCloudinary(photoUri);
      const newPhoto = {
        url: uploadedUrl,
        uploadedAt: new Date(),
        description: '',
      };
      setEvidencePhotos(prev => [...prev, newPhoto]);
      setShowEvidencePhotoPicker(false);
      Alert.alert('Success', 'Evidence photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading evidence photo:', error);
      Alert.alert('Error', 'Failed to upload evidence photo. Please try again.');
    } finally {
      setIsUploadingEvidencePhoto(false);
    }
  };

  const removeEvidencePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateEvidencePhotoDescription = (index: number, description: string) => {
    setEvidencePhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, description } : photo
    ));
  };

  const handleSubmit = () => {
    if (!claimReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for your claim.');
      return;
    }

    if (!idPhotoUrl) {
      Alert.alert('Error', 'Please upload your ID photo for verification.');
      return;
    }

    if (evidencePhotos.length === 0) {
      Alert.alert('Error', 'Please upload at least one evidence photo to support your claim.');
      return;
    }

    onSubmit({
      claimReason: claimReason.trim(),
      idPhotoUrl,
      evidencePhotos,
    });
  };

  const resetForm = () => {
    setClaimReason('');
    setIdPhotoUrl('');
    setEvidencePhotos([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
    >
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 20,
          margin: 20,
          width: '90%',
          maxWidth: 500,
          maxHeight: '80%',
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: 'bold',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            Claim Request
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: '#666',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            Requesting to claim: {postTitle}
          </Text>

          {/* Claim Reason */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Reason for Claim *
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              placeholder="Please explain why you believe this item belongs to you..."
              value={claimReason}
              onChangeText={setClaimReason}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* ID Photo Upload */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              ID Photo for Verification *
            </Text>
            {idPhotoUrl ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#10b981', fontSize: 14, flex: 1 }}>
                  ✓ ID photo uploaded
                </Text>
                <TouchableOpacity
                  onPress={() => setIdPhotoUrl('')}
                  style={{ padding: 4 }}
                >
                  <Text style={{ color: '#ef4444', fontSize: 14 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowIdPhotoPicker(true)}
                disabled={isUploadingIdPhoto}
                style={{
                  borderWidth: 2,
                  borderColor: '#d1d5db',
                  borderStyle: 'dashed',
                  borderRadius: 8,
                  padding: 20,
                  alignItems: 'center',
                  backgroundColor: isUploadingIdPhoto ? '#f9fafb' : 'white',
                }}
              >
                {isUploadingIdPhoto ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <>
                    <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 4 }}>
                      📷 Tap to upload ID photo
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      Required for verification
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Evidence Photos Upload */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Evidence Photos *
            </Text>
            <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
              Upload photos that prove this item belongs to you (up to 5 photos)
            </Text>

            {/* Existing Evidence Photos */}
            {evidencePhotos.map((photo, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                  padding: 8,
                  backgroundColor: '#f9fafb',
                  borderRadius: 6,
                }}
              >
                <Text style={{ color: '#10b981', fontSize: 14, flex: 1 }}>
                  ✓ Evidence photo {index + 1} uploaded
                </Text>
                <TouchableOpacity
                  onPress={() => removeEvidencePhoto(index)}
                  style={{ padding: 4 }}
                >
                  <Text style={{ color: '#ef4444', fontSize: 14 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Evidence Photo Button */}
            {evidencePhotos.length < 5 && (
              <TouchableOpacity
                onPress={() => setShowEvidencePhotoPicker(true)}
                disabled={isUploadingEvidencePhoto}
                style={{
                  borderWidth: 2,
                  borderColor: '#d1d5db',
                  borderStyle: 'dashed',
                  borderRadius: 8,
                  padding: 16,
                  alignItems: 'center',
                  backgroundColor: isUploadingEvidencePhoto ? '#f9fafb' : 'white',
                }}
              >
                {isUploadingEvidencePhoto ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : (
                  <>
                    <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 4 }}>
                      📷 Add Evidence Photo ({evidencePhotos.length}/5)
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                      Tap to upload
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              marginTop: 20,
            }}
          >
            <TouchableOpacity
              onPress={handleClose}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: '#6b7280',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '500' }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || !claimReason.trim() || !idPhotoUrl || evidencePhotos.length === 0}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: isLoading || !claimReason.trim() || !idPhotoUrl || evidencePhotos.length === 0 ? '#9ca3af' : '#8b5cf6',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '500' }}>
                {isLoading ? 'Sending...' : 'Send Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Image Pickers */}
      {showIdPhotoPicker && (
        <ImagePicker
          onImageSelect={handleIdPhotoUpload}
          onClose={() => setShowIdPhotoPicker(false)}
          isUploading={isUploadingIdPhoto}
        />
      )}

      {showEvidencePhotoPicker && (
        <ImagePicker
          onImageSelect={handleEvidencePhotoUpload}
          onClose={() => setShowEvidencePhotoPicker(false)}
          isUploading={isUploadingEvidencePhoto}
        />
      )}
    </View>
  );
}
