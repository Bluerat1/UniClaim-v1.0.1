import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState, useCallback } from 'react';
import { TouchableOpacity, View, Text, Image as RNImage, ActivityIndicator } from 'react-native';
import type { Post, RootStackParamList } from "../types/type";
import { useAdminStatus } from "../hooks/useAdminStatus";
import { useUserData } from "../hooks/useUserData";
import PostCardMenu from "./PostCardMenu";
import ProfilePicture from "./ProfilePicture";

type Props = {
  post: Post;
  descriptionSearch?: string;
  adminStatuses?: Map<string, boolean>;
};

export default function PostCard({
  post,
  descriptionSearch = "",
  adminStatuses,
}: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Image optimization state
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Get user data using the new hook
  const { firstName, lastName, profilePicture, loading: userLoading } = useUserData(post.creatorId);
  
  // Fallback to individual admin status fetch if not provided
  const fallbackAdminStatuses = useAdminStatus(adminStatuses ? [] : [post]);
  const effectiveAdminStatuses = adminStatuses || fallbackAdminStatuses;
  
  // Prepare user data for the post using the user object from the post
  const userData = {
    firstName,
    lastName,
    profilePicture,
    email: post.user?.email || '',
    id: post.creatorId,
    role: post.user?.role || 'user' // Add role with default value
  };

  const getCategoryBadgeStyle = (category: string) => {
    switch (category.toLowerCase()) {
      case "student essentials":
        return "bg-yellow-100 text-yellow-700";
      case "gadgets":
        return "bg-blue-100 text-blue-700";
      case "personal belongings":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const handleImageLoadStart = useCallback(() => {
    setImageLoading(true);
    setImageError(false);
  }, []);

  const handleImageLoadEnd = useCallback(() => {
    setImageLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
  }, []);

  const getOptimizedImageSource = (imageSource: string | number | File) => {
    if (typeof imageSource === "string") {
      // For remote images, add query parameters for optimization
      const separator = imageSource.includes('?') ? '&' : '?';
      return {
        uri: `${imageSource}${separator}w=400&h=300&q=80&f=webp`,
        cache: 'force-cache' as const,
      };
    }
    if (imageSource instanceof File) {
      // For File objects, we can't use them directly in React Native Image
      // Return a placeholder or handle differently
      return null;
    }
    return imageSource;
  };

  const renderImage = () => {
    if (!post.images || post.images.length === 0) {
      return (
        <View className="w-full h-72 bg-gray-200 rounded-t-md items-center justify-center">
          <Ionicons name="image-outline" size={48} color="#9CA3AF" />
          <Text className="text-gray-500 mt-2">No image available</Text>
        </View>
      );
    }

    const firstImage = post.images[0];
    const imageSource = getOptimizedImageSource(firstImage);

    // If image source is not valid (e.g., File object), show placeholder
    if (!imageSource) {
      return (
        <View className="w-full h-72 bg-gray-200 rounded-t-md items-center justify-center">
          <Ionicons name="image-outline" size={48} color="#9CA3AF" />
          <Text className="text-gray-500 mt-2">Image unavailable</Text>
        </View>
      );
    }

    return (
      <View className="relative">
        <View className="relative">
          <RNImage
            source={imageSource}
            className="w-full h-72 rounded-t-md"
            resizeMode="cover"
            onLoadStart={handleImageLoadStart}
            onLoadEnd={handleImageLoadEnd}
            onError={handleImageError}
            key={`${post.id}-${firstImage}`} // Force re-render when post changes
          />
        </View>

        {/* Loading indicator */}
        {imageLoading && (
          <View className="absolute inset-0 bg-gray-100 rounded-t-md items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        )}

        {/* Error state */}
        {imageError && (
          <View className="absolute inset-0 bg-gray-100 rounded-t-md items-center justify-center">
            <Ionicons name="image-outline" size={48} color="#9CA3AF" />
            <Text className="text-gray-500 mt-2">Failed to load image</Text>
          </View>
        )}
      </View>
    );
  };

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return <Text>{text}</Text>;
    
    // Create a regex pattern that matches any of the search terms
    const searchTerms = search.trim().split(/\s+/);
    const pattern = searchTerms.length > 1 
      ? `(${searchTerms.map(term => `(${term})`).join('|')})` 
      : `(${search})`;
      
    const regex = new RegExp(pattern, 'gi');
    const parts = text.split(regex);
    
    return (
      <Text>
        {parts.map((part, i) => {
          if (!part) return null;
          const isMatch = searchTerms.some(term => 
            term && part.toLowerCase().includes(term.toLowerCase())
          );
          return (
            <Text
              key={i}
              className={isMatch ? "bg-teal-300 text-black" : "text-gray-800"}
            >
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      className="border border-zinc-200 rounded-md mb-4"
      activeOpacity={0.1}
      onPress={() => {
        if (navigation) {
          navigation.navigate("PostDetails", {
            post: {
              ...post,
              images: post.images.map((img) =>
                typeof img === "number"
                  ? RNImage.resolveAssetSource(img).uri
                  : img
              ),
            },
          });
        } else {
          console.log('Navigation not available - cannot navigate to PostDetails');
          // TODO: Show a message to the user that navigation is not available
        }
      }}
    >
      <View>
        <View className="relative">
          {renderImage()}

          {/* Resolved Status Badge */}
          {post.status === "resolved" && (
            <View className="absolute top-3 left-3 bg-green-500 px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-inter-medium">
                {post.claimDetails
                  ? "Claimed"
                  : post.handoverDetails
                    ? "Handed Over"
                    : "Resolved"}
              </Text>
            </View>
          )}

          {/* Triple dot menu positioned at top right of image */}
          <View className="absolute top-3 right-3">
            <PostCardMenu
              postId={post.id}
              postTitle={post.title}
              postOwnerId={post.creatorId || post.postedById || ""}
              postOwnerUserData={userData}
              postType={post.type}
              postStatus={post.status}
              foundAction={post.foundAction}
              isFlagged={post.isFlagged}
              flaggedBy={post.flaggedBy}
              onFlagSuccess={() => {
                // Silent flagging - no visual feedback needed
              }}
            />
          </View>
        </View>

        <View className="p-3">
          <View className="flex-col">
            {/* Post Title */}
            <Text className="text-lg font-inter-bold text-gray-900 mb-2">
              {post.title}
            </Text>

            <View className="flex-row gap-2">
              {/* Category Badge */}
              <Text
                className={`self-start px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium ${getCategoryBadgeStyle(
                  post.category
                )}`}
              >
                {post.category}
              </Text>

              {/* Type Badge */}
              <Text
                className={`self-start px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium ${
                  post.type === "lost"
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {post.type === "lost" ? "Lost" : "Found"}
              </Text>
            </View>

            <View className="flex-row gap-2">
              {/* Expiry Countdown Badge */}
              {post.expiryDate && (
                <>
                  {(() => {
                    try {
                      const now = new Date();
                      let expiry: Date;

                      // Handle Firebase Timestamp
                      if (
                        post.expiryDate &&
                        typeof post.expiryDate === "object" &&
                        "seconds" in post.expiryDate
                      ) {
                        // Firebase Timestamp
                        expiry = new Date(post.expiryDate.seconds * 1000);
                      } else if (post.expiryDate instanceof Date) {
                        // Regular Date object
                        expiry = post.expiryDate;
                      } else if (post.expiryDate) {
                        // String or other format
                        expiry = new Date(post.expiryDate);
                      } else {
                        return null;
                      }

                      // Check if date is valid
                      if (isNaN(expiry.getTime())) {
                        return null;
                      }

                      const daysLeft = Math.ceil(
                        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );

                      if (daysLeft <= 0) {
                        return (
                          <Text className="self-start captialize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-red-100 text-red-700">
                            ⚠️ EXPIRED
                          </Text>
                        );
                      } else if (daysLeft <= 3) {
                        return (
                          <Text className="self-start captialize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-red-100 text-red-700">
                            ⚠️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </Text>
                        );
                      } else if (daysLeft <= 7) {
                        return (
                          <Text className="self-start captialize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-orange-100 text-orange-700">
                            ⚠️ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </Text>
                        );
                      } else {
                        return (
                          <Text className="self-start captialize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-green-100 text-green-700">
                            {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </Text>
                        );
                      }
                    } catch (error) {
                      console.error("Error calculating days left:", error);
                      return null;
                    }
                  })()}
                </>
              )}

              {post.type === "found" && post.foundAction && (
                <Text
                  className={`self-start px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium ${
                    post.foundAction === "keep"
                      ? "bg-amber-200 text-amber-700"
                      : "bg-fuchsia-200 text-fuchsia-700"
                  }`}
                >
                  {post.foundAction === "keep"
                    ? "Keep"
                    : post.foundAction === "turnover to OSA"
                      ? "OSA"
                      : "Campus Security"}
                </Text>
              )}
            </View>
          </View>

          {/* User Information and Admin Badge */}
          <View className="flex-row items-center gap-2 mt-2">
            <ProfilePicture
              src={profilePicture}
              size="xs"
              style={{ borderRadius: 10 }}
            />
            <Text className="text-sm text-gray-600">
              {!userLoading && (firstName || lastName)
                ? `Posted by ${firstName} ${lastName}`
                : 'Loading...'}
            </Text>
            {(post.user?.role === "admin" ||
              (post.user?.email && effectiveAdminStatuses.get(post.user.email))) && (
              <Text className="ml-1 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-manrope-bold">
                ADMIN
              </Text>
            )}
          </View>

          <View className="flex-row flex-wrap items-center gap-2 mt-2">
            <View className="flex-row items-center gap-1 flex-shrink">
              <Ionicons name="location-outline" size={16} color="#4B5563" />
              <Text
                className="text-zinc-700 font-inter ml-1 flex-shrink"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                Last seen at {post.location}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text className="text-sm font-inter text-zinc-700">
                {(() => {
                  // Priority: dateTime (when item was lost/found) > createdAt (when post was created)
                  let dateToShow: Date | null = null;

                  if (post.dateTime) {
                    dateToShow = new Date(post.dateTime);
                  } else if (post.createdAt) {
                    dateToShow = new Date(post.createdAt);
                  }

                  if (!dateToShow || isNaN(dateToShow.getTime())) {
                    return "Date not available";
                  }

                  const now = new Date();
                  const diffInMs = now.getTime() - dateToShow.getTime();
                  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
                  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

                  // Always show relative time for consistency
                  if (diffInMinutes < 1) {
                    return "just now";
                  } else if (diffInMinutes < 60) {
                    return `${diffInMinutes} min${diffInMinutes > 1 ? "s" : ""} ago`;
                  } else if (diffInHours < 24) {
                    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
                  } else if (diffInDays < 30) {
                    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
                  } else {
                    const months = Math.floor(diffInDays / 30);
                    return `${months} month${months > 1 ? "s" : ""} ago`;
                  }
                })()}
              </Text>
            </View>
          </View>

          <Text
            numberOfLines={2}
            className="text-sm text-gray-700 mt-3 font-inter"
          >
            {highlightText(post.description, descriptionSearch)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
