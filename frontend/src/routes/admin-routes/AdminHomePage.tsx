import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Post } from "@/types/Post";

// components
import AdminPostCard from "@/components/admin/AdminPostCard";
import AdminPostCardList from "@/components/admin/AdminPostCardList";
import AdminPostModal from "@/components/admin/AdminPostModal";
import TicketModal from "@/components/modals/Ticket";
import TurnoverConfirmationModal from "@/components/modals/TurnoverConfirmation";
import MobileNavText from "@/components/layout/NavHead";
import SearchBar from "@/components/common/SearchBar";
import MultiControlPanel from "@/components/common/MultiControlPanel";
import { useAdminPosts, useResolvedPosts } from "@/hooks/usePosts";
import { useToast } from "@/context/ToastContext";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useAuth } from "@/context/AuthContext";

import { notificationSender } from "../../services/firebase/notificationSender";

export default function AdminHomePage() {
  function fuzzyMatch(text: string, query: string, postUser?: { firstName?: string; lastName?: string; email?: string }): boolean {
    if (!text) return false;
    
    const cleanedText = text.toLowerCase();
    const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

    // If no query words, return true
    if (queryWords.length === 0) return true;

    // Check if query matches user's name (excluding email)
    if (postUser) {
      const userName = `${postUser.firstName || ''} ${postUser.lastName || ''}`.toLowerCase().trim();
      
      // Check if any query word matches user's name (excluding email)
      const userMatch = queryWords.some(word => 
        userName.includes(word) || 
        (postUser.firstName?.toLowerCase().includes(word) || 
         postUser.lastName?.toLowerCase().includes(word))
      );
      
      if (userMatch) return true;
    }

    // For single word queries, use partial matching
    if (queryWords.length === 1) {
      return cleanedText.includes(queryWords[0]);
    }

    // For multiple words, require all words to match
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

  // State for view mode (card/list view)
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
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

  // Multi-select state for bulk operations
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkRestoring, setIsBulkRestoring] = useState(false);
  const [isBulkReverting, setIsBulkReverting] = useState(false);

  // Bulk delete confirmation modal state
  const [showBulkDeleteConfirmModal, setShowBulkDeleteConfirmModal] = useState(false);
  const [bulkDeleteAction, setBulkDeleteAction] = useState<{
    count: number;
  } | null>(null);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);

  // Turnover confirmation modal state
  const [showTurnoverModal, setShowTurnoverModal] = useState(false);
  const [postToConfirm, setPostToConfirm] = useState<Post | null>(null);
  const [confirmationType, setConfirmationType] = useState<
    "confirmed" | "not_received" | null
  >(null);

  // Revert confirmation modal state
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [postToRevert, setPostToRevert] = useState<Post | null>(null);
  const [revertReason, setRevertReason] = useState<string>("");

  // Edit modal state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // e modify rani siya sa backend django
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  // e change dari pila ka post mu appear pag scroll down
  const itemsPerPage = 8; // Increased from 6 to 8 for better scroll experience

  // Multi-select handlers
  const handlePostSelectionChange = (post: Post, selected: boolean) => {
    setSelectedPosts((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(post.id);
      } else {
        newSet.delete(post.id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPosts.size === postsToDisplay.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(postsToDisplay.map((post) => post.id)));
    }
  };

  const handleBulkRestore = async () => {
    if (selectedPosts.size === 0) {
      showToast("warning", "No Selection", "Please select posts to restore");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to restore ${selectedPosts.size} selected posts? They will be moved back to pending status.`
      )
    ) {
      return;
    }

    try {
      setIsBulkRestoring(true);
      const { postService } = await import("../../services/firebase/posts");

      // Restore all selected posts
      for (const postId of selectedPosts) {
        await postService.restorePost(postId);
      }

      showToast(
        "success",
        "Bulk Restore Complete",
        `Successfully restored ${selectedPosts.size} posts`
      );

      // Clear selection and refresh
      setSelectedPosts(new Set());

      // Refresh the deleted posts list
      if (viewType === "deleted") {
        fetchDeletedPosts();
      }
    } catch (error: any) {
      console.error("Error during bulk restore:", error);
      showToast(
        "error",
        "Bulk Restore Failed",
        error.message || "Failed to restore selected posts"
      );
    } finally {
      setIsBulkRestoring(false);
    }
  };

  const handleBulkRevert = async () => {
    if (selectedPosts.size === 0) {
      showToast("warning", "No Selection", "Please select posts to revert");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to revert ${selectedPosts.size} selected posts? They will be moved back to pending status and all resolution data will be cleared.`
      )
    ) {
      return;
    }

    try {
      setIsBulkReverting(true);
      const { postService } = await import("../../utils/firebase");

      // Revert all selected posts
      for (const postId of selectedPosts) {
        const post = postsToDisplay.find(p => p.id === postId);
        if (post) {
          await postService.cleanupHandoverDetailsAndPhotos(postId);
          await postService.cleanupClaimDetailsAndPhotos(postId);
          await postService.updatePostStatus(
            postId,
            "pending",
            undefined,
            "Post reverted by admin via bulk operation"
          );
        }
      }

      showToast(
        "success",
        "Bulk Revert Complete",
        `Successfully reverted ${selectedPosts.size} posts back to pending status`
      );

      // Clear selection
      setSelectedPosts(new Set());
    } catch (error: any) {
      console.error("Error during bulk revert:", error);
      showToast(
        "error",
        "Bulk Revert Failed",
        error.message || "Failed to revert selected posts"
      );
    } finally {
      setIsBulkReverting(false);
    }
  };

  const handleRevertPost = async (post: Post) => {
    setPostToRevert(post);
    setShowRevertModal(true);
  };

  const handleDeletePost = (post: Post) => {
    setPostToDelete(post);
    setShowDeleteModal(true);
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) {
      showToast("warning", "No Selection", "Please select posts to move to Recently Deleted");
      return;
    }
    setBulkDeleteAction({ count: selectedPosts.size });
    setShowBulkDeleteConfirmModal(true);
  };

  // Handle bulk delete confirmation modal close
  const handleCancelBulkDelete = () => {
    setShowBulkDeleteConfirmModal(false);
    setBulkDeleteAction(null);
  };

  // Handle bulk delete confirmation - perform soft delete by default
  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteAction || selectedPosts.size === 0) return;

    const selectedPostIds = Array.from(selectedPosts);
    let successCount = 0;
    let errorCount = 0;

    try {
      setIsBulkDeleting(true);

      // Only use hard delete if we're in the deleted view, otherwise always use soft delete
      const isHardDelete = viewType === "deleted";
      const { postService } = await import("../../services/firebase/posts");

      for (const postId of selectedPostIds) {
        try {
          if (isHardDelete) {
            // When on deleted view, posts are in deleted_posts collection, so use permanentlyDeletePost
            await postService.permanentlyDeletePost(postId);
          } else {
            // Always use soft delete for posts in main collection (preserves images in Cloudinary)
            await postService.deletePost(postId, false, userData?.email || "admin");
          }
          successCount++;
        } catch (err) {
          console.error(`Failed to ${viewType === 'deleted' ? 'permanently delete' : 'move to Recently Deleted'} post ${postId}:`, err);
          errorCount++;
        }
      }

      // Refresh the appropriate data based on the current view
      if (successCount > 0) {
        if (isHardDelete) {
          // If we're in the deleted view and did a hard delete, refresh the deleted posts
          const updatedDeletedPosts = await postService.getDeletedPosts();
          setDeletedPosts(updatedDeletedPosts);
        } else {
          // For soft deletes, the useAdminPosts hook will automatically refresh the posts
          // We just need to refresh the deleted posts list
          const updatedDeletedPosts = await postService.getDeletedPosts();
          setDeletedPosts(updatedDeletedPosts);
        }
      }

      if (errorCount === 0) {
        const willSwitchView = successCount > 0 && !isHardDelete && (viewType === "all" || viewType === "lost" || viewType === "found");
        const didHardDeleteFromDeleted = successCount > 0 && isHardDelete && viewType === "deleted";

        showToast(
          "success",
          "Bulk Delete Complete",
          `Successfully ${isHardDelete ? 'permanently deleted' : 'moved'} ${successCount} post${successCount !== 1 ? 's' : ''}${isHardDelete ? '' : ' to Recently Deleted'}${willSwitchView ? ". View switched to Recently Deleted." : didHardDeleteFromDeleted ? ". List refreshed." : isHardDelete ? '' : ". Check Recently Deleted tab to see them."}`
        );
      } else {
        const willSwitchView = successCount > 0 && !isHardDelete && (viewType === "all" || viewType === "lost" || viewType === "found");
        const didHardDeleteFromDeleted = successCount > 0 && isHardDelete && viewType === "deleted";

        showToast(
          "warning",
          "Bulk Delete Partial",
          `${isHardDelete ? 'Permanently deleted' : 'Moved'} ${successCount} post${successCount !== 1 ? 's' : ''} successfully, ${errorCount} failed${willSwitchView ? ". View switched to Recently Deleted." : didHardDeleteFromDeleted ? ". List refreshed." : ""}`
        );
      }

      // Switch to deleted view after successful bulk deletion so users can see recently deleted items
      // Only switch if doing soft delete and currently on main item report views (all, lost, found)
      if (successCount > 0 && !isHardDelete && (viewType === "all" || viewType === "lost" || viewType === "found")) {
        setViewType("deleted");
      }
    } catch (err: any) {
      console.error("Error in bulk delete:", err);
      showToast("error", "Bulk Delete Failed", "An error occurred while processing your request");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirmModal(false);
      setBulkDeleteAction(null);
      setSelectedPosts(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedPosts(new Set());
  };

  const moveToDeleted = useCallback(async (post: Post) => {
    if (!post) return;

    try {
      setDeletingPostId(post.id);
      const { postService } = await import("../../services/firebase/posts");

      // Move to deleted (soft delete)
      await postService.deletePost(
        post.id,
        false,
        userData?.email || "admin"
      );

      // Refresh the deleted posts list from Firestore to ensure we have the latest data
      try {
        const { postService } = await import("../../services/firebase/posts");
        const updatedDeletedPosts = await postService.getDeletedPosts();
        setDeletedPosts(updatedDeletedPosts);
      } catch (error) {
        console.error("Failed to refresh deleted posts:", error);
        // Fallback to local state update if refresh fails
        setDeletedPosts(prevDeletedPosts => {
          if (prevDeletedPosts.some(p => p.id === post.id)) {
            return prevDeletedPosts;
          }
          return [...prevDeletedPosts, { ...post, deletedAt: new Date().toISOString(), isDeleted: true }];
        });
      }

      showToast(
        "success",
        "Post Moved",
        "Post has been moved to Recently Deleted"
      );
      setShowDeleteModal(false);
      setPostToDelete(null);

      // Send notification to the post creator
      if (post.creatorId) {
        try {
          // Check if this post has been turned over and use the original finder instead
          const notificationRecipientId =
            post.turnoverDetails?.originalFinder?.uid ||
            post.creatorId;

          await notificationSender.sendDeleteNotification({
            postId: post.id,
            postTitle: post.title,
            postType: post.type as "lost" | "found",
            creatorId: notificationRecipientId,
            creatorName: post.turnoverDetails?.originalFinder
              ? `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`
              : post.user?.firstName && post.user?.lastName
              ? `${post.user.firstName} ${post.user.lastName}`
              : post.user?.email || "User",
            adminName:
              userData?.firstName && userData?.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData?.email?.split("@")[0] || "Admin",
            deletionType: "soft",
          });
          console.log("✅ Delete notification sent to user");
        } catch (notificationError) {
          console.warn(
            "⚠️ Failed to send delete notification:",
            notificationError
          );
          // Don't throw - notification failures shouldn't break main functionality
        }
      }

      // Refresh the posts list
      if (viewType === "deleted") {
        fetchDeletedPosts();
      }
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

      // Send notification to the post creator
      if (postToDelete.creatorId) {
        try {
          await notificationSender.sendDeleteNotification({
            postId: postToDelete.id,
            postTitle: postToDelete.title,
            postType: postToDelete.type as "lost" | "found",
            creatorId: postToDelete.creatorId,
            creatorName:
              postToDelete.user.firstName && postToDelete.user.lastName
                ? `${postToDelete.user.firstName} ${postToDelete.user.lastName}`
                : postToDelete.user.email?.split("@")[0] || "User",
            adminName:
              userData?.firstName && userData?.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData?.email?.split("@")[0] || "Admin",
            deletionType: "permanent",
          });
          console.log("✅ Permanent delete notification sent to user");
        } catch (notificationError) {
          console.warn(
            "⚠️ Failed to send permanent delete notification:",
            notificationError
          );
          // Don't throw - notification failures shouldn't break main functionality
        }
      }

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

      // Send notification to the post creator
      if (postToDelete.creatorId) {
        try {
          await notificationSender.sendDeleteNotification({
            postId: postToDelete.id,
            postTitle: postToDelete.title,
            postType: postToDelete.type as "lost" | "found",
            creatorId: postToDelete.creatorId,
            creatorName:
              postToDelete.user.firstName && postToDelete.user.lastName
                ? `${postToDelete.user.firstName} ${postToDelete.user.lastName}`
                : postToDelete.user.email?.split("@")[0] || "User",
            adminName:
              userData?.firstName && userData?.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData?.email?.split("@")[0] || "Admin",
            deletionType: "permanent",
          });
          console.log("✅ Permanent delete notification sent to user");
        } catch (notificationError) {
          console.warn(
            "⚠️ Failed to send permanent delete notification:",
            notificationError
          );
          // Don't throw - notification failures shouldn't break main functionality
        }
      }

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
      if (!showDeleteModal && !showRevertModal) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          if (showDeleteModal) {
            cancelDelete();
          } else if (showRevertModal) {
            handleRevertCancel();
          }
          break;
        case "Enter":
          if (showDeleteModal && deletingPostId !== postToDelete?.id) {
            event.preventDefault();
            confirmDelete();
          } else if (showRevertModal) {
            event.preventDefault();
            handleRevertConfirm();
          }
          break;
        case "Tab":
          // Prevent tabbing outside the modal
          const modal = showDeleteModal
            ? document.querySelector('[role="dialog"][aria-modal="true"]')
            : document.querySelectorAll(
                '[role="dialog"][aria-modal="true"]'
              )[1];
          if (!modal) return;

          const focusableElements = modal.querySelectorAll(
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

    if (showDeleteModal || showRevertModal) {
      document.addEventListener("keydown", handleKeyDown);

      // Lock body scroll
      document.body.style.overflow = "hidden";

      // Focus management - focus the appropriate button
      if (showDeleteModal) {
        // Focus the delete button for better accessibility
        const deleteButton = document.querySelector(
          '[aria-label="Confirm deletion of post"]'
        ) as HTMLButtonElement;
        if (deleteButton && !deleteButton.disabled) {
          deleteButton.focus();
        }
      } else if (showRevertModal) {
        // Focus the revert button for better accessibility
        const revertButton = Array.from(
          document.querySelectorAll("button")
        ).find((btn) =>
          btn.textContent?.includes("Revert Post")
        ) as HTMLButtonElement;
        if (revertButton && !revertButton.disabled) {
          revertButton.focus();
        }
      }
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore body scroll
      document.body.style.overflow = "";
    };
  }, [showDeleteModal, showRevertModal, deletingPostId, postToDelete]);

  const handleStatusChange = async (
    post: Post,
    status: string,
    adminNotes?: string
  ) => {
    try {
      // Store the old status before updating
      const oldStatus = post.status;

      // Import and use the postService to update the status
      const { postService } = await import("../../utils/firebase");
      await postService.updatePostStatus(
        post.id,
        status as "pending" | "resolved" | "unclaimed",
        adminNotes
      );

      // Send notification to the post creator if status changed and we have creator info
      if (oldStatus !== status && post.creatorId) {
        try {
          // Check if this post has been turned over and use the original finder instead
          const notificationRecipientId =
            post.turnoverDetails?.originalFinder?.uid || post.creatorId;

          await notificationSender.sendStatusChangeNotification({
            postId: post.id,
            postTitle: post.title,
            postType: post.type as "lost" | "found",
            creatorId: notificationRecipientId,
            creatorName: post.turnoverDetails?.originalFinder
              ? `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`
              : post.user.firstName && post.user.lastName
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

  const handleRevertConfirm = async () => {
    if (!postToRevert) return;

    try {
      const { postService } = await import("../../utils/firebase");

      let totalPhotosDeleted = 0;
      let allErrors: string[] = [];

      // Clean up handover details and photos
      console.log("🧹 Starting cleanup of handover details and photos...");
      const handoverCleanupResult =
        await postService.cleanupHandoverDetailsAndPhotos(postToRevert.id);
      totalPhotosDeleted += handoverCleanupResult.photosDeleted;
      allErrors.push(...handoverCleanupResult.errors);

      // Clean up claim details and photos
      console.log("🧹 Starting cleanup of claim details and photos...");
      const claimCleanupResult = await postService.cleanupClaimDetailsAndPhotos(
        postToRevert.id
      );
      totalPhotosDeleted += claimCleanupResult.photosDeleted;
      allErrors.push(...claimCleanupResult.errors);

      // Then update the post status to pending
      await postService.updatePostStatus(
        postToRevert.id,
        "pending",
        undefined,
        revertReason || "Post reverted by admin"
      );

      // Send notification to the post creator
      if (postToRevert.creatorId) {
        try {
          // Check if this post has been turned over and use the original finder instead
          const notificationRecipientId =
            postToRevert.turnoverDetails?.originalFinder?.uid ||
            postToRevert.creatorId;

          await notificationSender.sendRevertNotification({
            postId: postToRevert.id,
            postTitle: postToRevert.title,
            postType: postToRevert.type as "lost" | "found",
            creatorId: notificationRecipientId,
            creatorName: postToRevert.turnoverDetails?.originalFinder
              ? `${postToRevert.turnoverDetails.originalFinder.firstName} ${postToRevert.turnoverDetails.originalFinder.lastName}`
              : postToRevert.user.firstName && postToRevert.user.lastName
              ? `${postToRevert.user.firstName} ${postToRevert.user.lastName}`
              : postToRevert.user.email?.split("@")[0] || "User",
            adminName:
              userData?.firstName && userData?.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData?.email?.split("@")[0] || "Admin",
            revertReason: revertReason || "Post reverted by admin",
          });
          console.log("✅ Revert notification sent to user");
        } catch (notificationError) {
          console.warn(
            "⚠️ Failed to send revert notification:",
            notificationError
          );
          // Don't throw - notification failures shouldn't break main functionality
        }
      }

      // Show success message with cleanup details
      let successMessage = `"${postToRevert.title}" has been reverted back to pending status.`;
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
        postToRevert.title,
        "Total photos deleted:",
        totalPhotosDeleted
      );

      // Close modal and reset state
      setShowRevertModal(false);
      setPostToRevert(null);
      setRevertReason("");
    } catch (error: any) {
      console.error("Failed to revert post resolution:", error);
      showToast(
        "error",
        "Revert Failed",
        error.message || "Failed to revert post resolution"
      );
    }
  };

  const handleRevertCancel = () => {
    setShowRevertModal(false);
    setPostToRevert(null);
    setRevertReason("");
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
    setLastDescriptionKeyword(filters?.description || "");
    const locationQuery = filters?.location?.toLowerCase() || "";
    const descriptionQuery = filters?.description?.toLowerCase() || "";
    const categoryQuery = filters?.selectedCategory?.toLowerCase() || "";

    // Use appropriate posts based on current viewType
    const postsToSearch = viewType === "completed" ? resolvedPosts : 
                          viewType === "deleted" ? deletedPosts : posts;

    const filtered = (postsToSearch ?? []).filter((item) => {
      // Check if search query matches title or user info
      const searchMatch = !query.trim() || 
        fuzzyMatch(item.title, query, item.user) ||
        fuzzyMatch(item.description, query, item.user) ||
        (item.user?.firstName && fuzzyMatch(item.user.firstName, query)) ||
        (item.user?.lastName && fuzzyMatch(item.user.lastName, query));

      // Check category filter
      const categoryMatch = !categoryQuery || 
        categoryQuery === "all" ||
        (item.category && item.category.toLowerCase() === categoryQuery);

      // Check description filter
      const descriptionMatch = !descriptionQuery ||
        (item.description && item.description.toLowerCase().includes(descriptionQuery));

      // Check location filter - using includes for partial matching
      const locationMatch = !locationQuery ||
        (item.location && item.location.toLowerCase().includes(locationQuery));

      return searchMatch && categoryMatch && descriptionMatch && locationMatch;
    });
    
    setRawResults(filtered);
  };

  // View filtered posts based on search and view type
  const viewFilteredPosts = useMemo(() => {
    // If there are raw search results, filter them by view type
    if (rawResults) {
      return rawResults.filter((post) => {
        if (viewType === "all") 
          return !(post.type === "found" &&
                  post.turnoverDetails && 
                  post.turnoverDetails.turnoverAction === "turnover to OSA" &&
                  post.turnoverDetails.turnoverStatus === "declared");
        if (viewType === "completed") return post.status === "completed" || post.status === "resolved";
        if (viewType === "deleted") return true;
        if (viewType === "flagged") return post.isFlagged === true;
        if (viewType === "turnover") 
          return post.type === "found" &&
                 post.turnoverDetails && 
                 post.turnoverDetails.turnoverAction === "turnover to OSA" &&
                 post.turnoverDetails.turnoverStatus === "declared";
        if (viewType === "unclaimed") return post.status === "unclaimed";
        return post.type === viewType && 
               post.status !== "completed" &&
               !(post.type === "found" &&
                 post.turnoverDetails && 
                 post.turnoverDetails.turnoverAction === "turnover to OSA" &&
                 post.turnoverDetails.turnoverStatus === "declared");
      });
    }

    // Handle deleted posts view
    if (viewType === "deleted") {
      return [...deletedPosts];
    }

    // Otherwise filter the current posts by view type and search query
    let postsToShow = [...posts];
    
    switch (viewType) {
      case "completed":
        postsToShow = [...resolvedPosts];
        break;
      case "flagged":
        postsToShow = posts.filter(post => post.isFlagged === true);
        break;
      case "turnover":
        // Show posts specifically created for turnover to OSA
        postsToShow = posts.filter(post => 
          post.type === "found" &&
          post.turnoverDetails && 
          post.turnoverDetails.turnoverAction === "turnover to OSA" &&
          post.turnoverDetails.turnoverStatus === "declared"
        );
        break;
      case "unclaimed":
        postsToShow = posts.filter(post => post.status === "unclaimed");
        break;
      case "all":
        // Show all posts except those created specifically for turnover to OSA and resolved/completed posts
        postsToShow = posts.filter(post => 
          !(post.type === "found" &&
            post.turnoverDetails && 
            post.turnoverDetails.turnoverAction === "turnover to OSA" &&
            post.turnoverDetails.turnoverStatus === "declared") &&
          post.status !== "completed" &&
          post.status !== "resolved"
        );
        break;
      default:
        // Handle other view types (lost, found) - exclude turnover posts and resolved/completed posts
        postsToShow = posts.filter(post => 
          post.type === viewType && 
          post.status !== "completed" &&
          post.status !== "resolved" &&
          !(post.type === "found" &&
            post.turnoverDetails && 
            post.turnoverDetails.turnoverAction === "turnover to OSA" &&
            post.turnoverDetails.turnoverStatus === "declared")
        );
    }
    
    if (!searchQuery) return postsToShow;

    return postsToShow.filter((post) => {
      // Create user info object with only the fields we want to search in
      const userInfo = post.user ? {
        firstName: post.user.firstName,
        lastName: post.user.lastName
      } : undefined;

      // Check if search query matches post title, description, or user name (excluding email)
      const searchMatch = 
        fuzzyMatch(post.title || '', searchQuery, userInfo) ||
        fuzzyMatch(post.description || '', searchQuery, userInfo) ||
        (post.user?.firstName && fuzzyMatch(post.user.firstName, searchQuery, { firstName: post.user.firstName })) ||
        (post.user?.lastName && fuzzyMatch(post.user.lastName, searchQuery, { lastName: post.user.lastName }));

      // If viewType is 'all', we need to filter by type as well and exclude resolved posts
      if (viewType === "all") {
        return searchMatch && post.status !== "completed" && post.status !== "resolved" && !post.isDeleted;
      }

      // For other view types (lost, found), also exclude resolved posts
      if (viewType === "lost" || viewType === "found") {
        return searchMatch && post.status !== "completed" && post.status !== "resolved";
      }

      return searchMatch;
    });
  }, [rawResults, viewType, posts, resolvedPosts, deletedPosts, searchQuery]);

  // Apply instant category filtering
  const postsToDisplay = useMemo(() => {
    if (viewType === "deleted") {
      // For deleted posts, use the search results if available, otherwise use all deleted posts
      // Skip category filtering for deleted posts
      return viewFilteredPosts;
    }

    return selectedCategoryFilter && selectedCategoryFilter !== "All"
      ? viewFilteredPosts.filter(
          (post) =>
            post.category &&
            post.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
        )
      : viewFilteredPosts;
  }, [viewType, deletedPosts, selectedCategoryFilter, viewFilteredPosts, rawResults]);

  // Clear selection when posts list changes due to filtering or search
  useEffect(() => {
    setSelectedPosts(new Set());
  }, [postsToDisplay]);

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

        showToast(
          "success",
          "Post Restored",
          `"${post.title}" has been restored and is now pending review.`
        );

        // Send notification to the post creator
        if (post.creatorId) {
          try {
            // Check if this post has been turned over and use the original finder instead
            const notificationRecipientId =
              post.turnoverDetails?.originalFinder?.uid || post.creatorId;

            await notificationSender.sendRestoreNotification({
              postId: post.id,
              postTitle: post.title,
              postType: post.type as "lost" | "found",
              creatorId: notificationRecipientId,
              creatorName: post.turnoverDetails?.originalFinder
                ? `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`
                : post.user.firstName && post.user.lastName
                ? `${post.user.firstName} ${post.user.lastName}`
                : post.user.email?.split("@")[0] || "User",
              adminName:
                userData?.firstName && userData?.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : userData?.email?.split("@")[0] || "Admin",
            });
            console.log("✅ Restore notification sent to user");
          } catch (notificationError) {
            console.warn(
              "⚠️ Failed to send restore notification:",
              notificationError
            );
            // Don't throw - notification failures shouldn't break main functionality
          }
        }
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

        showToast(
          "success",
          "Post Permanently Deleted",
          `"${post.title}" has been permanently deleted.`
        );

        // Send notification to the post creator
        if (post.creatorId) {
          try {
            // Check if this post has been turned over and use the original finder instead
            const notificationRecipientId =
              post.turnoverDetails?.originalFinder?.uid || post.creatorId;

            await notificationSender.sendDeleteNotification({
              postId: post.id,
              postTitle: post.title,
              postType: post.type as "lost" | "found",
              creatorId: notificationRecipientId,
              creatorName: post.turnoverDetails?.originalFinder
                ? `${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`
                : post.user.firstName && post.user.lastName
                ? `${post.user.firstName} ${post.user.lastName}`
                : post.user.email?.split("@")[0] || "User",
              adminName:
                userData?.firstName && userData?.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : userData?.email?.split("@")[0] || "Admin",
              deletionType: "permanent",
              originalFinder: post.turnoverDetails?.originalFinder,
            });
            console.log("✅ Permanent delete notification sent to user");
          } catch (notificationError) {
            console.warn(
              "⚠️ Failed to send permanent delete notification:",
              notificationError
            );
            // Don't throw - notification failures shouldn't break main functionality
          }
        }
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
        <div className="hidden lg:flex lg:items-center lg:space-x-4">
          <div className="text-right space-y-1">
            <h1 className="text-sm font-medium">Admin Home</h1>
            <p className="text-xs text-gray-600">
              Manage all lost and found items here
            </p>
          </div>
        </div>
      </div>

      {/* View Type Tabs */}
      <div className="flex mt-5 flex-wrap sm:justify-center items-center gap-3 w-full px-6 lg:justify-between lg:gap-3">
        <div className="flex items-center gap-3 flex-wrap sm:justify-center lg:justify-start">
          {/* <div className="w-full lg:w-auto text-center lg:text-left mb-2 lg:mb-0">
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
          </div> */}
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

        {/* Multi-select controls */}
        <div className="flex items-center justify-end">
          <MultiControlPanel
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            selectedCount={selectedPosts.size}
            totalCount={postsToDisplay.length}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onBulkDelete={handleBulkDelete}
            isBulkDeleting={isBulkDeleting}
            onBulkRestore={viewType === "deleted" ? handleBulkRestore : undefined}
            isBulkRestoring={isBulkRestoring}
            onBulkRevert={viewType === "completed" ? handleBulkRevert : undefined}
            isBulkReverting={isBulkReverting}
            viewType={viewType}
          />
        </div>
      </div>

  <div className={`${viewMode === "list" ? "space-y-4 mx-6 mt-7" : "grid grid-cols-1 gap-5 mx-6 mt-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
        {/* Handle loading state */}
        {loading ||
        resolvedLoading ||
        isLoading ||
        (viewType === "deleted" && deletedPostsLoading) ? (
          <div className={`col-span-full flex items-center justify-center h-80 ${viewMode === "list" ? "col-span-1" : ""}`}>
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
          <div className={`col-span-full flex flex-col items-center justify-center h-80 text-red-500 p-4 ${viewMode === "list" ? "col-span-1" : ""}`}>
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
          <div className={`col-span-full flex items-center justify-center h-80 text-gray-500 ${viewMode === "list" ? "col-span-1" : ""}`}>
            {viewType === "deleted"
              ? "No deleted posts found."
              : "No results found."}
          </div>
        ) : (
          postsToDisplay.slice(0, currentPage * itemsPerPage).map((post) => (
            viewMode === "list" ? (
              <AdminPostCardList
                key={post.id}
                post={post}
                onClick={() => setSelectedPost(post)}
                highlightText={lastDescriptionKeyword}
                onDelete={viewType === "deleted" ? undefined : handleDeletePost}
                onStatusChange={
                  viewType === "deleted" ? undefined : handleStatusChange
                }
                onActivateTicket={undefined}
                onHidePost={undefined}
                onUnhidePost={
                  viewType === "deleted" ? undefined : handleUnhidePost
                }
                isDeleting={deletingPostId === post.id}
                // Add restore and permanent delete actions for deleted posts
                onRestore={viewType === "deleted" ? handleRestorePost : undefined}
                onPermanentDelete={
                  viewType === "deleted" ? handlePermanentDeletePost : undefined
                }
                onRevert={viewType === "completed" ? handleRevertPost : undefined}
                showUnclaimedMessage={false}
                // Multi-select props
                isSelected={selectedPosts.has(post.id)}
                onSelectionChange={handlePostSelectionChange}
              />
            ) : (
              <AdminPostCard
                key={post.id}
                post={post}
                onClick={() => setSelectedPost(post)}
                highlightText={lastDescriptionKeyword}
                onDelete={viewType === "deleted" ? undefined : handleDeletePost}
                onStatusChange={
                  viewType === "deleted" ? undefined : handleStatusChange
                }
                onActivateTicket={undefined}
                onHidePost={undefined}
                onUnhidePost={
                  viewType === "deleted" ? undefined : handleUnhidePost
                }
                isDeleting={deletingPostId === post.id}
                // Add restore and permanent delete actions for deleted posts
                onRestore={viewType === "deleted" ? handleRestorePost : undefined}
                onPermanentDelete={
                  viewType === "deleted" ? handlePermanentDeletePost : undefined
                }
                onRevert={viewType === "completed" ? handleRevertPost : undefined}
                showUnclaimedMessage={false}
                // Multi-select props
                isSelected={selectedPosts.has(post.id)}
                onSelectionChange={handlePostSelectionChange}
              />
            )
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
        <AdminPostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onPostUpdate={(updatedPost) => {
            // Handle post update logic if needed
            console.log("Post updated:", updatedPost.id);
          }}
          onConfirmTurnover={(post, status) => {
            // Handle turnover confirmation logic if needed
            console.log("Turnover confirmed:", post.id, status);
          }}
          onConfirmCampusSecurityCollection={(post, status) => {
            // Handle campus security collection logic if needed
            console.log("Campus security collection:", post.id, status);
          }}
          onApprove={(post) => {
            // Handle approve logic if needed
            console.log("Approve post:", post.id);
          }}
          onHide={(post) => {
            // Handle hide logic if needed
            console.log("Hide post:", post.id);
          }}
          onUnhide={(post) => {
            // Handle unhide logic if needed
            console.log("Unhide post:", post.id);
          }}
          onDelete={(post) => {
            // Handle delete logic if needed
            console.log("Delete post:", post.id);
          }}
          showCampusSecurityButtons={false}
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
                  onClick={() => moveToDeleted(postToDelete)}
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

      {/* Revert Confirmation Modal */}
      {showRevertModal && postToRevert && (
        <>
          {/* Screen reader announcement */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Revert confirmation dialog opened for post: {postToRevert.title}
          </div>

          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="revert-modal-title"
            aria-describedby="revert-modal-description"
          >
            <div
              className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </div>
              </div>

              <h3
                className="text-lg font-semibold text-center mb-2"
                id="revert-modal-title"
              >
                Revert "{postToRevert.title}"?
              </h3>

              <p
                className="text-sm text-gray-600 text-center mb-4"
                id="revert-modal-description"
              >
                This will change the post back to pending status, reset any
                claim/handover requests, and delete associated photos.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for reverting (optional):
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  placeholder="Optional: Enter reason for reverting this post (e.g., 'Incorrect resolution', 'Policy violation', etc.)"
                  className="w-full p-3 border rounded-lg resize-none h-24 text-sm"
                  maxLength={500}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRevertCancel}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevertConfirm}
                  className="flex-1 px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Revert Post
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

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirmModal && bulkDeleteAction && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-[60]">
          <div className="relative top-8 mx-auto p-3 w-11/12 md:w-3/4 lg:w-1/2 rounded-md bg-white">
            <div className="py-2 px-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {viewType === "deleted" ? "Permanently Delete Multiple Posts" : "Delete Multiple Posts"}
                </h3>
                <button
                  onClick={handleCancelBulkDelete}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Bulk Delete Details:
                  </h4>
                  <p className="text-sm text-gray-700">
                    You are about to <strong>{viewType === "deleted" ? "permanently delete" : "move"}</strong>{" "}
                    <strong>{bulkDeleteAction.count}</strong> post
                    {bulkDeleteAction.count !== 1 ? "s" : ""}{viewType === "deleted" ? " from the system" : " to Recently Deleted"}.
                  </p>
                </div>

                <div className={`p-4 rounded-lg ${viewType === "deleted" ? "bg-red-50" : "bg-blue-50"}`}>
                  <p className={`text-sm ${viewType === "deleted" ? "text-red-800" : "text-blue-800"}`}>
                    {viewType === "deleted"
                      ? "This will permanently delete all selected posts from the system. This action cannot be undone."
                      : "This will move all selected posts to the Recently Deleted section. Posts can be restored from there if needed, or permanently deleted later."
                    }
                  </p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ This action will affect {bulkDeleteAction.count} post
                    {bulkDeleteAction.count !== 1 ? "s" : ""} and notifications will be sent to the post creators.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  onClick={handleCancelBulkDelete}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDeleteConfirm}
                  disabled={isBulkDeleting}
                  className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBulkDeleting
                    ? "Deleting..."
                    : `${viewType === "deleted" ? "Permanently Delete" : "Move"} ${bulkDeleteAction.count} Posts${viewType === "deleted" ? "" : " to Recently Deleted"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
