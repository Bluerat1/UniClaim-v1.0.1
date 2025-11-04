import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Image as RNImage,
  StyleSheet,
  View,
  TextInput,
  Platform,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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

// Debug logging utility with performance tracking
const DEBUG_ENABLED = true;
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
    markAllUnreadMessagesAsRead,
    sendClaimRequest,
    sendHandoverRequest,
    updateClaimResponse,
    confirmHandoverIdPhoto,
    confirmClaimIdPhoto,
  } = useMessage();

  const { user, userData } = useAuth();

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

  // Function to get profile picture URL from user data
  const getProfilePictureUrl = (user: any): string | null => {
    if (!user) return null;

    const pictureUrl = [
      user.photoURL,
      user.profilePicture,
      user.avatar,
      user.profilePic,
      user.image,
      user.picture,
      user.photo,
      user.profilePicUrl,
      user.profileImageUrl,
      user.profile_pic,
      user.profile_pic_url,
    ].find(Boolean);

    return pictureUrl || null;
  };

  // State for other participant's profile picture
  const [otherParticipantPic, setOtherParticipantPic] = useState<string | null>(
    null
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Effect to load other participant's profile picture - optimized to use route params first
  useEffect(() => {
    if (!userData?.uid) {
      return;
    }

    const profileStartTime = Date.now();
    debugLog("PROFILE-PIC", "📸 Profile picture loading started");

    const loadProfilePicture = async () => {
      try {
        let targetParticipantId: string | null = null;

        if (
          postOwnerUserData &&
          typeof postOwnerUserData === "object" &&
          postOwnerId !== userData.uid
        ) {
          const pictureUrl = getProfilePictureUrl(postOwnerUserData);
          if (pictureUrl) {
            const elapsed = Date.now() - profileStartTime;
            debugLog(
              "PROFILE-PIC",
              `✅ Found in postOwnerUserData (${elapsed}ms)`,
              {
                source: "route_params",
                pictureUrl: pictureUrl.substring(0, 50) + "...",
              }
            );
            setOtherParticipantPic(pictureUrl);
            return;
          }
        }

        if (conversationData?.participants) {
          const otherParticipant = Object.entries(
            conversationData.participants
          ).find(([uid]) => uid !== userData.uid);

          if (otherParticipant) {
            const [uid, participantData] = otherParticipant;
            targetParticipantId = uid;

            if (participantData && typeof participantData === "object") {
              const pictureUrl = getProfilePictureUrl(participantData);
              if (pictureUrl) {
                const elapsed = Date.now() - profileStartTime;
                debugLog(
                  "PROFILE-PIC",
                  `✅ Found in conversationData (${elapsed}ms)`,
                  {
                    source: "conversation_data",
                    pictureUrl: pictureUrl.substring(0, 50) + "...",
                  }
                );
                setOtherParticipantPic(pictureUrl);
                return;
              }
            }
          }
        }

        if (!targetParticipantId && postOwnerId && postOwnerId !== userData.uid) {
          targetParticipantId = postOwnerId;
        }

        if (targetParticipantId && !otherParticipantPic) {
          debugLog("PROFILE-PIC", "🔥 Fetching from Firestore...", {
            targetParticipantId,
          });
          setIsLoadingProfile(true);
          const firebaseStartTime = Date.now();

          const { getDoc, doc } = await import("firebase/firestore");
          const { db } = await import("../utils/firebase/config");
          const userDoc = await getDoc(doc(db, "users", targetParticipantId));

          const firebaseElapsed = Date.now() - firebaseStartTime;

          if (userDoc.exists()) {
            const userData = userDoc.data() as ParticipantData;
            const pictureUrl = getProfilePictureUrl(userData);
            if (pictureUrl) {
              const totalElapsed = Date.now() - profileStartTime;
              debugLog(
                "PROFILE-PIC",
                `✅ Found in Firestore (fetch: ${firebaseElapsed}ms, total: ${totalElapsed}ms)`,
                {
                  source: "firestore",
                  firebaseFetchTime: firebaseElapsed,
                  pictureUrl: pictureUrl.substring(0, 50) + "...",
                }
              );
              setOtherParticipantPic(pictureUrl);
            }
          } else {
            debugLog(
              "PROFILE-PIC",
              "⚠️  User document not found in Firestore",
              { targetParticipantId }
            );
          }
        }
      } catch (error) {
        debugLog("PROFILE-PIC", "❌ Error loading profile picture", {
          error: (error as Error).message,
        });
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
    otherParticipantPic,
  ]);

  // Get the other participant's ID
  const getOtherParticipantId = useCallback(() => {
    if (!userData?.uid || !conversationData?.participants) return null;

    const otherParticipant = Object.entries(
      conversationData.participants || {}
    ).find(([uid]) => uid !== userData.uid);

    return otherParticipant?.[0] || null;
  }, [userData, conversationData]);

  const otherParticipantId = getOtherParticipantId();

  // Get the other participant's profile picture (exclude current user)
  const getOtherParticipantProfilePicture = useCallback(() => {
    // First try the pre-fetched profile picture
    if (otherParticipantPic) {
      return otherParticipantPic;
    }

    // Fallback to post owner data if available
    if (postOwnerUserData) {
      return (
        postOwnerUserData.photoURL ||
        postOwnerUserData.profilePicture ||
        postOwnerUserData.avatar ||
        postOwnerUserData.profilePic ||
        postOwnerUserData.image ||
        postOwnerUserData.picture ||
        postOwnerUserData.photo ||
        postOwnerUserData.profilePicUrl ||
        postOwnerUserData.profileImageUrl ||
        postOwnerUserData.profile_pic ||
        postOwnerUserData.profile_pic_url ||
        null
      );
    }

    return null;
  }, [otherParticipantPic, postOwnerUserData]);

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
    const createConvStartTime = Date.now();
    debugLog("CREATE-CONV", "🆕 Creating new conversation", {
      postId,
      postOwnerId,
    });

    const createNewConversation = async () => {
      try {
        setLoading(true);

        // Double-check that conversation doesn't exist before creating
        debugLog("CREATE-CONV", "🔍 Checking for existing conversation");
        const existingConversation = await getConversation(
          conversationId || "dummy"
        );

        if (!isMounted) return; // Component was unmounted

        if (existingConversation) {
          debugLog(
            "CREATE-CONV",
            "⚠️  Existing conversation found, skipping creation"
          );
          setLoading(false);
          return;
        }

        debugLog(
          "CREATE-CONV",
          "📝 No existing conversation, creating new one"
        );
        const createStartTime = Date.now();

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

        const createElapsed = Date.now() - createStartTime;
        const totalElapsed = Date.now() - createConvStartTime;
        debugLog(
          "CREATE-CONV",
          `✅ Conversation created (create: ${createElapsed}ms, total: ${totalElapsed}ms)`,
          {
            conversationId: newConversationId,
          }
        );

        if (!isMounted) return; // Component was unmounted

        setConversationId(newConversationId);
      } catch (error: any) {
        const errorElapsed = Date.now() - createConvStartTime;
        debugLog(
          "CREATE-CONV",
          `❌ Error creating conversation (${errorElapsed}ms)`,
          { error: error.message }
        );
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
    const conversationLoadStartTime = Date.now();
    debugLog("CONVERSATION", "📋 Loading conversation data", {
      conversationId: initialConversationId,
    });

    const loadConversationData = async () => {
      try {
        // Mark messages as read first (critical path)
        if (user?.uid) {
          const markReadStartTime = Date.now();
          debugLog("MESSAGES", "📍 Marking messages as read (critical path)");
          await markAllUnreadMessagesAsRead(initialConversationId, user.uid);
          const markReadElapsed = Date.now() - markReadStartTime;
          debugLog("MESSAGES", `✅ Marked as read (${markReadElapsed}ms)`);
        }

        // Defer loading conversation data to avoid blocking UI
        // Use a small delay to allow messages to start loading first
        setTimeout(async () => {
          if (!isMounted) return;

          const deferred = Date.now() - conversationLoadStartTime;
          debugLog(
            "CONVERSATION",
            `⏱️  Deferred loading starting (deferred by ${deferred}ms)`
          );

          try {
            const dataLoadStartTime = Date.now();
            const conversationData = await getConversation(
              initialConversationId
            );
            const dataLoadElapsed = Date.now() - dataLoadStartTime;

            if (isMounted && conversationData) {
              debugLog(
                "CONVERSATION",
                `✅ Data loaded (${dataLoadElapsed}ms)`,
                {
                  hasParticipants: !!conversationData.participants,
                  postType: conversationData.postType,
                  postStatus: conversationData.postStatus,
                }
              );
              setConversationData(conversationData);
            }
          } catch (error) {
            debugLog("CONVERSATION", "❌ Error loading conversation data", {
              error: (error as Error).message,
            });
            console.error("Error loading conversation data:", error);
            // Don't show error for conversation data fetch as it's not critical
          }
        }, 100);
      } catch (error) {
        debugLog("MESSAGES", "❌ Error marking messages as read", {
          error: (error as Error).message,
        });
        console.error("Error marking messages as read:", error);
      }
    };

    loadConversationData();

    return () => {
      isMounted = false;
    };
  }, [
    initialConversationId,
    user?.uid,
    // Note: getConversation and markAllUnreadMessagesAsRead are now memoized with useCallback
    // in MessageContext, so they have stable references and don't need to be dependencies.
    // This prevents the effect from re-running unnecessarily after every render.
  ]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let isActive = true; // Track if this effect is still active
    const messagesLoadStartTime = Date.now();
    debugLog("MESSAGES", "💬 Setting up message listener", { conversationId });

    const unsubscribe = getConversationMessages(
      conversationId,
      (loadedMessages) => {
        // Only process if this effect is still active (not cleaned up)
        if (!isActive) {
          return;
        }

        const messagesLoadElapsed = Date.now() - messagesLoadStartTime;
        debugLog(
          "MESSAGES",
          `📨 Received messages (${messagesLoadElapsed}ms)`,
          {
            messageCount: loadedMessages.length,
            oldestMessage: loadedMessages[0]?.timestamp,
            newestMessage: loadedMessages[loadedMessages.length - 1]?.timestamp,
          }
        );

        setMessages(loadedMessages);
        setLoading(false); // Clear loading state when messages are received

        // Skip animated scroll if this is just confirming our sent message
        if (
          justSentRef.current &&
          loadedMessages.length === justSentMessageCount
        ) {
          debugLog("MESSAGES", "⏭️  Skipping scroll (just sent message)");
          return;
        }

        // Scroll to bottom when messages are loaded (for any number of messages)
        if (isFlatListReady) {
          debugLog("MESSAGES", "📜 Scrolling to bottom");
          // Clear any pending timeouts to prevent multiple animations
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }

          scrollTimeoutRef.current = setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
            scrollTimeoutRef.current = null;
            debugLog("MESSAGES", "✅ Scroll complete");
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
        userData.profilePicture
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
      const { cloudinaryService } = await import("../utils/cloudinary");
      const photoUrl = await cloudinaryService.uploadImage(
        photoUri,
        "id_photos"
      );

      if (imagePickerMessageType === "handover_request") {
        // For handover, first accept the request, then update with photo
        await handleHandoverResponse(imagePickerMessageId, "accepted");
        // Update the message with the ID photo URL using the same pattern as claim
        await updateClaimResponse(
          conversationId,
          imagePickerMessageId,
          "accepted",
          user.uid,
          photoUrl
        );
      } else if (imagePickerMessageType === "claim_request") {
        await handleClaimResponse(imagePickerMessageId, "accepted", photoUrl);
      }

      setShowImagePickerModal(false);
      setImagePickerMessageId("");
      setImagePickerMessageType("handover_request");
    } catch (error) {
      console.error("Error uploading ID photo:", error);
      Alert.alert("Error", "Failed to upload ID photo. Please try again.");
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

    // Get the message data before trying to confirm
    const message = messages.find((m) => m.id === messageId);
    if (!message) {
      setIsConfirmationInProgress(false);
      // If message is not found, conversation might already be deleted, just navigate back
      navigation.goBack();
      return;
    }

    try {
      if (message.messageType === "handover_request") {
        await confirmHandoverIdPhoto(conversationId, messageId, user.uid);
        showToastMessage(
          "Handover ID photo confirmed! The post is now marked as completed.",
          "success"
        );
      } else if (message.messageType === "claim_request") {
        await confirmClaimIdPhoto(conversationId, messageId, user.uid);
        showToastMessage(
          "Claim ID photo confirmed! The post is now marked as completed.",
          "success"
        );
      }

      // Clear messages and navigate back after successful confirmation
      setMessages([]);
      navigation.goBack();
    } catch (error: any) {
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
        Alert.alert("Error", "Failed to confirm ID photo. Please try again.");
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
            className={`bg-white px-4 pt-2 ${
              isKeyboardVisible ? "pb-0" : "pb-16"
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
