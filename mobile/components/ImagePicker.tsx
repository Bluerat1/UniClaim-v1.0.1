import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Image, StyleSheet } from "react-native";
import * as ExpoImagePicker from "expo-image-picker";

interface ImagePickerProps {
  onImageSelect: (imageUri: string) => void;
  onClose: () => void;
  isUploading?: boolean;
}

const ImagePicker: React.FC<ImagePickerProps> = ({
  onImageSelect,
  onClose,
  isUploading = false,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const requestPermissions = async () => {
    const { status } =
      await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant permission to access your photo library."
      );
      return false;
    }
    return true;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant permission to access your camera."
      );
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    try {
      const hasPermission = await requestCameraPermissions();
      if (!hasPermission) return;

      const result = await ExpoImagePicker.launchCameraAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to open camera. Please try again.");
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert("Error", "Failed to open gallery. Please try again.");
    }
  };

  const handleUpload = () => {
    if (selectedImage) {
      onImageSelect(selectedImage);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>
          Upload ID Photo
        </Text>
        <Text style={styles.subtitle}>
          Please provide a photo of your ID as proof that you received the item.
        </Text>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleTakePhoto}
            style={[styles.primaryButton, isUploading && { opacity: 0.5 }]}
            disabled={isUploading}
          >
            <Text style={styles.primaryButtonText}>
              📷 Take New Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleChooseFromGallery}
            style={[styles.secondaryButton, isUploading && { opacity: 0.5 }]}
            disabled={isUploading}
          >
            <Text style={styles.secondaryButtonText}>
              🖼️ Choose from Gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected image preview */}
        {selectedImage && (
          <View style={styles.imagePreview}>
            <Text style={styles.previewText}>
              Selected Photo:
            </Text>
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Upload button - only show when image is selected */}
        {selectedImage && (
          <TouchableOpacity
            onPress={handleUpload}
            style={[styles.primaryButton, { marginBottom: 12 }, isUploading && { opacity: 0.5 }]}
            disabled={isUploading}
          >
            <Text style={styles.primaryButtonText}>
              {isUploading ? "Uploading..." : "Upload Photo"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Cancel button */}
        <TouchableOpacity
          onPress={onClose}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    maxWidth: 320,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  imagePreview: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 128,
    borderRadius: 8,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default ImagePicker;
