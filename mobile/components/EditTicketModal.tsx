import React, { useState, useEffect } from "react";
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
import type { Post } from "../types/type";
import * as ImagePicker from "expo-image-picker";
import CustomDropdownWithSearch from "./DropdownWithSearch";
import { cleanupRemovedPostImages } from "../utils/cloudinary";
import { ITEM_CATEGORIES } from "../constants";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const [editedTitle, setEditedTitle] = useState(post.title);
  const [editedDescription, setEditedDescription] = useState(post.description);
  const [editedCategory, setEditedCategory] = useState<string | null>(
    post.category
  );

  const [editedImages, setEditedImages] = useState<string[]>(
    post.images.map((img) => (typeof img === "string" ? img : String(img)))
  );

  const [cleanupStatus, setCleanupStatus] = useState<{
    isCleaning: boolean;
    deleted: string[];
    failed: string[];
  }>({ isCleaning: false, deleted: [], failed: [] });

  useEffect(() => {
    ImagePicker.getMediaLibraryPermissionsAsync().then((permissionResult) => {
      if (permissionResult.status !== "granted") {
        console.log("Photo library permission not granted");
      }
    });
  }, []);

  useEffect(() => {
    setEditedTitle(post.title);
    setEditedDescription(post.description);
    setEditedCategory(post.category);
    setEditedImages(
      post.images.map((img) => (typeof img === "string" ? img : String(img)))
    );
  }, [post]);

  const handleSave = async () => {
    if (!editedTitle.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    if (!editedDescription.trim()) {
      Alert.alert("Error", "Description is required");
      return;
    }
    if (!editedCategory) {
      Alert.alert("Error", "Category is required");
      return;
    }

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
    } catch (error: any) {
      console.error("Cleanup error:", error.message);
      setCleanupStatus({ isCleaning: false, deleted: [], failed: [] });
    }

    const updatedPost: Post = {
      ...post,
      title: editedTitle.trim(),
      description: editedDescription.trim(),
      category: editedCategory,
      images: editedImages,
    };

    onSave(updatedPost);
  };

  const handleCancel = () => {
    setEditedTitle(post.title);
    setEditedDescription(post.description);
    setEditedCategory(post.category);
    setEditedImages(
      post.images.map((img) => (typeof img === "string" ? img : String(img)))
    );
    onClose();
  };

  const handleDeleteImage = (index: number) => {
    if (editedImages.length <= 1) {
      Alert.alert("Error", "You must keep at least one image");
      return;
    }

    const updated = [...editedImages];
    updated.splice(index, 1);
    setEditedImages(updated);
  };

  const handleAddImage = async () => {
    if (editedImages.length >= 3) {
      Alert.alert("Error", "You can only upload up to 3 images");
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant photo library access to add images."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      const newImage = result.assets[0].uri;
      setEditedImages([...editedImages, newImage]);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-white"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <TouchableOpacity onPress={handleCancel}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text className="text-lg font-manrope-bold text-gray-800">
              Edit Ticket
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-md ${
                isSaving ? "bg-gray-300" : "bg-yellow-500"
              }`}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-sm font-manrope-semibold">
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            {/* Title Input */}
            <View className="mb-4">
              <Text className="text-sm font-manrope-semibold text-black mb-2">
                Title
              </Text>
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-3 text-base text-gray-900"
                value={editedTitle}
                onChangeText={setEditedTitle}
                placeholder="Enter ticket title"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Description Input */}
            <View className="mb-4">
              <Text className="text-sm font-manrope-semibold text-black  mb-2">
                Description
              </Text>
              <TextInput
                className="border border-gray-300 rounded-md px-3 pb-3 text-base text-gray-900 min-h-24 text-top"
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Enter description"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Category Dropdown */}
            <View className="mb-4">
              <Text className="text-sm font-manrope-semibold text-black mb-2">
                Category
              </Text>
              <CustomDropdownWithSearch
                label=""
                data={ITEM_CATEGORIES}
                selected={editedCategory}
                setSelected={setEditedCategory}
                placeholder="Select a category"
              />
            </View>

            {/* Images Section */}
            <View className="mb-4">
              <Text className="text-sm font-manrope-semibold text-black mb-4">
                Images ({editedImages.length}/3)
              </Text>

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
                      className="absolute -top-1.5 -right-1.5 bg-red-500 w-6 h-6 rounded-full items-center justify-center"
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {editedImages.length < 3 && (
                <TouchableOpacity
                  onPress={handleAddImage}
                  className="border-2 border-dashed border-gray-300 rounded-md p-4 items-center justify-center"
                >
                  <Ionicons name="add" size={24} color="#9CA3AF" />
                  <Text className="text-sm font-manrope-semibold text-gray-500 mt-2">
                    Add Image
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Current Status */}
            <View className="mb-4">
              <Text className="text-sm font-manrope-semibold text-black mb-2">
                Current Status
              </Text>
              <View
                className={`px-3 py-2 rounded-md ${
                  post.status === "resolved" ? "bg-green-100" : "bg-yellow-100"
                }`}
              >
                <Text
                  className={`text-sm font-manrope-semibold capitalize ${
                    post.status === "resolved"
                      ? "text-green-700"
                      : "text-yellow-700"
                  }`}
                >
                  {post.status || "pending"}
                </Text>
              </View>
            </View>

            {/* Cleanup Status */}
            {cleanupStatus.isCleaning && (
              <View className="mb-4 p-3 rounded-md border border-green-500 bg-green-50 flex-row items-center space-x-2">
                <ActivityIndicator size="small" color="#10B981" />
                <Text className="text-sm font-medium text-green-700">
                  Cleaning up removed images...
                </Text>
              </View>
            )}

            {cleanupStatus.deleted.length > 0 && (
              <View className="mb-4 p-3 rounded-md border border-green-500 bg-green-50">
                <Text className="text-sm font-medium text-green-700">
                  ✅ Successfully cleaned up {cleanupStatus.deleted.length}{" "}
                  image(s)
                </Text>
              </View>
            )}

            {cleanupStatus.failed.length > 0 && (
              <View className="mb-4 p-3 rounded-md border border-yellow-500 bg-yellow-50">
                <Text className="text-sm font-medium text-yellow-700">
                  ⚠️ Failed to clean up {cleanupStatus.failed.length} image(s)
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
