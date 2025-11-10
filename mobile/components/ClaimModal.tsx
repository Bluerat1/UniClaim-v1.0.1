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
  const [claimReason, setClaimReason] = useState("");
  const [idPhotoUri, setIdPhotoUri] = useState("");
  const [evidencePhotoUris, setEvidencePhotoUris] = useState<string[]>([]);
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

      const idPhotoUrl = await cloudinaryService.uploadImage(
        idPhotoUri,
        "id_photos"
      );

      const evidencePhotos = await Promise.all(
        evidencePhotoUris.map(async (uri) => {
          const url = await cloudinaryService.uploadImage(
            uri,
            "evidence_photos"
          );
          return { url, uploadedAt: new Date(), description: "" };
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
    <View className="absolute inset-0 bg-black/50 justify-center items-center z-[2000]">
      <View className="bg-white rounded-xl p-5 m-5 w-[90%] max-h-[80%]">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="text-lg font-manrope-bold mb-2 text-center">
            Claim Request
          </Text>
          <Text className="text-sm font-inter text-blue-600 border border-blue-300 bg-blue-50 p-3 rounded-md mb-5 text-center">
            Requesting to claim: {postTitle}
          </Text>

          {/* Claim Reason */}
          <View className="mb-5">
            <Text className="text-base font-manrope-semibold mb-2">
              Reason for Claim <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 font-inter text-base text-gray-900"
              placeholder="Briefly state why you claim ownership of this item ..."
              placeholderTextColor="#9CA3AF"
              value={claimReason}
              onChangeText={setClaimReason}
              multiline
              numberOfLines={4}
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
                className="border-2 border-dashed border-gray-300 rounded-lg p-5 items-center bg-white"
              >
                <View className="items-center justify-center gap-3">
                  <Ionicons name="camera-outline" size={30} color="gray" />
                  <Text className="text-gray-600 text-sm font-inter">
                    Tap to select ID photo
                  </Text>
                </View>
                <Text className="text-gray-400 text-xs font-inter">
                  Required for verification
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Evidence Photos */}
          <View className="mb-5">
            <Text className="text-base font-manrope-semibold mb-1">
              Evidence Photos <Text className="text-red-500">*</Text>
            </Text>
            <Text className="text-xs font-inter text-gray-400 mb-2">
              Select photos that prove this item belongs to you (up to 3 photos)
            </Text>

            {evidencePhotoUris.map((uri, index) => (
              <View
                key={index}
                className="flex-row items-center font-inter mb-2 p-2 bg-gray-50 rounded-md"
              >
                <Text className="text-green-500 text-sm flex-1">
                  ✓ Evidence photo {index + 1} selected
                </Text>
                <TouchableOpacity onPress={() => removeEvidencePhoto(index)}>
                  <Text className="text-red-500 text-sm">Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {evidencePhotoUris.length < 3 && (
              <TouchableOpacity
                onPress={() => setShowEvidencePhotoPicker(true)}
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 items-center bg-white"
              >
                <Ionicons name="camera-outline" size={30} color="gray" />
                <Text className="text-gray-600 text-sm font-inter mt-3 mb-1">
                  Add Evidence Photo ({evidencePhotoUris.length}/3)
                </Text>
                <Text className="text-gray-400 text-xs font-inter">
                  Tap to select
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-col gap-3 mt-5">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={
                isLoading ||
                isClaimSubmitting ||
                !claimReason.trim() ||
                !idPhotoUri ||
                evidencePhotoUris.length === 0
              }
              className={`px-5 py-3 rounded-lg items-center ${
                isLoading ||
                isClaimSubmitting ||
                !claimReason.trim() ||
                !idPhotoUri ||
                evidencePhotoUris.length === 0
                  ? "bg-gray-200"
                  : "bg-blue-500"
              }`}
            >
              <Text className="text-white text-base font-manrope-semibold text-center">
                {isLoading || isClaimSubmitting
                  ? "Uploading & Sending..."
                  : "Send Request"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClose}
              className="px-5 py-3 rounded-lg bg-red-100 items-center"
            >
              <Text className="text-red-600 text-base font-manrope-semibold text-center">
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
      {showEvidencePhotoPicker && (
        <ImagePicker
          onImageSelect={handleEvidencePhotoSelect}
          onClose={() => setShowEvidencePhotoPicker(false)}
          isUploading={false}
          title="Upload Evidence Photo"
          description="Please provide photos that prove this item belongs to you."
        />
      )}
    </View>
  );
}
