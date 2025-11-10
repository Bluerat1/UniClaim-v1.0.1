import PageLayout from "../../layout/PageLayout";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";

import { useAuth } from "../../context/AuthContext";
import { useUserPostsWithSet } from "../../hooks/usePosts";
import type { Post } from "../../types/type";
import { postService , messageService } from "../../utils/firebase";


import { db } from "../../utils/firebase/config";
import { collection, query, getDocs, deleteDoc, doc } from "firebase/firestore";

// Create a context for ticket view actions
const TicketViewContext = React.createContext<{
  onView: ((post: Post) => void) | null;
}>({ onView: null });

// Custom hook to use the ticket view context
export const useTicketViewContext = () => React.useContext(TicketViewContext);
import { handoverClaimService } from "../../utils/handoverClaimService";
import { notificationSender } from "../../utils/firebase/notificationSender";
import { deleteMessageImages, extractMessageImages } from "../../utils/cloudinary";
import EditTicketModal from "../../components/EditTicketModal";
import ViewTicketModal from "../../components/ViewTicketModal";
import { Ionicons } from "@expo/vector-icons";
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function Ticket() {
  const { userData, loading: authLoading } = useAuth();
  const {
    posts,
    setPosts,
    loading: postsLoading,
  } = useUserPostsWithSet(userData?.email || "");
  const [activeTab, setActiveTab] = useState<"active" | "resolved" | "deleted">(
    "active"
  );
  const [searchText, setSearchText] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [restoringPostId, setRestoringPostId] = useState<string | null>(null);
  const [permanentlyDeletingPostId, setPermanentlyDeletingPostId] = useState<
    string | null
  >(null);

  // Debounced search for better performance
  const debouncedSearchText = useDebounce(searchText, 300);

  // Modal states
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // Pause Firebase listeners when tab is not focused
  useFocusEffect(
    useCallback(() => {
      // Tab is focused - listeners are active

      return () => {
        // Tab is unfocused - listeners are paused
        console.log("Ticket tab unfocused - listeners paused");
      };
    }, [])
  );

  // Memoize filtered posts to prevent unnecessary recalculations
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesTab =
        activeTab === "active"
          ? !post.deletedAt && post.status === "pending"
          : activeTab === "resolved"
            ? !post.deletedAt && post.status === "resolved"
            : !!post.deletedAt; // Show deleted posts in the deleted tab
      const matchesSearch =
        post.title.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
        post.description
          .toLowerCase()
          .includes(debouncedSearchText.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [posts, activeTab, debouncedSearchText]);

  const handleClearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  const handleDeletePost = useCallback(
    async (id: string) => {
      Alert.alert(
        "Delete Ticket",
        "Are you sure you want to move this ticket to recently deleted? You can restore it later from the Recently Deleted tab.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Move to Recently Deleted",
            style: "destructive",
            onPress: async () => {
              try {
                setDeletingPostId(id);

                // Store the current status before soft deleting
                const postToDelete = posts.find((p: Post) => p.id === id);
                const currentStatus = postToDelete?.status || "pending";

                // Update post with deletedAt timestamp and store original status
                await postService.updatePost(id, {
                  deletedAt: new Date().toISOString(),
                  originalStatus: currentStatus,
                });

                // Update local state
                setPosts((prevPosts: Post[]) =>
                  prevPosts.map((p: Post) =>
                    p.id === id
                      ? {
                          ...p,
                          deletedAt: new Date().toISOString(),
                          originalStatus: currentStatus,
                        }
                      : p
                  )
                );

                Alert.alert(
                  "Success",
                  "Ticket has been moved to Recently Deleted."
                );
              } catch (error) {
                console.error(
                  "Error moving ticket to recently deleted:",
                  error
                );
                Alert.alert(
                  "Error",
                  "Failed to move ticket to Recently Deleted. Please try again."
                );
              } finally {
                setDeletingPostId(null);
              }
            },
          },
        ]
      );
    },
    [posts, setPosts]
  );

  const handleRestorePost = useCallback(
    async (id: string) => {
      try {
        setRestoringPostId(id);

        // Get the post to restore
        const postToRestore = posts.find((p: Post) => p.id === id);
        const originalStatus = postToRestore?.originalStatus || "pending";

        // Remove the deletedAt field and restore original status
        await postService.updatePost(id, {
          deletedAt: null,
          status: originalStatus,
          originalStatus: null,
        });

        // Update local state
        setPosts((prevPosts: Post[]) =>
          prevPosts.map((p: Post) =>
            p.id === id
              ? {
                  ...p,
                  deletedAt: undefined,
                  status: originalStatus,
                  originalStatus: undefined,
                }
              : p
          )
        );

        Alert.alert("Success", "Ticket has been restored successfully.");
      } catch (error) {
        console.error("Error restoring ticket:", error);
        Alert.alert("Error", "Failed to restore ticket. Please try again.");
      } finally {
        setRestoringPostId(null);
      }
    },
    [posts, setPosts]
  );

  // Conversation cache to reduce Firebase queries
  const conversationCache = useMemo(
    () => new Map<string, { data: any[]; timestamp: number }>(),
    []
  );
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Helper function to find all conversations for a post (with caching)
  const findConversationsForPost = useCallback(
    async (postId: string): Promise<any[]> => {
      try {
        // Check cache first
        const cached = conversationCache.get(postId);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          return cached.data;
        }

        const conversations = await messageService.getCurrentConversations(
          userData?.uid || ""
        );
        const postConversations = conversations.filter(
          (conv) => conv.postId === postId
        );

        // Cache the result
        conversationCache.set(postId, {
          data: postConversations,
          timestamp: Date.now(),
        });

        return postConversations;
      } catch (error) {
        console.error("Error finding conversations for post:", error);
        return [];
      }
    },
    [userData?.uid, conversationCache, CACHE_DURATION]
  );

  // Helper function to find pending handover/claim requests in conversations
  const findPendingRequests = useCallback(
    async (postId: string): Promise<any[]> => {
      try {
        const conversations = await findConversationsForPost(postId);
        const pendingRequests: any[] = [];

        for (const conversation of conversations) {
          try {
            // Use direct Firestore query instead of real-time listener to get ALL messages
            const { collection, query, orderBy, getDocs } = await import(
              "firebase/firestore"
            );
            const { db } = await import("@/utils/firebase/config");

            const messagesQuery = query(
              collection(db, `conversations/${conversation.id}/messages`),
              orderBy("timestamp", "asc")
            );
            const messagesSnapshot = await getDocs(messagesQuery);

            const messages = messagesSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as any[];

            // Find pending handover or claim requests
            for (const message of messages) {
              if (
                message.messageType === "handover_request" &&
                message.handoverData?.status === "pending"
              ) {
                pendingRequests.push({
                  type: "handover",
                  conversationId: conversation.id,
                  messageId: message.id,
                  messageData: message,
                });
              } else if (
                message.messageType === "claim_request" &&
                message.claimData?.status === "pending"
              ) {
                pendingRequests.push({
                  type: "claim",
                  conversationId: conversation.id,
                  messageId: message.id,
                  messageData: message,
                });
              }
            }
          } catch (error) {
            console.error(
              `Error getting messages for conversation ${conversation.id}:`,
              error
            );
          }
        }

        return pendingRequests;
      } catch (error) {
        console.error("Error finding pending requests:", error);
        return [];
      }
    },
    [findConversationsForPost]
  );

  // Helper function to auto-reject pending requests and send notifications BEFORE deleting conversations
  const autoRejectPendingRequestsWithNotifications = useCallback(
    async (postId: string): Promise<void> => {
      try {
        const pendingRequests = await findPendingRequests(postId);

        // Collect all conversation data and participants BEFORE sending notifications
        const conversationParticipants: { [conversationId: string]: string[] } =
          {};

        for (const request of pendingRequests) {
          if (!conversationParticipants[request.conversationId]) {
            try {
              const { doc, getDoc } = await import("firebase/firestore");
              const { db } = await import("../../utils/firebase/config");

              const conversationRef = doc(
                db,
                "conversations",
                request.conversationId
              );
              const conversationDoc = await getDoc(conversationRef);

              if (conversationDoc.exists()) {
                const conversationData = conversationDoc.data();
                const participantIds = Object.keys(
                  conversationData.participants || {}
                );
                conversationParticipants[request.conversationId] = participantIds;
              }
            } catch (error) {
              console.error(
                `Error getting conversation data for ${request.conversationId}:`,
                error
              );
            }
          }
        }

        // Now send notifications and reject requests
        for (const request of pendingRequests) {
          try {
            const participants =
              conversationParticipants[request.conversationId] || [];

            if (request.type === "handover") {
              await handoverClaimService.updateHandoverResponse(
                request.conversationId,
                request.messageId,
                "rejected",
                userData?.uid || ""
              );

              // Send notification to other participants
              const otherParticipants = participants.filter(
                (id) => id !== userData?.uid
              );
              if (otherParticipants.length > 0) {
                await notificationSender.sendNotificationToUsers(
                  otherParticipants,
                  {
                    type: "handover_response",
                    title: "Handover Request Rejected",
                    body: `${userData?.firstName || "Someone"} rejected your handover request.`,
                    data: {
                      conversationId: request.conversationId,
                      messageId: request.messageId,
                      postId: postId,
                      status: "rejected",
                    },
                  }
                );
              }

              console.log(`Auto-rejected handover request: ${request.messageId}`);
            } else if (request.type === "claim") {
              await handoverClaimService.updateClaimResponse(
                request.conversationId,
                request.messageId,
                "rejected",
                userData?.uid || ""
              );

              // Send notification to other participants
              const otherParticipants = participants.filter(
                (id) => id !== userData?.uid
              );
              if (otherParticipants.length > 0) {
                await notificationSender.sendNotificationToUsers(
                  otherParticipants,
                  {
                    type: "claim_response",
                    title: "Claim Request Rejected",
                    body: `${userData?.firstName || "Someone"} rejected your claim request.`,
                    data: {
                      conversationId: request.conversationId,
                      messageId: request.messageId,
                      postId: postId,
                      status: "rejected",
                    },
                  }
                );
              }

              console.log(`Auto-rejected claim request: ${request.messageId}`);
            }
          } catch (error) {
            console.error(
              `Failed to auto-reject ${request.type} request:`,
              error
            );
          }
        }

        if (pendingRequests.length > 0) {
          console.log(
            `Auto-rejected ${pendingRequests.length} pending requests for post ${postId}`
          );
        }
      } catch (error) {
        console.error("Error auto-rejecting pending requests:", error);
      }
    },
    [userData?.uid, userData?.firstName, findPendingRequests]
  );

  // Helper function to delete all conversation images from Cloudinary
  const deleteConversationImages = useCallback(
    async (postId: string): Promise<void> => {
      try {
        const conversations = await findConversationsForPost(postId);

        for (const conversation of conversations) {
          try {
            // Get all messages in the conversation
            const messages = await new Promise<any[]>((resolve) => {
              messageService.getConversationMessages(
                conversation.id,
                (messages) => {
                  resolve(messages);
                }
              );
            });

            // Collect all image URLs from messages
            const allImageUrls: string[] = [];
            for (const message of messages) {
              const messageImages = extractMessageImages(message);
              allImageUrls.push(...messageImages);
            }

            // Delete images from Cloudinary
            if (allImageUrls.length > 0) {
              const result = await deleteMessageImages(allImageUrls);
              console.log(
                `Deleted ${result.deleted.length} images for conversation ${conversation.id}`
              );
              if (result.failed.length > 0) {
                console.warn(
                  `Failed to delete ${result.failed.length} images for conversation ${conversation.id}`
                );
              }
            }
          } catch (error) {
            console.error(
              `Error processing images for conversation ${conversation.id}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error("Error deleting conversation images:", error);
      }
    },
    [findConversationsForPost]
  );

  // Helper function to delete all conversations for a post
  const deleteAllConversations = useCallback(
    async (postId: string): Promise<void> => {
      try {
        const conversations = await findConversationsForPost(postId);

        for (const conversation of conversations) {
          try {
            // Get all messages in the conversation using direct Firestore query
            const messagesQuery = query(
              collection(db, `conversations/${conversation.id}/messages`)
            );
            const messagesSnapshot = await getDocs(messagesQuery);

            console.log(
              `🗑️ Mobile: Deleting ${messagesSnapshot.docs.length} messages from conversation ${conversation.id}`
            );

            // Delete all messages directly (bypass ownership check for admin deletion)
            for (const messageDoc of messagesSnapshot.docs) {
              await deleteDoc(
                doc(
                  db,
                  `conversations/${conversation.id}/messages`,
                  messageDoc.id
                )
              );
            }

            // Then delete the conversation document
            await deleteDoc(doc(db, "conversations", conversation.id));

            console.log(
              `✅ Mobile: Conversation ${conversation.id} deleted for post ${postId}`
            );
          } catch (error) {
            console.error(
              `Error deleting conversation ${conversation.id}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error("Error deleting conversations:", error);
      }
    },
    [findConversationsForPost]
  );

  const handleDeletePermanently = useCallback(
    async (id: string) => {
      Alert.alert(
        "Delete Permanently",
        "Are you sure you want to permanently delete this ticket? This will auto-reject any pending handover or claim requests and delete all associated conversations and images.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete Permanently",
            style: "destructive",
            onPress: async () => {
              try {
                setPermanentlyDeletingPostId(id);

                // Step 1: Get all required data in parallel for better performance
                console.log(`Starting permanent deletion for post ${id}`);

                // Run all preparatory operations in parallel
                const [pendingRequests, conversations] = await Promise.all([
                  findPendingRequests(id),
                  findConversationsForPost(id),
                ]);

                // Step 2: Auto-reject pending requests with notifications (single operation for all requests)
                if (pendingRequests.length > 0) {
                  console.log(
                    `Auto-rejecting ${pendingRequests.length} pending requests for post ${id}`
                  );
                  await autoRejectPendingRequestsWithNotifications(id);
                }

                // Step 3: Delete conversation images (single operation for all conversations)
                if (conversations.length > 0) {
                  console.log(
                    `Deleting images for ${conversations.length} conversations for post ${id}`
                  );
                  await deleteConversationImages(id);
                }

                // Step 4: Delete all conversations
                if (conversations.length > 0) {
                  console.log(
                    `Deleting ${conversations.length} conversations for post ${id}`
                  );
                  await deleteAllConversations(id);
                }

                // Step 5: Finally delete the post
                console.log(`Deleting post ${id}`);
                await postService.deletePost(id);

                // The post will be automatically removed from the list by the real-time listener
                Alert.alert(
                  "Success",
                  "Ticket and all associated data have been permanently deleted."
                );
              } catch (error) {
                console.error("Error deleting ticket permanently:", error);
                Alert.alert(
                  "Error",
                  "Failed to delete ticket. Please try again."
                );
              } finally {
                setPermanentlyDeletingPostId(null);
              }
            },
          },
        ]
      );
    },
    [autoRejectPendingRequestsWithNotifications, deleteAllConversations, deleteConversationImages, findConversationsForPost, findPendingRequests]
  );

  // Ticket action handlers
  const handleViewPost = useCallback((post: Post) => {
    setViewingPost(post);
    setIsViewModalVisible(true);
  }, []);

  const handleEditPost = useCallback((post: Post) => {
    setEditingPost(post);
    setIsEditModalVisible(true);
    setIsViewModalVisible(false); // Close view modal if open
  }, []);

  const handleUpdatePost = useCallback(async (updatedPost: Post) => {
    try {
      setIsUpdatingPost(true);

      // Call Firebase service to update the post
      await postService.updatePost(updatedPost.id, updatedPost);

      // Update local state after successful update
      setPosts((prevPosts: Post[]) =>
        prevPosts.map((p: Post) => (p.id === updatedPost.id ? updatedPost : p))
      );

      // Close modal and show success message
      setIsEditModalVisible(false);
      setEditingPost(null);
      Alert.alert("Success", "Ticket updated successfully!");
    } catch (error) {
      console.error("Error updating post:", error);
      Alert.alert("Error", "Failed to update ticket. Please try again.");
    } finally {
      setIsUpdatingPost(false);
    }
  }, [setPosts]);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setEditingPost(null);
  }, []);

  const handleCloseViewModal = useCallback(() => {
    setIsViewModalVisible(false);
    setViewingPost(null);
  }, []);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <PageLayout>
        <View className="flex-1 bg-white justify-center items-center">
          <ActivityIndicator size="large" color="#0f766e" />
          <Text className="text-gray-500 mt-2 font-manrope">Loading...</Text>
        </View>
      </PageLayout>
    );
  }

  // Show error if no user data
  if (!userData) {
    return (
      <PageLayout>
        <View className="flex-1 bg-white justify-center items-center px-4">
          <Text className="text-red-500 text-center font-manrope-medium">
            Please log in to view your tickets
          </Text>
        </View>
      </PageLayout>
    );
  }

  // Create the context value
  const ticketViewContextValue = {
    onView: handleViewPost,
  };

  return (
    <TicketViewContext.Provider value={ticketViewContextValue}>
      <PageLayout>
      <View className="flex-1 bg-white">
        {/* Search Section */}
        <View className="px-4 mt-1 space-y-3">
          <View className="flex-row items-center gap-2">
            {/* Search Input */}
            <View className="flex-[1.3] bg-gray-100 border border-zinc-300 rounded-md px-3 h-[3.3rem] flex-row items-center">
              <TextInput
                className="flex-1 text-gray-800 text-[13px] leading-tight font-manrope"
                placeholder="Search a ticket"
                placeholderTextColor="#6B7280"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {/* Search Button */}
            <TouchableOpacity className="bg-yellow-500 rounded-md h-[3.3rem] px-4 justify-center items-center">
              <Text className="text-white font-manrope-medium text-base">
                Search
              </Text>
            </TouchableOpacity>

            {/* Clear Search Button */}
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={handleClearSearch}
                className="bg-red-500 rounded-md h-[3.3rem] px-4 justify-center items-center self-start"
              >
                <Ionicons name="close-outline" size={23} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Toggle Buttons for Active/Completed */}
          <View className="flex-row mt-4 gap-2">
            <TouchableOpacity
              onPress={() => setActiveTab("active")}
              className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                activeTab === "active" ? "bg-navyblue" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-base font-manrope-semibold ${
                  activeTab === "active" ? "text-white" : "text-black"
                }`}
              >
                Active Tickets
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("resolved")}
              className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                activeTab === "resolved" ? "bg-navyblue" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-base font-manrope-semibold  ${
                  activeTab === "resolved" ? "text-white" : "text-black"
                }`}
              >
                Resolved
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("deleted")}
              className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                activeTab === "deleted" ? "bg-red-500" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-base font-manrope-semibold ${
                  activeTab === "deleted" ? "text-white" : "text-black"
                }`}
              >
                Deleted
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tickets Section */}
        <ScrollView className="flex-1 px-4 mt-4">
          {postsLoading ? (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator size="large" color="#0f766e" />
              <Text className="text-gray-500 mt-2 font-manrope">
                Loading tickets...
              </Text>
            </View>
          ) : filteredPosts.length === 0 ? (
            <View className="flex-1 justify-center items-center py-20">
              <Text className="text-gray-500 text-center font-manrope-medium">
                {searchText.length > 0
                  ? "No tickets found matching your search."
                  : `No ${activeTab} tickets found.`}
              </Text>
            </View>
          ) : (
            <View className="space-y-4 pb-4">
              {filteredPosts.map((post) => (
                <TicketCard
                  key={post.id}
                  post={post}
                  onDelete={
                    activeTab !== "deleted" ? handleDeletePost : undefined
                  }
                  onRestore={
                    activeTab === "deleted" ? handleRestorePost : undefined
                  }
                  onDeletePermanently={
                    activeTab === "deleted"
                      ? handleDeletePermanently
                      : undefined
                  }
                  onEdit={activeTab !== "deleted" ? handleEditPost : undefined}
                  isDeleting={deletingPostId === post.id || restoringPostId === post.id || permanentlyDeletingPostId === post.id}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* View Ticket Modal */}
      {viewingPost && (
        <ViewTicketModal
          post={viewingPost}
          isVisible={isViewModalVisible}
          onClose={handleCloseViewModal}
          onEdit={() => handleEditPost(viewingPost)}
        />
      )}

      {/* Edit Ticket Modal */}
      {editingPost && (
        <EditTicketModal
          post={editingPost}
          isVisible={isEditModalVisible}
          onClose={handleCloseEditModal}
          onSave={handleUpdatePost}
          isSaving={isUpdatingPost}
        />
      )}
      </PageLayout>
    </TicketViewContext.Provider>
  );
}

// Ticket Card Component
interface TicketCardProps {
  post: Post;
  onDelete?: (id: string) => void;
  onEdit?: (post: Post) => void;
  onRestore?: (id: string) => void;
  onDeletePermanently?: (id: string) => void;
  isDeleting: boolean;
}

const TicketCard = ({
  post,
  onDelete,
  onEdit,
  onRestore,
  onDeletePermanently,
  isDeleting,
}: TicketCardProps) => {
  // Navigation is no longer needed as we're using the modal for viewing posts
  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-green-100";
      default:
        return "bg-yellow-100";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "text-green-700";
      default:
        return "text-yellow-700";
    }
  };

  const getCategoryBadgeStyle = (category: string) => {
    switch (category.toLowerCase()) {
      case "student essentials":
        return "bg-yellow-100 text-yellow-700";
      case "gadgets":
        return "bg-blue-100 text-blue-700";
      case "personal belongings":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "Unknown date";
    try {
      const dateObj = typeof date === "string" ? new Date(date) : date.toDate();
      return dateObj.toLocaleDateString();
    } catch {
      return "Unknown date";
    }
  };

  // Handle image source properly for React Native
  const getImageSource = (images: (string | File)[]) => {
    if (!images || images.length === 0) return null;

    const firstImage = images[0];
    if (typeof firstImage === "string") {
      // If it's already a URL (Cloudinary URL), use it directly with optimization
      const separator = firstImage.includes("?") ? "&" : "?";
      return {
        uri: `${firstImage}${separator}w=400&h=300&q=80&f=webp`,
        cache: "force-cache" as const,
      };
    }

    // If it's a File object, this shouldn't happen in mobile but handle gracefully
    return null;
  };

  const imageSource = getImageSource(post.images);

  // Get the parent component's onView function from the context
  const { onView } = useTicketViewContext();

  return (
    <View className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-4">
      {/* Clickable content area */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onView?.(post)}
      >
      {/* Image Section */}
      <View className="relative">
        {post.deletedAt && (
          <View className="absolute top-2 right-2 z-10 bg-red-500 px-2 py-1 rounded-md">
            <Text className="text-white text-xs font-manrope-bold">
              DELETED
            </Text>
          </View>
        )}
        {imageSource ? (
          <View className="w-full h-48">
            <Image
              source={imageSource}
              className="w-full h-full"
              resizeMode="cover"
              onError={() => console.log("Failed to load image:", imageSource)}
            />
          </View>
        ) : (
          <View className="w-full h-48 bg-gray-100 justify-center items-center">
            <Text className="text-gray-400 text-center font-manrope">
              No Image Available
            </Text>
          </View>
        )}
      </View>

      {/* Content Section */}
      <View className="p-4">
        {/* Title, Status and Category */}
        <View className="flex-col items-start justify-between gap-3 mb-3">
          <Text className="flex-1 font-manrope-semibold text-lg text-gray-800 leading-tight">
            {post.title}
          </Text>
          <View>
            <View className="flex-row items-center gap-2">
              <Text
                className={`px-3 py-1 rounded-sm text-[9px] font-manrope-medium ${
                  post.type === "found"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {post.type === "lost" ? "Lost" : "Keep"}
              </Text>
              <Text
                className={`px-3 py-1 rounded-sm text-[9px] font-manrope-medium ${getCategoryBadgeStyle(
                  post.category
                )}`}
              >
                {post.category}
              </Text>
              <View
                className={`px-2 py-1 text-[9px] rounded ${getStatusColor(post.status || "pending")}`}
              >
                <Text
                  className={`text-[9px] font-manrope-semibold capitalize ${getStatusTextColor(post.status || "pending")}`}
                >
                  {post.status || "pending"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description */}
        <Text className="text-gray-600 text-sm mb-3 font-manrope">
          {post.description.length > 100
            ? `${post.description.substring(0, 100)}...`
            : post.description}
        </Text>

        {/* Date */}
        <View className="mb-3">
          <Text className="text-xs text-gray-500 font-manrope">
            {formatDate(post.createdAt)}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="space-y-2">
          <View className="flex-row gap-2">
            {/* Show Edit button only for pending posts */}
            {onEdit && post.status === "pending" && (
              <TouchableOpacity
                onPress={() => onEdit(post)}
                className="flex-1 bg-blue-500 py-2 rounded-md items-center"
                disabled={isDeleting}
              >
                <Text className="text-white font-manrope-medium">Edit</Text>
              </TouchableOpacity>
            )}

            {/* Show Delete button only for pending posts that are not deleted */}
            {onDelete && !post.deletedAt && post.status !== "resolved" && (
              <TouchableOpacity
                onPress={() => onDelete(post.id)}
                className={`flex-1 py-2 rounded-md items-center ${
                  isDeleting ? "bg-gray-400" : "bg-red-500"
                }`}
                disabled={isDeleting}
              >
                <Text className="text-white font-manrope-medium">
                  {isDeleting ? "Deleting..." : "Delete"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Show Restore and Delete Permanently buttons for deleted posts */}
            {post.deletedAt && (
              <>
                <TouchableOpacity
                  onPress={() => onRestore?.(post.id)}
                  className={`flex-1 py-2 rounded-md items-center mr-1 ${
                    isDeleting ? "bg-gray-400" : "bg-green-500"
                  }`}
                  disabled={isDeleting || !onRestore}
                >
                  <Text className="text-white font-manrope-medium">
                    {isDeleting ? "Restoring..." : "Restore"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onDeletePermanently?.(post.id)}
                  className={`flex-1 py-2 rounded-md items-center ml-1 ${
                    isDeleting ? "bg-gray-400" : "bg-red-600"
                  }`}
                  disabled={isDeleting || !onDeletePermanently}
                >
                  <Text className="text-white font-manrope-medium">
                    {isDeleting ? "Deleting..." : "Delete Permanently"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Show message for resolved posts */}
            {post.status === "resolved" && (
              <View className="flex-1 py-2 rounded-md items-center bg-gray-100">
                <Text className="text-gray-600 font-manrope-medium text-center">
                  This ticket has been resolved
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      </TouchableOpacity>
    </View>
  );
};

// Remove unused RootStackParamList type as we're using the modal now
export { TicketCard };
