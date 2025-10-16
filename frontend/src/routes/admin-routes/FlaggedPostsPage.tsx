import { useState, useMemo } from "react";
import { useAdminPosts } from "../../hooks/usePosts";
import { useToast } from "../../context/ToastContext";
import { postService } from "../../services/firebase/posts";
import type { Post } from "../../types/Post";
import PageWrapper from "../../components/PageWrapper";
import NavHeader from "../../components/NavHeadComp";
import AdminPostCard from "../../components/AdminPostCard";
import AdminPostModal from "../../components/AdminPostModal";
import SearchBar from "../../components/SearchBar";

export default function FlaggedPostsPage() {
  const { posts = [] } = useAdminPosts();
  const { showToast } = useToast();

  console.log("FlaggedPostsPage component rendering with posts:", posts.length);

  // Debug logging to see what's happening
  console.log("FlaggedPostsPage - Total posts:", posts.length);
  console.log("FlaggedPostsPage - Flagged posts:", posts.filter(p => p.isFlagged === true).length);
  console.log("FlaggedPostsPage - Posts with isFlagged property:", posts.filter(p => 'isFlagged' in p).length);
  console.log("FlaggedPostsPage - Sample posts:", posts.slice(0, 3).map(p => ({ id: p.id, isFlagged: p.isFlagged })));

  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "hide" | "unhide" | "delete";
    post: Post | null;
  } | null>(null);

  // Bulk actions state
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<{
    type: "approve" | "hide" | "unhide" | "delete";
    count: number;
  } | null>(null);

  // Post modal state
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);

  // State for loading actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // State for search functionality
  const [query, setQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // Filter posts to show only flagged ones
  const flaggedPosts = useMemo(() => {
    const flagged = posts.filter((post: Post) => post.isFlagged === true);
    const stringTrue = posts.filter((post: Post) => typeof post.isFlagged === 'string' && post.isFlagged === "true").length;
    const booleanTrue = posts.filter((post: Post) => post.isFlagged === true).length;
    const booleanFalse = posts.filter((post: Post) => post.isFlagged === false).length;
    const undefinedFlagged = posts.filter((post: Post) => post.isFlagged === undefined).length;

    console.log("FlaggedPostsPage - flaggedPosts computed:", flagged.length, "from", posts.length, "posts");
    console.log("FlaggedPostsPage - isFlagged analysis:");
    console.log("  - String 'true':", stringTrue);
    console.log("  - Boolean true:", booleanTrue);
    console.log("  - Boolean false:", booleanFalse);
    console.log("  - Undefined:", undefinedFlagged);
    console.log("  - Total with isFlagged property:", posts.filter(p => 'isFlagged' in p).length);

    return flagged;
  }, [posts]);

  // Filtered flagged posts based on search criteria
  const filteredFlaggedPosts = useMemo(() => {
    return flaggedPosts.filter((post) => {
      const matchesQuery = query.trim() === "" || 
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.description.toLowerCase().includes(query.toLowerCase());

      const matchesCategory = selectedCategoryFilter === "All" || 
        post.category === selectedCategoryFilter;

      const matchesDescription = description.trim() === "" || 
        post.description.toLowerCase().includes(description.toLowerCase());

      const matchesLocation = location.trim() === "" || 
        post.location?.toLowerCase().includes(location.toLowerCase());

      return matchesQuery && matchesCategory && matchesDescription && matchesLocation;
    });
  }, [flaggedPosts, query, selectedCategoryFilter, description, location]);

  // Handle search functionality
  const handleSearch = (searchQuery: string, filters: any) => {
    setQuery(searchQuery);
    setSelectedCategoryFilter(filters.selectedCategory || "All");
    setDescription(filters.description || "");
    setLocation(filters.location || "");
  };

  // Handle clear search
  const handleClear = () => {
    setQuery("");
    setSelectedCategoryFilter("All");
    setDescription("");
    setLocation("");
  };

  const handleActionClick = (
    action: "approve" | "hide" | "unhide" | "delete",
    post: Post
  ) => {
    setConfirmAction({ type: action, post });
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !confirmAction.post) return;

    const { type, post } = confirmAction;
    const postId = post.id;

    try {
      switch (type) {
        case "approve":
          await postService.unflagPost(postId);
          showToast(
            "success",
            "Success",
            "Post approved and unflagged successfully"
          );
          break;
        case "hide":
          await postService.hidePost(postId);
          showToast(
            "success",
            "Success",
            "Post hidden from public view successfully"
          );
          break;
        case "unhide":
          await postService.unhidePost(postId);
          showToast(
            "success",
            "Success",
            "Post unhidden and visible to public successfully"
          );
          break;
        case "delete":
          await postService.deletePost(postId, true); // Hard delete instead of soft delete
          showToast(
            "success",
            "Success",
            "Post permanently deleted successfully"
          );
          break;
      }
    } catch (err: any) {
      const actionText =
        type === "approve"
          ? "approve"
          : type === "hide"
          ? "hide"
          : type === "unhide"
          ? "unhide"
          : "delete";
      showToast(
        "error",
        "Error",
        err.message || `Failed to ${actionText} post`
      );
    } finally {
      setActionLoading(null);
      setShowConfirmModal(false);
      setConfirmAction(null);
    }
  };

  const handleCancelAction = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  // Bulk action handlers
  const handleSelectAll = () => {
    if (selectedPosts.size === filteredFlaggedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredFlaggedPosts.map((post) => post.id)));
    }
  };

  const handleBulkActionClick = (
    action: "approve" | "hide" | "unhide" | "delete"
  ) => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to perform bulk action");
      return;
    }
    setBulkAction({ type: action, count: selectedPosts.size });
    setShowBulkConfirmModal(true);
  };

  const handleBulkConfirmAction = async () => {
    if (!bulkAction || selectedPosts.size === 0) return;

    const { type } = bulkAction;
    const selectedPostIds = Array.from(selectedPosts);
    let successCount = 0;
    let errorCount = 0;

    try {
      setActionLoading("bulk");

      for (const postId of selectedPostIds) {
        try {
          switch (type) {
            case "approve":
              await postService.unflagPost(postId);
              break;
            case "hide":
              await postService.hidePost(postId);
              break;
            case "unhide":
              await postService.unhidePost(postId);
              break;
            case "delete":
              await postService.deletePost(postId, true); // Hard delete instead of soft delete
              break;
          }
          successCount++;
        } catch (err) {
          console.error(`Failed to ${type} post ${postId}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast(
          "success",
          "Success",
          `Successfully processed ${successCount} posts`
        );
      } else {
        showToast(
          "warning",
          "Warning",
          `Processed ${successCount} posts successfully, ${errorCount} failed`
        );
      }
    } catch (err: any) {
      showToast("error", "Error", "Failed to process bulk action");
    } finally {
      setActionLoading(null);
      setShowBulkConfirmModal(false);
      setBulkAction(null);
    }
  };

  const handleCancelBulkAction = () => {
    setShowBulkConfirmModal(false);
    setBulkAction(null);
  };

  return (
    <PageWrapper title="Flagged Posts">
      <div className="w-full mx-auto mb-13">
        {/* Page Header */}
        <div className="hidden px-4 py-3 sm:px-6 lg:px-8 lg:flex items-center justify-between bg-gray-50 border-b border-zinc-200">
          <div className="">
            <h1 className="text-base font-medium text-gray-900">
              Flagged Posts Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Review and manage posts that have been flagged by users
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
              {flaggedPosts.length} Flagged
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <NavHeader
          title="Flagged Posts Management"
          description="Review and manage posts that have been flagged by users"
        />

        {/* Search Bar */}
        <div className="px-4 sm:px-6 lg:px-8">
          <SearchBar
            onSearch={handleSearch}
            onClear={handleClear}
            query={query}
            setQuery={setQuery}
            selectedCategoryFilter={selectedCategoryFilter}
            setSelectedCategoryFilter={setSelectedCategoryFilter}
          />
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8">
          {/* Bulk Actions Bar */}
          {filteredFlaggedPosts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-3 mb-6 mt-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedPosts.size === filteredFlaggedPosts.length &&
                        filteredFlaggedPosts.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-5 h-5 text-brand border-gray-300 rounded focus:ring-brand"
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">
                        Select All ({selectedPosts.size}/{filteredFlaggedPosts.length})
                      </span>
                      {selectedPosts.size > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPosts.size} post
                          {selectedPosts.size !== 1 ? "s" : ""} selected
                        </p>
                      )}
                    </div>
                  </label>
                </div>

                {selectedPosts.size > 0 && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleBulkActionClick("approve")}
                      disabled={actionLoading === "bulk"}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
                    >
                      {actionLoading === "bulk"
                        ? "Processing..."
                        : `✓ Approve (${selectedPosts.size})`}
                    </button>

                    <button
                      onClick={() => handleBulkActionClick("hide")}
                      disabled={actionLoading === "bulk"}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
                    >
                      {actionLoading === "bulk"
                        ? "Processing..."
                        : `👁️ Hide (${selectedPosts.size})`}
                    </button>

                    <button
                      onClick={() => handleBulkActionClick("delete")}
                      disabled={actionLoading === "bulk"}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
                    >
                      {actionLoading === "bulk"
                        ? "Processing..."
                        : `🗑️ Delete (${selectedPosts.size})`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {filteredFlaggedPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🚩</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No Flagged Posts
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                All posts are clean! No flagged content to review at this time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFlaggedPosts.map((post) => (
                <AdminPostCard
                  key={post.id}
                  post={post}
                  onClick={() => {
                    setSelectedPost(post);
                    setShowPostModal(true);
                  }}
                  highlightText=""
                  onDelete={() => handleActionClick("delete", post)}
                  onHidePost={() => handleActionClick("hide", post)}
                  onUnhidePost={() => handleActionClick("unhide", post)}
                  onApprove={() => handleActionClick("approve", post)}
                  isSelected={selectedPosts.has(post.id)}
                  onSelectionChange={(post, selected) => {
                    const newSet = new Set(selectedPosts);
                    if (selected) {
                      newSet.add(post.id);
                    } else {
                      newSet.delete(post.id);
                    }
                    setSelectedPosts(newSet);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-[60]">
          <div className="relative top-8 mx-auto p-3 w-11/12 md:w-3/4 lg:w-1/2 rounded-md bg-white">
            <div className="py-2 px-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {confirmAction.type === "approve" && "Approve Post"}
                  {confirmAction.type === "hide" && "Hide Post"}
                  {confirmAction.type === "unhide" && "Unhide Post"}
                  {confirmAction.type === "delete" && "Delete Post"}
                </h3>
                <button
                  onClick={handleCancelAction}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Post Details:
                  </h4>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Title:</strong> {confirmAction.post?.title || "N/A"}
                  </p>
                  <p className="text-sm text-gray-700 mb-1">
                    <strong>Type:</strong>{" "}
                    {confirmAction.post?.type
                      ? confirmAction.post.type === "lost"
                        ? "Lost Item"
                        : "Found Item"
                      : "N/A"}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Category:</strong>{" "}
                    {confirmAction.post?.category || "N/A"}
                  </p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2">
                    Flag Information:
                  </h4>
                  <p className="text-sm text-red-700 mb-1">
                    <strong>Reason:</strong>{" "}
                    {confirmAction.post?.flagReason || "N/A"}
                  </p>
                  <p className="text-sm text-red-700">
                    <strong>Flagged by:</strong>{" "}
                    {confirmAction.post?.user
                      ? `${confirmAction.post.user.firstName || ""} ${
                          confirmAction.post.user.lastName || ""
                        }`.trim() || "Unknown"
                      : "Unknown"}
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    {confirmAction.type === "approve" &&
                      "This will remove the flag and make the post visible to all users again."}
                    {confirmAction.type === "hide" &&
                      "This will hide the post from public view but keep it in the system. It can be unhidden later."}
                    {confirmAction.type === "unhide" &&
                      "This will make the post visible to all users again. The post will remain flagged until approved."}
                    {confirmAction.type === "delete" &&
                      "This will permanently delete the post and all associated data. This action cannot be undone."}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  onClick={handleCancelAction}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={
                    !confirmAction.post ||
                    actionLoading === confirmAction.post.id
                  }
                  className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    confirmAction.type === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : confirmAction.type === "hide"
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : confirmAction.type === "unhide"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {confirmAction.post && actionLoading === confirmAction.post.id
                    ? "Processing..."
                    : confirmAction.type === "approve"
                    ? "Approve Post"
                    : confirmAction.type === "hide"
                    ? "Hide Post"
                    : confirmAction.type === "unhide"
                    ? "Unhide Post"
                    : "Delete Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Confirmation Modal */}
      {showBulkConfirmModal && bulkAction && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-[60]">
          <div className="relative top-8 mx-auto p-3 w-11/12 md:w-3/4 lg:w-1/2 rounded-md bg-white">
            <div className="py-2 px-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {bulkAction.type === "approve" && "Approve Multiple Posts"}
                  {bulkAction.type === "hide" && "Hide Multiple Posts"}
                  {bulkAction.type === "unhide" && "Unhide Multiple Posts"}
                  {bulkAction.type === "delete" && "Delete Multiple Posts"}
                </h3>
                <button
                  onClick={handleCancelBulkAction}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Bulk Action Details:
                  </h4>
                  <p className="text-sm text-gray-700">
                    You are about to <strong>{bulkAction.type}</strong>{" "}
                    <strong>{bulkAction.count}</strong> post
                    {bulkAction.count !== 1 ? "s" : ""}.
                  </p>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    {bulkAction.type === "approve" &&
                      "This will remove flags from all selected posts and make them visible to all users again."}
                    {bulkAction.type === "hide" &&
                      "This will hide all selected posts from public view but keep them in the system. They can be unhidden later."}
                    {bulkAction.type === "unhide" &&
                      "This will make all selected posts visible to all users again. The posts will remain flagged until approved."}
                    {bulkAction.type === "delete" &&
                      "This will permanently delete all selected posts and all associated data. This action cannot be undone."}
                  </p>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ This action will affect {bulkAction.count} post
                    {bulkAction.count !== 1 ? "s" : ""} and cannot be undone.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  onClick={handleCancelBulkAction}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkConfirmAction}
                  disabled={actionLoading === "bulk"}
                  className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    bulkAction.type === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : bulkAction.type === "hide"
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : bulkAction.type === "unhide"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actionLoading === "bulk"
                    ? "Processing..."
                    : bulkAction.type === "approve"
                    ? `Approve ${bulkAction.count} Posts`
                    : bulkAction.type === "hide"
                    ? `Hide ${bulkAction.count} Posts`
                    : bulkAction.type === "unhide"
                    ? `Unhide ${bulkAction.count} Posts`
                    : `Delete ${bulkAction.count} Posts`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Post Modal */}
      {showPostModal && selectedPost && (
        <AdminPostModal
          post={selectedPost}
          onClose={() => {
            setShowPostModal(false);
            setSelectedPost(null);
          }}
          onPostUpdate={(_updatedPost) => {
            // No need to manually update flaggedPosts since it's computed from posts
            // The useAdminPosts hook will handle updates automatically
          }}
          onConfirmTurnover={(_post, status) => {
            showToast(
              "success",
              "Turnover Confirmed",
              `Post turnover has been ${
                status === "confirmed" ? "confirmed" : "marked as not received"
              }`
            );
          }}
          onConfirmCampusSecurityCollection={(_post, status) => {
            showToast(
              "success",
              "Collection Confirmed",
              `Item has been ${
                status === "collected" ? "collected" : "marked as not available"
              }`
            );
          }}
          onApprove={() => handleActionClick("approve", selectedPost)}
          onHide={() => handleActionClick("hide", selectedPost)}
          onUnhide={() => handleActionClick("unhide", selectedPost)}
          onDelete={() => handleActionClick("delete", selectedPost)}
          showDeleteButton={true}
        />
      )}
    </PageWrapper>
  );
}
