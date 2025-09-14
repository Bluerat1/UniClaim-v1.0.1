import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useMessage } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import type { Message, RootStackParamList } from "@/types/type";
import MessageBubble from "@/components/MessageBubble";

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;
type ChatNavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">;

export default function Chat() {
  const navigation = useNavigation<ChatNavigationProp>();
  const route = useRoute<ChatRouteProp>();
  const {
    conversationId: initialConversationId,
    postTitle,
    postId,
    postOwnerId,
    postOwnerUserData,
  } = route.params;

  const {
    sendMessage,
    createConversation,
    getConversationMessages,
    getConversation,
    markConversationAsRead,
    markMessageAsRead,
    sendClaimRequest,
    sendHandoverRequest,
    updateHandoverResponse,
    updateClaimResponse,
    confirmHandoverIdPhoto,
    confirmClaimIdPhoto,
  } = useMessage();

  const { user, userData } = useAuth();

  // Simple state management
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationId, setConversationId] = useState<string>(
    initialConversationId || ""
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [conversationData, setConversationData] = useState<any>(null);

  // Modal states (like web version)
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Create conversation if needed
  useEffect(() => {
    if (
      conversationId ||
      !postId ||
      !postTitle ||
      !postOwnerId ||
      !user?.uid ||
      !userData?.uid
    ) {
      return;
    }

    // Prevent self-conversation
    if (postOwnerId === user.uid) {
      Alert.alert(
        "Cannot Start Chat",
        "You cannot start a conversation with yourself.",
        [{ text: "Go Back", onPress: () => navigation.goBack() }]
      );
      return;
    }

    const createNewConversation = async () => {
      try {
        setLoading(true);
        const newConversationId = await createConversation(
          postId,
          postTitle,
          postOwnerId,
          user.uid,
          userData,
          postOwnerUserData
        );
        setConversationId(newConversationId);
      } catch (error: any) {
        Alert.alert("Error", "Failed to start conversation. Please try again.");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    createNewConversation();
  }, [
    conversationId,
    postId,
    postTitle,
    postOwnerId,
    user?.uid,
    userData,
    postOwnerUserData,
    createConversation,
    navigation,
  ]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    const unsubscribe = getConversationMessages(
      conversationId,
      (loadedMessages) => {
        setMessages(loadedMessages);

        // Scroll to bottom on new messages
        if (loadedMessages.length > 0) {
          setTimeout(() => scrollToBottom(), 100);
        }
      }
    );

    return () => unsubscribe();
  }, [conversationId, getConversationMessages]);

  // Load conversation data
  useEffect(() => {
    if (!conversationId) return;

    getConversation(conversationId)
      .then((data) => {
        setConversationData(data);
      })
      .catch(() => {
        console.log("Failed to get conversation data");
      });
  }, [conversationId, getConversation]);

  // Mark conversation as read
  useEffect(() => {
    if (!conversationId || !userData?.uid || messages.length === 0) return;

    try {
      markConversationAsRead(conversationId, userData.uid);
    } catch {
      console.log("Failed to mark conversation as read");
    }
  }, [conversationId, userData, messages.length, markConversationAsRead]);

  // Handle message visibility changes to mark messages as read
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (!conversationId || !userData?.uid) return;

      // Get all visible message IDs
      const visibleMessageIds = viewableItems
        .filter((item) => item.item.senderId !== userData?.uid) // Only mark other people's messages as read
        .map((item) => item.item.id);

      // Mark each visible message as read
      visibleMessageIds.forEach((messageId) => {
        markMessageAsRead(conversationId, messageId);
      });
    },
    [conversationId, userData?.uid, markMessageAsRead]
  );

  // Configuration for when items are considered visible
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Item is visible when 50% is shown
    minimumViewTime: 100, // Minimum time item must be visible (100ms)
  };

  // Simple scroll to bottom
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!conversationId || !newMessage.trim()) return;

    const messageText = newMessage.trim();

    try {
      setNewMessage("");

      await sendMessage(
        conversationId,
        user!.uid,
        `${userData!.firstName} ${userData!.lastName}`,
        messageText,
        userData!.profilePicture
      );

      scrollToBottom();
    } catch (error: any) {
      Alert.alert("Error", "Failed to send message. Please try again.");
      setNewMessage(messageText); // Restore message on error
    }
  };

  // Check if buttons should be shown
  const shouldShowHandoverButton = () => {
    if (!userData || !postOwnerId) return false;
    if (postOwnerId === userData.uid) return false;
    if (conversationData?.postType !== "lost") return false;
    if (conversationData?.postStatus !== "pending") return false;
    return true;
  };

  const shouldShowClaimItemButton = () => {
    if (!userData || !postOwnerId) return false;
    if (postOwnerId === userData.uid) return false;
    if (conversationData?.postType !== "found") return false;
    if (conversationData?.postStatus !== "pending") return false;

    // Allow claiming for "keep" and "turnover to Campus Security" posts
    // Only exclude posts that are disposed or donated
    if (
      conversationData?.foundAction === "disposed" ||
      conversationData?.foundAction === "donated"
    ) {
      return false;
    }

    return true;
  };

  // Handle action buttons (like web version)
  const handleHandoverRequest = () => {
    setShowHandoverModal(true);
  };

  const handleHandoverRequestSubmit = async () => {
    if (!conversationId || !user || !userData) return;

    try {
      setIsHandoverSubmitting(true);
      await sendHandoverRequest(
        conversationId,
        user.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || "",
        conversationData?.postId || "",
        postTitle
      );
      setShowHandoverModal(false);
      Alert.alert("Success", "Handover request sent successfully!");
    } catch (error: any) {
      Alert.alert(
        "Error",
        "Failed to send handover request. Please try again."
      );
    } finally {
      setIsHandoverSubmitting(false);
    }
  };

  const handleClaimRequest = () => {
    setShowClaimModal(true);
  };

  const handleClaimRequestSubmit = async () => {
    if (!conversationId || !user || !userData) return;

    try {
      setIsClaimSubmitting(true);
      await sendClaimRequest(
        conversationId,
        user.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || "",
        conversationData?.postId || "",
        postTitle
      );
      setShowClaimModal(false);
      Alert.alert("Success", "Claim request sent successfully!");
    } catch (error: any) {
      Alert.alert("Error", "Failed to send claim request. Please try again.");
    } finally {
      setIsClaimSubmitting(false);
    }
  };

  // Handle handover response (like web version)
  const handleHandoverResponse = async (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    if (!conversationId || !user?.uid) return;

    try {
      await updateHandoverResponse(conversationId, messageId, status);
      Alert.alert("Success", `Handover request ${status}!`);
    } catch (error: any) {
      Alert.alert(
        "Error",
        `Failed to ${status} handover request. Please try again.`
      );
    }
  };

  // Handle claim response (like web version)
  const handleClaimResponse = async (
    messageId: string,
    status: "accepted" | "rejected"
  ) => {
    if (!conversationId || !user?.uid) return;

    try {
      await updateClaimResponse(conversationId, messageId, status);
      Alert.alert("Success", `Claim request ${status}!`);
    } catch (error: any) {
      Alert.alert(
        "Error",
        `Failed to ${status} claim request. Please try again.`
      );
    }
  };

  // Handle ID photo confirmation (like web version)
  const handleConfirmIdPhotoSuccess = async (messageId: string) => {
    if (!conversationId || !user?.uid) return;

    try {
      // Determine if it's a handover or claim message
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      if (message.messageType === "handover_request") {
        await confirmHandoverIdPhoto(conversationId, messageId);
        Alert.alert("Success", "Handover ID photo confirmed!");
      } else if (message.messageType === "claim_request") {
        await confirmClaimIdPhoto(conversationId, messageId);
        Alert.alert("Success", "Claim ID photo confirmed!");
      }
    } catch (error: any) {
      Alert.alert("Error", "Failed to confirm ID photo. Please try again.");
    }
  };

  if (!user || !userData) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Please log in to send messages</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white pt-3">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pt-3 pb-4 px-4 mt-6 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className="font-semibold text-lg text-gray-800"
            numberOfLines={1}
          >
            {postTitle}
          </Text>
          <Text className="text-sm text-gray-500">
            {postOwnerId && userData
              ? postOwnerId === userData.uid
                ? "Your post"
                : "Chat with post owner"
              : "About this lost/found item"}
          </Text>
        </View>

        {/* Action Buttons */}
        {shouldShowHandoverButton() && (
          <TouchableOpacity
            className="ml-3 px-4 py-2 bg-green-500 rounded-lg"
            onPress={handleHandoverRequest}
          >
            <Text className="text-white font-medium text-sm">Handover</Text>
          </TouchableOpacity>
        )}

        {shouldShowClaimItemButton() && (
          <TouchableOpacity
            className="ml-3 px-4 py-2 bg-blue-500 rounded-lg"
            onPress={handleClaimRequest}
          >
            <Text className="text-white font-medium text-sm">Claim Item</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500">Creating conversation...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            {postOwnerId === user?.uid ? (
              <>
                <Ionicons
                  name="person-circle-outline"
                  size={64}
                  color="#F59E0B"
                />
                <Text className="text-gray-700 text-center mt-4 mb-2 text-lg font-semibold">
                  This is your post
                </Text>
                <Text className="text-gray-500 text-center mt-2 mb-6 leading-6">
                  You cannot start a conversation with yourself about &quot;
                  {postTitle}&quot;
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  className="bg-blue-500 px-6 py-3 rounded-full"
                >
                  <Text className="text-white font-semibold">Go Back</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons
                  name="chatbubbles-outline"
                  size={64}
                  color="#9CA3AF"
                />
                <Text className="text-gray-500 text-center mt-4">
                  Start the conversation about &quot;{postTitle}&quot;
                </Text>
              </>
            )}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwnMessage={item.senderId === user.uid}
                conversationId={conversationId}
                currentUserId={user?.uid || ""}
                isCurrentUserPostOwner={postOwnerId === userData?.uid}
                onHandoverResponse={handleHandoverResponse}
                onClaimResponse={handleClaimResponse}
                onConfirmIdPhotoSuccess={handleConfirmIdPhotoSuccess}
                onImageClick={() => {}}
              />
            )}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        )}

        {/* Message Input */}
        <View className="border-t border-gray-200 bg-white p-4 mb-10">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <TextInput
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                className="border rounded-full font-inter  px-4 py-3 text-base border-gray-300 bg-white"
                multiline
                maxLength={200}
                editable={!loading}
              />
            </View>
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || loading}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                newMessage.trim() && !loading ? "bg-yellow-500" : "bg-gray-300"
              }`}
            >
              <Ionicons
                name="send"
                size={20}
                color={newMessage.trim() && !loading ? "white" : "#9CA3AF"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Claim Verification Modal - Like Web Version */}
      {showClaimModal && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 20,
              margin: 20,
              width: "90%",
              maxWidth: 400,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Verify Claim Request
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#666",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Please upload a photo of your ID to verify your claim.
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                marginTop: 20,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowClaimModal(false)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: "#6b7280",
                }}
              >
                <Text style={{ color: "white", fontWeight: "500" }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClaimRequestSubmit}
                disabled={isClaimSubmitting}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: isClaimSubmitting ? "#9ca3af" : "#3b82f6",
                }}
              >
                <Text style={{ color: "white", fontWeight: "500" }}>
                  {isClaimSubmitting ? "Processing..." : "Continue"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Handover Verification Modal - Like Web Version */}
      {showHandoverModal && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 20,
              margin: 20,
              width: "90%",
              maxWidth: 400,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Verify Handover Request
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#666",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Please upload a photo of your ID to verify the handover.
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                marginTop: 20,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowHandoverModal(false)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: "#6b7280",
                }}
              >
                <Text style={{ color: "white", fontWeight: "500" }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleHandoverRequestSubmit}
                disabled={isHandoverSubmitting}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: isHandoverSubmitting ? "#9ca3af" : "#3b82f6",
                }}
              >
                <Text style={{ color: "white", fontWeight: "500" }}>
                  {isHandoverSubmitting ? "Processing..." : "Continue"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
