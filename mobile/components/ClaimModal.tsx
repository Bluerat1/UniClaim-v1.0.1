import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import ImagePicker from "./ImagePicker";
import { cloudinaryService } from "../utils/cloudinary";
import { Ionicons } from "@expo/vector-icons";

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
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#3B82F6',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  textInputPlaceholder: {
    color: '#9CA3AF',
  },
  successText: {
    color: '#10B981',
    fontSize: 14,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    color: '#EF4444',
    fontSize: 14,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  uploadIcon: {
    marginBottom: 12,
  },
  uploadText: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 4,
  },
  uploadSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  evidenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  evidenceText: {
    color: '#10B981',
    fontSize: 14,
    flex: 1,
  },
  addButton: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  addButtonText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  addButtonSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonEnabled: {
    backgroundColor: '#7C3AED',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
  },
  loadingText: {
    color: '#6B7280',
  },
});

export default function ClaimModal({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
  postTitle,
}: ClaimModalProps) {
  const [claimReason, setClaimReason] = useState("");
  const [idPhotoUri, setIdPhotoUri] = useState("");
  const [evidencePhotoUris, setEvidencePhotoUris] = useState<string[]>([]);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);
  const [isUploadingEvidencePhoto, setIsUploadingEvidencePhoto] =
    useState(false);
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const [showIdPhotoPicker, setShowIdPhotoPicker] = useState(false);
  const [showEvidencePhotoPicker, setShowEvidencePhotoPicker] = useState(false);

  const handleIdPhotoSelect = (photoUri: string) => {
    setIdPhotoUri(photoUri);
    setShowIdPhotoPicker(false);
  };

  const handleEvidencePhotoSelect = (photoUri: string) => {
    setEvidencePhotoUris((prev) => [...prev, photoUri]);
    setShowEvidencePhotoPicker(false);
  };

  const removeEvidencePhoto = (index: number) => {
    setEvidencePhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!claimReason.trim()) {
      Alert.alert("Error", "Please provide a reason for your claim.");
      return;
    }

    if (!idPhotoUri) {
      Alert.alert("Error", "Please select your ID photo for verification.");
      return;
    }

    if (evidencePhotoUris.length === 0) {
      Alert.alert(
        "Error",
        "Please select at least one evidence photo to support your claim."
      );
      return;
    }

    try {
      setIsClaimSubmitting(true);

      // Upload ID photo
      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoUri,
        "id_photos"
      );

      // Upload evidence photos
      const evidencePhotos = await Promise.all(
        evidencePhotoUris.map(async (uri) => {
          const url = await cloudinaryService.uploadImage(
            uri,
            "evidence_photos"
          );
          return {
            url,
            uploadedAt: new Date(),
            description: "",
          };
        })
      );

      onSubmit({
        claimReason: claimReason.trim(),
        idPhotoUrl,
        evidencePhotos,
      });
    } catch (error) {
      console.error("Error uploading photos:", error);
      Alert.alert("Error", "Failed to upload photos. Please try again.");
    } finally {
      setIsClaimSubmitting(false);
    }
  };

  const resetForm = () => {
    setClaimReason("");
    setIdPhotoUri("");
    setEvidencePhotoUris([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.modalContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>
            Claim Request
          </Text>

          <Text style={styles.subtitle}>
            Requesting to claim: {postTitle}
          </Text>

          {/* Claim Reason */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Reason for Claim <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Briefly state why you claim ownership of this item ..."
              placeholderTextColor={styles.textInputPlaceholder.color}
              value={claimReason}
              onChangeText={setClaimReason}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* ID Photo Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              ID Photo for Verification <Text style={styles.required}>*</Text>
            </Text>
            {idPhotoUri ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.successText}>
                  ✓ ID photo selected
                </Text>
                <TouchableOpacity
                  onPress={() => setIdPhotoUri("")}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowIdPhotoPicker(true)}
                style={styles.uploadArea}
              >
                <View style={{ alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <Ionicons name="camera-outline" size={30} color="gray" />
                  <Text style={styles.uploadText}>
                    Tap to select ID photo
                  </Text>
                </View>
                <Text style={styles.uploadSubtext}>
                  Required for verification
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Evidence Photos Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Evidence Photos <Text style={styles.required}>*</Text>
            </Text>
            <Text style={[styles.uploadSubtext, { marginBottom: 8 }]}>
              Select photos that prove this item belongs to you (up to 5 photos)
            </Text>

            {evidencePhotoUris.map((uri, index) => (
              <View
                key={index}
                style={styles.evidenceItem}
              >
                <Text style={styles.evidenceText}>
                  ✓ Evidence photo {index + 1} selected
                </Text>
                <TouchableOpacity
                  onPress={() => removeEvidencePhoto(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {evidencePhotoUris.length < 5 && (
              <TouchableOpacity
                onPress={() => setShowEvidencePhotoPicker(true)}
                style={styles.addButton}
              >
                <Ionicons name="camera-outline" size={30} color="gray" />
                <Text style={styles.addButtonText}>
                  Add Evidence Photo ({evidencePhotoUris.length}/5)
                </Text>
                <Text style={styles.addButtonSubtext}>Tap to select</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={
                isLoading ||
                isClaimSubmitting ||
                !claimReason.trim() ||
                !idPhotoUri ||
                evidencePhotoUris.length === 0
              }
              style={[
                styles.submitButton,
                (isLoading ||
                isClaimSubmitting ||
                !claimReason.trim() ||
                !idPhotoUri ||
                evidencePhotoUris.length === 0)
                  ? styles.submitButtonDisabled
                  : styles.submitButtonEnabled
              ]}
            >
              <Text style={styles.submitButtonText}>
                {isLoading || isClaimSubmitting
                  ? "Uploading & Sending..."
                  : "Send Request"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>
                Cancel
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
