import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
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
}

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

      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoUri,
        "id_photos"
      );

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
    <View className="absolute inset-0 bg-black/50 justify-center items-center z-[2000]">
      <View className="bg-white rounded-xl p-5 mx-5 w-[90%] max-h-[80%]">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="text-lg font-manrope-bold mb-2 text-center">
            Handover Request
          </Text>

          <Text className="text-sm text-blue-500 bg-blue-50 border border-blue-300 p-3 rounded-md mb-5 text-center">
            Requesting to handover: {postTitle}
          </Text>

          {/* Handover Reason */}
          <View className="mb-5">
            <Text className="text-base font-manrope-semibold mb-2">
              Reason for Handover <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="border border-gray-300 font-inter rounded-lg p-3 text-sm text-gray-800"
              placeholder="State why you want to hand over this item..."
              value={handoverReason}
              onChangeText={setHandoverReason}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* ID Photo Selection */}
          <View className="mb-5">
            <Text className="text-base font-manrope-semibold mb-2">
              ID Photo for Verification <Text className="text-red-500">*</Text>
            </Text>
            {idPhotoUri ? (
              <View className="flex-row items-center mb-2">
                <Text className="text-green-500 text-sm flex-1">
                  ✓ ID photo selected
                </Text>
                <TouchableOpacity onPress={() => setIdPhotoUri("")}>
                  <Text className="text-red-500 text-sm">Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowIdPhotoPicker(true)}
                className="border-2 border-gray-300 border-dashed rounded-lg p-5 items-center bg-white"
              >
                <Ionicons name="camera-outline" size={30} color="gray" />
                <Text className="text-gray-500 font-inter text-sm mt-3">
                  Tap to select ID photo
                </Text>
                <Text className="text-gray-400 text-xs font-inter mt-1">
                  Required for verification
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Item Photos */}
          <View className="mb-5">
            <Text className="text-base font-manrope-semibold mb-2">
              Item Photos <Text className="text-red-500">*</Text>
            </Text>
            <Text className="text-xs font-inter text-gray-400 mb-2">
              Select photos of the item (up to 3 photos)
            </Text>

            {itemPhotoUris.map((uri, index) => (
              <View
                key={index}
                className="flex-row items-center mb-2 p-2 bg-gray-50 rounded-md"
              >
                <Text className="text-green-500 font-inter text-sm flex-1">
                  ✓ Photo {index + 1} selected
                </Text>
                <TouchableOpacity onPress={() => removeItemPhoto(index)}>
                  <Text className="text-red-500 text-sm">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {itemPhotoUris.length < 3 && (
              <TouchableOpacity
                onPress={() => setShowItemPhotoPicker(true)}
                className="border-2 border-gray-300 border-dashed rounded-lg p-4 items-center bg-white"
              >
                <Ionicons name="camera-outline" size={30} color="gray" />
                <Text className="text-gray-500 text-sm font-inter mt-2">
                  Add Item Photo ({itemPhotoUris.length}/3)
                </Text>
                <Text className="text-gray-400 font-inter text-xs mt-1">
                  Tap to select
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Buttons */}
          <View className="flex-col gap-3 mt-5">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={
                isLoading ||
                isHandoverSubmitting ||
                !handoverReason.trim() ||
                !idPhotoUri ||
                itemPhotoUris.length === 0
              }
              className={`rounded-lg py-3 items-center ${
                isLoading ||
                isHandoverSubmitting ||
                !handoverReason.trim() ||
                !idPhotoUri ||
                itemPhotoUris.length === 0
                  ? "bg-gray-400"
                  : "bg-green-500"
              }`}
            >
              <Text className="text-white text-base font-manrope-semibold">
                {isLoading || isHandoverSubmitting
                  ? "Uploading & Sending..."
                  : "Send Request"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClose}
              className="rounded-lg py-3 items-center bg-red-100"
            >
              <Text className="text-red-600 text-base font-manrope-semibold">
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
          title="Upload ID Photo"
          description="Please provide a photo of your ID as proof that you received the item."
        />
      )}
      {showItemPhotoPicker && (
        <ImagePicker
          onImageSelect={handleItemPhotoSelect}
          onClose={() => setShowItemPhotoPicker(false)}
          isUploading={false}
          title="Upload Item Photo"
          description="Please provide photos of the item to be handed over."
        />
      )}
    </View>
  );
}
