import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Image as RNImage,
  StyleSheet,
  Dimensions,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useMessage } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import ProfilePicture from "@/components/ProfilePicture";
import type { Message, RootStackParamList } from "@/types/type";
import MessageBubble from "@/components/MessageBubble";
import HandoverModal from "@/components/HandoverModal";
import ClaimModal from "@/components/ClaimModal";

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;
type ChatNavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: "100%",
    maxWidth: "95%",
    maxHeight: "80%",
    alignItems: "center",
    zIndex: 2,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  imageCaption: {
    color: "white",
    marginTop: 10,
    textAlign: "center",
    fontSize: 16,
    opacity: 0.8,
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  dismissArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});

export default function Chat() {
  const navigation = useNavigation<ChatNavigationProp>();
  const route = useRoute<ChatRouteProp>();
  const {
    conversationId: initialConversationId,
    postTitle,
    postId,
    postOwnerId,
    postOwnerUserData,
    postType,
    postStatus,
    foundAction,
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
  const [isConversationDataReady, setIsConversationDataReady] = useState(false);

  // Modal states (like web version)
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState(false);

  // Image preview state
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    alt: string;
  } | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Fetch post data from Firestore
  const fetchPostData = async (postId: string) => {
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db } = await import("@/utils/firebase/config");
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (postDoc.exists()) {
        return postDoc.data();
      }
      return null;
    } catch (error) {
      console.error("Error fetching post data:", error);
      return null;
    }
  };

  // Update conversation data in Firestore
  const updateConversationData = async (
    conversationId: string,
    updatedData: any
  ) => {
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      const { db } = await import("@/utils/firebase/config");
      await updateDoc(doc(db, "conversations", conversationId), {
        postType: updatedData.postType,
        postStatus: updatedData.postStatus,
        foundAction: updatedData.foundAction,
        postCreatorId: updatedData.postCreatorId,
      });
    } catch (error) {
      console.error("Error updating conversation data:", error);
    }
  };

  // Track if we've already updated this conversation to prevent spam
  const [hasUpdatedConversation, setHasUpdatedConversation] = useState(false);

  // Track if we're currently loading to prevent multiple simultaneous loads
  const isLoadingRef = useRef(false);

  // Get the other participant's profile picture (exclude current user)
  const getOtherParticipantProfilePicture = () => {
    if (!userData) return null;

    // First try to get from conversation data
    if (conversationData && conversationData.participants) {
      const otherParticipant = Object.entries(
        conversationData.participants || {}
      ).find(([uid]) => uid !== userData.uid);

      if (
        otherParticipant &&
        otherParticipant[1] &&
        (otherParticipant[1] as any).profilePicture
      ) {
        return (otherParticipant[1] as any).profilePicture;
      }
    }

    // Fallback to postOwnerUserData from route params
    if (postOwnerUserData && postOwnerUserData.profilePicture) {
      return postOwnerUserData.profilePicture;
    }

    return null;
  };

  // Create conversation if needed
  useEffect(() => {
    if (
      conversationId ||
      !postId ||
      !postTitle ||
      !postOwnerId ||
      !userData?.uid
    ) {
      return;
    }

    // Prevent self-conversation
    if (postOwnerId === userData.uid) {
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
          userData.uid,
          userData,
          postOwnerUserData,
          postType,
          postStatus,
          foundAction
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
        if (loadedMessages.length > 51) {
          setTimeout(() => scrollToBottom(), 100);
        }
      }
    );

    return () => unsubscribe();
  }, [conversationId, getConversationMessages]);

  // Load conversation data
  useEffect(() => {
    if (!conversationId) return;
    if (isLoadingRef.current) return; // Prevent multiple simultaneous loads

    isLoadingRef.current = true;
    setIsConversationDataReady(false);
    setHasUpdatedConversation(false);

    let isMounted = true; // Flag to prevent state updates if component unmounts

    getConversation(conversationId)
      .then((data) => {
        if (!isMounted) return; // Don't update state if component unmounted

        // Check if conversation data has the required fields, if not, fetch from post
        if (data && (!data.postType || !data.postStatus)) {
          // Fetch post data to get the correct values
          if (data.postId) {
            fetchPostData(data.postId)
              .then((postData) => {
                if (!isMounted) return; // Don't update state if component unmounted

                if (postData) {
                  // Update conversation data with post data
                  const updatedConversationData = {
                    ...data,
                    postType: postData.type || data.postType || "lost",
                    postStatus: postData.status || data.postStatus || "pending",
                    foundAction:
                      postData.foundAction || data.foundAction || null,
                    postCreatorId:
                      postData.creatorId ||
                      data.postCreatorId ||
                      data.postOwnerId,
                  };
                  setConversationData(updatedConversationData);
                  setIsConversationDataReady(true);
                  isLoadingRef.current = false;

                  // Also update the conversation in Firestore for future use (only once)
                  if (!hasUpdatedConversation) {
                    updateConversationData(
                      conversationId,
                      updatedConversationData
                    );
                    setHasUpdatedConversation(true);
                  }
                } else {
                  setConversationData(data);
                  setIsConversationDataReady(true);
                  isLoadingRef.current = false;
                }
              })
              .catch((error) => {
                if (!isMounted) return; // Don't update state if component unmounted
                setConversationData(data);
                setIsConversationDataReady(true);
                isLoadingRef.current = false;
              });
          } else {
            setConversationData(data);
            setIsConversationDataReady(true);
            isLoadingRef.current = false;
          }
        } else {
          setConversationData(data);
          setIsConversationDataReady(true);
          isLoadingRef.current = false;
        }
      })
      .catch((error) => {
        if (!isMounted) return; // Don't update state if component unmounted
        setIsConversationDataReady(true);
        isLoadingRef.current = false;
      });

    // Cleanup function
    return () => {
      isMounted = false;
      isLoadingRef.current = false;
    };
  }, [conversationId]); // Remove getConversation from dependencies

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
    if (!conversationId || !newMessage.trim() || !userData) return;

    const messageText = newMessage.trim();

    try {
      setNewMessage("");

      await sendMessage(
        conversationId,
        userData.uid,
        `${userData.firstName} ${userData.lastName}`,
        messageText,
        userData.profilePicture
      );

      scrollToBottom();
    } catch (error: any) {
      Alert.alert("Error", "Failed to send message. Please try again.");
      setNewMessage(messageText); // Restore message on error
    }
  };

  // Check if buttons should be shown
  const shouldShowHandoverButton = () => {
    // Use conversation data if available, otherwise fall back to route params
    const currentPostType = conversationData?.postType || postType;
    const currentPostStatus = conversationData?.postStatus || postStatus;

    if (!userData || !postOwnerId) return false;
    if (postOwnerId === userData.uid) return false;
    if (currentPostType !== "lost") return false;
    if (currentPostStatus !== "pending") return false;
    return true;
  };

  const shouldShowClaimItemButton = () => {
    // Use conversation data if available, otherwise fall back to route params
    const currentPostType = conversationData?.postType || postType;
    const currentPostStatus = conversationData?.postStatus || postStatus;
    const currentFoundAction = conversationData?.foundAction || foundAction;

    if (!userData || !postOwnerId) return false;
    if (postOwnerId === userData.uid) return false;
    if (currentPostType !== "found") return false;
    if (currentPostStatus !== "pending") return false;

    // Allow claiming for "keep" and "turnover to Campus Security" posts
    // Only exclude posts that are disposed or donated
    if (currentFoundAction === "disposed" || currentFoundAction === "donated") {
      return false;
    }

    return true;
  };

  // Handle action buttons (like web version)
  const handleHandoverRequest = () => {
    setShowHandoverModal(true);
  };

  const handleHandoverRequestSubmit = async (data: {
    handoverReason: string;
    idPhotoUrl: string;
    itemPhotos: { url: string; uploadedAt: any; description?: string }[];
  }) => {
    if (!conversationId || !user || !userData) return;

    try {
      setIsHandoverSubmitting(true);
      await sendHandoverRequest(
        conversationId,
        user.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || "",
        conversationData?.postId || "",
        postTitle,
        data.handoverReason,
        data.idPhotoUrl,
        data.itemPhotos
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

  const handleClaimRequestSubmit = async (data: {
    claimReason: string;
    idPhotoUrl: string;
    evidencePhotos: { url: string; uploadedAt: any; description?: string }[];
  }) => {
    if (!conversationId || !user || !userData) return;

    try {
      setIsClaimSubmitting(true);
      await sendClaimRequest(
        conversationId,
        user.uid,
        `${userData.firstName} ${userData.lastName}`,
        userData.profilePicture || "",
        conversationData?.postId || "",
        postTitle,
        data.claimReason,
        data.idPhotoUrl,
        data.evidencePhotos
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
    // MessageBubble handles the actual logic
    // This function is called by MessageBubble after successful rejection
    if (status === "rejected") {
      Alert.alert("Success", "Handover request rejected!");
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
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="bg-white border-b border-gray-200 pb-4 px-4 mt-3 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        {/* Profile Picture - only show for other user's conversations */}
        {postOwnerId && userData && postOwnerId !== userData.uid && (
          <View className="mr-3">
            <ProfilePicture
              src={getOtherParticipantProfilePicture()}
              size="sm"
            />
          </View>
        )}

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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
        enabled
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
                isOwnMessage={item.senderId === userData?.uid}
                conversationId={conversationId}
                currentUserId={userData?.uid || ""}
                isCurrentUserPostOwner={postOwnerId === userData?.uid}
                onHandoverResponse={handleHandoverResponse}
                onClaimResponse={handleClaimResponse}
                onConfirmIdPhotoSuccess={handleConfirmIdPhotoSuccess}
                onImageClick={(imageUrl, altText) =>
                  setSelectedImage({ uri: imageUrl, alt: altText })
                }
              />
            )}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            inverted
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        )}

        {/* Message Limit Counter */}
        <View className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-sm text-gray-600 font-medium">
              Messages in conversation
            </Text>
            <View className="flex-row items-center">
              <Text
                className={`text-sm font-medium ${
                  messages.length >= 45 ? "text-red-500" : "text-green-600"
                }`}
              >
                {messages.length}/50
              </Text>
              {messages.length >= 45 && (
                <Text className="text-xs text-red-500 font-medium ml-2">
                  {50 - messages.length} left
                </Text>
              )}
            </View>
          </View>

          {/* Progress Bar */}
          <View className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-full"
              style={[
                {
                  width: `${(messages.length / 50) * 100}%`,
                },
                messages.length >= 45
                  ? { backgroundColor: "#EF4444" }
                  : { backgroundColor: "#10B981" },
              ]}
            />
          </View>

          {/* Warning Message */}
          {messages.length >= 45 && (
            <Text className="text-xs text-red-500 text-center mt-1">
              ⚠️ Oldest messages will be automatically removed when limit is
              reached
            </Text>
          )}
        </View>

        {/* Message Input */}
        <View 
          className="border-t border-gray-200 bg-white p-4"
          style={Platform.OS === 'ios' ? { paddingBottom: 20 } : { paddingBottom: 16 }}
        >
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <TextInput
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                className="border rounded-full font-inter px-4 py-3 text-base border-gray-300 bg-white"
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

      {/* Image Preview Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          <View style={styles.imageContainer}>
            {selectedImage && (
              <>
                <RNImage
                  source={{ uri: selectedImage.uri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
                <Text style={styles.imageCaption} numberOfLines={1}>
                  {selectedImage.alt}
                </Text>
              </>
            )}
          </View>

          {/* Invisible touch area that covers the entire screen */}
          <TouchableOpacity
            style={styles.dismissArea}
            activeOpacity={1}
            onPress={() => setSelectedImage(null)}
          />
        </View>
      </Modal>

      {/* Enhanced Claim Modal */}
      <ClaimModal
        visible={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        onSubmit={handleClaimRequestSubmit}
        isLoading={isClaimSubmitting}
        postTitle={postTitle}
      />

      {/* Enhanced Handover Modal */}
      <HandoverModal
        visible={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        onSubmit={handleHandoverRequestSubmit}
        isLoading={isHandoverSubmitting}
        postTitle={postTitle}
      />
    </SafeAreaView>
  );
}
