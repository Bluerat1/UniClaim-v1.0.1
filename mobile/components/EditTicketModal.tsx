import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Post } from "@/types/type";
import * as ImagePicker from "expo-image-picker";
import CustomDropdownWithSearch from "./DropdownWithSearch";
import { cleanupRemovedPostImages } from "@/utils/cloudinary";
import { USTP_LOCATIONS } from "../constants";

interface EditTicketModalProps {
  post: Post;
  isVisible: boolean;
  onClose: () => void;
  onSave: (updatedPost: Post) => void;
  isSaving?: boolean;
}

export default function EditTicketModal({
  post,
  isVisible,
  onClose,
  onSave,
  isSaving = false,
}: EditTicketModalProps) {
  // Form state
  const [editedTitle, setEditedTitle] = useState(post.title);
  const [editedDescription, setEditedDescription] = useState(post.description);
  const [editedLocation, setEditedLocation] = useState<string | null>(
    // If the current location is in our predefined list, use it; otherwise set to null
    USTP_LOCATIONS.includes(post.location) ? post.location : null
  );

  // Image state - handle both string URLs and File objects
  const [editedImages, setEditedImages] = useState<string[]>(
    post.images.map((img) => {
      if (typeof img === "string") return img;
      if (img instanceof File) return img.name; // Handle File objects
      return String(img); // Fallback for other types
    })
  );
  const [newImageFiles, setNewImageFiles] = useState<string[]>([]);
  const [cleanupStatus, setCleanupStatus] = useState<{
    isCleaning: boolean;
    deleted: string[];
    failed: string[];
  }>({ isCleaning: false, deleted: [], failed: [] });

  // Check permissions when component mounts
  React.useEffect(() => {
    const checkPermissions = async () => {
      try {
        const permissionResult =
          await ImagePicker.getMediaLibraryPermissionsAsync();
        if (permissionResult.status !== "granted") {
          console.log(
            "Photo library permission status:",
            permissionResult.status
          );
        }
      } catch (error) {
        console.log("Error checking permissions:", error);
      }
    };

    checkPermissions();
  }, []);

  // Reset form when post changes
  React.useEffect(() => {
    setEditedTitle(post.title);
    setEditedDescription(post.description);
    setEditedLocation(
      // If the current location is in our predefined list, use it; otherwise set to null
      USTP_LOCATIONS.includes(post.location) ? post.location : null
    );
    setEditedImages(
      post.images.map((img) => {
        if (typeof img === "string") return img;
        if (img instanceof File) return img.name; // Handle File objects
        return String(img); // Fallback for other types
      })
    );
    setNewImageFiles([]);
  }, [post]); // ✅ FIXED: Removed locationOptions from dependencies

  const handleSave = async () => {
    // Basic validation
    if (!editedTitle.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    if (!editedDescription.trim()) {
      Alert.alert("Error", "Description is required");
      return;
    }
    if (!editedLocation) {
      Alert.alert("Error", "Location is required");
      return;
    }

    // Log for debugging
    console.log("Original post images:", post.images);
    console.log("Edited images to save:", editedImages);

    // Clean up removed images from Cloudinary before saving
    setCleanupStatus({ isCleaning: true, deleted: [], failed: [] });

    try {
      const cleanupResult = await cleanupRemovedPostImages(
        post.images,
        editedImages
      );

      setCleanupStatus({
        isCleaning: false,
        deleted: cleanupResult.deleted,
        failed: cleanupResult.failed,
      });

      if (cleanupResult.deleted.length > 0) {
        console.log(
          `Successfully cleaned up ${cleanupResult.deleted.length} removed images from Cloudinary`
        );
      }

      if (cleanupResult.failed.length > 0) {
        console.warn(
          `Failed to clean up ${cleanupResult.failed.length} images from Cloudinary:`,
          cleanupResult.failed
        );
      }
    } catch (cleanupError: any) {
      console.error("Error during image cleanup:", cleanupError.message);
      setCleanupStatus({ isCleaning: false, deleted: [], failed: [] });
      // Don't block the save operation - continue with profile update
    }

    const updatedPost: Post = {
      ...post,
      title: editedTitle.trim(),
      description: editedDescription.trim(),
      location: editedLocation,
      images: editedImages, // This should contain the updated image array
    };

    console.log("Final updated post:", updatedPost);
    onSave(updatedPost);
  };

  const handleCancel = () => {
    // Reset form to original values
    setEditedTitle(post.title);
    setEditedDescription(post.description);
    setEditedLocation(
      // If the current location is in our predefined list, use it; otherwise set to null
      USTP_LOCATIONS.includes(post.location) ? post.location : null
    );
    setEditedImages(
      post.images.map((img) => {
        if (typeof img === "string") return img;
        if (img instanceof File) return img.name; // Handle File objects
        return String(img); // Fallback for other types
      })
    );
    setNewImageFiles([]);
    onClose();
  };

  const handleDeleteImage = (index: number) => {
    if (editedImages.length <= 1) {
      Alert.alert("Error", "You must keep at least one image");
      return;
    }

    const updated = [...editedImages];
    const deletedImage = updated.splice(index, 1)[0];
    setEditedImages(updated);

    // Log for debugging
    console.log("Deleted image:", deletedImage);
    console.log("Updated images array:", updated);
    console.log("Current editedImages state length:", updated.length);
  };

  const handleAddImage = async () => {
    if (editedImages.length >= 3) {
      Alert.alert("Error", "You can only upload up to 3 images");
      return;
    }

    try {
      // Check permissions first
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant photo library access to add images to your ticket.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "OK",
              onPress: () => {
                // User needs to manually go to settings
                // openSettingsAsync is not available in this version
              },
            },
          ]
        );
        return;
      }

      // Launch image picker with better error handling
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // ✅ Using the working API
        allowsEditing: false,
        quality: 1.0,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImage = result.assets[0];
        if (newImage.uri) {
          setEditedImages([...editedImages, newImage.uri]);
        } else {
          Alert.alert("Error", "Selected image has no URI");
        }
      }
    } catch (error: any) {
      console.error("Image picker error:", error);

      // Show more specific error messages
      let errorMessage = "Failed to pick image";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        switch (error.code) {
          case "E_PICKER_CANCELLED":
            errorMessage = "Image selection was cancelled";
            break;
          case "E_PICKER_NO_DATA":
            errorMessage = "No image data received";
            break;
          case "E_PICKER_CANNOT_RUN":
            errorMessage = "Image picker cannot run on this device";
            break;
          default:
            errorMessage = `Image picker error: ${error.code}`;
        }
      }

      Alert.alert("Error", errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-green-100";
      default:
        return "bg-yellow-100";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "text-green-700";
      default:
        return "text-yellow-700";
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 bg-white">
          <TouchableOpacity onPress={handleCancel}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-manrope-semibold text-gray-800">
            Edit Ticket
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="bg-yellow-500 px-4 py-2 rounded-md"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-manrope-medium">Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Title Input */}
          <View className="mb-4">
            <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
              Title *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-md px-3 py-3 text-gray-800 font-manrope"
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Enter ticket title"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description Input */}
          <View className="mb-4">
            <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
              Description *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-md px-3 py-3 text-gray-800 font-manrope"
              value={editedDescription}
              onChangeText={setEditedDescription}
              placeholder="Enter description"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Location Selection */}
          <View className="mb-4">
            <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
              Location *
            </Text>
            <CustomDropdownWithSearch
              label=""
              data={USTP_LOCATIONS}
              selected={editedLocation}
              setSelected={setEditedLocation}
              placeholder="Select a place"
            />
          </View>

          {/* Images Section */}
          <View className="mb-4">
            <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
              Images ({editedImages.length}/3)
            </Text>

            {/* Current Images */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {editedImages.map((image, index) => (
                <View key={index} className="relative">
                  <Image
                    source={{ uri: image }}
                    className="w-20 h-20 rounded-md"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => handleDeleteImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center"
                  >
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Add Image Button */}
            {editedImages.length < 3 && (
              <TouchableOpacity
                onPress={handleAddImage}
                className="border-2 border-dashed border-gray-300 rounded-md p-4 items-center justify-center"
              >
                <Ionicons name="add" size={24} color="#9CA3AF" />
                <Text className="text-gray-500 font-manrope-medium mt-2">
                  Add Image
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Current Status Display */}
          <View className="mb-4">
            <Text className="text-sm font-manrope-medium text-gray-700 mb-2">
              Current Status
            </Text>
            <View
              className={`px-3 py-2 rounded-md ${getStatusColor(post.status || "pending")}`}
            >
              <Text
                className={`text-sm font-manrope-medium capitalize ${getStatusTextColor(post.status || "pending")}`}
              >
                {post.status || "pending"}
              </Text>
            </View>
          </View>

          {/* Image Cleanup Status */}
          {cleanupStatus.isCleaning && (
            <View className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text className="text-blue-700 font-manrope-medium ml-2">
                  Cleaning up removed images...
                </Text>
              </View>
            </View>
          )}

          {cleanupStatus.deleted.length > 0 && (
            <View className="mb-4 p-3 bg-green-50 rounded-md border border-green-200">
              <Text className="text-green-700 font-manrope-medium">
                ✅ Successfully cleaned up {cleanupStatus.deleted.length}{" "}
                removed image(s) from storage
              </Text>
            </View>
          )}

          {cleanupStatus.failed.length > 0 && (
            <View className="mb-4 p-3 bg-yellow-50 rounded-md border border-yellow-200">
              <Text className="text-yellow-700 font-manrope-medium">
                ⚠️ Failed to clean up {cleanupStatus.failed.length} image(s)
                from storage (will be cleaned up later)
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
