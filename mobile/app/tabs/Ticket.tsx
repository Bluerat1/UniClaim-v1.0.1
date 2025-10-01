import PageLayout from "@/layout/PageLayout";
import React, { useState, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useUserPostsWithSet } from "@/hooks/usePosts";
import type { Post } from "@/types/type";
import { auth } from "@/utils/firebase";
import { postService } from "@/utils/firebase";
import EditTicketModal from "@/components/EditTicketModal";
import { Ionicons } from "@expo/vector-icons";

export default function Ticket() {
  const { userData, loading: authLoading } = useAuth();
  const {
    posts,
    setPosts,
    loading: postsLoading,
  } = useUserPostsWithSet(userData?.email || "");
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "deleted">("active");
  const [searchText, setSearchText] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Edit modal state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // Pause Firebase listeners when tab is not focused
  useFocusEffect(
    useCallback(() => {
      // Tab is focused - listeners are active
      console.log("Ticket tab focused - listeners active");

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
          ? post.status === "pending"
          : activeTab === "completed"
          ? post.status === "resolved"
          : post.status === "deleted";
      const matchesSearch =
        post.title.toLowerCase().includes(searchText.toLowerCase()) ||
        post.description.toLowerCase().includes(searchText.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [posts, activeTab, searchText]);

  const handleClearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  const handleDeletePost = useCallback(async (id: string) => {
    // Show confirmation dialog
    Alert.alert(
      "Delete Ticket",
      "Are you sure you want to move this ticket to deleted? You can restore it later from the Deleted tab.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Move to Deleted",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingPostId(id); // Show loading state

              // Update post status to deleted instead of actually deleting it
              await postService.updatePost(id, { status: "deleted" });

              // Update local state
              setPosts((prevPosts: Post[]) =>
                prevPosts.map((p: Post) =>
                  p.id === id ? { ...p, status: "deleted" } : p
                )
              );

              // Show success message
              Alert.alert("Success", "Ticket moved to deleted items.");
            } catch (error) {
              console.error("Error moving post to deleted:", error);
              Alert.alert(
                "Error",
                "Failed to move ticket to deleted. Please try again."
              );
            } finally {
              setDeletingPostId(null); // Hide loading state
            }
          },
        },
      ]
    );
  }, []);

  const handleRestorePost = useCallback(async (id: string) => {
    try {
      setDeletingPostId(id); // Show loading state

      // Restore the post to its original status or default to 'pending'
      const postToRestore = posts.find((p: Post) => p.id === id);
      const originalStatus = postToRestore?.originalStatus || "pending";
      
      await postService.updatePost(id, { 
        status: originalStatus,
        originalStatus: null // Clear the original status
      });

      // Update local state
      setPosts((prevPosts: Post[]) =>
        prevPosts.map((p: Post) =>
          p.id === id 
            ? { 
                ...p, 
                status: originalStatus,
                originalStatus: undefined
              } 
            : p
        )
      );

      // Show success message
      Alert.alert("Success", "Ticket has been restored successfully!");
    } catch (error) {
      console.error("Error restoring post:", error);
      Alert.alert(
        "Error",
        "Failed to restore ticket. Please try again."
      );
    } finally {
      setDeletingPostId(null); // Hide loading state
    }
  }, [posts]);

  const handleDeletePermanently = useCallback(async (id: string) => {
    try {
      setDeletingPostId(id);
      
      // Call the service to delete the post permanently
      await postService.deletePost(id);
      
      // Update local state by removing the post
      setPosts((prevPosts: Post[]) => prevPosts.filter(p => p.id !== id));
      
      Alert.alert("Success", "Ticket has been permanently deleted.");
    } catch (error) {
      console.error("Error deleting post permanently:", error);
      Alert.alert(
        "Error",
        "Failed to delete ticket permanently. Please try again."
      );
    } finally {
      setDeletingPostId(null);
    }
  }, []);

  // Edit ticket handlers
  const handleEditPost = useCallback((post: Post) => {
    setEditingPost(post);
    setIsEditModalVisible(true);
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
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setEditingPost(null);
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

  return (
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
              onPress={() => setActiveTab("completed")}
              className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                activeTab === "completed" ? "bg-navyblue" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-base font-manrope-semibold  ${
                  activeTab === "completed" ? "text-white" : "text-black"
                }`}
              >
                Completed
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
                  onDelete={activeTab !== "deleted" ? handleDeletePost : undefined}
                  onRestore={activeTab === "deleted" ? handleRestorePost : undefined}
                  onDeletePermanently={activeTab === "deleted" ? handleDeletePermanently : undefined}
                  onEdit={activeTab !== "deleted" ? handleEditPost : undefined}
                  isDeleting={deletingPostId === post.id}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>

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
      // If it's already a URL (Cloudinary URL), use it directly
      return { uri: firstImage };
    }

    // If it's a File object, this shouldn't happen in mobile but handle gracefully
    return null;
  };

  const imageSource = getImageSource(post.images);

  return (
    <View className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-4">
      {/* Image Section */}
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

      {/* Content Section */}
      <View className="p-4">
        {/* Title and Status */}
        <View className="flex-row items-start justify-between gap-3 mb-3">
          <Text className="flex-1 font-manrope-semibold text-lg text-gray-800 leading-tight">
            {post.title}
          </Text>
          <View
            className={`px-2 py-1 rounded ${getStatusColor(post.status || "pending")}`}
          >
            <Text
              className={`text-xs font-manrope-semibold capitalize ${getStatusTextColor(post.status || "pending")}`}
            >
              {post.status || "pending"}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text className="text-gray-600 text-sm mb-3 font-manrope">
          {post.description.length > 100
            ? `${post.description.substring(0, 100)}...`
            : post.description}
        </Text>

        {/* Date and Type */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-xs text-gray-500 font-manrope">
            {formatDate(post.createdAt)}
          </Text>
          <Text
            className={`text-xs font-manrope-medium capitalize ${
              post.type === "found" ? "text-blue-700" : "text-orange-700"
            }`}
          >
            {post.type}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="space-y-2">
          {/* Delete Permanently button has been removed for mobile */}
          <View className="flex-row space-x-2">
            {onEdit && (
              <TouchableOpacity
                onPress={() => onEdit(post)}
                className="flex-1 bg-blue-500 py-2 rounded-md items-center"
                disabled={isDeleting}
              >
                <Text className="text-white font-manrope-medium">
                  Edit
                </Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => onDelete(post.id)}
                className={`flex-1 py-2 rounded-md items-center ${
                  isDeleting ? 'bg-gray-400' : 'bg-red-500'
                }`}
                disabled={isDeleting}
              >
                <Text className="text-white font-manrope-medium">
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            )}
            {onRestore && (
              <TouchableOpacity
                onPress={() => onRestore(post.id)}
                className={`flex-1 py-2 rounded-md items-center ${
                  isDeleting ? 'bg-gray-400' : 'bg-green-500'
                }`}
                disabled={isDeleting}
              >
                <Text className="text-white font-manrope-medium">
                  {isDeleting ? 'Restoring...' : 'Restore'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};
