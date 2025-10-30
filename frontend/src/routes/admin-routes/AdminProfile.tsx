import MobileNavInfo from "@/components/layout/NavHead";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { profileUpdateService } from "@/utils/profileUpdateService";
import { cloudinaryService } from "@/utils/cloudinary";
import { imageService } from "@/utils/firebase";
import { postUpdateService } from "@/utils/postUpdateService";
import ProfilePicture from "@/components/user/ProfilePicture";
import {
  validateProfilePicture,
  isCloudinaryImage,
} from "@/utils/profilePictureUtils";

const AdminProfile = () => {
  const { userData, loading, refreshUserData } = useAuth();
  const { showToast } = useToast();
  const [isEdit, setIsEdit] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use Firebase user data or fallback to empty strings
  const [userInfo, setUserInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contact: "",
    profilePicture: "",
  });

  const [initialUserInfo, setInitialUserInfo] = useState(userInfo);

  // State for local file storage (deferred upload approach)
  const [selectedProfileFile, setSelectedProfileFile] = useState<File | null>(
    null
  );
  const [profilePicturePreviewUrl, setProfilePicturePreviewUrl] = useState<
    string | null
  >(null);

  // State to track if profile picture is marked for deletion
  const [
    isProfilePictureMarkedForDeletion,
    setIsProfilePictureMarkedForDeletion,
  ] = useState(false);

  // Update local state when Firebase data loads
  useEffect(() => {
    if (userData) {
      const updatedInfo = {
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        email: userData.email || "",
        contact: userData.contactNum || "",
        profilePicture: userData.profilePicture || "",
      };
      setUserInfo(updatedInfo);
      setInitialUserInfo(updatedInfo);
      // Reset local file state when user data loads
      setSelectedProfileFile(null);
      setProfilePicturePreviewUrl(null);
    }
  }, [userData]);

  // Cleanup preview URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (profilePicturePreviewUrl) {
        URL.revokeObjectURL(profilePicturePreviewUrl);
      }
    };
  }, [profilePicturePreviewUrl]);

  // Helper function to clean up preview URL
  const cleanupPreviewUrl = () => {
    if (profilePicturePreviewUrl) {
      URL.revokeObjectURL(profilePicturePreviewUrl);
      setProfilePicturePreviewUrl(null);
    }
  };

  const handleCancel = () => {
    setUserInfo(initialUserInfo);
    // Reset local file state when canceling
    setSelectedProfileFile(null);
    cleanupPreviewUrl();
    setIsProfilePictureMarkedForDeletion(false);
    setIsEdit(false);
  };

  const handleEdit = () => {
    setInitialUserInfo(userInfo); // snapshot of current state
    setIsEdit(true);
  };

  const handleChange = (field: string, value: string) => {
    setUserInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfilePictureUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file using utility function
    const validation = validateProfilePicture(file);
    if (!validation.isValid) {
      showToast(
        "error",
        "Invalid File",
        validation.error || "Please select a valid image file."
      );
      return;
    }

    try {
      // Store the file locally instead of uploading immediately
      setSelectedProfileFile(file);

      // Create a preview URL from the local file
      const previewUrl = URL.createObjectURL(file);
      setProfilePicturePreviewUrl(previewUrl);
    } catch (error: any) {
      console.error("Profile picture selection error:", error);
      showToast(
        "error",
        "Selection Failed",
        "Failed to process the selected image. Please try again."
      );
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      // Check if there's a current profile picture to mark for deletion
      const hasCurrentPicture =
        userInfo.profilePicture && userInfo.profilePicture.trim() !== "";

      if (hasCurrentPicture) {
        // Mark the current profile picture for deletion on save
        setIsProfilePictureMarkedForDeletion(true);

        // Clear any local file selection that might override the deletion
        setSelectedProfileFile(null);
        cleanupPreviewUrl();

        // Update the displayed profile picture to show default immediately
        setUserInfo((prev) => ({ ...prev, profilePicture: "" }));

        showToast(
          "success",
          "Profile Picture Marked for Removal",
          "Your profile picture will be removed when you save changes."
        );
      } else {
        // No current picture to remove
        showToast(
          "info",
          "No Profile Picture",
          "You don't have a profile picture to remove."
        );
      }
    } catch (error: any) {
      console.error("Error marking profile picture for removal:", error);
      showToast(
        "error",
        "Removal Failed",
        "Failed to mark profile picture for removal. Please try again."
      );
    }
  };

  const handleSave = async () => {
    const { firstName, lastName, contact } = userInfo;

    // Check if any field is empty
    if (!firstName.trim() || !lastName.trim() || !contact.trim()) {
      showToast(
        "warning",
        "Save without data in your profile",
        "Please fill in all fields before saving your profile."
      );
      return;
    }

    // Check if values actually changed (including profile picture)
    const hasProfilePictureChanged =
      selectedProfileFile !== null ||
      profilePicturePreviewUrl !== null ||
      isProfilePictureMarkedForDeletion;
    const isChanged =
      firstName !== initialUserInfo.firstName ||
      lastName !== initialUserInfo.lastName ||
      contact !== initialUserInfo.contact ||
      hasProfilePictureChanged;

    if (!isChanged) {
      showToast(
        "info",
        "No Changes Made",
        "Your profile is already up to date."
      );
      setIsEdit(false);
      return;
    }

    // Show summary of what will happen
    if (hasProfilePictureChanged) {
      if (selectedProfileFile) {
        // New profile picture will be uploaded and old one replaced
      } else {
        // Profile picture will be removed
      }
    }

    // Update all user data across collections
    try {
      setIsUpdating(true);

      if (userData?.uid) {
        let finalProfilePicture = userInfo.profilePicture;
        let oldProfilePicture = initialUserInfo.profilePicture; // Use initial value, not current value

        // Handle profile picture changes if there's a new file
        if (selectedProfileFile) {
          try {
            // Upload new profile picture to Cloudinary
            const imageUrls = await cloudinaryService.uploadImages(
              [selectedProfileFile],
              "profiles"
            );
            finalProfilePicture = imageUrls[0];

            // Delete the old profile picture if it exists and is different from the new one
            if (
              oldProfilePicture &&
              oldProfilePicture !== "" &&
              oldProfilePicture !== finalProfilePicture
            ) {
              if (isCloudinaryImage(oldProfilePicture)) {
                try {
                  await imageService.deleteProfilePicture(
                    oldProfilePicture,
                    userData.uid
                  );
                } catch (deleteError: any) {
                  // Don't fail the save operation - continue with profile update
                  showToast(
                    "warning",
                    "Cleanup Warning",
                    "New profile picture uploaded successfully, but there was an issue removing the old one from storage."
                  );
                }
              } else {
                // Old profile picture is not a Cloudinary image, skipping deletion
              }
            } else {
              // No old profile picture to delete or same image
            }
          } catch (uploadError: any) {
            console.error("Failed to upload profile picture:", uploadError);
            showToast(
              "error",
              "Upload Failed",
              "Failed to upload profile picture. Please try again."
            );
            return; // Don't proceed with save if upload fails
          } finally {
          }
        } else if (isProfilePictureMarkedForDeletion) {
          // Profile picture was marked for deletion
          if (oldProfilePicture && oldProfilePicture !== "") {
            if (isCloudinaryImage(oldProfilePicture)) {
              try {
                await imageService.deleteProfilePicture(
                  oldProfilePicture,
                  userData.uid
                );
              } catch (deleteError: any) {
                // Don't fail the save operation - continue with profile update
                showToast(
                  "warning",
                  "Cleanup Warning",
                  "Profile picture removed from profile, but there was an issue deleting it from storage."
                );
              }
            }
          }
          // Set final profile picture to empty string for deletion
          finalProfilePicture = "";
        }

        // Use the new profile update service to update everything
        await profileUpdateService.updateAllUserData(userData.uid, {
          firstName,
          lastName,
          contactNum: contact,
          profilePicture: finalProfilePicture,
        });

        // Update all existing posts with the new profile picture (or removal)
        if (finalProfilePicture !== initialUserInfo.profilePicture) {
          try {
            await postUpdateService.updateUserPostsWithProfilePicture(
              userData.uid,
              finalProfilePicture
            );
          } catch (postUpdateError: any) {
            console.error(
              "Failed to update posts with profile picture change:",
              postUpdateError.message
            );
            // Don't fail the save operation - profile was updated successfully
          }
        }

        // Update local state and clear preview
        setUserInfo((prev) => ({
          ...prev,
          profilePicture: finalProfilePicture,
        }));
        setInitialUserInfo((prev) => ({
          ...prev,
          profilePicture: finalProfilePicture,
        }));
        setSelectedProfileFile(null);
        cleanupPreviewUrl();
        setIsProfilePictureMarkedForDeletion(false);

        // Refresh user data to ensure UI shows updated profile picture
        await refreshUserData();

        console.log("Profile update completed:", {
          finalProfilePicture,
          userInfoProfilePicture: userInfo.profilePicture,
          refreshedUserData: userData?.profilePicture,
        });

        showToast(
          "success",
          "Profile Updated Successfully!",
          "Your profile and all related information have been updated across the app."
        );
        setIsEdit(false);
      }
    } catch (error: any) {
      showToast(
        "error",
        "Update Failed",
        error.message || "Failed to update profile. Please try again."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  // Show error if no user data
  if (!userData) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-500">Unable to load profile data</p>
      </div>
    );
  }

  return (
    <>
      <div className="lg:pt-1">
        <MobileNavInfo
          title="Admin Profile"
          description="Your admin info all in one place"
        />

        {/* profile icon */}
        <div className="relative bg-gradient-to-r from-amber-100 to-yellow-100 h-45 mx-4 mt-4 rounded lg:h-50 lg:mx-6 border-2 border-amber-300">
          <div className="absolute flex gap-8 -bottom-16 z-10 left-4 md:-bottom-25 lg:-bottom-30">
            <div className="relative">
              <ProfilePicture
                src={profilePicturePreviewUrl || userInfo.profilePicture}
                alt="profile"
                className="size-27 sm:w-32 sm:h-32 lg:w-40 lg:h-40 lg:left-6"
                priority={true}
                key={userInfo.profilePicture || "default"} // Force re-render when profile picture changes
              />
              {isEdit && (
                <div className="absolute -bottom-2 -right-2 flex gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUpdating}
                    className="bg-amber-600 text-white rounded-full p-2 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    title="Upload new profile picture"
                  >
                    {isUpdating ? (
                      <svg
                        className="w-3 h-3 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    )}
                  </button>
                  {(userInfo.profilePicture || profilePicturePreviewUrl) && (
                    <button
                      onClick={handleRemoveProfilePicture}
                      disabled={isUpdating}
                      className="bg-red-500 text-white rounded-full p-2 hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed"
                      title="Remove profile picture"
                    >
                      {isUpdating ? (
                        <svg
                          className="w-3 h-3 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureUpload}
                className="hidden"
              />
            </div>
            <div className="hidden space-y-2 md:block mt-16 md:mt-15 md:space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold md:text-xl lg:text-2xl">
                  {userInfo.firstName} <span></span> {userInfo.lastName}
                </h1>
                <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                  ADMIN
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* button group */}
        <div className="mx-4 text-right lg:mx-6 mt-5">
          {!isEdit ? (
            <button
              onClick={handleEdit}
              className="bg-amber-600 border border-amber-600 mr-4 px-4 text-xs sm:text-sm md:text-base py-2 text-white rounded-sm lg:mr-6 hover:bg-amber-700"
            >
              Edit Profile
            </button>
          ) : (
            <div className="">
              <button
                onClick={handleCancel}
                className="border border-amber-600 px-3 mr-3 text-xs sm:text-sm md:text-base py-2 text-gray-800 rounded-sm hover:bg-amber-50"
              >
                Cancel edit
              </button>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className={`border border-amber-600 mr-4 px-5 text-xs sm:text-sm md:text-base py-2 text-white rounded-sm lg:mr-6 ${
                  isUpdating
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isUpdating ? "Updating..." : "Save edit"}
              </button>
            </div>
          )}
        </div>

        <div className="mx-9 mt-6 space-y-2 lg:mx-6 md:hidden">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {userInfo.firstName} {userInfo.lastName}
            </h1>
            <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
              ADMIN
            </span>
          </div>
        </div>

        {/* account details */}
        <div className="mx-7 mt-10 md:mt-20 lg:mt-25">
          <h1 className="text-[16px] lg:text-base my-5">Account Details</h1>

          {/* read-only inputs and edit inputs */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              {/* First Name */}
              <div className="bg-gray-100 border border-gray-700 flex items-center justify-between rounded px-4 py-2.5">
                <h1 className="text-sm text-gray-600">First Name</h1>
                {isEdit ? (
                  <input
                    type="text"
                    value={userInfo.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    className="w-60 max-w-sm bg-white border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                ) : (
                  <span className="text-gray-800 text-sm">
                    {userInfo.firstName}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="bg-gray-100 border border-gray-700 flex items-center justify-between  rounded px-4 py-2.5">
                <h1 className="text-sm text-gray-600">Email</h1>
                <span className="text-gray-800 text-sm">{userInfo.email}</span>
              </div>
            </div>

            <div className="space-y-5">
              {/* Last Name */}
              <div className="bg-gray-100 border border-gray-700 flex items-center justify-between  rounded px-4 py-2.5">
                <h1 className="text-sm text-gray-600">Last Name</h1>
                {isEdit ? (
                  <input
                    type="text"
                    value={userInfo.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    className="w-60 max-w-sm bg-white border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                ) : (
                  <span className="text-gray-800 text-sm">
                    {userInfo.lastName}
                  </span>
                )}
              </div>

              {/* Contact Number */}
              <div className="bg-gray-100 border border-gray-700 flex items-center justify-between  rounded px-4 py-2.5">
                <h1 className="text-sm text-gray-600">Contact Number</h1>
                {isEdit ? (
                  <input
                    type="text"
                    value={userInfo.contact}
                    onChange={(e) => handleChange("contact", e.target.value)}
                    className="w-60 max-w-sm bg-white border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                ) : (
                  <span className="text-gray-800 text-sm">
                    {userInfo.contact}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminProfile;
