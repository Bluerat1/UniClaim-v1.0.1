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
import { cloudinaryService } from '../utils/cloudinary';

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
  const [idPhotoUri, setIdPhotoUri] = useState('');
  const [evidencePhotoUris, setEvidencePhotoUris] = useState<string[]>([]);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);
  const [isUploadingEvidencePhoto, setIsUploadingEvidencePhoto] = useState(false);
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const [showIdPhotoPicker, setShowIdPhotoPicker] = useState(false);
  const [showEvidencePhotoPicker, setShowEvidencePhotoPicker] = useState(false);

  const handleIdPhotoSelect = (photoUri: string) => {
    setIdPhotoUri(photoUri);
    setShowIdPhotoPicker(false);
  };

  const handleEvidencePhotoSelect = (photoUri: string) => {
    setEvidencePhotoUris(prev => [...prev, photoUri]);
    setShowEvidencePhotoPicker(false);
  };

  const removeEvidencePhoto = (index: number) => {
    setEvidencePhotoUris(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!claimReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for your claim.');
      return;
    }

    if (!idPhotoUri) {
      Alert.alert('Error', 'Please select your ID photo for verification.');
      return;
    }

    if (evidencePhotoUris.length === 0) {
      Alert.alert('Error', 'Please select at least one evidence photo to support your claim.');
      return;
    }

    try {
      setIsClaimSubmitting(true);

      // Upload ID photo
      const idPhotoUrl = await cloudinaryService.uploadImage(idPhotoUri, 'id_photos');

      // Upload evidence photos
      const evidencePhotos = await Promise.all(
        evidencePhotoUris.map(async (uri) => {
          const url = await cloudinaryService.uploadImage(uri, 'evidence_photos');
          return {
            url,
            uploadedAt: new Date(),
            description: '',
          };
        })
      );

      onSubmit({
        claimReason: claimReason.trim(),
        idPhotoUrl,
        evidencePhotos,
      });
    } catch (error) {
      console.error('Error uploading photos:', error);
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    } finally {
      setIsClaimSubmitting(false);
    }
  };

  const resetForm = () => {
    setClaimReason('');
    setIdPhotoUri('');
    setEvidencePhotoUris([]);
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

          {/* ID Photo Selection */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              ID Photo for Verification *
            </Text>
            {idPhotoUri ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#10b981', fontSize: 14, flex: 1 }}>
                  ✓ ID photo selected
                </Text>
                <TouchableOpacity
                  onPress={() => setIdPhotoUri('')}
                  style={{ padding: 4 }}
                >
                  <Text style={{ color: '#ef4444', fontSize: 14 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowIdPhotoPicker(true)}
                style={{
                  borderWidth: 2,
                  borderColor: '#d1d5db',
                  borderStyle: 'dashed',
                  borderRadius: 8,
                  padding: 20,
                  alignItems: 'center',
                  backgroundColor: 'white',
                }}
              >
                <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 4 }}>
                  📷 Tap to select ID photo
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  Required for verification
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Evidence Photos Selection */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              Evidence Photos *
            </Text>
            <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>
              Select photos that prove this item belongs to you (up to 5 photos)
            </Text>

            {/* Selected Evidence Photos */}
            {evidencePhotoUris.map((uri, index) => (
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
                  ✓ Evidence photo {index + 1} selected
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
            {evidencePhotoUris.length < 5 && (
              <TouchableOpacity
                onPress={() => setShowEvidencePhotoPicker(true)}
                style={{
                  borderWidth: 2,
                  borderColor: '#d1d5db',
                  borderStyle: 'dashed',
                  borderRadius: 8,
                  padding: 16,
                  alignItems: 'center',
                  backgroundColor: 'white',
                }}
              >
                <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 4 }}>
                  📷 Add Evidence Photo ({evidencePhotoUris.length}/5)
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  Tap to select
                </Text>
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
              disabled={isLoading || isClaimSubmitting || !claimReason.trim() || !idPhotoUri || evidencePhotoUris.length === 0}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: isLoading || isClaimSubmitting || !claimReason.trim() || !idPhotoUri || evidencePhotoUris.length === 0 ? '#9ca3af' : '#8b5cf6',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '500' }}>
                {isLoading || isClaimSubmitting ? 'Uploading & Sending...' : 'Send Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Image Pickers */}
      {showIdPhotoPicker && (
        <ImagePicker
          onImageSelect={handleIdPhotoSelect}
          onClose={() => setShowIdPhotoPicker(false)}
          isUploading={false}
        />
      )}

      {showEvidencePhotoPicker && (
        <ImagePicker
          onImageSelect={handleEvidencePhotoSelect}
          onClose={() => setShowEvidencePhotoPicker(false)}
          isUploading={false}
        />
      )}
    </View>
  );
}
