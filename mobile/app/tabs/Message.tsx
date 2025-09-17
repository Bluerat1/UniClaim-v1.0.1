import React, { useState, useMemo } from "react";
import {
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import PageLayout from "@/layout/PageLayout";
import { useMessage } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "@/components/ProfilePicture";
import type { Conversation } from "@/types/type";
import type { RootStackParamList } from "@/types/type";

type MessageNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Message"
>;

const ConversationItem = ({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) => {
  const { userData } = useAuth();

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const diffInHours = diffInMinutes / 60;

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m`;
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  // Get the other participant's name (exclude current user)
  const getOtherParticipantName = () => {
    if (!userData) return "Unknown User";

    // Try new structure first (participants with user data)
    const otherParticipants = Object.entries(conversation.participants || {})
      .filter(([uid]) => uid !== userData.uid) // Exclude current user
      .map(([, participant]) =>
        `${participant.firstName} ${participant.lastName}`.trim()
      )
      .filter((name) => name.length > 0);

    if (otherParticipants.length > 0) {
      return otherParticipants.join(", ");
    }

    // Fallback to old structure (participantData)
    if (conversation.participantData) {
      const otherParticipantData = Object.entries(
        conversation.participantData || {}
      )
        .filter(([uid]) => uid !== userData.uid)
        .map(([, participant]) =>
          `${participant.firstName} ${participant.lastName}`.trim()
        )
        .filter((name) => name.length > 0);

      if (otherParticipantData.length > 0) {
        return otherParticipantData.join(", ");
      }
    }

    return "Unknown User";
  };

  // Get the other participant's profile picture (exclude current user)
  const getOtherParticipantProfilePicture = () => {
    if (!userData) return null;

    // Try new structure first (participants with user data)
    const otherParticipant = Object.entries(
      conversation.participants || {}
    ).find(([uid]) => uid !== userData.uid);

    if (otherParticipant && otherParticipant[1].profilePicture) {
      return otherParticipant[1].profilePicture;
    }

    // Fallback to old structure (participantData)
    if (conversation.participantData) {
      const otherParticipantData = Object.entries(
        conversation.participantData || {}
      ).find(([uid]) => uid !== userData.uid);

      if (otherParticipantData) {
        return (
          otherParticipantData[1].profilePicture ||
          otherParticipantData[1].profileImageUrl
        );
      }
    }

    return null;
  };

  // Get the name of the user who sent the last message
  const getLastMessageSenderName = () => {
    if (!conversation.lastMessage?.senderId || !userData) return "Unknown User";

    // If the sender is the current user
    if (conversation.lastMessage.senderId === userData.uid) {
      return "You";
    }

    // Find the sender in participants (new structure)
    const sender = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid === conversation.lastMessage.senderId
    );

    if (sender) {
      const firstName = sender[1].firstName || "";
      const lastName = sender[1].lastName || "";
      return `${firstName} ${lastName}`.trim() || "Unknown User";
    }

    // Fallback to old structure (participantData)
    if (conversation.participantData) {
      const senderData = Object.entries(
        conversation.participantData || {}
      ).find(([uid]) => uid === conversation.lastMessage.senderId);

      if (senderData) {
        const firstName = senderData[1].firstName || "";
        const lastName = senderData[1].lastName || "";
        return `${firstName} ${lastName}`.trim() || "Unknown User";
      }
    }

    return "Unknown User";
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white p-4 border-b border-gray-200"
    >
      <View className="flex-row items-start">
        {/* Profile Picture */}
        <View className="mr-3">
          <ProfilePicture src={getOtherParticipantProfilePicture()} size="md" />
        </View>

        {/* Conversation Details */}
        <View className="flex-1">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className="font-manrope-semibold text-gray-800 text-base"
                  numberOfLines={1}
                >
                  {conversation.postTitle}
                </Text>
                {/* Post Type Badge */}
                <View
                  className={`px-2 py-1 rounded-full ${conversation.postType === "found" ? "bg-green-100" : "bg-orange-100"}`}
                >
                  <Text
                    className={`text-xs font-medium ${conversation.postType === "found" ? "text-green-800" : "text-orange-800"}`}
                  >
                    {conversation.postType === "found" ? "FOUND" : "LOST"}
                  </Text>
                </View>
              </View>
              <Text
                className="text-gray-500 font-manrope-medium text-xs mt-1"
                numberOfLines={1}
              >
                {getOtherParticipantName()}
              </Text>
              <Text
                className={`text-sm mt-2 font-inter ${conversation.unreadCounts?.[userData?.uid || ""] > 0 ? "font-bold text-gray-800" : "text-gray-600"}`}
                numberOfLines={2}
              >
                {conversation.lastMessage ? (
                  <>
                    <Text className="font-medium">
                      {getLastMessageSenderName()}
                    </Text>
                    <Text>: {conversation.lastMessage.text}</Text>
                  </>
                ) : (
                  "No messages yet"
                )}
              </Text>
            </View>
            <View className="ml-2">
              <Text className="text-gray-500 text-xs font-manrope">
                {formatTime(conversation.lastMessage?.timestamp)}
              </Text>
              {/* Get the current user's unread count from this conversation */}
              {conversation.unreadCounts?.[userData?.uid || ""] > 0 && (
                <View className="bg-blue-500 rounded-full px-2 py-1 mt-1 self-end min-w-[20px] items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {conversation.unreadCounts[userData?.uid || ""] > 99
                      ? "99+"
                      : conversation.unreadCounts[userData?.uid || ""]}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function Message() {
  const navigation = useNavigation<MessageNavigationProp>();
  const { conversations, loading, refreshConversations } = useMessage();
  const [refreshing, setRefreshing] = useState(false);

  const handleConversationPress = (conversation: Conversation) => {
    console.log("🔍 DEBUG: Navigating to Chat with conversation data:", {
      conversationId: conversation.id,
      postTitle: conversation.postTitle,
      postOwnerId: conversation.postCreatorId,
      postId: conversation.postId,
      postType: conversation.postType,
      postStatus: conversation.postStatus,
      foundAction: conversation.foundAction,
      fullConversation: conversation,
    });

    navigation.navigate("Chat", {
      conversationId: conversation.id,
      postTitle: conversation.postTitle,
      postOwnerId: conversation.postCreatorId,
      postId: conversation.postId,
      postOwnerUserData:
        conversation.participants?.[conversation.postCreatorId] || {},
      postType: conversation.postType,
      postStatus: conversation.postStatus,
      foundAction: conversation.foundAction,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshConversations();
    } catch (error) {
      console.error("Failed to refresh conversations:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Sort conversations by most recent message timestamp (newest first)
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // Get timestamps from last messages
      const aTime = a.lastMessage?.timestamp;
      const bTime = b.lastMessage?.timestamp;

      // Handle conversations without messages
      if (!aTime && !bTime) return 0; // Both have no messages, maintain current order
      if (!aTime) return 1; // Conversation without messages goes to bottom
      if (!bTime) return -1; // Conversation without messages goes to bottom

      // Convert timestamps to comparable values
      const aTimestamp =
        aTime instanceof Date
          ? aTime.getTime()
          : aTime.toDate?.()?.getTime() || 0;
      const bTimestamp =
        bTime instanceof Date
          ? bTime.getTime()
          : bTime.toDate?.()?.getTime() || 0;

      // Sort newest first (descending order)
      return bTimestamp - aTimestamp;
    });
  }, [conversations]);

  if (loading) {
    return (
      <PageLayout>
        <SafeAreaView className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading conversations...</Text>
        </SafeAreaView>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SafeAreaView className="flex-1 bg-gray-50">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500">Loading conversations...</Text>
          </View>
        ) : sortedConversations.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500 text-center">
              No conversations yet.{"\n"}Start a conversation by contacting
              someone about their post!
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedConversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversationItem
                conversation={item}
                onPress={() => handleConversationPress(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}
      </SafeAreaView>
    </PageLayout>
  );
}
