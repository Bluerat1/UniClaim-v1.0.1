import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Image } from "react-native";
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
    <View className="absolute inset-0 bg-black/70 justify-center items-center z-50">
      <View className="bg-white p-4 rounded-lg m-4 max-w-sm w-full">
        <Text className="text-lg font-manrope-bold mb-3 text-center">
          Upload ID Photo
        </Text>
        <Text className="text-sm text-gray-600 mb-4 text-center font-inter">
          Please provide a photo of your ID as proof that you received the item.
        </Text>

        {/* Action buttons */}
        <View className="flex-col gap-3 mb-4">
          <TouchableOpacity
            onPress={handleTakePhoto}
            className="w-full bg-blue-500 p-3 rounded-lg"
            disabled={isUploading}
          >
            <Text className="text-white font-manrope-medium text-center font-medium">
              📷 Take New Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleChooseFromGallery}
            className="w-full bg-green-500 p-3 rounded-lg"
            disabled={isUploading}
          >
            <Text className="text-white font-manrope-medium text-center font-medium">
              🖼️ Choose from Gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected image preview */}
        {selectedImage && (
          <View className="mb-4 p-3 bg-gray-50 rounded border">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Selected Photo:
            </Text>
            <Image
              source={{ uri: selectedImage }}
              className="w-full h-32 rounded"
              resizeMode="cover"
            />
          </View>
        )}

        {/* Upload button - only show when image is selected */}
        {selectedImage && (
          <TouchableOpacity
            onPress={handleUpload}
            className="w-full bg-blue-500 p-3 rounded-lg mb-3"
            disabled={isUploading}
          >
            <Text className="text-white text-center font-manrope-medium">
              {isUploading ? "Uploading..." : "Upload Photo"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Cancel button */}
        <TouchableOpacity
          onPress={onClose}
          className="w-full bg-gray-300 p-3 rounded-lg"
        >
          <Text className="text-gray-700 text-center font-manrope-medium">
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ImagePicker;
