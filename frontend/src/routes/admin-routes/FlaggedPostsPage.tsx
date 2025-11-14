import { useState, useMemo, useEffect } from "react";
import { useAdminPosts } from "@/hooks/usePosts";
import { useToast } from "@/context/ToastContext";
import { postService } from "@/services/firebase/posts";
import type { Post } from "@/types/Post";
import PageWrapper from "@/components/layout/PageWrapper";
import NavHeader from "@/components/layout/NavHead";
import AdminPostCard from "@/components/admin/AdminPostCard";
import AdminPostCardList from "@/components/admin/AdminPostCardList";
import AdminPostModal from "@/components/admin/AdminPostModal";
import SearchBar from "@/components/common/SearchBar";
import MultiControlPanel from "@/components/common/MultiControlPanel";

// Fuzzy match function for flexible searching
function fuzzyMatch(text: string, query: string, postUser?: { firstName?: string; lastName?: string; email?: string }): boolean {
  if (!text) return false;
  
  const cleanedText = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

  // If no query words, return true
  if (queryWords.length === 0) return true;

  // Check if query matches user's name or email
  if (postUser) {
    const userName = `${postUser.firstName || ''} ${postUser.lastName || ''}`.toLowerCase().trim();
    const userEmail = postUser.email?.toLowerCase() || '';
    
    // Check if any query word matches user's name or email
    const userMatch = queryWords.some(word => 
      userName.includes(word) || 
      (postUser.firstName?.toLowerCase().includes(word) || 
       postUser.lastName?.toLowerCase().includes(word)) ||
      userEmail.includes(word)
    );
    
    if (userMatch) return true;
  }

  // For single word queries, use partial matching
  if (queryWords.length === 1) {
    return cleanedText.includes(queryWords[0]);
  }

  // For multiple words, require at least 70% of words to match (more flexible)
  const matchedWords = queryWords.filter((word) => cleanedText.includes(word));
  return matchedWords.length >= Math.ceil(queryWords.length * 0.7);
}

