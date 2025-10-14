import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "@/context/AuthContext";
import { messageService } from "@/utils/firebase/messages";
import { postService } from "@/utils/firebase/posts";
import FlagModal from "./FlagModal";
import Toast from "./Toast";
import type { RootStackParamList } from "@/types/type";

interface PostCardMenuProps {
  postId: string;
  postTitle: string;
  postOwnerId: string;
  postOwnerUserData?: any;
  postType?: string;
  postStatus?: string;
  foundAction?: string;
  isFlagged?: boolean;
  flaggedBy?: string;
  onFlagSuccess?: () => void;
  className?: string;
}

export default function PostCardMenu({
  postId,
  postTitle,
  postOwnerId,
  postOwnerUserData,
  postType,
  postStatus,
  foundAction,
  isFlagged = false,
  flaggedBy,
  onFlagSuccess,
  className = "",
}: PostCardMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<
    "success" | "error" | "warning" | "info"
  >("success");

  const { user, userData } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleMenuPress = () => {
    console.log("Triple dot pressed, isOpen:", isOpen);
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async () => {
    console.log("Send Message button pressed");
    console.log("UserData:", !!userData);
    console.log("PostOwnerId:", postOwnerId);

    if (!userData) {
      Alert.alert("Login Required", "Please log in to send messages");
      return;
    }

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

    setIsCreatingConversation(true);
    setIsOpen(false);

    try {
      console.log("Creating conversation...");
      // Create conversation
      const conversationId = await messageService.createConversation(
        postId,
        postTitle,
        postOwnerId,
        userData.uid,
        userData,
        postOwnerUserData
      );

      console.log("Conversation created, navigating to chat...");
      // Navigate to chat
      navigation.navigate("Chat", {
        conversationId,
        postTitle,
        postId,
        postOwnerId,
        postOwnerUserData,
        postType: postType, // Pass post type (lost/found)
        postStatus: postStatus || "pending", // Pass post status
        foundAction: foundAction, // Pass found action for found items
      });
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      Alert.alert("Error", error.message || "Failed to start conversation");
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleFlagClick = () => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to flag posts");
      return;
    }
    setIsOpen(false);
    setShowFlagModal(true);
  };

  const handleFlagSubmit = async (reason: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      await postService.flagPost(postId, user.uid, reason);
      setShowFlagModal(false);
      setToastMessage("Post has been flagged for review");
      setToastType("success");
      setShowToast(true);
      onFlagSuccess?.();
    } catch (error: any) {
      setToastMessage(error.message || "Failed to flag post");
      setToastType("error");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  // Check if current user has already flagged this post
  const isAlreadyFlaggedByUser = isFlagged && flaggedBy === user?.uid;

  return (
    <>
      <View className={`relative ${className}`}>
        {/* Triple dot button */}
        <TouchableOpacity
          onPress={handleMenuPress}
          className="p-2 rounded-full bg-black/30"
          hitSlop={10}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Dropdown menu positioned beside the triple dot */}
        {isOpen && (
          <View className="absolute top-0 right-12 bg-white rounded-lg shadow-lg border border-gray-200 w-48 z-50">
            {/* Send Message Button */}
            <TouchableOpacity
              onPress={() => {
                console.log("Send Message button tapped!");
                handleSendMessage();
              }}
              disabled={isCreatingConversation || postOwnerId === userData?.uid}
              className={`flex-row items-center px-4 py-3 border-b border-gray-200 ${
                isCreatingConversation || postOwnerId === userData?.uid
                  ? "opacity-50"
                  : "active:bg-gray-50"
              }`}
              style={{ minHeight: 48 }} // Ensure minimum touch target
            >
              {isCreatingConversation ? (
                <ActivityIndicator
                  size="small"
                  color="#3B82F6"
                  className="mr-3"
                />
              ) : (
                <Ionicons
                  name="chatbubble-outline"
                  size={20}
                  color="#3B82F6"
                  className="mr-3"
                />
              )}
              <Text
                className={`text-base font-manrope-medium ${
                  isCreatingConversation || postOwnerId === userData?.uid
                    ? "text-gray-400"
                    : "text-gray-700"
                }`}
              >
                {isCreatingConversation ? "Starting Chat..." : "Send Message"}
              </Text>
            </TouchableOpacity>

            {/* Flag Post Button */}
            <TouchableOpacity
              onPress={() => {
                console.log("Flag Post button tapped!");
                handleFlagClick();
              }}
              disabled={
                isAlreadyFlaggedByUser ||
                postOwnerId === user?.uid ||
                postStatus === "resolved"
              }
              className={`flex-row items-center px-4 py-3 mr-3 ${
                isAlreadyFlaggedByUser ||
                postOwnerId === user?.uid ||
                postStatus === "resolved"
                  ? "opacity-50"
                  : "active:bg-gray-50"
              }`}
            >
              <Ionicons
                name="flag-outline"
                size={20}
                color={
                  isAlreadyFlaggedByUser ||
                  postOwnerId === user?.uid ||
                  postStatus === "resolved"
                    ? "#9CA3AF" // gray-400
                    : "#DC2626" // red-600
                }
                className="mr-3"
              />
              <Text
                className={`text-base font-manrope-medium ${
                  isAlreadyFlaggedByUser ||
                  postOwnerId === user?.uid ||
                  postStatus === "resolved"
                    ? "text-gray-400"
                    : "text-red-600"
                }`}
              >
                {isAlreadyFlaggedByUser
                  ? "Already Flagged"
                  : postOwnerId === user?.uid
                    ? "Can't Flag Own Post"
                    : postStatus === "resolved"
                      ? "Can't Flag Resolved Post"
                      : "Flag Post"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Flag Modal */}
      {showFlagModal && (
        <FlagModal
          onClose={() => setShowFlagModal(false)}
          onSubmit={handleFlagSubmit}
          isLoading={isLoading}
        />
      )}

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => setShowToast(false)}
      />
    </>
  );
}
