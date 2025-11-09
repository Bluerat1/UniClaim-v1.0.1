/**
 * Gets the profile picture URL from user data, checking multiple possible field names
 * in order of preference.
 */
export const getProfilePictureUrl = (
  data: Record<string, any> | null | undefined
): string | null => {
  if (!data) return null;

  const pictureFields = [
    "profilePicture",
    "photoURL",
    "avatar",
    "profilePic",
    "profile_picture",
    "profilePicUrl",
    "profileImageUrl",
    "profile_pic",
    "profile_pic_url",
    "image",
    "picture",
    "photo",
  ];

  for (const field of pictureFields) {
    const value = data?.[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
};

// Interface for user profile data that might contain a profile picture
export interface UserProfileData {
  profilePicture?: string;
  photoURL?: string;
  avatar?: string;
  profilePic?: string;
  profile_picture?: string;
  profilePicUrl?: string;
  profileImageUrl?: string;
  profile_pic?: string;
  profile_pic_url?: string;
  image?: string;
  picture?: string;
  photo?: string;
  [key: string]: any;
}
