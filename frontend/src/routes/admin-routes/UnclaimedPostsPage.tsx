import { useState, useMemo } from "react";
import { useAdminPosts } from "../../hooks/usePosts";
import { useToast } from "../../context/ToastContext";
import { postService } from "../../services/firebase/posts";
import { notificationSender } from "../../services/firebase/notificationSender";
import type { Post } from "../../types/Post";
import PageWrapper from "../../components/layout/PageWrapper";
import NavHeader from "../../components/layout/NavHead";
import AdminPostCard from "../../components/admin/AdminPostCard";
import AdminPostModal from "../../components/admin/AdminPostModal";
import AdminPostCardList from "../../components/admin/AdminPostCardList";
import MultiControlPanel from "../../components/common/MultiControlPanel";
import { useAuth } from "../../context/AuthContext";
import ActivationModal from "../../components/modals/Activation";
import SearchBar from "../../components/common/SearchBar";

function fuzzyMatch(text: string, query: string): boolean {
  const cleanedText = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

  // Make sure every keyword appears in the text
  return queryWords.every((word) => cleanedText.includes(word));
}

export default function UnclaimedPostsPage() {
  const { posts = [], loading, error } = useAdminPosts();
  const { showToast } = useToast();
  const { userData } = useAuth();

  // State for search and filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("All");
  const [rawResults, setRawResults] = useState<Post[] | null>(null);
  const [lastDescriptionKeyword, setLastDescriptionKeyword] = useState("");

  // State for activation
  const [activatingPostId, setActivatingPostId] = useState<string | null>(null);

  // State for view type filtering (similar to AdminHomePage)
  const [viewType, setViewType] = useState<"all" | "lost" | "found">("all");

  // State for modal
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for activation modal
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [postToActivate, setPostToActivate] = useState<Post | null>(null);

  // State for view mode (card/list view)
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // State for post selection
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());

  // State for bulk delete confirmation modal
  const [showBulkDeleteConfirmModal, setShowBulkDeleteConfirmModal] = useState(false);
  const [bulkDeleteAction, setBulkDeleteAction] = useState<{
    count: number;
  } | null>(null);

  // Filter posts to show only unclaimed ones
  const unclaimedPosts = useMemo(() => {
    if (rawResults) {
      return rawResults.filter(
        (post) => post.status === "unclaimed" || Boolean(post.movedToUnclaimed)
      );
    }

    return posts.filter(
      (post) => post.status === "unclaimed" || Boolean(post.movedToUnclaimed)
    );
  }, [posts, rawResults]);

  // Apply category filtering and viewType filtering
  const filteredPosts = useMemo(() => {
    let filtered = unclaimedPosts;

    // Apply viewType filtering
    if (viewType !== "all") {
      filtered = filtered.filter((post) => post.type.toLowerCase() === viewType);
    }

    // Apply category filtering
    if (selectedCategoryFilter && selectedCategoryFilter !== "All") {
      filtered = filtered.filter(
        (post) =>
          post.category &&
          post.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
      );
    }

    return filtered;
  }, [unclaimedPosts, selectedCategoryFilter, viewType]);

  // Handle search
  const handleSearch = (query: string, filters: any) => {
    setLastDescriptionKeyword(filters.description || "");

    const filtered = unclaimedPosts.filter((item) => {
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

  // Handle clear search
  const handleClearSearch = () => {
    setRawResults(null);
    setLastDescriptionKeyword("");
    setSearchQuery("");
    setSelectedCategoryFilter("All");
  };

  // Handle post activation (move back from unclaimed status) - opens activation modal
  const handleActivatePost = (post: Post) => {
    if (!post.movedToUnclaimed && post.status !== "unclaimed") {
      showToast(
        "error",
        "Cannot Activate",
        "This post is not in unclaimed status."
      );
      return;
    }

    // Open activation modal instead of using confirm dialog
    setPostToActivate(post);
    setIsActivationModalOpen(true);
  };

  // Handle activation confirmation from modal
  const handleActivationConfirm = async (adminNotes?: string) => {
    if (!postToActivate) return;

    try {
      setActivatingPostId(postToActivate.id);

      // Use updatePostStatus instead of activateTicket to support admin notes
      const originalStatus = postToActivate.originalStatus || 'pending';
      await postService.updatePostStatus(postToActivate.id, originalStatus, adminNotes);

      // Send notification to the post creator
      if (postToActivate.creatorId) {
        try {
          await notificationSender.sendActivateNotification({
            postId: postToActivate.id,
            postTitle: postToActivate.title,
            postType: postToActivate.type as "lost" | "found",
            creatorId: postToActivate.creatorId,
            creatorName:
              postToActivate.user.firstName && postToActivate.user.lastName
                ? `${postToActivate.user.firstName} ${postToActivate.user.lastName}`
                : postToActivate.user.email?.split("@")[0] || "User",
            adminName:
              userData?.firstName && userData?.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData?.email?.split("@")[0] || "Admin",
          });
          console.log("✅ Activate notification sent to user");
        } catch (notificationError) {
          console.warn(
            "⚠️ Failed to send activate notification:",
            notificationError
          );
          // Don't throw - notification failures shouldn't break main functionality
        }
      }

      const statusMessage = postToActivate.movedToUnclaimed
        ? `"${postToActivate.title}" has been activated from expired status and moved back to active status.`
        : `"${postToActivate.title}" has been activated and moved back to active status.`;

      showToast("success", "Post Activated", statusMessage);

      // Close modal and update local state
      setIsModalOpen(false);

      // Update local state to remove the activated post from unclaimed list
      setRawResults((prev) =>
        prev ? prev.filter((p) => p.id !== postToActivate.id) : null
      );
    } catch (error: any) {
      console.error("Failed to activate post:", error);
      showToast(
        "error",
        "Activation Failed",
        error.message || "Failed to activate post"
      );
    } finally {
      setActivatingPostId(null);
    }
  };

  // Handle modal open
  const handleOpenModal = (post: Post) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleCloseActivationModal = () => {
    setIsActivationModalOpen(false);
    setPostToActivate(null);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
  };

  // Handle post selection change
  const handlePostSelectionChange = (post: Post, selected: boolean) => {
    const newSet = new Set(selectedPosts);
    if (selected) {
      newSet.add(post.id);
    } else {
      newSet.delete(post.id);
    }
    setSelectedPosts(newSet);
  };

  // Handle select all posts
  const handleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((post) => post.id)));
    }
  };

  // Handle bulk activation
  const handleBulkActivate = async () => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to activate");
      return;
    }

    try {
      setActivatingPostId("bulk");

      // Convert selected post IDs to post objects
      const postsToActivate = filteredPosts.filter(post => selectedPosts.has(post.id));

      // Process each post activation
      const results = await Promise.allSettled(
        postsToActivate.map(async (post) => {
          const originalStatus = post.originalStatus || 'pending';
          await postService.updatePostStatus(post.id, originalStatus);

          // Send notification for each post
          if (post.creatorId) {
            try {
              await notificationSender.sendActivateNotification({
                postId: post.id,
                postTitle: post.title,
                postType: post.type as "lost" | "found",
                creatorId: post.creatorId,
                creatorName:
                  post.user.firstName && post.user.lastName
                    ? `${post.user.firstName} ${post.user.lastName}`
                    : post.user.email?.split("@")[0] || "User",
                adminName:
                  userData?.firstName && userData?.lastName
                    ? `${userData.firstName} ${userData.lastName}`
                    : userData?.email?.split("@")[0] || "Admin",
              });
            } catch (notificationError) {
              console.warn(
                `⚠️ Failed to send activate notification for post ${post.id}:`,
                notificationError
              );
            }
          }

          return post;
        })
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      if (failed === 0) {
        showToast("success", "Bulk Activation Complete", `Successfully activated ${successful} posts`);
      } else {
        showToast("warning", "Bulk Activation Partial", `Activated ${successful} posts, ${failed} failed`);
      }

      // Clear selection and update local state
      setSelectedPosts(new Set());
      setRawResults((prev) =>
        prev ? prev.filter((p) => !selectedPosts.has(p.id)) : null
      );

    } catch (error: any) {
      console.error("Failed to bulk activate posts:", error);
      showToast(
        "error",
        "Bulk Activation Failed",
        error.message || "Failed to activate selected posts"
      );
    } finally {
      setActivatingPostId(null);
    }
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedPosts(new Set());
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to delete");
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

  // Handle bulk delete confirmation - actually perform the deletion
  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteAction || selectedPosts.size === 0) return;

    const selectedPostIds = Array.from(selectedPosts);
    let successCount = 0;
    let errorCount = 0;

    try {
      setActivatingPostId("bulk");

      for (const postId of selectedPostIds) {
        try {
          const post = filteredPosts.find((p) => p.id === postId);
          if (!post) {
            throw new Error("Post not found");
          }

          await postService.deletePost(postId, false, userData?.email || "admin");

          // Send notification to the post creator
          if (post.creatorId) {
            try {
              await notificationSender.sendDeleteNotification({
                postId: post.id,
                postTitle: post.title,
                postType: post.type as "lost" | "found",
                creatorId: post.creatorId,
                creatorName:
                  post.user.firstName && post.user.lastName
                    ? `${post.user.firstName} ${post.user.lastName}`
                    : post.user.email?.split("@")[0] || "User",
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

          successCount++;
        } catch (err) {
          console.error(`Failed to delete post ${postId}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast(
          "success",
          "Bulk Delete Complete",
          `Successfully deleted ${successCount} posts`
        );
      } else {
        showToast(
          "warning",
          "Bulk Delete Partial",
          `Deleted ${successCount} posts successfully, ${errorCount} failed`
        );
      }
    } catch (err: any) {
      showToast("error", "Bulk Delete Failed", "Failed to delete selected posts");
    } finally {
      setActivatingPostId(null);
      setShowBulkDeleteConfirmModal(false);
      setBulkDeleteAction(null);
      // Clear selection and update local state
      setSelectedPosts(new Set());
      setRawResults((prev) =>
        prev ? prev.filter((p) => !selectedPostIds.includes(p.id)) : null
      );
    }
  };

  // Handle post deletion from modal
  const handleModalDeletePost = async (postId: string) => {
    try {
      // Find the post object to get creator information for notifications
      const post = filteredPosts.find((p) => p.id === postId);
      if (!post) {
        throw new Error("Post not found");
      }

      await postService.deletePost(postId, false, userData?.email || "admin");

      // Send notification to the post creator
      if (post.creatorId) {
        try {
          await notificationSender.sendDeleteNotification({
            postId: post.id,
            postTitle: post.title,
            postType: post.type as "lost" | "found",
            creatorId: post.creatorId,
            creatorName:
              post.user.firstName && post.user.lastName
                ? `${post.user.firstName} ${post.user.lastName}`
                : post.user.email?.split("@")[0] || "User",
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

      showToast(
        "success",
        "Post Deleted",
        "Post has been moved to Recently Deleted"
      );
      handleCloseModal();
      // Update local state to remove the deleted post from unclaimed list
      setRawResults((prev) =>
        prev ? prev.filter((p) => p.id !== postId) : null
      );
    } catch (error: any) {
      console.error("Failed to delete post from modal:", error);
      showToast(
        "error",
        "Delete Failed",
        error.message || "Failed to delete post"
      );
    }
  };

  if (loading) {
    return (
      <PageWrapper title="Unclaimed Posts">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
            <p className="text-gray-600">Loading unclaimed posts...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper title="Unclaimed Posts">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-teal-600"
            >
              Try Again
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Unclaimed Posts">
      <div className="w-full mx-auto mb-5">
        {/* Page Header */}
        <div className="hidden px-4 py-3 sm:px-6 lg:px-8 lg:flex items-center justify-between bg-gray-50 border-b border-zinc-200">
          <div className="">
            <h1 className="text-base font-medium text-gray-900">
              Unclaimed Posts Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage posts that have been automatically or manually marked as
              unclaimed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
              {filteredPosts.length} Unclaimed
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <NavHeader
          title="Unclaimed Posts"
          description="Manage posts that have been marked as unclaimed"
        />

        {/* Search Bar */}
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <SearchBar
            onSearch={handleSearch}
            onClear={handleClearSearch}
            query={searchQuery}
            setQuery={setSearchQuery}
            selectedCategoryFilter={selectedCategoryFilter}
            setSelectedCategoryFilter={setSelectedCategoryFilter}
          />
        </div>

        {/* Filter Buttons and MultiControl Panel */}
        <div className="flex flex-wrap justify-between items-center gap-3 w-full px-4 sm:px-6 lg:px-8 lg:justify-between lg:gap-3 mb-5">
          <div className="flex flex-wrap sm:justify-center items-center gap-3 lg:justify-start lg:gap-3">
            <button
              className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
                viewType === "all"
                  ? "bg-navyblue text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
              }`}
              onClick={() => {
                setViewType("all");
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
                setViewType("lost");
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
                setViewType("found");
              }}
            >
              Found Item Reports
            </button>
          </div>

          {/* MultiControl Panel */}
          {filteredPosts.length > 0 && (
            <MultiControlPanel
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectedCount={selectedPosts.size}
              totalCount={filteredPosts.length}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onBulkDelete={handleBulkDelete}
              isBulkDeleting={activatingPostId === "bulk"}
              customActions={
                selectedPosts.size > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleBulkActivate()}
                      disabled={activatingPostId === "bulk"}
                      className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors shadow-sm"
                      title={`Activate (${selectedPosts.size})`}
                    >
                      {activatingPostId === "bulk"
                        ? "Activating..."
                        : `Activate (${selectedPosts.size})`}
                    </button>
                  </div>
                )
              }
            />
          )}
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 mb-13">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No Unclaimed Posts
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {viewType === "all"
                  ? "No unclaimed posts found."
                  : viewType === "lost"
                  ? "No unclaimed lost item reports found."
                  : "No unclaimed found item reports found."}
              </p>
            </div>
          ) : (
            <>
              {viewMode === "list" ? (
                <div className="space-y-4">
                  {filteredPosts.map((post) => (
                    <AdminPostCardList
                      key={post.id}
                      post={post}
                      onClick={() => handleOpenModal(post)}
                      highlightText={lastDescriptionKeyword}
                      onActivateTicket={handleActivatePost}
                      onDelete={(post: Post) => handleModalDeletePost(post.id)}
                      isDeleting={activatingPostId === post.id}
                      showUnclaimedMessage={false}
                      hideStatusDropdown={true}
                      // Multi-select props
                      isSelected={selectedPosts.has(post.id)}
                      onSelectionChange={handlePostSelectionChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredPosts.map((post) => (
                    <AdminPostCard
                      key={post.id}
                      post={post}
                      onClick={() => handleOpenModal(post)}
                      highlightText={lastDescriptionKeyword}
                      onActivateTicket={handleActivatePost}
                      onDelete={(post: Post) => handleModalDeletePost(post.id)}
                      isDeleting={activatingPostId === post.id}
                      showUnclaimedMessage={false}
                      hideStatusDropdown={true}
                      // Multi-select props
                      isSelected={selectedPosts.has(post.id)}
                      onSelectionChange={handlePostSelectionChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Unclaimed Post Modal */}
      {isModalOpen && selectedPost && (
        <AdminPostModal
          post={selectedPost}
          onClose={handleCloseModal}
          showUnclaimedFeatures={true}
          onDelete={(post) => handleModalDeletePost(post.id)}
        />
      )}

      {/* Activation Modal */}
      <ActivationModal
        post={postToActivate}
        isOpen={isActivationModalOpen}
        onClose={handleCloseActivationModal}
        onConfirm={handleActivationConfirm}
        isActivating={activatingPostId === postToActivate?.id}
      />

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirmModal && bulkDeleteAction && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-[60]">
          <div className="relative top-8 mx-auto p-3 w-11/12 md:w-3/4 lg:w-1/2 rounded-md bg-white">
            <div className="py-2 px-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Delete Multiple Posts
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
                    You are about to <strong>delete</strong>{" "}
                    <strong>{bulkDeleteAction.count}</strong> post
                    {bulkDeleteAction.count !== 1 ? "s" : ""}.
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    This will move all selected posts to the Recently Deleted section.
                    Posts can be restored from there if needed.
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
                  disabled={activatingPostId === "bulk"}
                  className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activatingPostId === "bulk"
                    ? "Deleting..."
                    : `Delete ${bulkDeleteAction.count} Posts`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
