import MobileNavInfo from "@/components/NavHeadComp";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { profileUpdateService } from "@/utils/profileUpdateService";
import { cloudinaryService } from "@/utils/cloudinary";
import { imageService } from "@/utils/firebase";
import { postUpdateService } from "@/utils/postUpdateService";
import ProfilePicture from "@/components/ProfilePicture";
import {
  validateProfilePicture,
  isCloudinaryImage,
} from "@/utils/profilePictureUtils";
import { userDeletionService } from "@/services/firebase/userDeletion";

const Profile = () => {
  const { userData, loading, refreshUserData, user, logout } = useAuth();
  const { showToast } = useToast();
  const [isEdit, setIsEdit] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete account states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use Firebase user data or fallback to empty strings
  const [userInfo, setUserInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contact: "",
    studentId: "",
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

  // State for pending deletion (Option 1: Immediate Preview + Deferred Action)
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
        studentId: userData.studentId || "",
        profilePicture: userData.profilePicture || "",
      };
      setUserInfo(updatedInfo);
      setInitialUserInfo(updatedInfo);
      // Reset local file state when user data loads
      setSelectedProfileFile(null);
      setProfilePicturePreviewUrl(null);
      setIsProfilePictureMarkedForDeletion(false);
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
    // Reset pending deletion flag when starting edit
    setIsProfilePictureMarkedForDeletion(false);
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
    const { firstName, lastName, contact, studentId } = userInfo;

    // Check if any field is empty
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !contact.trim() ||
      !studentId.trim()
    ) {
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
      studentId !== initialUserInfo.studentId ||
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
          // Profile picture was marked for deletion (Option 1 behavior)
          if (oldProfilePicture && oldProfilePicture !== "") {
            if (isCloudinaryImage(oldProfilePicture)) {
              try {
                await imageService.deleteProfilePicture(
                  oldProfilePicture,
                  userData.uid
                );
                showToast(
                  "success",
                  "Profile Picture Removed",
                  "Your profile picture has been successfully removed."
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
          // Clear the pending deletion flag
          setIsProfilePictureMarkedForDeletion(false);
        }

        // Use the new profile update service to update everything
        await profileUpdateService.updateAllUserData(userData.uid, {
          firstName,
          lastName,
          contactNum: contact,
          studentId,
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

  // Delete account handlers
  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
    setDeleteConfirmation("");
    setDeletePassword("");
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmation("");
    setDeletePassword("");
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmation !== "DELETE") {
      showToast(
        "error",
        "Invalid Confirmation",
        "Please type 'DELETE' exactly to confirm account deletion."
      );
      return;
    }

    if (!deletePassword) {
      showToast(
        "error",
        "Password Required",
        "Please enter your password to confirm account deletion."
      );
      return;
    }

    if (!user) {
      showToast(
        "error",
        "Authentication Error",
        "You must be logged in to delete your account."
      );
      return;
    }

    try {
      setIsDeleting(true);

      // Show initial toast
      showToast(
        "info",
        "Deleting Account",
        "Please wait while we delete your account and all associated data..."
      );

      // Call the deletion service with password for re-authentication
      await userDeletionService.deleteUserAccount(user, deletePassword);

      // Show success message
      showToast(
        "success",
        "Account Deleted",
        "Your account and all data have been permanently deleted."
      );

      // Close modal first
      handleCloseDeleteModal();

      // Reset loading state
      setIsDeleting(false);

      // Force logout and redirect to login
      try {
        await logout();
      } catch (logoutError) {
        // If logout fails (user account already deleted), force redirect
        console.log("Logout failed, forcing redirect to login:", logoutError);
      }

      // Force redirect to login page after a short delay
      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    } catch (error: any) {
      console.error("Error deleting account:", error);

      // Handle specific error cases
      if (error.message.includes("re-enter your password")) {
        showToast("error", "Re-authentication Required", error.message);
      } else if (
        error.message.includes("invalid-credential") ||
        error.message.includes("wrong-password")
      ) {
        showToast(
          "error",
          "Invalid Password",
          "The password you entered is incorrect. Please try again."
        );
      } else {
        showToast(
          "error",
          "Deletion Failed",
          error.message || "Failed to delete account. Please try again."
        );
      }
    } finally {
      setIsDeleting(false);
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
      <div className="lg:pt-1 pb-20">
        <MobileNavInfo
          title="My Profile"
          description="Your info all in one place"
        />

        {/* profile icon */}
        <div className="relative bg-gray-200 h-45 mx-4 mt-4 rounded lg:h-50 lg:mx-6">
          <div className="absolute flex gap-8 -bottom-13 z-10 left-4 sm:-bottom-16 md:-bottom-22 lg:-bottom-30">
            <div className="relative">
              <ProfilePicture
                src={profilePicturePreviewUrl || userInfo.profilePicture}
                alt="Profile picture"
                className="size-25 sm:w-32 sm:h-32 lg:w-40 lg:h-40 lg:left-6"
                priority
                key={userInfo.profilePicture || "default"}
              />
              {isEdit && (
                <div className="absolute -bottom-2 -right-2 flex gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUpdating}
                    className="bg-navyblue text-white rounded-full p-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
                    <div className="relative">
                      <button
                        onClick={handleRemoveProfilePicture}
                        disabled={isUpdating}
                        className={`text-white rounded-full p-2 disabled:cursor-not-allowed ${
                          isProfilePictureMarkedForDeletion
                            ? "bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400"
                            : "bg-red-500 hover:bg-red-600 disabled:bg-red-400"
                        }`}
                        title={
                          isProfilePictureMarkedForDeletion
                            ? "Profile picture marked for removal"
                            : "Remove profile picture"
                        }
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
                      {isProfilePictureMarkedForDeletion && (
                        <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          !
                        </div>
                      )}
                    </div>
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
              <h1 className="text-2xl font-semibold md:text-xl lg:text-2xl">
                {userInfo.firstName} <span></span> {userInfo.lastName}
              </h1>
              <p className="text-gray-600">Student ID: {userInfo.studentId}</p>
            </div>
          </div>
        </div>

        {/* button group */}
        <div className="mx-4 text-right lg:mx-6 mt-5">
          {!isEdit ? (
            <button
              onClick={handleEdit}
              className="bg-navyblue border border-navyblue mr-4 px-4 text-xs sm:text-sm md:text-base py-2 text-white rounded-sm lg:mr-6 cursor-pointer hover:bg-blue-900 hover:border-blue-900"
            >
              Edit Profile
            </button>
          ) : (
            <div className="">
              <button
                onClick={handleCancel}
                className="border border-navyblue px-3 mr-3 text-xs sm:text-sm md:text-base py-2 text-gray-800 rounded-sm"
              >
                Cancel edit
              </button>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className={`border border-navyblue mr-4 px-5 text-xs sm:text-sm md:text-base py-2 text-white rounded-sm lg:mr-6 ${
                  isUpdating
                    ? "bg-blue-800 border-blue-800 cursor-not-allowed"
                    : "bg-navyblue border-navyblue border hover:bg-blue-900 hover:border-blue-900"
                }`}
              >
                {isUpdating ? "Updating..." : "Save edit"}
              </button>
            </div>
          )}
        </div>

        <div className="mx-9 mt-8 space-y-2 lg:mx-6 md:hidden">
          <h1 className="text-xl font-semibold">
            {userInfo.firstName} {userInfo.lastName}
          </h1>
          <p className="text-sm text-gray-600">
            Student ID: {userInfo.studentId}
          </p>
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

              {/* Student ID */}
              <div className="bg-gray-100 border border-gray-700 flex items-center justify-between  rounded px-4 py-2.5">
                <h1 className="text-sm text-gray-600">Student ID</h1>
                {isEdit ? (
                  <input
                    type="text"
                    value={userInfo.studentId}
                    onChange={(e) => handleChange("studentId", e.target.value)}
                    className="w-60 max-w-sm bg-white border border-gray-300 rounded px-3 py-1.5 text-sm"
                    placeholder="10 digits"
                  />
                ) : (
                  <span className="text-gray-800 text-sm">
                    {userInfo.studentId}
                  </span>
                )}
              </div>

              {/* Logout Button */}
              {!isEdit && (
                <div className="">
                  <button
                    onClick={logout}
                    className="w-full bg-red-100 text-red-600 hidden lg:flex border-red-600 border font-medium px-4 py-2.5 rounded-sm transition-colors duration-200 items-center justify-center gap-2 mb-3"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
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
              <div className="bg-gray-100 border border-gray-700 flex items-center justify-between rounded px-4 py-2.5">
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

              {/* Delete Account Button */}
              {!isEdit && (
                <div className="">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium px-4 py-2.5 rounded-md transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
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
                    {isDeleting ? "Deleting Account..." : "Delete Account"}
                  </button>
                </div>
              )}

              {/* Logout Button */}
              {!isEdit && (
                <div className="">
                  <button
                    onClick={logout}
                    className="w-full bg-red-100 text-red-600 lg:hidden border-red-600 border font-medium px-4 py-2.5 rounded-sm transition-colors duration-200 flex items-center justify-center gap-2 mb-3"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Account Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-md max-w-md w-full p-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="size-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg
                    className="size-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  Delete Account
                </h3>
              </div>

              <div className="mb-6">
                <p className="text-black mb-4">
                  This action cannot be undone. This will permanently delete
                  your account and remove all data from our servers, including:
                </p>
                <ul className="text-sm text-zinc-600 space-y-1 mb-4">
                  <li>• Your profile and personal information</li>
                  <li>• All your posts and images</li>
                  <li>• All conversations and messages</li>
                  <li>• All notifications and settings</li>
                </ul>
                <p className="text-red-600 font-medium">
                  Type{" "}
                  <span className="font-mono bg-red-50 px-1 rounded">
                    DELETE
                  </span>{" "}
                  to confirm:
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={isDeleting}
                />

                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password to confirm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  disabled={isDeleting}
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleCloseDeleteModal}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={
                      isDeleting ||
                      deleteConfirmation !== "DELETE" ||
                      !deletePassword
                    }
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-md transition-colors duration-200 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* End of JSX */}
    </>
  );
};

export default Profile;
