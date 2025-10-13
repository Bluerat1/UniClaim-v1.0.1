import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Post } from "@/types/Post";

// components
import AdminPostCard from "@/components/AdminPostCard";
import PostModal from "@/components/PostModal";
import TicketModal from "@/components/TicketModal";
import TurnoverConfirmationModal from "@/components/TurnoverConfirmationModal";
import MobileNavText from "@/components/NavHeadComp";
import SearchBar from "../../components/SearchBar";

// hooks
import { useAdminPosts, useResolvedPosts } from "@/hooks/usePosts";
import { useToast } from "@/context/ToastContext";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useAuth } from "@/context/AuthContext";

import { notificationSender } from "../../services/firebase/notificationSender";

export default function AdminHomePage() {
  function fuzzyMatch(text: string, query: string): boolean {
    const cleanedText = text.toLowerCase();
    const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

    // Make sure every keyword appears in the text
    return queryWords.every((word) => cleanedText.includes(word));
  }

  // ✅ Use the custom hooks for real-time posts (admin version includes turnover items)
  const { posts = [], loading, error } = useAdminPosts();
  const {
    posts: resolvedPosts = [],
    loading: resolvedLoading,
    error: resolvedError,
  } = useResolvedPosts();
  const { showToast } = useToast();
  const { userData } = useAuth();

  // Refs for tracking if this is the initial load
  const initialLoad = useRef(true);

  // State for deleted posts
  const [deletedPosts, setDeletedPosts] = useState<Post[]>([]);
  const [deletedPostsLoading, setDeletedPostsLoading] = useState(false);
  const [deletedPostsError, setDeletedPostsError] = useState<string | null>(
    null
  );
  const [deletedPostsCount, setDeletedPostsCount] = useState(0);

  const [viewType, setViewType] = useState<
    | "all"
    | "lost"
    | "found"
    | "unclaimed"
    | "completed"
    | "turnover"
    | "flagged"
    | "deleted"
  >("all");
  const [rawResults, setRawResults] = useState<Post[] | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastDescriptionKeyword, setLastDescriptionKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);

  // Turnover confirmation modal state
  const [showTurnoverModal, setShowTurnoverModal] = useState(false);
  const [postToConfirm, setPostToConfirm] = useState<Post | null>(null);
  const [confirmationType, setConfirmationType] = useState<
    "confirmed" | "not_received" | null
  >(null);

  // Edit modal state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // e modify rani siya sa backend django
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  // e change dari pila ka post mu appear pag scroll down
  const itemsPerPage = 6; // Increased from 2 to 6 for better scroll experience

  // Admin functionality handlers
  const handleDeletePost = (post: Post) => {
    setPostToDelete(post);
    setShowDeleteModal(true);
  };

  const moveToDeleted = useCallback(async () => {
    if (!postToDelete) return;

    try {
      setDeletingPostId(postToDelete.id);
      const { postService } = await import("../../services/firebase/posts");

      // Move to deleted (soft delete)
      await postService.deletePost(
        postToDelete.id,
        false,
        userData?.email || "admin"
      );

      showToast(
        "success",
        "Post Moved",
        "Post has been moved to Recently Deleted"
      );
      setShowDeleteModal(false);
      setPostToDelete(null);

      // Refresh the posts list
      if (viewType === "deleted") {
        fetchDeletedPosts();
      }

      // Update the deleted posts count (always update, regardless of current view)
      fetchDeletedPostsCount();
    } catch (error: any) {
      console.error("Error moving post to deleted:", error);
      showToast(
        "error",
        "Error",
        error.message || "Failed to move post to deleted"
      );
    } finally {
      setDeletingPostId(null);
    }
  }, [postToDelete, userData?.email, viewType, showToast]);

  // Fetch deleted posts count only (more efficient for counter)
  const fetchDeletedPostsCount = useCallback(async () => {
    try {
      const { postService } = await import("../../services/firebase/posts");
      const count = await postService.getDeletedPostsCount();
      setDeletedPostsCount(count);
    } catch (error: any) {
      console.error("Error fetching deleted posts count:", error);
      // Don't show toast for count errors as it's not critical
    }
  }, []);

  // Fetch deleted posts
  const fetchDeletedPosts = useCallback(async () => {
    if (viewType !== "deleted") return;

    try {
      setDeletedPostsLoading(true);
      setDeletedPostsError(null);
      const { postService } = await import("../../services/firebase/posts");
      const deleted = await postService.getDeletedPosts();
      setDeletedPosts(deleted);
    } catch (error: any) {
      console.error("Error fetching deleted posts:", error);
      setDeletedPostsError(error.message || "Failed to load deleted posts");
      showToast("error", "Error", "Failed to load deleted posts");
      throw error;
    } finally {
      setDeletedPostsLoading(false);
    }
  }, [showToast, viewType]);

  const confirmDelete = useCallback(async () => {
    if (!postToDelete) return;

    try {
      setDeletingPostId(postToDelete.id);
      const { postService } = await import("../../services/firebase/posts");

      // Permanently delete
      await postService.deletePost(
        postToDelete.id,
        true,
        userData?.email || "admin"
      );

      showToast("success", "Post Deleted", "Post has been permanently deleted");
      setShowDeleteModal(false);
      setPostToDelete(null);

      // Refresh the deleted posts list if we're in the deleted view
      if (viewType === "deleted") {
        fetchDeletedPosts();
      }
    } catch (error: any) {
      console.error("Error permanently deleting post:", error);
      showToast(
        "error",
        "Error",
        error.message || "Failed to permanently delete post"
      );
    } finally {
      setDeletingPostId(null);
    }
  }, [postToDelete, userData?.email, viewType, showToast, fetchDeletedPosts]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  }, []);

  const confirmPermanentDelete = useCallback(async () => {
    if (!postToDelete) return;

    try {
      setDeletingPostId(postToDelete.id);
      const { postService } = await import("../../services/firebase/posts");

      // Permanently delete
      await postService.deletePost(
        postToDelete.id,
        true,
        userData?.email || "admin"
      );

      showToast("success", "Post Deleted", "Post has been permanently deleted");
      setShowDeleteModal(false);
      setPostToDelete(null);

      // Refresh the deleted posts list if we're in the deleted view
      if (viewType === "deleted") {
        fetchDeletedPosts();
      }
    } catch (error: any) {
      console.error("Error permanently deleting post:", error);
      showToast(
        "error",
        "Error",
        error.message || "Failed to permanently delete post"
      );
    } finally {
      setDeletingPostId(null);
    }
  }, [postToDelete, userData?.email, viewType, showToast, fetchDeletedPosts]);
  const handleHidePost = async (post: Post) => {
    try {
      const { postService } = await import("../../services/firebase/posts");
      await postService.hidePost(post.id);
      showToast(
        "success",
        "Post Hidden",
        "Post has been hidden from public view"
      );
    } catch (error: any) {
      console.error("Failed to hide post:", error);
      showToast("error", "Hide Failed", error.message || "Failed to hide post");
    }
  };

  const handleUnhidePost = async (post: Post) => {
    try {
      const { postService } = await import("../../services/firebase/posts");
      await postService.unhidePost(post.id);
      showToast("success", "Post Unhidden", "Post is now visible to public");
    } catch (error: any) {
      console.error("Failed to unhide post:", error);
      showToast(
        "error",
        "Unhide Failed",
        error?.message || "Failed to unhide post"
      );
    }
  };

  // Initial load of deleted posts count
  useEffect(() => {
    fetchDeletedPostsCount();
  }, [fetchDeletedPostsCount]);

  // Load deleted posts when the deleted tab is active
  useEffect(() => {
    if (viewType === "deleted") {
      fetchDeletedPosts();
    }
  }, [viewType, fetchDeletedPosts]);

  // Initial load of deleted posts
  useEffect(() => {
    if (initialLoad.current && viewType === "deleted") {
      fetchDeletedPosts();
      initialLoad.current = false;
    }
  }, [viewType, fetchDeletedPosts]);

  // Keyboard shortcuts and accessibility for delete modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showDeleteModal) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          cancelDelete();
          break;
        case "Enter":
          if (deletingPostId !== postToDelete?.id) {
            event.preventDefault();
            confirmDelete();
          }
          break;
        case "Tab":
          // Prevent tabbing outside the modal
          const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[
            focusableElements.length - 1
          ] as HTMLElement;

          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === lastElement
          ) {
            event.preventDefault();
            firstElement.focus();
          }
          break;
      }
    };

    if (showDeleteModal) {
      document.addEventListener("keydown", handleKeyDown);
      // Focus the delete button for better accessibility
      const deleteButton = document.querySelector(
        '[aria-label="Confirm deletion of post"]'
      ) as HTMLButtonElement;
      if (deleteButton && !deleteButton.disabled) {
        deleteButton.focus();
      }
      // Lock body scroll
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore body scroll
      document.body.style.overflow = "";
    };
  }, [showDeleteModal, deletingPostId, postToDelete]);

  const handleStatusChange = async (post: Post, status: string) => {
    try {
      // Store the old status before updating
      const oldStatus = post.status;

      // Import and use the postService to update the status
      const { postService } = await import("../../utils/firebase");
      await postService.updatePostStatus(
        post.id,
        status as "pending" | "resolved" | "unclaimed"
      );

      // Send notification to the post creator if status changed and we have creator info
      if (oldStatus !== status && post.creatorId) {
        try {
          await notificationSender.sendStatusChangeNotification({
            postId: post.id,
            postTitle: post.title,
            postType: post.type as "lost" | "found",
            creatorId: post.creatorId,
            creatorName:
              post.user.firstName && post.user.lastName
                ? `${post.user.firstName} ${post.user.lastName}`
                : post.user.email?.split("@")[0] || "User",
            oldStatus: oldStatus || "unknown",
            newStatus: status,
            adminName:
              userData?.firstName && userData?.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData?.email?.split("@")[0] || "Admin",
          });
          console.log("✅ Status change notification sent to user");
        } catch (notificationError) {
          console.warn(
            "⚠️ Failed to send status change notification:",
            notificationError
          );
          // Don't throw - notification failures shouldn't break main functionality
        }
      }

      showToast(
        "success",
        "Status Updated",
        `Post status changed to ${status}`
      );
    } catch (error: any) {
      console.error("Failed to change post status:", error);
      showToast(
        "error",
        "Status Change Failed",
        error.message || "Unknown error occurred"
      );
    }
  };

  const handleActivateTicket = async (post: Post) => {
    const canActivate = post.status === "unclaimed" || post.movedToUnclaimed;

    if (!canActivate) {
      showToast(
        "error",
        "Cannot Activate",
        "This post cannot be activated as it's not in unclaimed status."
      );
      return;
    }

    const confirmMessage = post.movedToUnclaimed
      ? `Are you sure you want to activate "${post.title}"? This will move it back to active status with a new 30-day period.`
      : `Are you sure you want to activate "${post.title}"? This will move it back to active status with a new 30-day period.`;

    if (confirm(confirmMessage)) {
      try {
        const { postService } = await import("../../utils/firebase");
        await postService.activateTicket(post.id);

        const statusMessage = post.movedToUnclaimed
          ? `"${post.title}" has been activated from expired status and moved back to active status.`
          : `"${post.title}" has been activated and moved back to active status.`;

        showToast("success", "Ticket Activated", statusMessage);
        console.log("Ticket activated successfully:", post.title);
      } catch (error: any) {
        console.error("Failed to activate ticket:", error);
        showToast(
          "error",
          "Activation Failed",
          error.message || "Failed to activate ticket"
        );
      }
    }
  };

  const handleRevertResolution = async (post: Post) => {
    const reason = prompt(
      `Why are you reverting "${post.title}"? (Optional reason):`
    );
    if (reason === null) return; // User cancelled

    if (
      confirm(
        `Are you sure you want to revert "${post.title}" back to pending status? This will reset any claim/handover requests and delete associated photos.`
      )
    ) {
      try {
        const { postService } = await import("../../utils/firebase");

        let totalPhotosDeleted = 0;
        let allErrors: string[] = [];

        // Clean up handover details and photos
        console.log("🧹 Starting cleanup of handover details and photos...");
        const handoverCleanupResult =
          await postService.cleanupHandoverDetailsAndPhotos(post.id);
        totalPhotosDeleted += handoverCleanupResult.photosDeleted;
        allErrors.push(...handoverCleanupResult.errors);

        // Clean up claim details and photos
        console.log("🧹 Starting cleanup of claim details and photos...");
        const claimCleanupResult =
          await postService.cleanupClaimDetailsAndPhotos(post.id);
        totalPhotosDeleted += claimCleanupResult.photosDeleted;
        allErrors.push(...claimCleanupResult.errors);

        // Then update the post status to pending
        await postService.updatePostStatus(post.id, "pending");

        // Show success message with cleanup details
        let successMessage = `"${post.title}" has been reverted back to pending status.`;
        if (totalPhotosDeleted > 0) {
          successMessage += ` ${totalPhotosDeleted} photos were deleted from storage.`;
        }
        if (allErrors.length > 0) {
          console.warn("⚠️ Some cleanup errors occurred:", allErrors);
          successMessage += ` Note: Some cleanup operations had issues.`;
        }

        showToast("success", "Resolution Reverted", successMessage);
        console.log(
          "Post resolution reverted successfully:",
          post.title,
          "Total photos deleted:",
          totalPhotosDeleted
        );
      } catch (error: any) {
        console.error("Failed to revert post resolution:", error);
        showToast(
          "error",
          "Revert Failed",
          error.message || "Failed to revert post resolution"
        );
      }
    }
  };

  // Handle turnover confirmation
  const handleConfirmTurnover = (
    post: Post,
    status: "confirmed" | "not_received"
  ) => {
    setPostToConfirm(post);
    setConfirmationType(status);
    setShowTurnoverModal(true);
  };

  const handleTurnoverConfirmation = async (
    status: "confirmed" | "not_received",
    notes?: string
  ) => {
    if (!postToConfirm) return;

    try {
      const { postService } = await import("../../services/firebase/posts");
      // Get current admin user ID from auth context
      const currentUserId = userData?.uid;

      if (!currentUserId) {
        throw new Error("Admin user ID not found. Please log in again.");
      }

      console.log(
        `🔑 Using admin user ID for turnover confirmation: ${currentUserId}`
      );

      if (status === "not_received") {
        // Total deletion when OSA marks item as not received
        await postService.deletePost(postToConfirm.id);

        const statusMessage = `Item "${postToConfirm.title}" has been completely deleted from the system as it was not received by OSA.`;
        showToast("success", "Item Deleted", statusMessage);
        console.log(
          "Item completely deleted:",
          postToConfirm.title,
          "Reason: Not received by OSA"
        );

        // Update the deleted posts count when a post is deleted via turnover
        fetchDeletedPostsCount();
      } else {
        // Normal status update for confirmed items
        await postService.updateTurnoverStatus(
          postToConfirm.id,
          status,
          currentUserId,
          notes
        );

        const statusMessage = `Item receipt confirmed for "${postToConfirm.title}"`;
        showToast("success", "Turnover Status Updated", statusMessage);
        console.log(
          "Turnover status updated successfully:",
          postToConfirm.title,
          "Status:",
          status
        );
      }
    } catch (error: any) {
      console.error("Failed to process turnover confirmation:", error);
      const errorMessage =
        status === "not_received"
          ? "Failed to delete item from system"
          : "Failed to update turnover status";
      showToast("error", "Operation Failed", error.message || errorMessage);
    } finally {
      setShowTurnoverModal(false);
      setPostToConfirm(null);
      setConfirmationType(null);
    }
  };

  // Handle edit post
  const handleEditPost = (post: Post) => {
    setEditingPost(post);
  };

  // Handle update post (for TicketModal)
  const handleUpdatePost = async (updatedPost: Post) => {
    try {
      setIsUpdatingPost(true);

      // Import postService
      const { postService } = await import("../../services/firebase/posts");

      // Update the post in Firebase
      await postService.updatePost(updatedPost.id, {
        title: updatedPost.title,
        description: updatedPost.description,
        location: updatedPost.location,
        status: updatedPost.status,
        category: updatedPost.category,
        type: updatedPost.type,
        createdAt: updatedPost.createdAt,
        images: updatedPost.images,
      });

      // Close edit modal
      setEditingPost(null);

      // Show success message
      showToast(
        "success",
        "Post Updated",
        "The post has been successfully updated!"
      );
    } catch (error: any) {
      console.error("Error updating post:", error);
      showToast(
        "error",
        "Update Failed",
        error.message || "Failed to update post. Please try again."
      );
    } finally {
      setIsUpdatingPost(false);
    }
  };

  const handleSearch = async (query: string, filters: any) => {
    setLastDescriptionKeyword(filters.description || "");

    // Use appropriate posts based on current viewType
    const postsToSearch = viewType === "completed" ? resolvedPosts : posts;

    const filtered = (postsToSearch ?? []).filter((item) => {
      const matchesQuery = query.trim() ? fuzzyMatch(item.title, query) : true;

      const matchesCategory =
        filters.selectedCategory &&
        filters.selectedCategory.toLowerCase() != "all"
          ? item.category.toLowerCase() ===
            filters.selectedCategory.toLowerCase()
          : true;

      const matchesDescription = filters.description
        ? fuzzyMatch(item.description, filters.description)
        : true;

      const matchesLocation = filters.location
        ? item.location.toLowerCase() === filters.location.toLowerCase()
        : true;

      return (
        matchesQuery && matchesCategory && matchesDescription && matchesLocation
      );
    });
    setRawResults(filtered);
  };

  // const postsToDisplay = (rawResults ?? posts ?? []).filter(
  //   (post) => post.type === viewType
  // );

  // Apply view type filtering first
  const viewFilteredPosts = useMemo(() => {
    if (viewType === "deleted") {
      return deletedPosts;
    }

    const sourcePosts =
      rawResults ?? (viewType === "completed" ? resolvedPosts : posts) ?? [];

    return sourcePosts.filter((post) => {
      let shouldShow = false;

      if (viewType === "all") {
        // Show all posts EXCEPT unclaimed ones and posts awaiting OSA confirmation in "All Item Reports"
        shouldShow =
          post.status !== "unclaimed" &&
          !post.movedToUnclaimed &&
          !(
            post.type === "found" &&
            post.turnoverDetails &&
            post.turnoverDetails.turnoverAction === "turnover to OSA" &&
            post.turnoverDetails.turnoverStatus === "declared"
          );
      } else if (viewType === "unclaimed") {
        // Show posts that are either status 'unclaimed' OR have movedToUnclaimed flag
        shouldShow =
          post.status === "unclaimed" || Boolean(post.movedToUnclaimed);
      } else if (viewType === "completed") {
        shouldShow = true; // resolvedPosts already filtered
      } else if (viewType === "turnover") {
        // Show only Found items marked for turnover to OSA that have been confirmed as received
        shouldShow =
          post.type === "found" &&
          post.turnoverDetails?.turnoverAction === "turnover to OSA" &&
          post.turnoverDetails?.turnoverStatus === "confirmed";
      } else if (viewType === "flagged") {
        // Show only flagged posts
        shouldShow = Boolean(post.isFlagged);
      } else {
        // Exclude posts with 'awaiting confirmation' status (turnoverStatus === 'declared') for found items
        shouldShow =
          post.type.toLowerCase() === viewType &&
          post.status !== "unclaimed" &&
          !post.movedToUnclaimed &&
          !(
            post.type === "found" &&
            post.turnoverDetails &&
            post.turnoverDetails.turnoverAction === "turnover to OSA" &&
            post.turnoverDetails.turnoverStatus === "declared"
          );
      }

      return shouldShow;
    });
  }, [viewType, deletedPosts, rawResults, resolvedPosts, posts]);

  // Apply instant category filtering
  const postsToDisplay = useMemo(() => {
    if (viewType === "deleted") {
      return deletedPosts; // Skip category filtering for deleted posts
    }

    return selectedCategoryFilter && selectedCategoryFilter !== "All"
      ? viewFilteredPosts.filter(
          (post) =>
            post.category &&
            post.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
        )
      : viewFilteredPosts;
  }, [viewType, deletedPosts, selectedCategoryFilter, viewFilteredPosts]);

  // Check if there are more posts to load
  const hasMorePosts = postsToDisplay.length > currentPage * itemsPerPage;

  // Function to load more posts when scrolling
  const handleLoadMore = useCallback(() => {
    if (hasMorePosts && !isLoading) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMorePosts, isLoading]);

  // Handle restore post
  const handleRestorePost = useCallback(
    async (post: Post) => {
      if (!confirm(`Are you sure you want to restore "${post.title}"?`)) return;

      try {
        const { postService } = await import("../../services/firebase/posts");
        await postService.restorePost(post.id);

        // Update the UI by removing the restored post from the list
        setDeletedPosts((prev) => prev.filter((p) => p.id !== post.id));

        // Update the deleted posts count (always update, regardless of current view)
        fetchDeletedPostsCount();

        showToast(
          "success",
          "Post Restored",
          `"${post.title}" has been restored and is now pending review.`
        );
      } catch (error: any) {
        console.error("Failed to restore post:", error);
        showToast(
          "error",
          "Restore Failed",
          error.message || "Failed to restore post"
        );

        // Refresh the list if there was an error to ensure consistency
        if (viewType === "deleted") {
          await fetchDeletedPosts().catch(console.error);
        }
      }
    },
    [showToast, viewType, fetchDeletedPosts]
  );

  // Handle permanent delete post
  const handlePermanentDeletePost = useCallback(
    async (post: Post) => {
      if (
        !confirm(
          `WARNING: This will permanently delete "${post.title}" and all its data. This action cannot be undone.\n\nAre you sure?`
        )
      )
        return;

      try {
        const { postService } = await import("../../services/firebase/posts");
        await postService.permanentlyDeletePost(post.id);

        // Update the UI by removing the deleted post from the list
        setDeletedPosts((prev) => prev.filter((p) => p.id !== post.id));

        // Update the deleted posts count (always update, regardless of current view)
        fetchDeletedPostsCount();

        showToast(
          "success",
          "Post Permanently Deleted",
          `"${post.title}" has been permanently deleted.`
        );
      } catch (error: any) {
        console.error("Failed to permanently delete post:", error);
        showToast(
          "error",
          "Delete Failed",
          error.message || "Failed to permanently delete post"
        );

        // Refresh the list if there was an error to ensure consistency
        if (viewType === "deleted") {
          await fetchDeletedPosts().catch(console.error);
        }
      }
    },
    [showToast, viewType, fetchDeletedPosts]
  );

  // Use the infinite scroll hook
  const loadingRef = useInfiniteScroll(handleLoadMore, hasMorePosts, isLoading);

  return (
    <div className="min-h-screen bg-gray-100 mb-13 font-manrope transition-colors duration-300">
      <MobileNavText
        title="Admin Home"
        description="Admin dashboard for managing posts"
      />

      <div className="pt-4 px-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* SearchBar (grows to fill left side) */}
        <div className="w-full lg:flex-1">
          <SearchBar
            onSearch={handleSearch}
            onClear={() => {
              setRawResults(null);
              setLastDescriptionKeyword("");
              setSearchQuery("");
              setSelectedCategoryFilter("All"); // ✅ Reset category filter when clearing
              setCurrentPage(1); // Reset pagination when clearing search
            }}
            query={searchQuery}
            setQuery={setSearchQuery}
            // ✅ Pass instant category filtering props
            selectedCategoryFilter={selectedCategoryFilter}
            setSelectedCategoryFilter={setSelectedCategoryFilter}
          />
        </div>

        {/* Home Title and Description */}
        <div className="hidden lg:block lg:max-w-sm lg:text-right space-y-1">
          <h1 className="text-sm font-medium">Admin Home</h1>
          <p className="text-xs text-gray-600">
            Manage all lost and found items here
          </p>
        </div>
      </div>

      {/* Admin Quick Stats */}
      <div className="px-6 mb-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Dashboard Overview
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">
              {posts?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Total Posts</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">
              {posts?.filter((p) => p.type === "lost").length || 0}
            </div>
            <div className="text-sm text-gray-600">Lost Items</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {posts?.filter((p) => p.type === "found").length || 0}
            </div>
            <div className="text-sm text-gray-600">Found Items</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {posts?.filter((p) => p.status === "pending").length || 0}
            </div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">
              {posts?.filter(
                (p) => p.status === "unclaimed" || p.movedToUnclaimed
              ).length || 0}
            </div>
            <div className="text-sm text-gray-600">Unclaimed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {resolvedPosts?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-indigo-600">
              {posts?.filter(
                (p) =>
                  p.type === "found" &&
                  p.turnoverDetails &&
                  p.turnoverDetails.turnoverAction === "turnover to OSA"
              ).length || 0}
            </div>
            <div className="text-sm text-gray-600">OSA Turnover</div>
          </div>

          {/* Recently Deleted Items */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">
              {deletedPostsCount}
            </div>
            <div className="text-sm text-gray-600">Recently Deleted</div>
          </div>
        </div>
      </div>

      {/* View Type Tabs */}
      <div className="flex flex-wrap sm:justify-center items-center gap-3 w-full px-6 lg:justify-start lg:gap-3">
        <div className="w-full lg:w-auto text-center lg:text-left mb-2 lg:mb-0">
          <span className="text-sm text-gray-600">Current View: </span>
          <span className="text-sm font-semibold text-blue-600 capitalize">
            {viewType === "unclaimed"
              ? "Unclaimed Items"
              : viewType === "completed"
              ? "Resolved Reports"
              : viewType === "turnover"
              ? "Turnover Management"
              : viewType === "flagged"
              ? "Flagged Posts"
              : `${viewType} Item Reports`}
          </span>
        </div>
        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "all"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("all");
            setCurrentPage(1); // Reset pagination when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          All Item Reports
        </button>

        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "lost"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("lost");
            setCurrentPage(1); // Reset pagination when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Lost Item Reports
        </button>

        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "found"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("found");
            setCurrentPage(1); // Reset pagination when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Found Item Reports
        </button>

        {/* Unclaimed Items Button - Hidden as requested */}
        {/* <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "unclaimed"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("unclaimed");
            setCurrentPage(1); // Reset pagination when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Unclaimed Items
        </button> */}

        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "completed"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("completed");
            setCurrentPage(1); // Reset pagination when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Completed Reports
        </button>

        {/* Turnover Management Button - Hidden as requested */}
        {/* <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "turnover"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("turnover");
            setCurrentPage(1); // Reset pagination when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Turnover Management
        </button> */}

        {/* Flagged Posts Button - Hidden as requested */}
        {/* <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "flagged"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("flagged");
            setCurrentPage(1); // Reset pagination when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Flagged Posts
        </button> */}

        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "deleted"
              ? "bg-red-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-red-100 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("deleted");
            setCurrentPage(1);
            fetchDeletedPosts(); // Make sure to fetch deleted posts when this tab is selected
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Recently Deleted
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 mx-6 mt-7 sm:grid-cols-2 lg:grid-cols-3">
        {/* ✅ Handle loading state */}
        {loading ||
        resolvedLoading ||
        isLoading ||
        (viewType === "deleted" && deletedPostsLoading) ? (
          <div className="col-span-full flex items-center justify-center h-80">
            <span className="text-gray-400">
              Loading{" "}
              {viewType === "unclaimed"
                ? "unclaimed"
                : viewType === "completed"
                ? "resolved"
                : viewType === "deleted"
                ? "recently deleted"
                : viewType}{" "}
              report items...
            </span>
          </div>
        ) : error ||
          resolvedError ||
          (viewType === "deleted" && deletedPostsError) ? (
          <div className="col-span-full flex flex-col items-center justify-center h-80 text-red-500 p-4">
            <p>
              Error loading {viewType === "deleted" ? "deleted " : ""}posts:{" "}
              {viewType === "deleted"
                ? deletedPostsError
                : error || resolvedError}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : postsToDisplay.length === 0 ? (
          <div className="col-span-full flex items-center justify-center h-80 text-gray-500">
            {viewType === "deleted"
              ? "No deleted posts found."
              : "No results found."}
          </div>
        ) : (
          postsToDisplay.slice(0, currentPage * itemsPerPage).map((post) => (
            <AdminPostCard
              key={post.id}
              post={post}
              onClick={() => setSelectedPost(post)}
              highlightText={lastDescriptionKeyword}
              onDelete={viewType === "deleted" ? undefined : handleDeletePost}
              onEdit={viewType === "deleted" ? undefined : handleEditPost}
              onStatusChange={
                viewType === "deleted" ? undefined : handleStatusChange
              }
              onActivateTicket={
                viewType === "deleted" ? undefined : handleActivateTicket
              }
              onRevertResolution={
                viewType === "deleted" ? undefined : handleRevertResolution
              }
              onConfirmTurnover={
                viewType === "deleted" ? undefined : handleConfirmTurnover
              }
              onHidePost={viewType === "deleted" ? undefined : handleHidePost}
              onUnhidePost={
                viewType === "deleted" ? undefined : handleUnhidePost
              }
              isDeleting={deletingPostId === post.id}
              // Add restore and permanent delete actions for deleted posts
              onRestore={viewType === "deleted" ? handleRestorePost : undefined}
              onPermanentDelete={
                viewType === "deleted" ? handlePermanentDeletePost : undefined
              }
              showUnclaimedMessage={false}
            />
          ))
        )}
      </div>

      {/* Invisible loading indicator for scroll-to-load */}
      {hasMorePosts && (
        <div
          ref={loadingRef}
          className="h-10 flex items-center justify-center my-6"
        >
          {isLoading ? (
            <div className="text-gray-500 text-sm">Loading more posts...</div>
          ) : (
            <div className="text-gray-400 text-sm">
              Scroll down to load more
            </div>
          )}
        </div>
      )}

      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          hideSendMessage={true}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && postToDelete && (
        <>
          {/* Screen reader announcement */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Delete confirmation dialog opened for post: {postToDelete.title}
          </div>

          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-description"
          >
            <div
              className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>

              <h3
                className="text-lg font-semibold text-center mb-2"
                id="delete-modal-title"
              >
                Delete "{postToDelete.title}"?
              </h3>

              <p
                className="text-sm text-gray-600 text-center mb-6"
                id="delete-modal-description"
              >
                Choose how you want to delete this post:
              </p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={moveToDeleted}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex flex-col items-center"
                  disabled={!!deletingPostId}
                >
                  <span className="font-medium">Move to Recently Deleted</span>
                  <span className="text-xs opacity-90">
                    Can be restored later
                  </span>
                </button>

                <button
                  onClick={confirmPermanentDelete}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex flex-col items-center"
                  disabled={!!deletingPostId}
                >
                  <span className="font-medium">Permanently Delete</span>
                  <span className="text-xs opacity-90">Cannot be undone</span>
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  disabled={!!deletingPostId}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Turnover Confirmation Modal */}
      <TurnoverConfirmationModal
        isOpen={showTurnoverModal}
        onClose={() => {
          setShowTurnoverModal(false);
          setPostToConfirm(null);
          setConfirmationType(null);
        }}
        onConfirm={handleTurnoverConfirmation}
        post={postToConfirm}
        confirmationType={confirmationType}
      />

      {/* Edit Modal */}
      {editingPost && (
        <TicketModal
          key={editingPost.id}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onDelete={(id: string) => {
            // Find the post by ID and call handleDeletePost with the full Post object
            const postToDelete =
              posts?.find((p) => p.id === id) ||
              resolvedPosts?.find((p) => p.id === id);
            if (postToDelete) {
              handleDeletePost(postToDelete);
            }
          }}
          onUpdatePost={handleUpdatePost}
          isDeleting={isUpdatingPost}
          isAdmin={true}
        />
      )}
    </div>
  );
}
