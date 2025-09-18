import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  Image,
  Image as RNImage,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Post } from "@/types/type";
import ProfilePicture from "./ProfilePicture";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import PostCardMenu from "./PostCardMenu";

type RootStackParamList = {
  PostDetails: { post: Post };
};

type Props = {
  post: Post;
  descriptionSearch?: string;
  adminStatuses?: Map<string, boolean>;
};

export default function PostCard({ post, descriptionSearch = "", adminStatuses }: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    
  // Fallback to individual admin status fetch if not provided
  const fallbackAdminStatuses = useAdminStatus(adminStatuses ? [] : [post]);
  const effectiveAdminStatuses = adminStatuses || fallbackAdminStatuses;
    
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

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return <Text>{text}</Text>;
    const parts = text.split(new RegExp(`(${search})`, "gi"));
    return (
      <Text>
        {parts.map((part, i) => (
          <Text
            key={i}
            className={
              part.toLowerCase() === search.toLowerCase()
                ? "bg-teal-300"
                : "text-gray-800"
            }
          >
            {part}
          </Text>
        ))}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      className="border border-zinc-200 rounded-md mb-4"
      activeOpacity={0.1}
      onPress={() =>
        navigation.navigate("PostDetails", {
          post: {
            ...post,
            images: post.images.map((img) =>
              typeof img === "number"
                ? RNImage.resolveAssetSource(img).uri
                : img
            ),
          },
        })
      }
    >
      <View className="relative">
        <Image
          source={
            typeof post.images[0] === "string"
              ? { uri: post.images[0] as string }
              : (post.images[0] as any)
          }
          className="w-full h-80 rounded-t-md"
          resizeMode="cover"
        />
        
        {/* Triple dot menu positioned at top right of image */}
        <View className="absolute top-3 right-3">
          <PostCardMenu
            postId={post.id}
            postTitle={post.title}
            postOwnerId={post.creatorId || post.postedById}
            postOwnerUserData={post.user}
            postType={post.type}
            postStatus={post.status}
            foundAction={post.foundAction}
            isFlagged={post.isFlagged}
            flaggedBy={post.flaggedBy}
            onFlagSuccess={() => {
              // You can add any callback logic here if needed
            }}
          />
        </View>
      </View>

      <View className="p-3">
        <View className="flex-row items-center gap-2">
          {/* Category Badge */}
          <Text
            className={`self-start px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium ${
              getCategoryBadgeStyle(post.category)
            }`}
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

          {/* Expiry Countdown Badge */}
          {post.expiryDate && (
            <>
              {(() => {
                try {
                  const now = new Date();
                  let expiry: Date;
                  
                  // Handle Firebase Timestamp
                  if (post.expiryDate && typeof post.expiryDate === 'object' && 'seconds' in post.expiryDate) {
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
                  
                  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  
                                      if (daysLeft <= 0) {
                      return (
                        <Text className="capitalize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-red-100 text-red-700">
                          ⚠️ EXPIRED
                        </Text>
                      );
                    } else if (daysLeft <= 3) {
                      return (
                        <Text className="capitalize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-red-100 text-red-700">
                          ⚠️ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </Text>
                      );
                    } else if (daysLeft <= 7) {
                      return (
                        <Text className="capitalize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-orange-100 text-orange-700">
                          ⚠️ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </Text>
                      );
                    } else {
                      return (
                        <Text className="capitalize px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium bg-green-100 text-green-700">
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </Text>
                      );
                    }
                } catch (error) {
                  console.error('Error calculating days left:', error);
                  return null;
                }
              })()}
            </>
          )}

          {post.type === "found" && post.foundAction && (
            <Text
              className={`px-3 py-1 mb-2 rounded-sm text-xs font-inter-medium ${
                post.foundAction === "keep"
                  ? "bg-amber-200 text-amber-700"
                  : "bg-fuchsia-200 text-fuchsia-700"
              }`}
            >
              {post.foundAction === "keep" ? "Keep" : 
               post.foundAction === "turnover to OSA" ? "OSA" : 
               "Campus Security"}
            </Text>
          )}
        </View>

        <Text className="text-2xl my-1.5 font-manrope-semibold text-black">
          {post.title}
        </Text>
        <View className="flex-row items-center gap-2 mb-2">
          <ProfilePicture
            src={post.user?.profilePicture}
            size="xs"
          />
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-blue-800 font-manrope-bold">
              Posted by {(() => {
                // ✅ Handle multiple data structure scenarios
                if (post.user?.firstName && post.user?.lastName) {
                  return `${post.user.firstName} ${post.user.lastName}`;
                } else if (post.postedBy) {
                  return post.postedBy;
                } else if (post.user?.email) {
                  return post.user.email.split('@')[0]; // Show username part of email
                } else {
                  return 'Unknown User';
                }
              })()}
            </Text>
            {/* Admin Badge */}
            {(post.user?.role === 'admin' || (post.user?.email && effectiveAdminStatuses.get(post.user.email))) && (
              <Text className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-manrope-bold">
                ADMIN
              </Text>
            )}
          </View>
        </View>


        <View className="flex-row flex-wrap items-center gap-2">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={16} color="#4B5563" />
            <Text className="text-sm text-zinc-700 font-inter ml-0.5">
              Last seen at
            </Text>
            <Text className="text-sm text-zinc-700 font-inter">
              {post.location}
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
                  return 'Date not available';
                }
                
                const now = new Date();
                const diffInMs = now.getTime() - dateToShow.getTime();
                const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
                const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
                const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
                
                // Always show relative time for consistency
                if (diffInMinutes < 1) {
                  return 'just now';
                } else if (diffInMinutes < 60) {
                  return `${diffInMinutes} min${diffInMinutes > 1 ? 's' : ''} ago`;
                } else if (diffInHours < 24) {
                  return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                } else if (diffInDays < 30) {
                  return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
                } else {
                  const months = Math.floor(diffInDays / 30);
                  return `${months} month${months > 1 ? 's' : ''} ago`;
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
    </TouchableOpacity>
  );
}
