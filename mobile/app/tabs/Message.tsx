import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  SafeAreaView,
  Text,
  FlatList,
  TouchableOpacity,
  View,
  ActivityIndicator,
 Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { doc, updateDoc, getDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../utils/firebase/config";
import { getProfilePictureUrl } from "../../utils/profileUtils";
import PageLayout from "../../layout/PageLayout";
import { useMessage } from "../../context/MessageContext";
import { useAuth } from "../../context/AuthContext";
import ProfilePicture from "../../components/ProfilePicture";
import type { Conversation, RootStackParamList } from "../../types/type";

type MessageNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Message"
>;

// Debug logging utility
const DEBUG_ENABLED = true; // Enable debug logging for profile picture issues
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
    `\n[MESSAGE-PERF:${timestamp}] ${section.padEnd(25)} | ${message}`,
    data ? data : ""
  );
};


const ConversationItem = React.memo(
  ({
    conversation,
    onPress,
    onDelete,
  }: {
    conversation: Conversation;
    onPress: () => void;
    onDelete: (conversationId: string) => Promise<void>;
  }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleDelete = async () => {
      try {
        setIsDeleting(true);
        await onDelete(conversation.id);
      } catch (error) {
        console.error('Error deleting conversation:', error);
        Alert.alert('Error', 'Failed to delete conversation. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    };
    
    const showDeleteConfirmation = () => {
      Alert.alert(
        'Delete Conversation',
        'Are you sure you want to delete this conversation? This action cannot be undone.',
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => console.log('Delete cancelled')
          },
          { 
            text: 'Delete', 
            onPress: handleDelete, 
            style: 'destructive' 
          },
        ]
      );
    };
    const { userData } = useAuth();
    const { listenToParticipantProfile } = useMessage();
    const profileUnsubscribeRef = useRef<(() => void) | null>(null);
    const currentParticipantIdRef = useRef<string | null>(null);

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

    // Participant name state
    const [participantName, setParticipantName] =
      useState<string>("Loading...");

    const [otherParticipantPic, setOtherParticipantPic] = useState<string | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Get the other participant's ID
    const otherParticipantId = useMemo(() => {
      if (!userData?.uid) return null;

      if (Array.isArray(conversation.participantIds)) {
        const fromParticipantIds = conversation.participantIds.find(
          (id) => id !== userData.uid
        );
        if (fromParticipantIds) {
          return fromParticipantIds;
        }
      }

      if (conversation.participants) {
        const fromParticipants = Object.keys(conversation.participants).find(
          (id) => id !== userData.uid
        );
        if (fromParticipants) {
          return fromParticipants;
        }
      }

      return null;
    }, [conversation.participantIds, conversation.participants, userData?.uid]);

    // Effect to load and subscribe to the other participant's profile picture
    useEffect(() => {
      if (!otherParticipantId) {
        currentParticipantIdRef.current = null;
        setOtherParticipantPic(null);
        profileUnsubscribeRef.current?.();
        profileUnsubscribeRef.current = null;
        return;
      }

      currentParticipantIdRef.current = otherParticipantId;
      setOtherParticipantPic(null);
      profileUnsubscribeRef.current?.();

      profileUnsubscribeRef.current = listenToParticipantProfile(
        otherParticipantId,
        (participant) => {
          if (currentParticipantIdRef.current !== otherParticipantId) {
            return;
          }

          const pictureUrl = getProfilePictureUrl(participant);
          setOtherParticipantPic(pictureUrl || null);
        }
      );

      return () => {
        profileUnsubscribeRef.current?.();
        profileUnsubscribeRef.current = null;
      };
    }, [otherParticipantId, listenToParticipantProfile]);

    // Get the other participant's profile picture (exclude current user)
    const getOtherParticipantProfilePicture = useCallback((): string | null => {
      return otherParticipantPic;
    }, [otherParticipantPic]);

    // Function to fetch user data from Firestore with timeout
    const fetchUserData = useCallback(
      async (userId: string) => {
        if (!userId) {
          setParticipantName("Unknown User");
          return;
        }

        try {
          // Check if participant data is just a boolean
          const participant = conversation.participants?.[userId] as any;
          if (participant === true) {
            const userRef = doc(db, "users", userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
              const userData = userDoc.data();

              // Get the best available name
              const name = [
                userData.displayName,
                userData.name,
                userData.firstName && userData.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : null,
                userData.firstName,
                userData.lastName,
                userData.email?.split("@")[0],
                "User",
              ].find(Boolean) as string;

              setParticipantName(name);

              // Defer conversation update to avoid blocking UI
              timeoutRef.current = setTimeout(async () => {
                try {
                  await updateDoc(doc(db, "conversations", conversation.id), {
                    [`participants.${userId}`]: {
                      displayName: name,
                      photoURL: getProfilePictureUrl(userData),
                      email: userData.email,
                      participantIds: arrayUnion(userId),
                    },
                  });
                } catch (updateError) {
                  // Silently fail for update - it's not critical
                }
              }, 2000);

              // Set profile picture using the utility function
              const pictureUrl = getProfilePictureUrl(userData);
              if (currentParticipantIdRef.current === userId) {
                setOtherParticipantPic(pictureUrl);
              }
            } else {
              // If user document doesn't exist, try to get name from participant data
              const participant = conversation.participants?.[userId];

              if (participant && typeof participant === "object") {
                const p = participant as any;
                const fallbackName = [
                  p.displayName,
                  p.name,
                  p.firstName || p.lastName
                    ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
                    : null,
                  p.firstName,
                  p.lastName,
                  p.email?.split("@")[0],
                  "User",
                ].find(Boolean) as string;

                setParticipantName(fallbackName);
              } else {
                setParticipantName("User");
              }
              setOtherParticipantPic(null);
            }
          } else {
            // Original fetch logic for non-boolean participants
            const userRef = doc(db, "users", userId);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
              const userData = userDoc.data();
              const name = [
                userData.displayName,
                userData.name,
                userData.firstName && userData.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : null,
                userData.firstName,
                userData.lastName,
                userData.email?.split("@")[0],
                "User",
              ].find(Boolean) as string;

              setParticipantName(name);

              const pictureUrl = getProfilePictureUrl(userData);
              if (currentParticipantIdRef.current === userId) {
                setOtherParticipantPic(pictureUrl || null);
              }
            } else {
              // If user document doesn't exist, try to get name from participant data
              const participant = conversation.participants?.[userId];

              if (participant && typeof participant === "object") {
                const p = participant as any;
                const fallbackName = [
                  p.displayName,
                  p.name,
                  p.firstName || p.lastName
                    ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
                    : null,
                  p.firstName,
                  p.lastName,
                  p.email?.split("@")[0],
                  "User",
                ].find(Boolean) as string;

                setParticipantName(fallbackName);
              } else {
                setParticipantName("User");
              }
              setOtherParticipantPic(null);
            }
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setParticipantName("User");
          setOtherParticipantPic(null);
        }
      },
      [conversation.id, conversation.participants]
    );

    // Function to get the best available name from participant data
    const getParticipantName = useCallback(
      (participantData: any, userId: string): string => {
        if (!participantData) return "User";

        // If participantData is a boolean (old format), we need to fetch the user data
        if (typeof participantData === "boolean") {
          fetchUserData(userId);
          return "Loading...";
        }

        // Try to get the best available name from participant data
        const p = participantData as Record<string, any>;
        const name = [
          p?.displayName,
          p?.name,
          p?.firstName || p?.lastName
            ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
            : null,
          p?.firstName,
          p?.lastName,
          p?.email?.split("@")[0],
          "User",
        ].find(Boolean) as string;

        return name || "User";
      },
      [fetchUserData]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    // Effect to handle participant data and update name/picture
    useEffect(() => {
      if (!otherParticipantId) {
        setParticipantName("User");
        setOtherParticipantPic(null);
        return;
      }

      const participantData = conversation.participants?.[otherParticipantId];

      if (!participantData) {
        fetchUserData(otherParticipantId);
        return;
      }

      const name = getParticipantName(participantData, otherParticipantId);
      setParticipantName(name);

      if (typeof participantData === "boolean") {
        fetchUserData(otherParticipantId);
        return;
      }
    }, [
      conversation.participants,
      otherParticipantId,
      fetchUserData,
      getParticipantName,
    ]);

    const lastMessageSenderName = useMemo(() => {
      if (!conversation.lastMessage?.senderId || !userData) {
        return "Unknown User";
      }

      // If the sender is the current user
      if (conversation.lastMessage.senderId === userData.uid) {
        return "You";
      }

      // Find the sender in participants
      const sender = Object.entries(conversation.participants || {}).find(
        ([uid]) => uid === conversation.lastMessage?.senderId
      );

      if (sender && sender[1]) {
        const participantData = sender[1];

        // If participant data is just a boolean, we need to fetch the full user data
        if (typeof participantData === "boolean") {
          fetchUserData(sender[0]);
          return "Loading...";
        }

        // Otherwise, try to get the best available name
        const p = participantData as Record<string, any>;
        const name = [
          p?.displayName,
          p?.name,
          p?.firstName || p?.lastName
            ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
            : null,
          p?.firstName,
          p?.lastName,
          p?.email?.split("@")[0],
        ].find(Boolean) as string | undefined;

        if (name) return name;

        // If we couldn't find a name, try to fetch the user data
        fetchUserData(sender[0]);
        return "Loading...";
      }

      // If we can't find the sender in participants, try to fetch their data
      if (conversation.lastMessage?.senderId) {
        fetchUserData(conversation.lastMessage.senderId);
      }

      return "Loading...";
    }, [
      conversation.lastMessage?.senderId,
      conversation.participants,
      userData,
      fetchUserData,
    ]);

    const formattedTime = useMemo(
      () => formatTime(conversation.lastMessage?.timestamp),
      [formatTime, conversation.lastMessage?.timestamp]
    );
    const unreadCount = useMemo(
      () => conversation.unreadCounts?.[userData?.uid || ""] || 0,
      [conversation.unreadCounts, userData?.uid]
    );

    return (
      <View className="bg-white border-b border-gray-200">
        <TouchableOpacity
          onPress={onPress}
          className="p-4"
        >
        <View className="flex-row items-start">
          {/* Profile Picture */}
          <View className="mr-3">
            <ProfilePicture 
              src={getOtherParticipantProfilePicture()} 
              size="md" 
            />
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
                    className={`px-2 py-1 rounded-full ${
                      conversation.postType === "found"
                        ? "bg-green-100"
                        : "bg-orange-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        conversation.postType === "found"
                          ? "text-green-800"
                          : "text-orange-800"
                      }`}
                    >
                      {conversation.postType === "found" ? "FOUND" : "LOST"}
                    </Text>
                  </View>
                </View>
                <Text
                  className="text-gray-500 font-manrope-medium text-xs mt-1"
                  numberOfLines={1}
                >
                  {participantName}
                </Text>
                <Text
                  className={`text-sm mt-2 font-inter ${
                    unreadCount > 0
                      ? "font-bold text-gray-800"
                      : "text-gray-600"
                  }`}
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
              <View className="ml-2 items-end">
                <View className="flex-row items-center">
                  <TouchableOpacity 
                    onPress={(e) => {
                      e.stopPropagation();
                      showDeleteConfirmation();
                    }}
                    disabled={isDeleting}
                    className="p-2 -mr-2"
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                  <Text className="text-gray-500 text-xs font-manrope">
                    {formattedTime}
                  </Text>
                </View>
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
      </View>
    );
  }
);

ConversationItem.displayName = "ConversationItem";

export default function Message() {
  const navigation = useNavigation<MessageNavigationProp>();
  const {
    conversations,
    refreshConversations,
    markConversationAsRead,
    deleteConversation: deleteConversationInContext,
  } = useMessage();
  const { userData } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleConversationPress = useCallback(
    (conversation: Conversation) => {
      const pressStartTime = Date.now();
      debugLog("ITEM-PRESS", "👆 Conversation tapped", {
        conversationId: conversation.id,
        postTitle: conversation.postTitle,
        postCreatorId: conversation.postCreatorId,
      });

      if (userData?.uid) {
        const markReadStartTime = Date.now();
        debugLog("ITEM-PRESS", "📍 Marking conversation as read");
        markConversationAsRead(conversation.id, userData.uid)
          .then(() => {
            const markReadElapsed = Date.now() - markReadStartTime;
            debugLog("ITEM-PRESS", `✅ Marked as read (${markReadElapsed}ms)`);
          })
          .catch((error: Error) => {
            debugLog("ITEM-PRESS", "❌ Failed to mark conversation as read", {
              error: error.message,
            });
          });
      }

      const postOwnerData =
        conversation.participants?.[conversation.postCreatorId] || {};
      const navigateStartTime = Date.now();
      debugLog("ITEM-PRESS", "🚀 Navigating to Chat screen", {
        hasPostOwnerData:
          !!postOwnerData && Object.keys(postOwnerData).length > 0,
      });

      navigation.navigate("Chat", {
        conversationId: conversation.id,
        postTitle: conversation.postTitle,
        postOwnerId: conversation.postCreatorId,
        postId: conversation.postId,
        postOwnerUserData: postOwnerData,
        postType: conversation.postType,
        postStatus: conversation.postStatus,
        foundAction: conversation.foundAction,
      });

      const totalElapsed = Date.now() - pressStartTime;
      debugLog("ITEM-PRESS", `✅ Navigation initiated (${totalElapsed}ms)`);
    },
    [userData?.uid, markConversationAsRead, navigation]
  );

  const handleDeleteConversation = async (conversationId: string) => {
    if (!userData?.uid) return;
    
    try {
      setIsDeleting(true);
      await deleteConversationInContext(conversationId, userData.uid);
      // No need to check success/error here as the MessageContext will handle the state update
    } catch (error) {
      console.error('Error in handleDeleteConversation:', error);
      Alert.alert('Error', 'An unexpected error occurred while deleting the conversation');
    } finally {
      setIsDeleting(false);
    }
  };

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

  // Set loading to false after initial load
  useEffect(() => {
    if (conversations.length > 0) {
      setIsLoading(false);
    } else {
      // If no conversations but we've finished loading, set loading to false
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [conversations]);

  if (isLoading) {
    return (
      <PageLayout>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </PageLayout>
    );
  }

  if (conversations.length === 0) {
    return (
      <PageLayout>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 text-center">
            No conversations yet.{"\n"}Start a conversation by contacting
            someone about their post!
          </Text>
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SafeAreaView className="flex-1 bg-gray-50">
        {isLoading ? (
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
            renderItem={({ item: conversation }) => (
              <ConversationItem
                conversation={conversation}
                onPress={() => handleConversationPress(conversation)}
                onDelete={() => handleDeleteConversation(conversation.id)}
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
