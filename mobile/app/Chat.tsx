import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image as RNImage,
  Modal,
  Alert,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useMessage } from "../context/MessageContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ProfilePicture from "../components/ProfilePicture";
import type { Message, RootStackParamList } from "../types/type";
import MessageBubble from "../components/MessageBubble";
import HandoverModal from "../components/HandoverModal";
import ClaimModal from "../components/ClaimModal";
import ImagePicker from "../components/ImagePicker";
import { getProfilePictureUrl } from "../utils/profileUtils";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../utils/firebase";
import { messageService } from "../utils/firebase/messages";

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;
type ChatNavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">;

// Debug logging utility with performance tracking
const DEBUG_ENABLED = false;
const debugLog = (section: string, message: string, data?: any) => {
  if (!DEBUG_ENABLED) return;
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
  console.log(
    `\n[CHAT-PERF:${timestamp}] ${section.padEnd(25)} | ${message}`,
    data ? data : ""
  );
};

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
    postCreatorId, // Add postCreatorId parameter
  } = route.params;

  // Log component mount with initial params
  const performanceStartRef = useRef(Date.now());
  useEffect(() => {
    debugLog("COMPONENT", "🚀 Chat component mounted", {
      initialConversationId,
      postId,
      postOwnerId,
      hasPostOwnerUserData: !!postOwnerUserData,
    });
    return () => {
      const elapsed = Date.now() - performanceStartRef.current;
      debugLog(
        "COMPONENT",
        `🏁 Chat component unmounted (total time: ${elapsed}ms)`
      );
    };
  }, []);

  const {
    sendMessage,
    createConversation,
    getConversationMessages,
    getConversation,
    markMessageAsRead,
    hasUnreadMessages,
    markAllUnreadMessagesAsRead,
    sendClaimRequest,
    sendHandoverRequest,
    updateClaimResponse,
    confirmHandoverIdPhoto,
    confirmClaimIdPhoto,
    listenToParticipantProfile,
  } = useMessage();

  const { user, userData } = useAuth();

  const currentUserProfilePicture = useMemo(
    () => getProfilePictureUrl(userData),
    [userData]
  );

  // Add toast context
  const { showToastMessage } = useToast();

  // Simple state management
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationId, setConversationId] = useState<string>(
    initialConversationId || ""
  );
  const [loading, setLoading] = useState<boolean>(
    initialConversationId ? true : false
  );
  const [conversationData, setConversationData] = useState<any>(null);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
  const [isHandoverSubmitting, setIsHandoverSubmitting] = useState(false);

  // ImagePicker state for ID photo uploads
  const [imagePickerMessageId, setImagePickerMessageId] = useState<string>("");
  const [imagePickerMessageType, setImagePickerMessageType] = useState<
    "handover_request" | "claim_request"
  >("handover_request");
  const [isImagePickerUploading, setIsImagePickerUploading] = useState(false);

  // Image preview state
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    alt: string;
  } | null>(null);

  // Keyboard handling state
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  const flatListRef = useRef<FlatList>(null);

  // Define the participant data type
  interface ParticipantData {
    photoURL?: string;
    profilePicture?: string;
    avatar?: string;
    profilePic?: string;
    image?: string;
    picture?: string;
    photo?: string;
    profilePicUrl?: string;
    profileImageUrl?: string;
    profile_pic?: string;
    profile_pic_url?: string;
    displayName?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }

  // State for other participant's profile picture
  const [otherParticipantPic, setOtherParticipantPic] = useState<string | null>(
    null
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);
  const currentParticipantIdRef = useRef<string | null>(null);

  // Get the other participant's ID (memoized)
  const otherParticipantId = useMemo(() => {
    if (!userData?.uid || !conversationData?.participants) return null;

    const otherParticipant = Object.entries(
      conversationData.participants || {}
    ).find(([uid]) => uid !== userData.uid);

    return otherParticipant?.[0] || null;
  }, [userData?.uid, conversationData?.participants]);

  // Subscribe to the other participant's profile updates
  useEffect(() => {
    if (!otherParticipantId) {
      currentParticipantIdRef.current = null;
      setOtherParticipantPic(null);
      profileUnsubscribeRef.current?.();
      profileUnsubscribeRef.current = null;
      return;
    }

    currentParticipantIdRef.current = otherParticipantId;

    // Reset cached state so we don't briefly show the previous participant's avatar
    setOtherParticipantPic(null);
    setIsLoadingProfile(true);

    profileUnsubscribeRef.current?.();
    profileUnsubscribeRef.current = listenToParticipantProfile(
      otherParticipantId,
      (participant) => {
        if (currentParticipantIdRef.current !== otherParticipantId) {
          return;
        }

        const pictureUrl = getProfilePictureUrl(participant);
        setOtherParticipantPic(pictureUrl);
        setIsLoadingProfile(false);
      }
    );

    return () => {
      profileUnsubscribeRef.current?.();
      profileUnsubscribeRef.current = null;
    };
  }, [otherParticipantId, listenToParticipantProfile]);

  // Effect to load other participant's profile picture - optimized to use route params first
  useEffect(() => {
    if (!userData?.uid || otherParticipantPic) {
      return;
    }

    const loadProfilePicture = async () => {
      try {
        if (
          currentParticipantIdRef.current === otherParticipantId &&
          postOwnerUserData &&
          typeof postOwnerUserData === "object" &&
          postOwnerId !== userData.uid &&
          postOwnerId === otherParticipantId
        ) {
          const pictureUrl = getProfilePictureUrl(postOwnerUserData);
          if (pictureUrl) {
            setOtherParticipantPic(pictureUrl);
            setIsLoadingProfile(false);
            return;
          }
        }

        if (!otherParticipantId) {
          return;
        }

        setIsLoadingProfile(true);
        const firebaseStartTime = Date.now();

        const { getDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../utils/firebase/config");
        const userDoc = await getDoc(doc(db, "users", otherParticipantId));

        const firebaseElapsed = Date.now() - firebaseStartTime;

        if (userDoc.exists()) {
          const userData = userDoc.data() as ParticipantData;
          const pictureUrl = getProfilePictureUrl(userData);
          if (pictureUrl) {
            if (currentParticipantIdRef.current !== otherParticipantId) {
              return;
            }

            setOtherParticipantPic(pictureUrl);
          }
        } else {
        }
      } catch (error) {
        console.error("Error loading profile picture:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfilePicture();
  }, [
    userData?.uid,
    postOwnerId,
    postOwnerUserData,
    conversationData?.participants,
    otherParticipantId,
    otherParticipantPic,
  ]);

  // Mark all messages as read when the chat is opened
  useEffect(() => {
    const markMessagesAsRead = async () => {
      try {
        if (conversationId && user?.uid) {
          await messageService.markAllUnreadMessagesAsRead(
            conversationId,
            user.uid
          );
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };

    markMessagesAsRead();
  }, [conversationId, user?.uid]);

  // Get the other participant's profile picture (exclude current user)
  const getOtherParticipantProfilePicture = useCallback(() => {
    if (otherParticipantPic) {
      return otherParticipantPic;
    }

    if (otherParticipantId && conversationData?.participants) {
      const participantData = conversationData.participants[otherParticipantId];
      const participantPicture = getProfilePictureUrl(participantData);
      if (participantPicture) {
        return participantPicture;
      }
    }

    if (otherParticipantId) {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (
          message.senderId === otherParticipantId &&
          typeof message.senderProfilePicture === "string" &&
          message.senderProfilePicture.trim() !== ""
        ) {
          return message.senderProfilePicture;
        }
      }
    }

    if (
      otherParticipantId &&
      postOwnerUserData &&
      postOwnerId === otherParticipantId
    ) {
      const ownerPicture = getProfilePictureUrl(postOwnerUserData);
      if (ownerPicture) {
        return ownerPicture;
      }
    }

    return null;
  }, [
    otherParticipantPic,
    otherParticipantId,
    conversationData?.participants,
    messages,
    postOwnerUserData,
    postOwnerId,
  ]);

  // Fetch post data from Firestore
  const fetchPostData = async (postId: string) => {
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../utils/firebase/config");
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
      const { db } = await import("../utils/firebase/config");
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

  // Track if confirmation is in progress to prevent duplicate calls
  const [isConfirmationInProgress, setIsConfirmationInProgress] =
    useState(false);

  // Track if FlatList is ready for scrolling
  const [isFlatListReady, setIsFlatListReady] = useState(false);

  // Handle FlatList layout to ensure it's ready for scrolling
  const handleFlatListLayout = () => {
    setIsFlatListReady(true);
  };

  // Ref to track pending scroll operations to prevent duplicate animations
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if we just sent a message to avoid redundant scroll on Firebase confirmation
  const [justSentMessageCount, setJustSentMessageCount] = useState(0);
  const justSentRef = useRef(false);

  // Scroll to bottom function - defined after state declarations so it can be used in useEffect hooks
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0 && isFlatListReady) {
      // Clear any pending scroll operations
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Use requestAnimationFrame for better timing with UI updates
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length, isFlatListReady]);

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

    let isMounted = true; // Track if component is still mounted

    const createNewConversation = async () => {
      try {
        setLoading(true);

        // Double-check that conversation doesn't exist before creating
        const existingConversation = await getConversation(
          conversationId || "dummy"
        );

        if (!isMounted) return; // Component was unmounted

        if (existingConversation) {
          setLoading(false);
          return;
        }

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

        if (!isMounted) return; // Component was unmounted

        setConversationId(newConversationId);
      } catch (error: any) {
        console.error("❌ Chat: Error creating conversation:", error);

        if (!isMounted) return; // Component was unmounted

        // Check if conversation was deleted during creation process
        if (
          error.message?.includes("Conversation does not exist") ||
          error.message?.includes("Conversation not found") ||
          error.message?.includes("Failed to get conversation") ||
          conversationId
        ) {
          navigation.goBack();
          return;
        }

        Alert.alert("Error", "Failed to start conversation. Please try again.");
        navigation.goBack();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    createNewConversation();

    return () => {
      isMounted = false;
    };
  }, [
    conversationId,
    postId,
    postTitle,
    postOwnerId,
    userData?.uid,
    postOwnerUserData,
    createConversation,
    navigation,
    foundAction,
    getConversation,
    postStatus,
    postType,
  ]);

  useEffect(() => {
    if (!initialConversationId) {
      return;
    }

    let isMounted = true;

    const loadConversationData = async () => {
      try {
        // Only mark as read if there are unread messages
        if (user?.uid && initialConversationId) {
          try {
            const hasUnread = await hasUnreadMessages(
              initialConversationId,
              user.uid
            );
            if (hasUnread) {
              const startTime = Date.now();
              const marked = await markAllUnreadMessagesAsRead(
                initialConversationId,
                user.uid
              );
              if (marked) {
                const elapsed = Date.now() - startTime;
                debugLog(
                  "MESSAGES",
                  `✅ Marked messages as read (${elapsed}ms)`
                );
              }
            }
          } catch (error) {
            console.error("Error checking/marking messages as read:", error);
          }
        }

        // Defer loading conversation data to avoid blocking UI
        // Use a small delay to allow messages to start loading first
        setTimeout(async () => {
          if (!isMounted) return;

          try {
            const conversationData = await getConversation(
              initialConversationId
            );

            if (isMounted && conversationData) {
              setConversationData(conversationData);
            }
          } catch (error) {
            console.error("Error loading conversation data:", error);
            // Don't show error for conversation data fetch as it's not critical
          }
        }, 100);
      } catch (error) {
        console.error("Error in loadConversationData:", error);
      }
    };

    loadConversationData();

    return () => {
      isMounted = false;
    };
  }, [
    initialConversationId,
    user?.uid,
    hasUnreadMessages,
    markAllUnreadMessagesAsRead,
    getConversation,
    // These are memoized in MessageContext, but we need to include them as dependencies
    // to avoid stale closures
  ]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let isActive = true; // Track if this effect is still active

    const unsubscribe = getConversationMessages(
      conversationId,
      (loadedMessages) => {
        // Only process if this effect is still active (not cleaned up)
        if (!isActive) {
          return;
        }

        setMessages(loadedMessages);
        setLoading(false); // Clear loading state when messages are received

        // Skip animated scroll if this is just confirming our sent message
        if (
          justSentRef.current &&
          loadedMessages.length === justSentMessageCount
        ) {
          return;
        }

        // Scroll to bottom when messages are loaded (for any number of messages)
        if (isFlatListReady) {
          // Clear any pending timeouts to prevent multiple animations
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }

          scrollTimeoutRef.current = setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
            scrollTimeoutRef.current = null;
          }, 100);
        }
      }
    );

    return () => {
      isActive = false; // Mark this effect as inactive
      unsubscribe();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [conversationId]);

  // Scroll to bottom when FlatList becomes ready (for existing messages)
  useEffect(() => {
    if (isFlatListReady && messages.length > 0) {
      // Clear any pending timeouts to prevent duplicate animations
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false }); // No animation on initial load
        scrollTimeoutRef.current = null;
      }, 50);
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isFlatListReady]);

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
        markMessageAsRead(conversationId, messageId, userData?.uid || "").catch(
          (error) => {
            console.error(
              `❌ Chat: Failed to mark message ${messageId} as read:`,
              error
            );
            // Continue with other messages even if one fails
          }
        );
      });
    },
    [conversationId, userData?.uid, markMessageAsRead]
  );

  // Configuration for when items are considered visible
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50, // Item is visible when 50% is shown
    minimumViewTime: 100, // Minimum time item must be visible (100ms)
  };

  // Send message
  const handleSendMessage = async () => {
    if (!conversationId || !newMessage.trim() || !userData) {
      return;
    }

    const messageText = newMessage.trim();

    try {
      // Track message count before sending
      const countBeforeSend = messages.length;

      // Verify conversation exists before sending message
      const conversation = await getConversation(conversationId);
      if (!conversation) {
        console.error("Conversation not found");
        Alert.alert("Error", "Conversation not found. Please try again.");
        return;
      }

      setNewMessage("");

      await sendMessage(
        conversationId,
        userData.uid,
        `${userData.firstName} ${userData.lastName}`,
        messageText,
        currentUserProfilePicture || undefined
      );

      // Mark that we just sent a message with the count it should reach
      justSentRef.current = true;
      setJustSentMessageCount(countBeforeSend + 1);

      // Clear the flag after 2 seconds to allow normal scrolling again
      setTimeout(() => {
        justSentRef.current = false;
      }, 2000);

      if (isFlatListReady) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            // Scroll without animation for instant feedback
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 50);
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
      setNewMessage(messageText); // Restore message on error
      justSentRef.current = false; // Clear flag on error
    }
  };

  // Check if buttons should be shown
  const shouldShowHandoverButton = () => {
    // Use conversation data if available, otherwise fall back to route params
    const currentPostType = conversationData?.postType || postType;
    const currentPostStatus = conversationData?.postStatus || postStatus;
    const currentPostCreatorId =
      conversationData?.postCreatorId || postCreatorId || postOwnerId;

    if (!userData || !currentPostCreatorId) return false;

    // Only show if current user is messaging the actual post creator
    if (postOwnerId !== currentPostCreatorId) return false;

    // Don't show if current user is the post creator
    if (currentPostCreatorId === userData.uid) return false;

    if (currentPostType !== "lost") return false;
    if (currentPostStatus !== "pending") return false;
    return true;
  };

  const shouldShowClaimItemButton = () => {
    // Use conversation data if available, otherwise fall back to route params
    const currentPostType = conversationData?.postType || postType;
    const currentPostStatus = conversationData?.postStatus || postStatus;
    const currentPostCreatorId =
      conversationData?.postCreatorId || postCreatorId || postOwnerId;
    const currentFoundAction = conversationData?.foundAction || foundAction;

    if (!userData || !currentPostCreatorId) return false;

    // Only show if current user is messaging the actual post creator
    if (postOwnerId !== currentPostCreatorId) return false;

    // Don't show if current user is the post creator
    if (currentPostCreatorId === userData.uid) return false;

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

  const checkForPendingHandoverRequest = async (
    conversationId: string
  ): Promise<boolean> => {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (conversationDoc.exists()) {
        const conversationData = conversationDoc.data();
        if (
          conversationData?.hasHandoverRequest &&
          conversationData.handoverRequestId
        ) {
          const existingRequestRef = doc(
            db,
            "conversations",
            conversationId,
            "messages",
            conversationData.handoverRequestId
          );
          const existingRequestDoc = await getDoc(existingRequestRef);

          if (existingRequestDoc.exists()) {
            const existingRequest = existingRequestDoc.data();
            return existingRequest.handoverData?.status === "pending";
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking for pending handover request:", error);
      return false;
    }
  };

  const handleHandoverRequestSubmit = async (data: {
    handoverReason: string;
    idPhotoUrl: string;
    itemPhotos: { url: string; uploadedAt: any; description?: string }[];
  }) => {
    if (!conversationId || !user || !userData) return;

    try {
      // First check for pending handover request before any processing
      const hasPendingRequest =
        await checkForPendingHandoverRequest(conversationId);
      if (hasPendingRequest) {
        showToastMessage(
          "There is already a pending handover request for this conversation",
          "error"
        );
        return;
      }

      // Validate required fields
      if (!data.idPhotoUrl || !data.itemPhotos?.length) {
        showToastMessage(
          "Please upload your ID photo and at least one item photo",
          "error"
        );
        return;
      }

      setIsHandoverSubmitting(true);
      await sendHandoverRequest(
        conversationId,
        user.uid,
        `${userData.firstName} ${userData.lastName}`,
        currentUserProfilePicture || "",
        conversationData?.postId || "",
        postTitle,
        data.handoverReason,
        data.idPhotoUrl,
        data.itemPhotos
      );
      setShowHandoverModal(false);
      showToastMessage("Handover request sent successfully!", "success");
    } catch {
      Alert.alert(
        "Error",
        "Failed to send handover request. Please try again."
      );
    } finally {
      setIsHandoverSubmitting(false);
    }
  };

  const handleClaimRequest = async () => {
    if (!conversationId) return;

    try {
      setIsClaimSubmitting(true);
      const hasPendingRequest =
        await checkForPendingClaimRequest(conversationId);

      if (hasPendingRequest) {
        showToastMessage(
          "There is already a pending claim request for this conversation",
          "error"
        );
        return;
      }

      // Only show the modal if there are no pending requests
      setShowClaimModal(true);
    } catch (error) {
      console.error("Error checking for pending claim request:", error);
      showToastMessage(
        "Failed to check for existing requests. Please try again.",
        "error"
      );
    } finally {
      setIsClaimSubmitting(false);
    }
  };

  const checkForPendingClaimRequest = async (
    conversationId: string
  ): Promise<boolean> => {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        return false; // No conversation found, so no pending request
      }

      const conversationData = conversationDoc.data();

      // If there's no claim request flag or ID, definitely no pending request
      if (
        !conversationData?.hasClaimRequest ||
        !conversationData.claimRequestId
      ) {
        return false;
      }

      // Try to get the actual message
      const existingRequestRef = doc(
        db,
        "conversations",
        conversationId,
        "messages",
        conversationData.claimRequestId
      );
      const existingRequestDoc = await getDoc(existingRequestRef);

      // If message doesn't exist or is deleted, clean up the conversation data
      if (!existingRequestDoc.exists()) {
        // Update conversation to remove the reference to the deleted message
        await updateDoc(conversationRef, {
          hasClaimRequest: false,
          claimRequestId: deleteField(),
        });
        return false;
      }

      // Check if the existing request is still pending
      const existingRequest = existingRequestDoc.data();
      return existingRequest.claimData?.status === "pending";
    } catch (error) {
      console.error("Error checking for pending claim request:", error);
      // In case of error, be permissive and allow the user to try submitting
      return false;
    }
  };

  const handleClaimRequestSubmit = async (data: {
    claimReason: string;
    idPhotoUrl: string;
    evidencePhotos: { url: string; uploadedAt: any; description?: string }[];
  }) => {
    if (!conversationId || !user || !userData) return;

    try {
      // First check for pending claim request before any processing
      const hasPendingRequest =
        await checkForPendingClaimRequest(conversationId);
      if (hasPendingRequest) {
        showToastMessage(
          "There is already a pending claim request for this conversation",
          "error"
        );
        return;
      }

      // Validate required fields
      const isAdminPost =
        conversationData?.postCreatorId === "admin" ||
        (conversationData?.postCreatorId?.includes("admin") ?? false) ||
        conversationData?.postCreatorId === "campus_security";

      if (isAdminPost) {
        if (!data.idPhotoUrl) {
          showToastMessage("Please upload your ID photo", "error");
          return;
        }
      } else {
        if (!data.idPhotoUrl || !data.evidencePhotos?.length) {
          showToastMessage(
            "Please upload your ID photo and at least one evidence photo",
            "error"
          );
          return;
        }
      }

      setIsClaimSubmitting(true);
      await sendClaimRequest(
        conversationId,
        user.uid,
        `${userData.firstName} ${userData.lastName}`,
        currentUserProfilePicture || "",
        conversationData?.postId || "",
        postTitle,
        data.claimReason,
        data.idPhotoUrl,
        data.evidencePhotos
      );
      setShowClaimModal(false);
      showToastMessage("Claim request sent successfully!", "success");
    } catch {
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
      showToastMessage("Handover request rejected!", "success");
    }
  };

  // Handle claim response (like web version)
  const handleClaimResponse = async (
    messageId: string,
    status: "accepted" | "rejected",
    idPhotoUrl?: string
  ) => {
    if (!conversationId || !user?.uid) return;

    try {
      // Update the local messages state to reflect the new claim response
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === messageId && msg.claimData) {
            return {
              ...msg,
              claimData: {
                ...msg.claimData,
                status: status === "accepted" ? "pending_confirmation" : status,
                respondedAt: new Date(),
                respondedBy: user.uid,
              } as any, // Type assertion to handle optional properties
            };
          }
          return msg;
        })
      );

      // Update the claim response in Firebase with ID photo URL if provided
      await updateClaimResponse(
        conversationId,
        messageId,
        status,
        user.uid,
        idPhotoUrl
      );

      // Refresh message data from Firebase after upload to get complete updated data
      if (status === "accepted") {
        setTimeout(() => {
          if (conversationId) {
            getConversationMessages(conversationId, (updatedMessages) => {
              // Force re-render of MessageBubble components by updating a key or state
              setMessages(updatedMessages);
            });
          }
        }, 2000); // Increased delay to allow Firebase to fully update
      }

      showToastMessage(
        `Claim request ${
          status === "accepted" ? "accepted - awaiting verification" : status
        }!`,
        "success"
      );
    } catch {
      Alert.alert(
        "Error",
        `Failed to ${status} claim request. Please try again.`
      );
    }
  };

  // Handle ID photo upload for ImagePicker
  const handleImagePickerSelect = async (photoUri: string) => {
    if (!conversationId || !user?.uid || !imagePickerMessageId) return;

    setIsImagePickerUploading(true);

    try {
      // Import the handoverClaimService
      const handoverClaimService = await import(
        "../utils/handoverClaimService"
      );

      // Upload the ID photo
      const uploadResult = await handoverClaimService.uploadIdPhotoMobile(
        photoUri,
        imagePickerMessageType === "handover_request" ? "handover" : "claim"
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to upload ID photo");
      }

      // Update the appropriate response based on message type
      if (imagePickerMessageType === "handover_request") {
        // Use the handoverClaimService to handle the response
        await handoverClaimService.updateHandoverResponse(
          conversationId,
          imagePickerMessageId,
          "accepted",
          user.uid,
          uploadResult.url
        );

        // Refresh messages to show updated status
        if (conversationId) {
          getConversationMessages(conversationId, setMessages);
        }
      } else if (imagePickerMessageType === "claim_request") {
        // Use the handoverClaimService to handle the response
        await handoverClaimService.updateClaimResponse(
          conversationId,
          imagePickerMessageId,
          "accepted",
          user.uid,
          uploadResult.url
        );

        // Refresh messages to show updated status
        if (conversationId) {
          getConversationMessages(conversationId, setMessages);
        }
      }

      // Show success message
      showToastMessage(
        "ID photo uploaded successfully! The item owner will now review and confirm.",
        "success"
      );

      // Close the modal and reset states
      setShowImagePickerModal(false);
      setImagePickerMessageId("");
      setImagePickerMessageType("handover_request");
    } catch (error: any) {
      console.error("Error in handleImagePickerSelect:", error);
      Alert.alert(
        "Upload Failed",
        error.message || "Failed to upload ID photo. Please try again."
      );
    } finally {
      setIsImagePickerUploading(false);
    }
  };

  const handleImagePickerClose = () => {
    setShowImagePickerModal(false);
    setImagePickerMessageId("");
    setImagePickerMessageType("handover_request");
  };

  // Function to trigger ImagePicker from MessageBubble
  const triggerImagePicker = (
    messageId: string,
    messageType: "handover_request" | "claim_request"
  ) => {
    setImagePickerMessageId(messageId);
    setImagePickerMessageType(messageType);
    setShowImagePickerModal(true);
  };

  // Handle ID photo confirmation (like web version)
  const handleConfirmIdPhotoSuccess = async (messageId: string) => {
    if (!conversationId || !user?.uid || isConfirmationInProgress) return;

    // Prevent duplicate confirmations
    setIsConfirmationInProgress(true);

    try {
      // Import the handoverClaimService
      const handoverClaimService = await import(
        "../utils/handoverClaimService"
      );

      // Get the message data before trying to confirm
      // Find the message and log its details for debugging
      const message = messages.find((m) => m.id === messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      console.log("🔍 Message found for confirmation:", {
        messageId: message.id,
        messageType: message.messageType,
        isHandover: message.messageType === "handover_request",
        isClaim: message.messageType === "claim_request",
        hasClaimData: !!message.claimData,
        hasHandoverData: !!message.handoverData,
      });

      let result;

      // Check both messageType and the existence of the corresponding data object
      const isHandover =
        message.messageType === "handover_request" || message.handoverData;
      const isClaim =
        message.messageType === "claim_request" || message.claimData;

      console.log("🔍 Confirmation type check:", { isHandover, isClaim });

      if (isHandover && !isClaim) {
        console.log("🔄 Confirming handover ID photo...");
        result = await handoverClaimService.confirmHandoverIdPhoto(
          conversationId,
          messageId,
          user.uid
        );

        if (result && result.success) {
          console.log("✅ Handover ID photo confirmed successfully");
          showToastMessage(
            "Handover ID photo confirmed! The post is now marked as completed.",
            "success"
          );
        } else {
          throw new Error(
            result?.error || "Failed to confirm handover ID photo"
          );
        }
      } else if (isClaim) {
        console.log("🔄 Confirming claim ID photo...");
        result = await handoverClaimService.confirmClaimIdPhoto(
          conversationId,
          messageId,
          user.uid
        );

        if (result && result.success) {
          console.log("✅ Claim ID photo confirmed successfully");
          showToastMessage(
            "Claim ID photo confirmed! The post is now marked as completed.",
            "success"
          );
        } else {
          throw new Error(result?.error || "Failed to confirm claim ID photo");
        }
      } else {
        console.error(
          "❌ Invalid message type for ID photo confirmation:",
          message.messageType
        );
        throw new Error("Invalid message type for ID photo confirmation");
      }

      // Clear messages and navigate back after successful confirmation
      setMessages([]);
      navigation.goBack();
    } catch (error: any) {
      console.error("Error in handleConfirmIdPhotoSuccess:", error);
      setIsConfirmationInProgress(false);

      // Handle different error scenarios
      if (
        error.message?.includes("Conversation does not exist") ||
        error.message?.includes("Message not found") ||
        error.message?.includes("already processed")
      ) {
        // Clear messages and navigate back since conversation was already deleted
        setMessages([]);
        navigation.goBack();
      } else {
        Alert.alert(
          "Confirmation Failed",
          error.message || "Failed to confirm ID photo. Please try again."
        );
      }
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
      {/* Header - Stays fixed at top */}
      <View className="bg-white border-b border-gray-200 pb-4 px-4 mt-3 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>

        {/* Profile Picture - Always show for the other participant */}
        {userData && (
          <View className="mr-3">
            <ProfilePicture
              src={getOtherParticipantProfilePicture()}
              size="sm"
            />
          </View>
        )}

        <View className="flex-1">
          <Text
            className="font-manrope-semibold text-md text-gray-800"
            numberOfLines={1}
          >
            {postTitle}
          </Text>
          <Text className="text-[12px] text-gray-500">
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
            <Text className="text-white font-manrope-semibold text-sm">
              Handover
            </Text>
          </TouchableOpacity>
        )}

        {shouldShowClaimItemButton() && (
          <TouchableOpacity
            className="ml-3 px-4 py-2 bg-blue-500 rounded-lg"
            onPress={handleClaimRequest}
          >
            <Text className="text-white font-manrope-semibold text-sm">
              Claim Item
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chat Content - Moves up with keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={{ flex: 1 }}
      >
        {/* Messages Container with Custom Spacing */}
        <View style={{ flex: 1, marginBottom: 0 }}>
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
            <View style={{ flex: 1 }}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => {
                  const renderItem = ({
                    item,
                  }: {
                    item: Message;
                    index: number;
                  }) => {
                    return (
                      <MessageBubble
                        message={item}
                        isOwnMessage={item.senderId === userData?.uid}
                        conversationId={conversationId}
                        currentUserId={userData?.uid || ""}
                        isCurrentUserPostOwner={postOwnerId === userData?.uid}
                        onHandoverResponse={handleHandoverResponse}
                        onClaimResponse={handleClaimResponse}
                        onConfirmIdPhotoSuccess={handleConfirmIdPhotoSuccess}
                        isConfirmationInProgress={isConfirmationInProgress}
                        triggerImagePicker={triggerImagePicker}
                        onImageClick={(imageUrl, altText) =>
                          setSelectedImage({ uri: imageUrl, alt: altText })
                        }
                        conversationParticipants={
                          conversationData?.participants || {}
                        }
                        isLastSeenByOthers={false}
                        fallbackProfilePicture={getOtherParticipantProfilePicture()}
                      />
                    );
                  };

                  // Check if this is the most recent message that other users have read
                  let isLastSeenByOthers = false;

                  // Find the most recent message SENT BY CURRENT USER that has been read by other users
                  for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    const readers = msg.readBy || [];
                    const otherUsersRead = readers.some(
                      (uid) => uid !== userData?.uid
                    );

                    if (otherUsersRead && msg.senderId === userData?.uid) {
                      isLastSeenByOthers = index === i;
                      break;
                    }
                  }

                  return (
                    <MessageBubble
                      message={item}
                      isOwnMessage={item.senderId === userData?.uid}
                      conversationId={conversationId}
                      currentUserId={userData?.uid || ""}
                      isCurrentUserPostOwner={postOwnerId === userData?.uid}
                      onHandoverResponse={handleHandoverResponse}
                      onClaimResponse={handleClaimResponse}
                      onConfirmIdPhotoSuccess={handleConfirmIdPhotoSuccess}
                      isConfirmationInProgress={isConfirmationInProgress}
                      triggerImagePicker={triggerImagePicker}
                      onImageClick={(imageUrl, altText) =>
                        setSelectedImage({ uri: imageUrl, alt: altText })
                      }
                      conversationParticipants={
                        conversationData?.participants || {}
                      }
                      isLastSeenByOthers={isLastSeenByOthers}
                      fallbackProfilePicture={getOtherParticipantProfilePicture()}
                    />
                  );
                }}
                contentContainerStyle={{ padding: 16, paddingBottom: 10 }}
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                keyboardShouldPersistTaps="handled"
                onLayout={handleFlatListLayout}
              />
            </View>
          )}

          {/* Spacer between messages and counter */}

          {/* Message Limit Counter */}
          <View className="border-b border-gray-200 px-4 py-2 bg-gray-100 rounded-t-lg">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[12px] text-gray-500 font-medium">
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

          {/* Input Area with bottom spacing */}
          <View
            className={`bg-white px-4 pt-2 transition-all duration-300 ${
              isKeyboardVisible ? "pb-0" : "pb-5"
            }`}
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
                  newMessage.trim() && !loading
                    ? "bg-yellow-500"
                    : "bg-gray-300"
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
        </View>
      </KeyboardAvoidingView>

      {/* Image Preview Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View className="flex-1 bg-black/90 justify-center items-center">
          {/* Close Button */}
          <TouchableOpacity
            className="absolute top-10 right-5 w-10 h-10 rounded-full bg-black/50 justify-center items-center z-30"
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          {/* Image Container */}
          <View className="w-[95%] max-h-[80%] items-center z-20">
            {selectedImage && (
              <>
                <RNImage
                  source={{ uri: selectedImage.uri }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
                <Text
                  className="text-white text-center mt-2 text-base opacity-80"
                  numberOfLines={1}
                >
                  {selectedImage.alt}
                </Text>
              </>
            )}
          </View>

          {/* Invisible dismiss area */}
          <TouchableOpacity
            className="absolute inset-0 z-10"
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
        conversationId={conversationId || ""}
      />

      {/* Enhanced Handover Modal */}
      <HandoverModal
        visible={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        onSubmit={handleHandoverRequestSubmit}
        isLoading={isHandoverSubmitting}
        postTitle={postTitle}
      />

      {/* ImagePicker Modal for ID photos */}
      {showImagePickerModal && (
        <ImagePicker
          onImageSelect={handleImagePickerSelect}
          onClose={handleImagePickerClose}
          isUploading={isImagePickerUploading}
          title="Upload ID Photo"
          description="Please provide a photo of your ID as proof that you received the item."
        />
      )}
    </SafeAreaView>
  );
}
