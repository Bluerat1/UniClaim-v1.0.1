import ImageCarousel from "../../components/ImageCarousel";
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
import LocationMapView from "../../components/LocationMapView";
import { useAuth } from "../../context/AuthContext";
import { useMessage } from "../../context/MessageContext";
import ProfilePicture from "../../components/ProfilePicture";

type PostDetailsRouteProp = RouteProp<RootStackParamList, "PostDetails">;

export default function PostDetailsScreen() {
  const route = useRoute<PostDetailsRouteProp>();
  const { post } = route.params;
  const { userData } = useAuth();
  const { createConversation, conversations } = useMessage();
  
  // Generate a friendly greeting based on post type
  const generateGreeting = (title: string, postType?: string) => {
    const greetings: Record<string, string> = {
      lost: `Hi! I found your ${title} and I think it matches the one you lost.`,
      found: `Hello! I believe I might be the owner of the ${title} you found.`,
    };
    return greetings[postType || ''] || `Hi! I'm reaching out about your ${postType || 'item'}: ${title}`;
  };

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isSendingMessage, setIsSendingMessage] = React.useState(false);

  // Handle send message button click
  const handleSendMessage = async () => {
    if (!userData) {
      Alert.alert("Login Required", "Please log in to send messages");
      return;
    }

    // Try to get postOwnerId from multiple sources
    const postOwnerId = post.creatorId || post.postedById;
    
    if (!postOwnerId) {
      Alert.alert(
        "Messaging Unavailable",
        "Unable to start conversation. Post owner information is missing."
      );
      return;
    }

    if (postOwnerId === userData.uid) {
      Alert.alert(
        "Cannot Send Message",
        "You cannot send a message to yourself"
      );
      return;
    }

    try {
      setIsSendingMessage(true);
      
      // Check if a conversation already exists for this post and users
      const existingConversation = conversations.find(conv => 
        conv.postId === post.id && 
        conv.participants && 
        conv.participants[postOwnerId] && 
        conv.participants[userData.uid]
      );
      
      let conversationId: string;
      
      if (existingConversation) {
        // Use existing conversation
        conversationId = existingConversation.id;
      } else {
        // Create new conversation with initial greeting in a single batch
        const greeting = generateGreeting(post.title, post.type);
        conversationId = await createConversation(
          post.id,
          post.title,
          postOwnerId,
          userData.uid,
          userData,
          post.user, // Pass the post owner's user data
          post.type as "lost" | "found",
          (post.status || "pending") as "pending" | "resolved" | "unclaimed",
          (post.foundAction as
            | "keep"
            | "turnover to OSA"
            | "turnover to Campus Security"
            | null) || null,
          greeting
        );
      }

      // Navigate to chat
      navigation.navigate("Chat", {
        conversationId,
        postTitle: post.title,
        postId: post.id,
        postOwnerId,
        postOwnerUserData: post.user,
        postType: post.type,
        postStatus: post.status || "pending",
        foundAction: post.foundAction,
        postCreatorId: post.creatorId || post.postedById,
      });
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to start conversation"
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Check if current user is the creator of this post
  const isCurrentUserCreator =
    userData?.uid === post.creatorId || userData?.uid === post.postedById;

  // Helper function to format dates consistently
  const formatDateTime = (
    datetime: string | Date | { seconds: number; nanoseconds: number } | any
  ) => {
    let date: Date;

    if (datetime && typeof datetime === "object" && "seconds" in datetime) {
      // Handle Firestore Timestamp objects
      date = new Date(datetime.seconds * 1000 + datetime.nanoseconds / 1000000);
    } else if (typeof datetime === "string") {
      date = new Date(datetime);
    } else {
      date = datetime as Date;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }

    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Handle send message to original finder button click
  const handleSendMessageToOriginalFinder = async () => {
    if (!userData) {
      Alert.alert("Login Required", "Please log in to send messages.", [
        { text: "OK" },
      ]);
      return;
    }

    if (!post.turnoverDetails?.originalFinder) {
      Alert.alert(
        "Information Unavailable",
        "Original finder information is not available.",
        [{ text: "OK" }]
      );
      return;
    }

    if (userData.uid === post.turnoverDetails.originalFinder.uid) {
      Alert.alert(
        "Cannot Message Yourself",
        "You cannot send a message to yourself. This is your own post.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      const originalFinder = post.turnoverDetails.originalFinder;
      const originalFinderId = originalFinder.uid;

      if (!originalFinderId) {
        throw new Error("Cannot identify original finder");
      }

      // Check if a conversation already exists for this post and users
      const existingConversation = conversations.find(conv => 
        conv.postId === post.id && 
        conv.participants && 
        conv.participants[originalFinderId] && 
        conv.participants[userData.uid]
      );
      
      let conversationId: string;
      
      if (existingConversation) {
        // Use existing conversation
        conversationId = existingConversation.id;
      } else {
        // Create new conversation with initial greeting in a single batch
        const greeting = `Hello! I'm reaching out regarding the item you found: ${post.title}`;
        conversationId = await createConversation(
          post.id,
          post.title,
          originalFinderId, // Original finder's ID as postOwnerId
          userData.uid, // Current user's UID
          userData, // Current user's data
          originalFinder, // Original finder's data as postOwnerUserData
          post.type as "lost" | "found",
          (post.status || "pending") as "pending" | "resolved" | "unclaimed",
          (post.foundAction as
            | "keep"
            | "turnover to OSA"
            | "turnover to Campus Security"
            | null) || null,
          greeting
        );
      }

      // Navigate to Chat screen with the conversation
      (navigation as any).navigate("Chat", {
        conversationId,
        postTitle: post.title,
        postId: post.id,
        postOwnerId: originalFinderId,
        postOwnerUserData: originalFinder,
        postType: post.type,
        postStatus: post.status || "pending",
        foundAction: post.foundAction,
        postCreatorId: post.creatorId || post.postedById, // Pass the actual post creator ID
      });
    } catch (error: any) {
      console.error("Error creating conversation with original finder:", error);
      Alert.alert("Error", `Failed to start conversation: ${error.message}`, [
        { text: "OK" },
      ]);
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
            className="bg-brand h-[3.5rem] mb-5 w-full items-center justify-center rounded-md flex-row"
            onPress={handleSendMessage}
            disabled={!userData || isSendingMessage}
          >
            {isSendingMessage ? (
              <>
                <MaterialCommunityIcons
                  name="loading"
                  size={20}
                  color="white"
                  style={{ marginRight: 8 }}
                />
                <Text className="text-white font-manrope-medium text-base">
                  Starting Chat...
                </Text>
              </>
            ) : (
              <Text className="text-white font-manrope-medium text-base">
                Send Message to {post.user.firstName}
              </Text>
            )}
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
            <Text className="mb-2 font-manrope-semibold">
              Found Item Action
            </Text>
            <View className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <Text className="text-base font-manrope-medium text-blue-700">
                {post.foundAction === "keep"
                  ? "The finder will keep this item and return it themselves"
                  : post.turnoverDetails &&
                      post.turnoverDetails.originalTurnoverAction ===
                        "turnover to Campus Security" &&
                      post.turnoverDetails.turnoverAction === "turnover to OSA"
                    ? "This item was transferred to OSA"
                    : post.foundAction === "turnover to OSA"
                      ? "This item was turned over to OSA office"
                      : "This item was turned over to Campus Security"}
              </Text>
            </View>
          </View>
        )}

        {/* Item Holder Transfer Section - Show when item transferred from Campus Security to OSA */}
        {post.turnoverDetails &&
          post.turnoverDetails.turnoverAction === "turnover to OSA" &&
          post.turnoverDetails.turnoverStatus === "transferred" &&
          post.turnoverDetails.originalTurnoverAction ===
            "turnover to Campus Security" && (
            <View className="mt-3 mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-2 h-2 bg-blue-500 rounded-full"></View>
                <Text className="text-base font-manrope-bold text-blue-800">
                  🔄 Item Holder Transfer
                </Text>
              </View>
              <View className="space-y-2">
                <View className="flex-row items-center">
                  <Text className="text-sm font-manrope-semibold text-blue-800 w-20">
                    Status:
                  </Text>
                  <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                    Item has been transferred from Campus Security to OSA
                    (Admin)
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-sm font-manrope-semibold text-blue-800 w-20">
                    Transfer Date:
                  </Text>
                  <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                    {post.turnoverDetails.turnoverDecisionAt
                      ? formatDateTime(post.turnoverDetails.turnoverDecisionAt)
                      : "N/A"}
                  </Text>
                </View>
                {post.turnoverDetails.turnoverReason && (
                  <View className="flex-row items-start">
                    <Text className="text-sm font-manrope-semibold text-blue-800 w-20">
                      Reason:
                    </Text>
                    <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                      {post.turnoverDetails.turnoverReason}
                    </Text>
                  </View>
                )}
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
                  return "Date not available";
                }

                // Show both date and time in a user-friendly format
                return dateToShow.toLocaleString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
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
            <Text
              className="text-base font-manrope-medium text-black flex-shrink"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
              ellipsizeMode="tail"
            >
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
              <Text className="text-xs font-manrope-medium text-gray-500 mt-1 text-center ">
                Location: {post.location}
              </Text>
            </View>
          )}
        </View>

        {/* Turnover Information Section */}
        {post.turnoverDetails && (
          <View className="mt-4 mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="text-blue-600 text-lg">🔄</Text>
              <Text className="text-base font-manrope-bold text-blue-800">
                Turnover Information
              </Text>
            </View>
            <View className="space-y-2">
              {/* Original Finder Information */}
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-manrope-semibold text-blue-800">
                  Originally found by:
                </Text>
                <ProfilePicture
                  src={post.turnoverDetails.originalFinder.profilePicture}
                  size="xs"
                />
                <Text
                  className="text-sm font-manrope-medium text-blue-700 flex-shrink"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {post.turnoverDetails.originalFinder.firstName}{" "}
                  {post.turnoverDetails.originalFinder.lastName}
                </Text>
                {/* Message button - only show if user is not the creator and not the original finder */}
                {!isCurrentUserCreator &&
                  userData?.uid !== post.turnoverDetails.originalFinder.uid &&
                  post.status !== "resolved" && (
                    <TouchableOpacity
                      className="ml-2 px-2 py-1 bg-brand rounded-md"
                      onPress={handleSendMessageToOriginalFinder}
                    >
                      <Text className="text-white text-xs font-manrope-medium">
                        Message
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>

              {/* Status */}
              <View className="flex-row items-center">
                <Text className="text-sm font-manrope-semibold text-blue-800 w-16">
                  Status:
                </Text>
                <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                  {post.turnoverDetails.turnoverStatus === "declared"
                    ? "Declared - Awaiting Confirmation"
                    : post.turnoverDetails.turnoverStatus === "confirmed"
                      ? "Confirmed - Item Received"
                      : post.turnoverDetails.turnoverStatus === "not_received"
                        ? "Not Received - Item Deleted"
                        : post.turnoverDetails.turnoverAction ===
                            "turnover to Campus Security"
                          ? "Turned over to Campus Security"
                          : post.turnoverDetails.turnoverAction ===
                              "turnover to OSA"
                            ? "Turned over to OSA"
                            : post.turnoverDetails.turnoverStatus}
                </Text>
              </View>

              {/* Turned over to */}
              <View className="flex-row items-center">
                <Text className="text-sm font-manrope-semibold text-blue-800 w-16">
                  Turned over to:
                </Text>
                <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                  {post.turnoverDetails.turnoverAction === "turnover to OSA"
                    ? "OSA"
                    : post.turnoverDetails.originalTurnoverAction ===
                        "turnover to Campus Security"
                      ? "Campus Security"
                      : "Campus Security"}
                </Text>
              </View>

              {/* Turnover Date */}
              <View className="flex-row items-center">
                <Text className="text-sm font-manrope-semibold text-blue-800 w-16">
                  Date:
                </Text>
                <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                  {post.turnoverDetails.turnoverDecisionAt
                    ? formatDateTime(post.turnoverDetails.turnoverDecisionAt)
                    : "N/A"}
                </Text>
              </View>

              {/* Reason */}
              {post.turnoverDetails.turnoverReason && (
                <View className="flex-row items-start">
                  <Text className="text-sm font-manrope-semibold text-blue-800 w-16">
                    Reason:
                  </Text>
                  <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                    {post.turnoverDetails.turnoverReason}
                  </Text>
                </View>
              )}

              {/* Confirmation Notes */}
              {post.turnoverDetails.confirmationNotes && (
                <View className="flex-row items-start">
                  <Text className="text-sm font-manrope-semibold text-blue-800 w-16">
                    Notes:
                  </Text>
                  <Text className="text-sm font-manrope-medium text-blue-700 flex-1">
                    {post.turnoverDetails.confirmationNotes}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
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

        {/* Contact number hidden for mobile as requested */}
        {/* <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Contact Number</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base capitalize font-manrope-medium text-black">
              {post.user.contactNum || "Not provided"}
            </Text>
          </View>
        </View> */}

        {/* Email address hidden for mobile as requested */}
        {/* <View className="mt-1 mb-3">
          <Text className="mb-2 font-manrope-semibold">Email</Text>
          <View className="bg-zinc-100 justify-center w-full p-3 h-[3.5rem] border border-zinc-200 rounded-md">
            <Text className="text-base font-manrope-medium text-black">
              {post.user.email}
            </Text>
          </View>
        </View> */}

        {/* Claim and Handover information sections have been hidden as requested */}
        {/* Show claim information if this post has a resolved claim */}
        {/*
        {post.claimDetails && (
          <View className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="text-green-600 text-lg">✅</Text>
              <Text className="text-sm font-semibold text-green-800">Claim Information</Text>
            </View>
            <View className="space-y-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-green-700 font-medium">Claimed by:</Text>
                <Text className="text-sm text-green-700">
                  {post.claimDetails.claimerName}
                </Text>
              </View>
              {post.claimDetails.claimerContact && (
                <View>
                  <Text className="text-sm text-green-700">
                    <Text className="font-medium">Contact:</Text> {post.claimDetails.claimerContact}
                  </Text>
                </View>
              )}
              {post.claimDetails.claimerStudentId && (
                <View>
                  <Text className="text-sm text-green-700">
                    <Text className="font-medium">Student ID:</Text> {post.claimDetails.claimerStudentId}
                  </Text>
                </View>
              )}
              {post.claimDetails.claimerEmail && (
                <View>
                  <Text className="text-sm text-green-700">
                    <Text className="font-medium">Email:</Text> {post.claimDetails.claimerEmail}
                  </Text>
                </View>
              )}
              {post.claimDetails.claimerIdPhoto && (
                <View>
                  <Text className="text-sm text-green-700 font-medium">ID Photo Verified</Text>
                </View>
              )}
              <View>
                <Text className="text-sm text-green-700">
                  <Text className="font-medium">Claimed on:</Text>{" "}
                  {post.claimDetails.claimConfirmedAt
                    ? new Date(post.claimDetails.claimConfirmedAt.seconds * 1000).toLocaleDateString()
                    : 'Date not available'}
                </Text>
              </View>
              <View>
                <Text className="text-sm text-green-700">
                  <Text className="font-medium">Confirmed by:</Text> {post.claimDetails.ownerName}
            </View>
          </View>
        )}
        */}

        {/*
        {post.handoverDetails && (
          <View className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="text-purple-600 text-lg">🔄</Text>
              <Text className="text-sm font-semibold text-purple-800">Handover Information</Text>
            </View>
            <View className="space-y-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-purple-700 font-medium">Handed over by:</Text>
                <Text className="text-sm text-purple-700">
                  {post.handoverDetails.handoverPersonName || 'Unknown'}
                </Text>
              </View>
              {post.handoverDetails.handoverPersonContact && (
                <View>
                  <Text className="text-sm text-purple-700">
                    <Text className="font-medium">Contact:</Text> {post.handoverDetails.handoverPersonContact}
                  </Text>
                </View>
              )}
              {post.handoverDetails.handoverPersonStudentId && (
                <View>
                  <Text className="text-sm text-purple-700">
                    <Text className="font-medium">Student ID:</Text> {post.handoverDetails.handoverPersonStudentId}
                  </Text>
                </View>
              )}
              {post.handoverDetails.handoverPersonEmail && (
                <View>
                  <Text className="text-sm text-purple-700">
                    <Text className="font-medium">Email:</Text> {post.handoverDetails.handoverPersonEmail}
                  </Text>
                </View>
              )}
              {post.handoverDetails.handoverIdPhoto && (
                <View>
                  <Text className="text-sm text-purple-700 font-medium">ID Photo Verified</Text>
                </View>
              )}
              <View>
                <Text className="text-sm text-purple-700">
                  <Text className="font-medium">Handed over on:</Text>{" "}
                  {post.handoverDetails.handoverConfirmedAt
                    ? (() => {
                        const timestamp = post.handoverDetails.handoverConfirmedAt;
                        if (timestamp && timestamp.seconds) {
                          return new Date(timestamp.seconds * 1000).toLocaleDateString();
                        } else if (timestamp) {
                          return new Date(timestamp).toLocaleDateString();
                        } else {
                          return 'Date not available';
                        }
                      })()
                    : 'Date not available'}
                </Text>
              </View>
              <View>
                <Text className="text-sm text-purple-700">
                  <Text className="font-medium">Confirmed by:</Text> {post.handoverDetails.ownerName || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        )}
        */}

        {/* Conversation History - Only show for non-resolved posts */}
        {!isCurrentUserCreator && post.status !== 'resolved' && (
          <View className="mt-6">
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
