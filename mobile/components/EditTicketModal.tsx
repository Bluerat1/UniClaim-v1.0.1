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
  StyleSheet,
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
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    backgroundColor: '#EAB308',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  textInputPlaceholder: {
    color: '#9CA3AF',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    textAlignVertical: 'top',
    minHeight: 96,
  },
  imageSection: {
    marginBottom: 16,
  },
  imageSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 6,
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  statusSection: {
    marginBottom: 16,
  },
  statusContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  statusResolved: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusTextResolved: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusTextPending: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  cleanupContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  cleanupSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  cleanupWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  cleanupText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cleanupSuccessText: {
    color: '#059669',
  },
  cleanupWarningText: {
    color: '#D97706',
  },
});

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
    // console.log("Original post images:", post.images);
    // console.log("Edited images to save:", editedImages);

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

    // console.log("Final updated post:", updatedPost);
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

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Edit Ticket
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[
              styles.saveButton,
              isSaving && styles.saveButtonDisabled
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formContainer}>
          {/* Title Input */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>
              Title *
            </Text>
            <TextInput
              style={styles.textInput}
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Enter ticket title"
              placeholderTextColor={styles.textInputPlaceholder.color}
            />
          </View>

          {/* Description Input */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>
              Description *
            </Text>
            <TextInput
              style={styles.textArea}
              value={editedDescription}
              onChangeText={setEditedDescription}
              placeholder="Enter description"
              placeholderTextColor={styles.textInputPlaceholder.color}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Location Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>
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
          <View style={styles.imageSection}>
            <Text style={styles.imageSectionTitle}>
              Images ({editedImages.length}/3)
            </Text>

            {/* Current Images */}
            <View style={styles.imageGrid}>
              {editedImages.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image
                    source={{ uri: image }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => handleDeleteImage(index)}
                    style={styles.deleteButton}
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
                style={styles.addImageButton}
              >
                <Ionicons name="add" size={24} color="#9CA3AF" />
                <Text style={styles.addImageText}>
                  Add Image
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Current Status Display */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionLabel}>
              Current Status
            </Text>
            <View
              style={[
                styles.statusContainer,
                post.status === "resolved" ? styles.statusResolved : styles.statusPending
              ]}
            >
              <Text
                style={
                  post.status === "resolved" ? styles.statusTextResolved : styles.statusTextPending
                }
              >
                {post.status || "pending"}
              </Text>
            </View>
          </View>

          {/* Image Cleanup Status */}
          {cleanupStatus.isCleaning && (
            <View style={[styles.cleanupContainer, styles.cleanupSuccess]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={[styles.cleanupText, styles.cleanupSuccessText]}>
                  Cleaning up removed images...
                </Text>
              </View>
            </View>
          )}

          {cleanupStatus.deleted.length > 0 && (
            <View style={[styles.cleanupContainer, styles.cleanupSuccess]}>
              <Text style={[styles.cleanupText, styles.cleanupSuccessText]}>
                ✅ Successfully cleaned up {cleanupStatus.deleted.length}{" "}
                removed image(s) from storage
              </Text>
            </View>
          )}

          {cleanupStatus.failed.length > 0 && (
            <View style={[styles.cleanupContainer, styles.cleanupWarning]}>
              <Text style={[styles.cleanupText, styles.cleanupWarningText]}>
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
