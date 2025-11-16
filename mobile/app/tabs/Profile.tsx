import {
  AntDesign,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useState, useCallback, useEffect } from "react";
import {
  FlatList,
  View as RNView,
  ActivityIndicator as RNActivityIndicator,
  RefreshControl,

  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import PageLayout from "../../layout/PageLayout";
import type { RootStackParamList } from "../../types/type";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { profileUpdateService } from "../../utils/profileUpdateService";
import {
  cloudinaryService,
  deleteOldProfilePicture,
} from "../../utils/cloudinary";
import { userDeletionService } from "../../utils/firebase/userDeletion";
import { credentialStorage } from "../../utils/credentialStorage";
import { usePaginatedUserPosts } from "../../hooks/usePaginatedUserPosts";

type Post = {
  id: string;
  title: string;
  description: string;
  createdAt: {
    toDate: () => Date;
  };
  // Add other post properties as needed
};

// Default profile picture constant
const DEFAULT_PROFILE_PICTURE = require("../../assets/images/empty_profile.jpg");

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Profile">;

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const { logout, userData, user, refreshUserData, isAuthenticated } =
    useAuth();
  const { showToastMessage } = useToast();

  // Delete account states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Add pagination for user posts
  const {
    posts: userPosts,
    loading: isLoadingPosts,
    loadingMore,
    hasMore,
    loadMore,
    error: postsError,
    refresh: refreshPosts,
  } = usePaginatedUserPosts(userData?.email || "");

  // Handle posts error
  useEffect(() => {
    if (postsError) {
      console.error("Error loading posts:", postsError);
      // You can show a toast or alert to the user here
    }
  }, [postsError]);

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
        const separator = uri.includes("?") ? "&" : "?";
        return {
          uri: `${uri}${separator}w=400&h=400&q=80&f=webp`,
          cache: "force-cache" as const,
        };
      }

      // If it's a local file, use it directly (will be handled by ImagePicker)
      return imageUri;
    }

    // If it's a string URL
    if (typeof imageUri === "string") {
      if (imageUri.includes("cloudinary.com")) {
        const separator = imageUri.includes("?") ? "&" : "?";
        return {
          uri: `${imageUri}${separator}w=400&h=400&q=80&f=webp`,
          cache: "force-cache" as const,
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
              showToastMessage(
                "Profile picture removed successfully!",
                "success"
              );
            } else {
              showToastMessage(
                "Profile picture removed, but there was an issue deleting it from storage.",
                "warning"
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

      // Note: We no longer update posts with profile picture changes to reduce write amplification

      // Refresh user data to ensure UI shows updated information
      await refreshUserData();

      showToastMessage("Profile updated successfully!", "success");
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
    console.log("[Logout] Logout initiated - showing confirmation dialog");
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => console.log("[Logout] User cancelled logout"),
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          const startTime = Date.now();
          console.log(
            `[Logout] User confirmed logout at ${new Date().toISOString()}`
          );

          try {
            console.log("[Logout] Initiating logout...");
            const logoutStart = Date.now();
            await logout();
            const logoutDuration = Date.now() - logoutStart;

            console.log(
              `[Logout] Logout completed successfully in ${logoutDuration}ms`
            );
            console.log(
              "[Logout] Auth state change will automatically navigate to Index"
            );
          } catch (error: any) {
            const errorTime = Date.now();
            const errorDuration = errorTime - startTime;

            console.error(
              `[Logout] Error during logout after ${errorDuration}ms:`,
              {
                error: error,
                message: error.message,
                stack: error.stack,
                time: new Date().toISOString(),
              }
            );

            Alert.alert(
              "Logout Failed",
              error.message ||
                "An error occurred during logout. Please try again."
            );
          } finally {
            const totalDuration = Date.now() - startTime;
            console.log(
              `[Logout] Logout process completed in ${totalDuration}ms`
            );
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
    const startTime = Date.now();
    console.log("[Account Deletion] Starting account deletion process...");
    console.log("[Account Deletion] Confirmation text:", deleteConfirmation);

    if (deleteConfirmation !== "DELETE") {
      console.log(
        "[Account Deletion] Validation failed: Invalid confirmation text"
      );
      Alert.alert(
        "Invalid Confirmation",
        "Please type 'DELETE' exactly to confirm account deletion."
      );
      return;
    }

    if (!deletePassword) {
      console.log("[Account Deletion] Validation failed: No password provided");
      Alert.alert(
        "Password Required",
        "Please enter your password to confirm account deletion."
      );
      return;
    }

    if (!user) {
      console.error("[Account Deletion] Error: No authenticated user found");
      Alert.alert(
        "Authentication Error",
        "You must be logged in to delete your account."
      );
      return;
    }

    console.log(
      "[Account Deletion] Starting account deletion for user:",
      user.uid
    );
    console.log("[Account Deletion] User email:", user.email);

    try {
      setIsDeleting(true);
      console.log(
        `[Account Deletion][${new Date().toISOString()}] Starting deletion process...`
      );

      console.log(
        "[Account Deletion] Calling userDeletionService.deleteUserAccount..."
      );

      // Call the deletion service with password for re-authentication
      // The loading overlay with spinner will be visible during this time
      await userDeletionService.deleteUserAccount(user, deletePassword);

      const deletionTime = Date.now() - startTime;
      console.log(
        `[Account Deletion] Account successfully deleted in ${deletionTime}ms`
      );

      // Close the modal first
      handleCloseDeleteModal();
      console.log("[Account Deletion] Modal closed");

      // Clear stored credentials to prevent auto-login attempts with deleted account
      try {
        console.log("[Account Deletion] Clearing stored credentials...");
        await credentialStorage.clearCredentials();
        console.log(
          "[Account Deletion] Successfully cleared stored credentials"
        );
      } catch (credentialError) {
        console.error(
          "[Account Deletion] Error clearing credentials after account deletion:",
          credentialError
        );
        // Continue with logout even if clearing credentials fails
      }

      // Reset loading state after all cleanup is complete
      setIsDeleting(false);
      console.log("[Account Deletion] Reset loading state");

      // Show success message
      Alert.alert(
        "Account Deleted",
        "Your account and all data have been permanently deleted.",
        [
          {
            text: "OK",
            onPress: async () => {
              console.log(
                "[Account Deletion] User acknowledged account deletion"
              );

              console.log(
                "[Account Deletion] Initiating auth state cleanup..."
              );

              try {
                console.log(
                  "[Account Deletion] Auth state cleanup - waiting for AuthContext..."
                );
                // Give AuthContext time to process the auth state change
                await new Promise((resolve) => setTimeout(resolve, 1000));
                console.log("[Account Deletion] Auth state cleanup complete");
              } catch (resetError) {
                console.error(
                  "[Account Deletion] Error during auth state reset:",
                  resetError
                );
              }
            },
          },
        ]
      );
    } catch (error: any) {
      const errorTime = Date.now();
      console.error(
        `[Account Deletion][${new Date().toISOString()}] Error during account deletion:`,
        {
          error: error.toString(),
          message: error.message,
          code: error.code,
          stack: error.stack,
          time: errorTime - startTime + "ms since start",
        }
      );

      // Handle specific error cases
      if (error.message.includes("re-enter your password")) {
        console.log("[Account Deletion] Re-authentication required");
        Alert.alert("Re-authentication Required", error.message);
      } else if (
        error.message.includes("invalid-credential") ||
        error.message.includes("wrong-password")
      ) {
        console.log("[Account Deletion] Invalid password provided");
        Alert.alert(
          "Invalid Password",
          "The password you entered is incorrect. Please try again."
        );
      } else {
        console.error(
          "[Account Deletion] Unexpected error during deletion:",
          error
        );
        Alert.alert(
          "Deletion Failed",
          error.message ||
            "An unexpected error occurred while deleting your account. Please try again."
        );
      }
    } finally {
      console.log("[Account Deletion] Cleaning up...");
      setIsDeleting(false);
      console.log("[Account Deletion] Cleanup complete");
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

            showToastMessage(
              "Your profile picture is marked for removal and will be deleted when you save changes.",
              "info"
            );
          },
        },
      ]
    );
  }, [userData?.profilePicture, showToastMessage]);

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
  }, [user, isAuthenticated, userData]);

  // Render a single post item
  const renderPostItem = useCallback(
    ({ item }: { item: Post }) => (
      <RNView className="mb-4 p-4 bg-white rounded-lg shadow-sm">
        <Text className="font-manrope-bold text-base mb-1">{item.title}</Text>
        <Text className="text-gray-600 text-sm mb-2" numberOfLines={2}>
          {item.description}
        </Text>
        <Text className="text-xs text-gray-500">
          {new Date(item.createdAt?.toDate()).toLocaleDateString()}
        </Text>
      </RNView>
    ),
    []
  );

  // Render loading indicator at the bottom when loading more
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <RNView className="py-4">
        <RNActivityIndicator size="small" color="#1e3a8a" />
      </RNView>
    );
  }, [loadingMore]);

  // Render empty state
  const renderEmptyComponent = useCallback(() => {
    if (isLoading) return null;
    if (isLoadingPosts) return null;
    return (
      <RNView className="py-8 items-center">
        <Text className="text-gray-500">No posts found</Text>
      </RNView>
    );
  }, [isLoading, isLoadingPosts]);

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
                    className={`rounded-md py-3 px-4 flex-row items-center justify-center ${
                      isLoading ? "bg-gray-400" : "bg-green-600"
                    }`}
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
                  name={
                    userData?.emailVerified
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={20}
                  color={userData?.emailVerified ? "#10b981" : "#f59e0b"}
                />
                <Text className="text-[13px] font-manrope-medium">
                  Email Verification
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text
                  className={`font-inter text-[13px] font-medium ${
                    userData?.emailVerified
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  {userData?.emailVerified ? "Verified" : "Pending"}
                </Text>
                {!userData?.emailVerified && (
                  <TouchableOpacity
                    className="bg-orange-100 px-2 py-1 rounded-full"
                    onPress={() =>
                      navigation.navigate("EmailVerification", {
                        email: userData?.email || "",
                        fromLogin: false,
                      })
                    }
                  >
                    <Text className="text-orange-600 text-xs font-manrope-medium">
                      Verify
                    </Text>
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
          animationType="slide"
          onRequestClose={handleCloseDeleteModal}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-black/50 justify-center z-50"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
          >
            {/* Loading Overlay */}
            {isDeleting && (
              <View className="absolute inset-0 bg-black/70 items-center justify-center z-50">
                <View className="bg-white rounded-lg p-8 items-center mx-6">
                  <ActivityIndicator size="large" color="#dc2626" />
                  <Text className="mt-4 text-center font-manrope-medium text-gray-700 text-base">
                    Deleting your account...
                  </Text>
                  <Text className="mt-2 text-center font-manrope text-gray-500 text-sm">
                    Please wait while we remove all your data
                  </Text>
                </View>
              </View>
            )}

            <KeyboardAwareScrollView 
              contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
              extraScrollHeight={20}
              enableOnAndroid={true}
              keyboardShouldPersistTaps="handled"
            >
              <View className="bg-white rounded-lg max-w-md w-full p-6 mx-auto my-4">
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
            </KeyboardAwareScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </PageLayout>
  );
}
