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
      <View className="bg-white rounded-lg p-4 mx-4 max-w-[320px] w-full">
        <Text className="text-lg font-manrope-bold mb-2 text-center">
          Upload ID Photo
        </Text>
        <Text className="text-sm font-inter text-gray-500 mb-4 text-center">
          Please provide a photo of your ID as proof that you received the item.
        </Text>

        {/* Action Buttons */}
        <View className="flex-col gap-3 mb-4">
          <TouchableOpacity
            onPress={handleTakePhoto}
            activeOpacity={0.7}
            delayPressIn={80}
            disabled={isUploading}
            className={`w-full rounded-lg py-3 items-center ${
              isUploading ? "bg-blue-400 opacity-50" : "bg-blue-500"
            }`}
          >
            <Text className="text-white text-base font-manrope-semibold">
              Take A Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleChooseFromGallery}
            activeOpacity={0.7}
            delayPressIn={80}
            disabled={isUploading}
            className={`w-full rounded-lg py-3 items-center ${
              isUploading ? "bg-emerald-400 opacity-50" : "bg-emerald-500"
            }`}
          >
            <Text className="text-white text-base font-manrope-semibold">
              Choose from your Gallery
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected image preview */}
        {selectedImage && (
          <View className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
              Selected Photo:
            </Text>
            <Image
              source={{ uri: selectedImage }}
              className="w-full h-32 rounded-lg"
              resizeMode="cover"
            />
          </View>
        )}

        {/* Upload button */}
        {selectedImage && (
          <TouchableOpacity
            onPress={handleUpload}
            activeOpacity={0.7}
            delayPressIn={80}
            disabled={isUploading}
            className={`w-full rounded-lg py-3 mb-3 items-center ${
              isUploading ? "bg-blue-400 opacity-50" : "bg-blue-500"
            }`}
          >
            <Text className="text-white text-base font-manrope-semibold">
              {isUploading ? "Uploading..." : "Upload Photo"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Cancel button */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          delayPressIn={80}
          className="w-full bg-gray-200 rounded-lg py-3 items-center"
        >
          <Text className="text-gray-800 text-base font-manrope-semibold">
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ImagePicker;
