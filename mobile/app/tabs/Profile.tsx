import {
  AntDesign,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import PageLayout from "../../layout/PageLayout";
import type { RootStackParamList } from "../../types/type";
import { useAuth } from "../../context/AuthContext";
import { profileUpdateService } from "../../utils/profileUpdateService";
import {
  cloudinaryService,
  deleteOldProfilePicture,
} from "../../utils/cloudinary";
import { userService } from "../../utils/firebase";
import { postUpdateService } from "../../utils/postUpdateService";
import { userDeletionService } from "../../utils/firebase/userDeletion";
import { credentialStorage } from "../../utils/credentialStorage";

// Default profile picture constant
const DEFAULT_PROFILE_PICTURE = require("../../assets/images/empty_profile.jpg");

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Profile">;
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { logout, userData, user, refreshUserData, isAuthenticated } = useAuth();

  // Delete account states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [profile, setProfile] = useState(() => {
    return {
      firstName: userData?.firstName || "",
      lastName: userData?.lastName || "",
      email: userData?.email || "",
      contactNumber: userData?.contactNum || "",
      studentId: userData?.studentId || "",
      imageUri:
        userData?.profilePicture &&
        userData.profilePicture.trim() !== "" &&
        !userData.profilePicture.includes("/src/assets/")
          ? { uri: userData.profilePicture }
          : DEFAULT_PROFILE_PICTURE,
    };
  });
  const [hasImageChanged, setHasImageChanged] = useState(false);

  // State for pending deletion (Option 1: Immediate Preview + Deferred Action)
  const [
    isProfilePictureMarkedForDeletion,
    setIsProfilePictureMarkedForDeletion,
  ] = useState(false);

  // Handle image source properly for React Native with optimization
  const getOptimizedImageSource = (imageUri: any) => {
    if (!imageUri) return DEFAULT_PROFILE_PICTURE;

    if (typeof imageUri === "object" && "uri" in imageUri) {
      const uri = imageUri.uri;

      // If it's already a Cloudinary URL, optimize it
      if (uri.includes("cloudinary.com")) {
        const separator = uri.includes('?') ? '&' : '?';
        return {
          uri: `${uri}${separator}w=400&h=400&q=80&f=webp`,
          cache: 'force-cache' as const,
        };
      }

      // If it's a local file, use it directly (will be handled by ImagePicker)
      return imageUri;
    }

    // If it's a string URL
    if (typeof imageUri === "string") {
      if (imageUri.includes("cloudinary.com")) {
        const separator = imageUri.includes('?') ? '&' : '?';
        return {
          uri: `${imageUri}${separator}w=400&h=400&q=80&f=webp`,
          cache: 'force-cache' as const,
        };
      }

      // Return as-is for other URLs
      return { uri: imageUri };
    }

    return DEFAULT_PROFILE_PICTURE;
  };

  const optimizedImageSource = getOptimizedImageSource(profile.imageUri);

  const handleSave = async () => {
    if (!userData || !user) {
      Alert.alert("Error", "User data not available");
      return;
    }

    try {
      setIsLoading(true);

      let profileImageUrl = userData.profilePicture;

      // Handle profile picture changes
      if (hasImageChanged) {
        if (
          profile.imageUri &&
          typeof profile.imageUri === "object" &&
          "uri" in profile.imageUri
        ) {
          // New image uploaded - check if it's a local file or Cloudinary URL
          if (
            profile.imageUri.uri.startsWith("file://") ||
            profile.imageUri.uri.startsWith("content://")
          ) {
            // Local file - upload to Cloudinary
            try {
              const uploadedUrls = await cloudinaryService.uploadImages(
                [profile.imageUri.uri],
                "profiles"
              );
              profileImageUrl = uploadedUrls[0];

              // Automatically delete the old profile picture if it exists and is different from the new one
              if (
                userData.profilePicture &&
                userData.profilePicture !== profileImageUrl
              ) {
                try {
                  const deletionSuccess = await deleteOldProfilePicture(
                    userData.profilePicture
                  );
                  if (deletionSuccess) {
                    // Old profile picture deleted successfully
                  } else {
                    // Failed to delete old profile picture, but continuing with profile update
                  }
                } catch (deleteError: any) {
                  console.error(
                    "Error deleting old profile picture:",
                    deleteError.message
                  );
                  // Don't fail the save operation - continue with profile update
                }
              }
            } catch (imageError: any) {
              console.error("Error uploading profile image:", imageError);
              Alert.alert(
                "Warning",
                "Failed to upload profile image, but other changes will be saved."
              );
              // Revert to original image
              profileImageUrl = userData.profilePicture;
            }
          } else if (profile.imageUri.uri.includes("cloudinary.com")) {
            // Already a Cloudinary URL - use it directly
            profileImageUrl = profile.imageUri.uri;

            // Automatically delete the old profile picture if it exists and is different from the new one
            if (
              userData.profilePicture &&
              userData.profilePicture !== profileImageUrl
            ) {
              try {
                const deletionSuccess = await deleteOldProfilePicture(
                  userData.profilePicture
                );
                if (deletionSuccess) {
                  // Old profile picture deleted successfully
                } else {
                  // Failed to delete old profile picture, but continuing with profile update
                }
              } catch (deleteError: any) {
                console.error(
                  "Error deleting old profile picture:",
                  deleteError.message
                );
                // Don't fail the save operation - continue with profile update
              }
            }
          } else {
            // Default image - set to empty string
            profileImageUrl = "";
          }
        } else {
          // No image - set to empty string (profile picture removed)
          profileImageUrl = "";

          // Automatically delete the old profile picture if it exists
          if (userData.profilePicture) {
            try {
              const deletionSuccess = await deleteOldProfilePicture(
                userData.profilePicture
              );
              if (deletionSuccess) {
                // Old profile picture deleted successfully after removal
              } else {
                // Failed to delete old profile picture after removal, but continuing with profile update
              }
            } catch (deleteError: any) {
              console.error(
                "Error deleting old profile picture after removal:",
                deleteError.message
              );
              // Don't fail the save operation - continue with profile update
            }
          }
        }
      } else if (isProfilePictureMarkedForDeletion) {
        // Profile picture was marked for deletion (Option 1 behavior)
        profileImageUrl = ""; // Set to empty to remove profile picture

        if (userData.profilePicture) {
          try {
            const deletionSuccess = await deleteOldProfilePicture(
              userData.profilePicture
            );
            if (deletionSuccess) {
              Alert.alert("Success", "Profile picture removed successfully!");
            } else {
              Alert.alert(
                "Warning",
                "Profile picture removed, but there was an issue deleting it from storage."
              );
            }
          } catch (deleteError: any) {
            console.error(
              "Error deleting profile picture:",
              deleteError.message
            );
            Alert.alert(
              "Warning",
              "Profile picture removed from profile, but there was an issue deleting it from storage."
            );
          }
        }

        // Clear the pending deletion flag
        setIsProfilePictureMarkedForDeletion(false);
      }

      // Prepare update data
      const updateData: any = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        contactNum: profile.contactNumber,
        studentId: profile.studentId,
      };

      // Include profilePicture if it has changed
      if (hasImageChanged) {
        updateData.profilePicture = profileImageUrl;
      }

      // Update all user data across collections using the new service
      await profileUpdateService.updateAllUserData(user.uid, updateData);

      // Update all existing posts with the new profile picture (or removal)
      if (hasImageChanged) {
        try {
          await postUpdateService.updateUserPostsWithProfilePicture(
            user.uid,
            profileImageUrl || null
          );
        } catch (postUpdateError: any) {
          console.error(
            "Failed to update posts with profile picture change:",
            postUpdateError.message
          );
          // Don't fail the save operation - profile was updated successfully
        }
      }

      // Refresh user data to ensure UI shows updated information
      await refreshUserData();

      Alert.alert("Success", "Profile updated successfully!");
      setIsEditing(false);
      setHasImageChanged(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = useCallback(() => {
    // Revert to original userData
    if (userData) {
      setProfile({
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        email: userData.email || "",
        contactNumber: userData.contactNum || "",
        studentId: userData.studentId || "",
        imageUri:
          userData.profilePicture &&
          userData.profilePicture.trim() !== "" &&
          !userData.profilePicture.includes("/src/assets/")
            ? { uri: userData.profilePicture }
            : DEFAULT_PROFILE_PICTURE,
      });
    }
    setIsEditing(false);
    setHasImageChanged(false);
    setIsProfilePictureMarkedForDeletion(false);
  }, [userData]);

  const handleLogout = useCallback(async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            // Wait a moment for auth state to update
            setTimeout(() => {
              navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
              });
            }, 100);
          } catch (error: any) {
            Alert.alert("Logout Failed", error.message);
          }
        },
      },
    ]);
  }, [logout, navigation]);

  // Delete account handlers
  const handleDeleteAccount = useCallback(() => {
    setShowDeleteModal(true);
    setDeleteConfirmation("");
    setDeletePassword("");
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setDeleteConfirmation("");
    setDeletePassword("");
  }, []);

  const handleConfirmDelete = async () => {
    if (deleteConfirmation !== "DELETE") {
      Alert.alert(
        "Invalid Confirmation",
        "Please type 'DELETE' exactly to confirm account deletion."
      );
      return;
    }

    if (!deletePassword) {
      Alert.alert(
        "Password Required",
        "Please enter your password to confirm account deletion."
      );
      return;
    }

    if (!user) {
      Alert.alert(
        "Authentication Error",
        "You must be logged in to delete your account."
      );
      return;
    }

    try {
      setIsDeleting(true);

      // Show initial alert
      Alert.alert(
        "Deleting Account",
        "Please wait while we delete your account and all associated data..."
      );

      // Call the deletion service with password for re-authentication
      await userDeletionService.deleteUserAccount(user, deletePassword);

      // Show success message and logout
      Alert.alert(
        "Account Deleted",
        "Your account and all data have been permanently deleted.",
        [
          {
            text: "OK",
            onPress: async () => {
              handleCloseDeleteModal();

              // Reset loading state
              setIsDeleting(false);

              // Clear stored credentials to prevent auto-login attempts with deleted account
              try {
                await credentialStorage.clearCredentials();
                console.log('Stored credentials cleared after account deletion');
              } catch (credentialError) {
                console.warn('Error clearing credentials after account deletion:', credentialError);
                // Continue with logout even if clearing credentials fails
              }

              // Force complete reset of auth state
              // Since the user account is deleted, we need to manually reset the AuthContext
              console.log('Account deleted, forcing complete auth state reset');

              // Manually reset auth state instead of calling logout()
              // because logout() may fail when user account is already deleted
              try {
                // Clear any cached auth state in the app
                // The AuthContext onAuthStateChanged listener should handle the rest
                console.log('Auth state will be reset by onAuthStateChanged listener');
              } catch (resetError) {
                console.warn('Error during auth state reset:', resetError);
              }

              // Wait for AuthContext to process the logout state
              await new Promise(resolve => setTimeout(resolve, 500));

              // Force navigation to ensure we leave any current screens
              console.log('Forcing navigation to Index screen after account deletion');
              navigation.reset({
                index: 0,
                routes: [{ name: "Index" }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Error deleting account:", error);

      // Handle specific error cases
      if (error.message.includes("re-enter your password")) {
        Alert.alert("Re-authentication Required", error.message);
      } else if (
        error.message.includes("invalid-credential") ||
        error.message.includes("wrong-password")
      ) {
        Alert.alert(
          "Invalid Password",
          "The password you entered is incorrect. Please try again."
        );
      } else {
        Alert.alert(
          "Deletion Failed",
          error.message || "Failed to delete account. Please try again."
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const pickImage = useCallback(async () => {
    // Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need access to your gallery to change the photo."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as any, // Direct string value avoids all enum deprecation warnings
      allowsEditing: false,
      quality: 1.0,
    });

    if (!result.canceled) {
      setProfile((prev) => ({
        ...prev,
        imageUri: { uri: result.assets[0].uri },
      }));
      setHasImageChanged(true);
    }
  }, []);

  const handleRemoveProfilePicture = useCallback(() => {
    // Check if there's a current profile picture to mark for deletion
    const hasCurrentPicture =
      userData?.profilePicture &&
      userData.profilePicture.trim() !== "" &&
      !userData.profilePicture.includes("/src/assets/");

    if (!hasCurrentPicture) {
      Alert.alert(
        "No Profile Picture",
        "You don&apos;t have a profile picture to remove."
      );
      return;
    }

    // Show confirmation dialog for Option 1 behavior
    Alert.alert(
      "Mark Profile Picture for Removal",
      "This will mark your profile picture for removal. The change will be applied when you save your profile. Continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Mark for Removal",
          style: "destructive",
          onPress: () => {
            // Mark for deletion and show immediate preview (Option 1)
            setIsProfilePictureMarkedForDeletion(true);

            // Update local state to show default image immediately
            setProfile((prev) => ({
              ...prev,
              imageUri: DEFAULT_PROFILE_PICTURE, // Use consistent default
            }));

            setHasImageChanged(true);

            Alert.alert(
              "Profile Picture Marked for Removal",
              "Your profile picture is marked for removal and will be deleted when you save changes."
            );
          },
        },
      ]
    );
  }, [userData?.profilePicture]);

  const renderField = (
    iconName: keyof typeof AntDesign.glyphMap | keyof typeof Ionicons.glyphMap,
    label: string,
    value: string,
    fieldKey: keyof typeof profile,
    IconComponent: typeof AntDesign | typeof Ionicons,
    isReadOnly = false
  ) => {
    if (isEditing && typeof value === "string" && !isReadOnly) {
      return (
        <View className="w-full">
          <Text className="text-base font-manrope-medium mb-1">{label}</Text>
          <TextInput
            value={profile[fieldKey] as string}
            onChangeText={(text) =>
              setProfile((prev) => ({ ...prev, [fieldKey]: text }))
            }
            editable={!isReadOnly} // Optional if you have a read-only field (like email)
            className="w-full bg-zinc-100 p-3 rounded-md border border-zinc-300 font-inter text-base flex-shrink"
            returnKeyType="done"
            numberOfLines={1}
          />
        </View>
      );
    }

    return (
      <View className="flex-row justify-between items-center w-full bg-zinc-100 p-3 rounded-md border border-zinc-300">
        <View className="flex-row items-center gap-3">
          <IconComponent name={iconName as any} size={20} color="black" />
          <Text className="text-[13px] font-manrope-medium">{label}</Text>
        </View>

        <Text
          className="font-inter text-[13px] flex-shrink text-right max-w-[70%]"
          numberOfLines={1}
          ellipsizeMode="tail"
          minimumFontScale={0.9}
        >
          {value}
        </Text>
      </View>
    );
  };

  // Refresh user data when component mounts or userData changes
  useEffect(() => {
    if (user && isAuthenticated && userData) {
      // Ensure profile shows latest data
    }
  }, [userData?.emailVerified]);

  // Show loading if userData is not available yet
  if (!userData) {
    return (
      <PageLayout>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text className="text-gray-500 text-base font-manrope-medium mt-3">
            Loading profile...
          </Text>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
      >
        <KeyboardAwareScrollView
          className="mx-4"
          contentContainerStyle={{
            paddingBottom: 60,
          }}
          extraScrollHeight={10}
          enableOnAndroid={true}
          keyboardOpeningTime={0}
          showsVerticalScrollIndicator={false}
        >
          {/* profile with name and id */}
          <View className="items-center my-4">
            <TouchableOpacity
              activeOpacity={isEditing ? 0.7 : 1}
              onPress={() => {
                if (isEditing) pickImage();
              }}
            >
              <Image
                source={optimizedImageSource}
                className="size-[7.8rem] rounded-full"
                onError={(error) => {
                  console.error("Profile image error:", error);
                  console.log("Image source:", profile.imageUri);
                }}
                defaultSource={DEFAULT_PROFILE_PICTURE}
              />
              {isEditing && (
                <View className="absolute bottom-0 right-0 flex-row gap-1">
                  <View className="bg-black/60 p-1 rounded-full">
                    <Ionicons name="camera-outline" size={18} color="white" />
                  </View>
                  {isProfilePictureMarkedForDeletion && (
                    <View className="bg-orange-500 p-1 rounded-full">
                      <Ionicons
                        name="warning-outline"
                        size={18}
                        color="white"
                      />
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>

            {/* Remove profile picture button - only show when editing and has a profile picture */}
            {isEditing &&
              userData?.profilePicture &&
              userData.profilePicture.trim() !== "" &&
              !userData.profilePicture.includes("/src/assets/") && (
                <TouchableOpacity
                  className={`mt-2 rounded-md py-2 px-3 flex-row items-center gap-2 ${
                    isProfilePictureMarkedForDeletion
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }`}
                  onPress={handleRemoveProfilePicture}
                >
                  <Ionicons
                    name={
                      isProfilePictureMarkedForDeletion
                        ? "warning-outline"
                        : "trash-outline"
                    }
                    size={16}
                    color="white"
                  />
                  <Text className="text-white text-sm font-manrope-medium">
                    {isProfilePictureMarkedForDeletion
                      ? "Marked for Removal"
                      : "Remove Photo"}
                  </Text>
                </TouchableOpacity>
              )}

            <View className="items-center flex-col gap-1 mt-3">
              <Text className="font-manrope-bold text-xl">
                {profile.firstName} {profile.lastName}
              </Text>
              <Text className="text-zinc-500 text-base font-inter">
                Student ID: {profile.studentId}
              </Text>
            </View>

            {/* edit/save/cancel buttons */}
            <View className="my-3 flex-row gap-2">
              {!isEditing ? (
                <TouchableOpacity
                  className="flex-row gap-2 bg-navyblue rounded-md py-3 px-4"
                  onPress={() => setIsEditing(true)}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={15}
                    color="white"
                  />
                  <Text className="text-white text-sm font-manrope-medium">
                    Edit Profile
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    className={`rounded-md py-3 px-4 flex-row items-center justify-center ${isLoading ? "bg-gray-400" : "bg-green-600"}`}
                    onPress={handleSave}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <ActivityIndicator size="small" color="white" />
                        <Text className="text-white text-sm font-manrope-medium ml-2">
                          Saving...
                        </Text>
                      </>
                    ) : (
                      <Text className="text-white text-sm font-manrope-medium">
                        Save Changes
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-red-600 rounded-md py-3 px-4"
                    onPress={handleCancel}
                  >
                    <Text className="text-white text-sm font-manrope-medium">
                      Cancel Changes
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* profile-details-info */}
          <View className="flex-col gap-4 mt-1">
            {renderField(
              "person-outline",
              "First Name",
              profile.firstName,
              "firstName",
              Ionicons
            )}
            {renderField(
              "person-outline",
              "Last Name",
              profile.lastName,
              "lastName",
              Ionicons
            )}
            {renderField(
              "mail-outline",
              "Email",
              profile.email,
              "email",
              Ionicons,
              true // Email is read-only
            )}
            {renderField(
              "call-outline",
              "Contact Number",
              profile.contactNumber,
              "contactNumber",
              Ionicons
            )}
            {renderField(
              "idcard",
              "Student ID",
              profile.studentId,
              "studentId",
              AntDesign
            )}

            {/* Email Verification Status */}
            <View className="flex-row justify-between items-center w-full bg-zinc-100 p-3 rounded-md border border-zinc-300">
              <View className="flex-row items-center gap-3">
                <Ionicons
                  name={userData?.emailVerified ? "checkmark-circle" : "alert-circle"}
                  size={20}
                  color={userData?.emailVerified ? "#10b981" : "#f59e0b"}
                />
                <Text className="text-[13px] font-manrope-medium">Email Verification</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text
                  className={`font-inter text-[13px] font-medium ${
                    userData?.emailVerified ? "text-green-600" : "text-orange-600"
                  }`}
                >
                  {userData?.emailVerified ? "Verified" : "Pending"}
                </Text>
                {!userData?.emailVerified && (
                  <TouchableOpacity
                    className="bg-orange-100 px-2 py-1 rounded-full"
                    onPress={() => navigation.navigate("EmailVerification")}
                  >
                    <Text className="text-orange-600 text-xs font-manrope-medium">Verify</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {!isEditing && (
              <>
                <TouchableOpacity
                  className="flex-row justify-between items-center w-full bg-red-50 p-3 rounded-md border border-red-300"
                  activeOpacity={0.7}
                  onPress={handleLogout}
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="exit-outline" size={20} color="red" />
                    <Text className="text-[13px] font-manrope-medium text-red-500">
                      Log Out
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row justify-between items-center w-full bg-red-600 p-3 rounded-md"
                  activeOpacity={0.7}
                  onPress={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="trash-outline" size={20} color="white" />
                    <Text className="text-[13px] font-manrope-medium text-white">
                      {isDeleting ? "Deleting Account..." : "Delete Account"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          visible={showDeleteModal}
          transparent
          onRequestClose={handleCloseDeleteModal}
        >
          <View className="flex-1 bg-black/50 items-center justify-center z-50 p-4">
            <View className="bg-white rounded-lg max-w-md w-full p-6">
              <View className="flex-row items-center gap-3 mb-4">
                <View className="size-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Ionicons name="warning" size={24} color="#dc2626" />
                </View>
                <Text className="text-lg font-manrope-semibold text-gray-900">
                  Delete Account
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 mb-4 font-manrope-medium text-sm">
                  This action cannot be undone. This will permanently delete
                  your account and remove all data from our servers, including:
                </Text>
                <View className="space-y-1 mb-4">
                  <Text className="text-sm text-gray-500 font-inter">
                    • Your profile and personal information
                  </Text>
                  <Text className="text-sm text-gray-500 font-inter">
                    • All your posts and images
                  </Text>
                  <Text className="text-sm text-gray-500 font-inter">
                    • All conversations and messages
                  </Text>
                  <Text className="text-sm text-gray-500 font-inter">
                    • All notifications and settings
                  </Text>
                </View>
                <Text className="text-red-600 font-manrope-medium">
                  Type{" "}
                  <Text className="bg-red-50 px-1 rounded font-manrope-bold">
                    DELETE
                  </Text>{" "}
                  to confirm:
                </Text>
              </View>

              <View className="flex-col gap-3">
                <TextInput
                  value={deleteConfirmation}
                  onChangeText={setDeleteConfirmation}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-3 border font-inter border-gray-300 rounded-lg"
                  editable={!isDeleting}
                />

                <TextInput
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder="Enter your password to confirm"
                  secureTextEntry={true}
                  className="w-full px-3 py-3 border font-inter border-gray-300 rounded-lg"
                  editable={!isDeleting}
                />

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={handleCloseDeleteModal}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 bg-gray-100 rounded-lg"
                  >
                    <Text className="text-center font-manrope-medium text-gray-700 font-medium">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleConfirmDelete}
                    disabled={
                      isDeleting ||
                      deleteConfirmation !== "DELETE" ||
                      !deletePassword
                    }
                    className="flex-1 px-4 py-3 bg-red-600 rounded-lg"
                  >
                    <Text className="text-center font-manrope-medium text-white font-medium">
                      {isDeleting ? "Deleting..." : "Delete Account"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </PageLayout>
  );
}
