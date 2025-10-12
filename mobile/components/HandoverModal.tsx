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

interface HandoverModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    handoverReason: string;
    idPhotoUrl: string;
    itemPhotos: { url: string; uploadedAt: any; description?: string }[];
  }) => void;
  isLoading?: boolean;
  postTitle: string;
};

const styles = StyleSheet.create({
  modalOverlay: {
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
    maxWidth: 500,
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
  formSection: {
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
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
  itemPhotoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  itemPhotoText: {
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
    marginTop: 4,
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
    backgroundColor: '#10B981',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: 'white',
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
    color: 'white',
  },
});

export default function HandoverModal({
  visible,
  onClose,
  onSubmit,
  isLoading = false,
  postTitle,
}: HandoverModalProps) {
  const [handoverReason, setHandoverReason] = useState("");
  const [idPhotoUri, setIdPhotoUri] = useState("");
  const [itemPhotoUris, setItemPhotoUris] = useState<string[]>([]);
  const [isUploadingIdPhoto, setIsUploadingIdPhoto] = useState(false);
  const [isUploadingItemPhoto, setIsUploadingItemPhoto] = useState(false);
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState(false);
  const [showIdPhotoPicker, setShowIdPhotoPicker] = useState(false);
  const [showItemPhotoPicker, setShowItemPhotoPicker] = useState(false);

  const handleIdPhotoSelect = (photoUri: string) => {
    setIdPhotoUri(photoUri);
    setShowIdPhotoPicker(false);
  };

  const handleItemPhotoSelect = (photoUri: string) => {
    setItemPhotoUris((prev) => [...prev, photoUri]);
    setShowItemPhotoPicker(false);
  };

  const removeItemPhoto = (index: number) => {
    setItemPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!handoverReason.trim()) {
      Alert.alert("Error", "Please provide a reason for the handover request.");
      return;
    }

    if (!idPhotoUri) {
      Alert.alert("Error", "Please select your ID photo for verification.");
      return;
    }

    if (itemPhotoUris.length === 0) {
      Alert.alert("Error", "Please select at least one photo of the item.");
      return;
    }

    try {
      setIsHandoverSubmitting(true);

      // Upload ID photo
      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoUri,
        "id_photos"
      );

      // Upload item photos
      const itemPhotos = await Promise.all(
        itemPhotoUris.map(async (uri) => {
          const url = await cloudinaryService.uploadImage(uri, "item_photos");
          return {
            url,
            uploadedAt: new Date(),
            description: "",
          };
        })
      );

      onSubmit({
        handoverReason: handoverReason.trim(),
        idPhotoUrl,
        itemPhotos,
      });
    } catch (error) {
      console.error("Error uploading photos:", error);
      Alert.alert("Error", "Failed to upload photos. Please try again.");
    } finally {
      setIsHandoverSubmitting(false);
    }
  };

  const resetForm = () => {
    setHandoverReason("");
    setIdPhotoUri("");
    setItemPhotoUris([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>
            Handover Request
          </Text>

          <Text style={styles.subtitle}>
            Requesting to handover: {postTitle}
          </Text>

          {/* Handover Reason */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              Reason for Handover <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="State why do you want to hand over this item..."
              value={handoverReason}
              onChangeText={setHandoverReason}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* ID Photo Selection */}
          <View style={styles.formSection}>
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

          {/* Item Photos Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              Item Photos <Text style={styles.required}>*</Text>
            </Text>
            <Text style={[styles.uploadSubtext, { marginBottom: 8 }]}>
              Select photos of the item (up to 3 photos)
            </Text>

            {/* Selected Item Photos */}
            {itemPhotoUris.map((uri, index) => (
              <View
                key={index}
                style={styles.itemPhotoContainer}
              >
                <Text style={styles.itemPhotoText}>
                  ✓ Photo {index + 1} selected
                </Text>
                <TouchableOpacity
                  onPress={() => removeItemPhoto(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Item Photo Button */}
            {itemPhotoUris.length < 3 && (
              <TouchableOpacity
                onPress={() => setShowItemPhotoPicker(true)}
                style={styles.addButton}
              >
                <Ionicons name="camera-outline" size={30} color="gray" />
                <Text style={styles.addButtonText}>
                  Add Item Photo ({itemPhotoUris.length}/3)
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
                isHandoverSubmitting ||
                !handoverReason.trim() ||
                !idPhotoUri ||
                itemPhotoUris.length === 0
              }
              style={[
                styles.submitButton,
                (isLoading ||
                isHandoverSubmitting ||
                !handoverReason.trim() ||
                !idPhotoUri ||
                itemPhotoUris.length === 0)
                  ? styles.submitButtonDisabled
                  : styles.submitButtonEnabled,
              ]}
            >
              <Text style={styles.submitButtonText}>
                {isLoading || isHandoverSubmitting
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

      {showItemPhotoPicker && (
        <ImagePicker
          onImageSelect={handleItemPhotoSelect}
          onClose={() => setShowItemPhotoPicker(false)}
          isUploading={false}
        />
      )}
    </View>
  );
}