export default function FlaggedPostsPage() {
  const { posts = [] } = useAdminPosts();
  const { showToast } = useToast();

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

  // State for view type filtering (similar to AdminHomePage)
  const [viewType, setViewType] = useState<"all" | "lost" | "found">("all");

  // State for view mode (card/list view)
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // State for search functionality
  const [query, setQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // Filter posts to show only flagged ones
  const flaggedPosts = useMemo(() => {
    return posts.filter((post: Post) => post.isFlagged === true);
  }, [posts]);
  const filteredFlaggedPosts = useMemo(() => {
    return flaggedPosts.filter((post: Post) => {
      // Apply viewType filtering first
      let shouldShow = false;

      if (viewType === "all") {
        shouldShow = true; // Show all flagged posts
      } else {
        shouldShow = post.type.toLowerCase() === viewType;
      }

      if (!shouldShow) return false;

      // Then apply search criteria with fuzzy matching
      const matchesQuery =
        query.trim() === "" ||
        fuzzyMatch(post.title, query, post.user) ||
        fuzzyMatch(post.description, query, post.user) ||
        (post.user?.firstName && fuzzyMatch(post.user.firstName, query)) ||
        (post.user?.lastName && fuzzyMatch(post.user.lastName, query)) ||
        (post.user?.email && fuzzyMatch(post.user.email, query));

      const matchesCategory =
        selectedCategoryFilter === "All" ||
        post.category === selectedCategoryFilter;

      const matchesDescription =
        description.trim() === "" ||
        fuzzyMatch(post.description, description, post.user) ||
        (post.user?.firstName && fuzzyMatch(post.user.firstName, description)) ||
        (post.user?.lastName && fuzzyMatch(post.user.lastName, description)) ||
        (post.user?.email && fuzzyMatch(post.user.email, description));

      const matchesLocation =
        location.trim() === "" ||
        post.location?.toLowerCase().includes(location.toLowerCase());

      return (
        matchesQuery && matchesCategory && matchesDescription && matchesLocation
      );
    });
  }, [
    flaggedPosts,
    query,
    selectedCategoryFilter,
    description,
    location,
    viewType,
  ]);

  // Clean up selected posts that are no longer in the filtered list
  useEffect(() => {
    const currentFilteredIds = new Set(filteredFlaggedPosts.map((post: Post) => post.id));
    setSelectedPosts((prev: Set<string>) => {
      const newSet = new Set<string>();
      for (const postId of prev) {
        if (currentFilteredIds.has(postId)) {
          newSet.add(postId);
        }
      }
      return newSet;
    });
  }, [filteredFlaggedPosts]);

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

    // Check if trying to hide an already hidden post
    if (type === "hide" && post.isHidden) {
      showToast("error", "Error", "Post is already hidden");
      setShowConfirmModal(false);
      setConfirmAction(null);
      return;
    }

    // Check if trying to unhide an already visible post
    if (type === "unhide" && !post.isHidden) {
      showToast("error", "Error", "Post is already visible");
      setShowConfirmModal(false);
      setConfirmAction(null);
      return;
    }

    try {
      switch (type) {
        case "approve":
          await postService.unflagPost(postId);
          showToast(
            "success",
            "Success",
            "Post approved and unflagged successfully"
          );
          // Remove from selection since approved posts leave the flagged view
          setSelectedPosts(prev => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
          break;
        case "hide":
          await postService.hidePost(postId);
          showToast(
            "success",
            "Success",
            "Post hidden from public view successfully"
          );
          // Keep in selection since hidden posts remain in flagged view
          break;
        case "unhide":
          await postService.unhidePost(postId);
          showToast(
            "success",
            "Success",
            "Post unhidden and visible to public successfully"
          );
          // Keep in selection since unhidden posts remain in flagged view
          break;
        case "delete":
          await postService.deletePost(postId, true); // Hard delete instead of soft delete
          showToast(
            "success",
            "Success",
            "Post permanently deleted successfully"
          );
          // Remove from selection since deleted posts are removed from the view
          setSelectedPosts(prev => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
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

  const handleSelectAll = () => {
    if (selectedPosts.size === filteredFlaggedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredFlaggedPosts.map((post) => post.id)));
    }
  };

  // Helper function to check if any selected posts are hidden
  const hasHiddenPosts = () => {
    return Array.from(selectedPosts).some((postId) => {
      const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
      return post?.isHidden === true;
    });
  };

  // Helper function to check if any selected posts are not hidden
  const hasNonHiddenPosts = () => {
    return Array.from(selectedPosts).some((postId) => {
      const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
      return !post?.isHidden;
    });
  };

  const handleClearSelection = () => {
    setSelectedPosts(new Set());
  };

  const handleBulkApprove = () => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to approve");
      return;
    }
    setBulkAction({ type: "approve", count: selectedPosts.size });
    setShowBulkConfirmModal(true);
  };

  const handleBulkHide = () => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to hide");
      return;
    }

    // Filter selected posts to only include non-hidden ones
    const postsToHide = Array.from(selectedPosts).filter((postId) => {
      const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
      return !post?.isHidden;
    });

    if (postsToHide.length === 0) {
      showToast("error", "Error", "All selected posts are already hidden");
      return;
    }

    setBulkAction({ type: "hide", count: postsToHide.length });
    setShowBulkConfirmModal(true);
  };

  const handleBulkUnhide = () => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to unhide");
      return;
    }

    // Filter selected posts to only include hidden ones
    const postsToUnhide = Array.from(selectedPosts).filter((postId) => {
      const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
      return post?.isHidden === true;
    });

    if (postsToUnhide.length === 0) {
      showToast("error", "Error", "All selected posts are already visible");
      return;
    }

    setBulkAction({ type: "unhide", count: postsToUnhide.length });
    setShowBulkConfirmModal(true);
  };

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to delete");
      return;
    }
    setBulkAction({ type: "delete", count: selectedPosts.size });
    setShowBulkConfirmModal(true);
  };

  const handleCancelBulkAction = () => {
    setShowBulkConfirmModal(false);
    setBulkAction(null);
  };

  const handleBulkConfirmAction = async () => {
    if (!bulkAction || selectedPosts.size === 0) return;

    const { type } = bulkAction;

    // For hide and unhide actions, only process posts that need the action
    const postsToProcess = type === "hide"
      ? Array.from(selectedPosts).filter((postId) => {
          const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
          return !post?.isHidden;
        })
      : type === "unhide"
      ? Array.from(selectedPosts).filter((postId) => {
          const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
          return post?.isHidden === true;
        })
      : Array.from(selectedPosts);

    if (postsToProcess.length === 0) {
      showToast("error", "Error", "No posts to process");
      setShowBulkConfirmModal(false);
      setBulkAction(null);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    try {
      setActionLoading("bulk");

      for (const postId of postsToProcess) {
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
        // Clear selection after successful bulk operations since posts may no longer be in the filtered list
        setSelectedPosts(new Set());
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
        <div className="px-4 mt-4 sm:px-6 lg:px-8">
          <SearchBar
            onSearch={handleSearch}
            onClear={handleClear}
            query={query}
            setQuery={setQuery}
            selectedCategoryFilter={selectedCategoryFilter}
            setSelectedCategoryFilter={setSelectedCategoryFilter}
          />
        </div>

        {/* Filter Buttons and MultiControl Panel */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mt-5 px-4 sm:px-6 lg:px-8">
          {/* Filter Buttons */}
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
          {filteredFlaggedPosts.length > 0 && (
            <div className="flex items-center justify-end lg:justify-end">
              <MultiControlPanel
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                selectedCount={selectedPosts.size}
                totalCount={filteredFlaggedPosts.length}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
                customActions={
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleBulkApprove}
                      disabled={selectedPosts.size === 0}
                      className={`p-1.5 rounded transition-colors ${
                        selectedPosts.size > 0
                          ? "text-green-600 hover:bg-green-50"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                      title={`Approve ${selectedPosts.size} Selected Posts`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={handleBulkHide}
                      disabled={selectedPosts.size === 0 || !hasNonHiddenPosts()}
                      className={`p-1.5 rounded transition-colors ${
                        selectedPosts.size > 0 && hasNonHiddenPosts()
                          ? "text-yellow-600 hover:bg-yellow-50"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                      title={
                        selectedPosts.size === 0
                          ? "Please select posts to hide"
                          : !hasNonHiddenPosts()
                          ? "All selected posts are already hidden"
                          : `Hide ${Array.from(selectedPosts).filter((postId) => {
                              const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
                              return !post?.isHidden;
                            }).length} Selected Posts`
                      }
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                        />
                      </svg>
                    </button>
                    {hasHiddenPosts() && (
                      <button
                        onClick={handleBulkUnhide}
                        disabled={selectedPosts.size === 0 || !hasHiddenPosts()}
                        className={`p-1.5 rounded transition-colors ${
                          selectedPosts.size > 0 && hasHiddenPosts()
                            ? "text-blue-600 hover:bg-blue-50"
                            : "text-gray-400 cursor-not-allowed"
                        }`}
                        title={
                          selectedPosts.size === 0
                            ? "Please select posts to unhide"
                            : !hasHiddenPosts()
                            ? "All selected posts are already visible"
                            : `Unhide ${Array.from(selectedPosts).filter((postId) => {
                                const post = filteredFlaggedPosts.find((p: Post) => p.id === postId);
                                return post?.isHidden === true;
                              }).length} Selected Posts`
                        }
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={handleBulkDelete}
                      disabled={selectedPosts.size === 0}
                      className={`p-1.5 rounded transition-colors ${
                        selectedPosts.size > 0
                          ? "text-red-600 hover:bg-red-50"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                      title={`Delete ${selectedPosts.size} Selected Posts`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                }
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-5 px-4 sm:px-6 lg:px-8">
          {filteredFlaggedPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🚩</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No Flagged Posts
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {viewType === "all"
                  ? "No flagged posts found."
                  : viewType === "lost"
                  ? "No flagged lost item reports found."
                  : "No flagged found item reports found."}
              </p>
            </div>
          ) : (
            <>
              {viewMode === "list" ? (
                <div className="space-y-4">
                  {filteredFlaggedPosts.map((post) => (
                    <AdminPostCardList
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
                      onSelectionChange={(post: Post, selected: boolean) => {
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
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                      onSelectionChange={(post: Post, selected: boolean) => {
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
            </>
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
                      "This will hide the selected posts that are not already hidden from public view but keep them in the system. They can be unhidden later."}
                    {bulkAction.type === "unhide" &&
                      "This will make the selected posts that are hidden visible to all users again. The posts will remain flagged until approved."}
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
          showFlaggedPostActions={true}
        />
      )}
    </PageWrapper>
  );
}
