import React, { useState, useMemo, useCallback } from "react";
import {
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import PageLayout from "../../layout/PageLayout";
import { useMessage } from "../../context/MessageContext";
import { useAuth } from "../../context/AuthContext";
import ProfilePicture from "../../components/ProfilePicture";
import type { Conversation , RootStackParamList } from "../../types/type";


type MessageNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Message"
>;

const ConversationItem = React.memo(({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) => {
  const { userData } = useAuth();

  const formatTime = useCallback((timestamp: any) => {
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
  }, []);

  // Memoize expensive participant computations
  const otherParticipantName = useMemo(() => {
    if (!userData) return "Unknown User";

    const otherParticipants = Object.entries(conversation.participants || {})
      .filter(([uid]) => uid !== userData.uid)
      .map(([, participant]) => {
        const p = participant as { firstName: string; lastName: string };
        return `${p.firstName} ${p.lastName}`.trim();
      })
      .filter((name) => name.length > 0);

    return otherParticipants.length > 0 ? otherParticipants.join(", ") : "Unknown User";
  }, [conversation.participants, userData]);

  const otherParticipantProfilePicture = useMemo(() => {
    if (!userData) return null;

    const otherParticipant = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid !== userData.uid
    );

    if (otherParticipant) {
      const p = otherParticipant[1] as {
        profilePicture?: string;
        profileImageUrl?: string;
      };
      return p.profilePicture || p.profileImageUrl || null;
    }

    return null;
  }, [conversation.participants, userData]);

  const lastMessageSenderName = useMemo(() => {
    if (!conversation.lastMessage?.senderId || !userData) return "Unknown User";

    if (conversation.lastMessage.senderId === userData.uid) {
      return "You";
    }

    const sender = Object.entries(conversation.participants || {}).find(
      ([uid]) => uid === conversation.lastMessage?.senderId
    );

    if (sender) {
      const p = sender[1] as { firstName: string; lastName: string };
      const firstName = p.firstName || "";
      const lastName = p.lastName || "";
      return `${firstName} ${lastName}`.trim() || "Unknown User";
    }

    return "Unknown User";
  }, [conversation.lastMessage?.senderId, conversation.participants, userData]);

  const formattedTime = useMemo(() => formatTime(conversation.lastMessage?.timestamp), [formatTime, conversation.lastMessage?.timestamp]);
  const unreadCount = useMemo(() => conversation.unreadCounts?.[userData?.uid || ""] || 0, [conversation.unreadCounts, userData?.uid]);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white p-4 border-b border-gray-200"
    >
      <View className="flex-row items-start">
        {/* Profile Picture */}
        <View className="mr-3">
          <ProfilePicture src={otherParticipantProfilePicture} size="md" />
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
                {otherParticipantName}
              </Text>
              <Text
                className={`text-sm mt-2 font-inter ${unreadCount > 0 ? "font-bold text-gray-800" : "text-gray-600"}`}
                numberOfLines={2}
              >
                {conversation.lastMessage ? (
                  <>
                    <Text className="font-medium">
                      {lastMessageSenderName}
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
                {formattedTime}
              </Text>
              {/* Get the current user's unread count from this conversation */}
              {unreadCount > 0 && (
                <View className="bg-blue-500 rounded-full px-2 py-1 mt-1 self-end min-w-[20px] items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

ConversationItem.displayName = 'ConversationItem';

export default function Message() {
  const navigation = useNavigation<MessageNavigationProp>();
  const {
    conversations,
    loading,
    refreshConversations,
    markConversationAsRead,
  } = useMessage();
  const { userData } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleConversationPress = useCallback(async (conversation: Conversation) => {
    // Mark conversation as read before navigating
    if (userData?.uid) {
      await markConversationAsRead(conversation.id, userData.uid);
    }

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
  }, [userData?.uid, markConversationAsRead, navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshConversations();
    } catch (error) {
      console.error("Failed to refresh conversations:", error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshConversations]);

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
