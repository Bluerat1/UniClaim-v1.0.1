import ImageCarousel from "@/components/ImageCarousel";
import ProfilePicture from "@/components/ProfilePicture";
import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../types/type";
import LocationMapView from '../../components/LocationMapView';
import { useAuth } from "../../context/AuthContext";

type PostDetailsRouteProp = RouteProp<RootStackParamList, "PostDetails">;

export default function PostDetailsScreen() {
  const route = useRoute<PostDetailsRouteProp>();
  const { post } = route.params;
  const { userData } = useAuth();

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Check if current user is the creator of this post
  const isCurrentUserCreator = userData?.uid === post.creatorId || userData?.uid === post.postedById;

  const getCategoryBadgeStyle = (category: string) => {
    switch (category.toLowerCase()) {
      case "student essentials":
        return "bg-yellow-100 text-yellow-700";
      case "gadgets":
        return "bg-blue-100 text-blue-700";
      case "personal belongings":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-blue-100 text-blue-700"; // fallback
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white">
      {/* X Close Icon */}
      <View className="flex-row items-center gap-3 p-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={28} color="#333" />
        </TouchableOpacity>
        <Text className="text-xl font-manrope-bold text-gray-800">
          {post.user.firstName} {post.user.lastName}
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-4 pb-4"
      >
        {/* Image Container */}
        <View className="bg-zinc-100 w-full h-80 mb-5 rounded-sm overflow-hidden">
          <ImageCarousel images={post.images as string[]} />
        </View>

        {/* Send Message Button - Only show if user is NOT the creator */}
        {!isCurrentUserCreator && (
          <TouchableOpacity 
            className="bg-brand h-[3.5rem] mb-5 w-full items-center justify-center rounded-md"
            onPress={() => {
              // Debug: Log post data to see what's available
              console.log('PostDetails - Post data for messaging:', {
                id: post.id,
                title: post.title,
                postedById: post.postedById,
                user: post.user,
                hasPostedById: !!post.postedById,
                userKeys: Object.keys(post.user || {})
              });

              // Try to get postOwnerId from multiple sources
              let postOwnerId = post.creatorId || post.postedById;
              
              // Fallback: if postedById is missing, try to get it from the user object
              if (!postOwnerId && post.user) {
                // For now, we'll show an alert, but in the future we could implement
                // a way to get the user ID from the user object or other means
                console.warn('PostDetails - postedById missing, cannot start conversation');
              }

              // Navigate to Chat screen with post details
              if (postOwnerId) {
                (navigation as any).navigate('Chat', {
                  postTitle: post.title,
                  postId: post.id,
                  postOwnerId: postOwnerId,
                  postOwnerUserData: post.user, // Pass the post owner's user data
                  postType: post.type, // Pass post type (lost/found)
                  postStatus: post.status || 'pending', // Pass post status
                  foundAction: post.foundAction // Pass found action for found items
                });
              } else {
                // Fallback: show alert that messaging is not available
                Alert.alert(
                  'Messaging Unavailable',
                  'Unable to start conversation. Post owner information is missing. This post was created before messaging was enabled.',
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <Text className="text-white font-manrope-medium text-base">
              Send Message to {post.user.firstName}
            </Text>
          </TouchableOpacity>
        )}

        {/* Show message for post creator */}
        {isCurrentUserCreator && (
          <View className="bg-gray-100 h-[3.5rem] mb-5 w-full items-center justify-center rounded-md border border-gray-300">
            <Text className="text-gray-600 font-manrope-medium text-base">
              This is your post - you cannot message yourself
            </Text>
          </View>
        )}

        {post.type === "lost" ? (
          <View className="flex-row mb-5 bg-blue-50 rounded-md py-3 w-full items-center justify-center px-3">
            <MaterialIcons name="info-outline" size={15} color="blue" />
            <Text className="text-sm text-center w-[20rem] text-blue-700 font-inter ml-2">
              All lost items must be surrendered to the OSA Building or to the
              Campus Security
            </Text>
          </View>
        ) : (
          <View className="flex-row mb-5 bg-blue-50 rounded-md py-3 w-full items-center justify-center px-3">
            <MaterialIcons name="info-outline" size={15} color="blue" />
            <Text className="text-sm text-center w-[20rem] text-blue-700 font-inter ml-2">
              All found items can be claimed to the OSA office.
            </Text>
          </View>
        )}

        {/* item-details */}
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="info-outline" size={20} color="black" />
          <Text className="font-manrope-medium">Item Details</Text>
        </View>

        <View className="my-3">
          <Text className="mb-2 font-manrope-semibold">Item Title</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base font-manrope-medium text-black">
              {post.title}
            </Text>
          </View>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Item Status</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
              {post.type}
            </Text>
          </View>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Item Category</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
              {post.category}
            </Text>
          </View>
        </View>

        {/* Keep/Turnover Display for Found Items Only */}
        {post.type === "found" && post.foundAction && (
          <View className="mt-1 mb-3">
            <Text className="mb-2 font-manrope-semibold">Keep or Turnover</Text>
            <View
              className={`justify-center w-full p-3 h-[3.5rem] border rounded-md ${
                post.foundAction === "keep"
                  ? "bg-zinc-100 border-zinc-200"
                  : "bg-zinc-100 border-zinc-200"
              }`}
            >
              <Text
                className={`text-base capitalize font-manrope-medium ${
                  post.foundAction === "keep" ? "text-black" : "text-black"
                }`}
              >
                {post.foundAction === "keep" ? "Keep" : 
                 post.foundAction === "turnover to OSA" ? "OSA" : 
                 "Campus Security"}
              </Text>
            </View>
          </View>
        )}

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Description</Text>

          <View className="bg-zinc-100 w-full h-[10rem] border border-zinc-200 rounded-md">
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 13 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text className="text-base font-manrope-medium text-black leading-relaxed">
                {post.description}
              </Text>
            </ScrollView>
          </View>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Date and Time</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
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
                
                // Show both date and time in a user-friendly format
                return dateToShow.toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              })()}
            </Text>
          </View>
        </View>

        {/* location-section */}
        <View className="flex-row items-center gap-2 mt-5 mb-3">
          <Ionicons name="location-outline" size={20} color="black" />
          <Text className="font-manrope-medium">Location</Text>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Last Seen Location</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
              {post.location}
            </Text>
          </View>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Location Map</Text>
          {post.coordinates ? (
            <LocationMapView 
              coordinates={post.coordinates} 
              location={post.location} 
            />
          ) : (
            <View className="bg-zinc-100 w-full p-3 h-[20rem] border border-zinc-200 rounded-md justify-center items-center">
              <Ionicons name="location-outline" size={48} color="#9CA3AF" />
              <Text className="text-base font-manrope-medium text-gray-600 mt-2 text-center">
                No coordinates available
              </Text>
              <Text className="text-xs font-manrope-medium text-gray-500 mt-1 text-center">
                Location: {post.location}
              </Text>
            </View>
          )}
        </View>

        {/* contact-details */}
        <View className="flex-row items-center gap-2 mt-5 mb-3">
          <MaterialCommunityIcons
            name="account-details"
            size={20}
            color="black"
          />
          <Text className="font-manrope-medium">Contact Details</Text>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Name</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
              {post.user.firstName} {post.user.lastName}
            </Text>
          </View>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Contact Number</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
              {post.user.contactNum || 'Not provided'}
            </Text>
          </View>
        </View>

        <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Email</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
              {post.user.email}
            </Text>
          </View>
        </View>

        {/* Show turnover information if this post was turned over */}
        {post.turnoverDetails && (
          <View className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="text-blue-600 text-lg">🔄</Text>
              <Text className="text-sm font-semibold text-blue-800">Turnover Information</Text>
            </View>
            <View className="space-y-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-blue-700 font-medium">Originally found by:</Text>
                <ProfilePicture
                  src={post.turnoverDetails.originalFinder.profilePicture}
                  size="sm"
                />
                <Text className="text-sm text-blue-700">
                  {post.turnoverDetails.originalFinder.firstName} {post.turnoverDetails.originalFinder.lastName}
                </Text>
              </View>
              <View>
                <Text className="text-sm text-blue-700">
                  <Text className="font-medium">Student ID:</Text> {post.turnoverDetails.originalFinder.studentId || 'N/A'}
                </Text>
              </View>
              <View>
                <Text className="text-sm text-blue-700">
                  <Text className="font-medium">Email:</Text> {post.turnoverDetails.originalFinder.email}
                </Text>
              </View>
              {post.turnoverDetails.originalFinder.contactNum && (
                <View>
                  <Text className="text-sm text-blue-700">
                    <Text className="font-medium">Contact:</Text> {post.turnoverDetails.originalFinder.contactNum}
                  </Text>
                </View>
              )}
              <View>
                <Text className="text-sm text-blue-700">
                  <Text className="font-medium">Turned over to:</Text>{" "}
                  {post.turnoverDetails.turnoverAction === "turnover to OSA" ? "OSA" : "Campus Security"}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
