import { useState, useMemo } from "react";
import type { Post } from "@/types/Post";

// Fuzzy match function for more flexible search
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

// components
import AdminPostCard from "@/components/admin/AdminPostCard";
import AdminPostCardList from "@/components/admin/AdminPostCardList";
import MultiControlPanel from "@/components/common/MultiControlPanel";
import AdminPostModal from "@/components/admin/AdminPostModal";
import TurnoverConfirmationModal from "@/components/modals/TurnoverConfirmation";
import NavHeader from "@/components/layout/NavHead";
import SearchBar from "@/components/common/SearchBar";

// hooks
import { useAdminPosts } from "@/hooks/usePosts";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

export default function TurnoverManagementPage() {
  const { posts = [], loading, error } = useAdminPosts();
  const { showToast } = useToast();
  const { userData } = useAuth();

  // State for view mode (card/list view)
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // State for post selection
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());

  // State for admin post modal
  const [showAdminPostModal, setShowAdminPostModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // State for turnover confirmation modal
  const [showTurnoverModal, setShowTurnoverModal] = useState(false);
  const [postToConfirm, setPostToConfirm] = useState<Post | null>(null);
  const [confirmationType, setConfirmationType] = useState<
    "confirmed" | "not_received" | null
  >(null);

  // State for search functionality
  const [query, setQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // Handle opening admin post modal
  const handleOpenAdminPostModal = (post: Post) => {
    setSelectedPost(post);
    setShowAdminPostModal(true);
  };

  // Handle closing admin post modal
  const handleCloseAdminPostModal = () => {
    setShowAdminPostModal(false);
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
    if (selectedPosts.size === turnoverPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(turnoverPosts.map((post) => post.id)));
    }
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedPosts(new Set());
  };

  // Handle bulk turnover confirmation
  const handleBulkTurnoverConfirm = async (status: "confirmed" | "not_received") => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to confirm");
      return;
    }

    const selectedPostObjects = turnoverPosts.filter(post => selectedPosts.has(post.id));

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const post of selectedPostObjects) {
        try {
          if (status === "not_received") {
            // Total deletion when OSA marks item as not received
            const { postService } = await import("../../services/firebase/posts");
            await postService.deletePost(post.id);
          } else {
            // Normal status update for confirmed items
            const { postService } = await import("../../services/firebase/posts");
            await postService.updateTurnoverStatus(
              post.id,
              status,
              userData?.uid || "",
              ""
            );
          }
          successCount++;
        } catch (error) {
          console.error(`Failed to process turnover for post ${post.id}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast("success", "Turnover Confirmed", `Successfully confirmed ${successCount} items`);
      } else {
        showToast("warning", "Partial Success",
          `Confirmed ${successCount} items successfully, ${errorCount} failed`
        );
      }

      // Clear selection and close modal
      setSelectedPosts(new Set());

    } catch (error: any) {
      console.error("Bulk turnover confirmation failed:", error);
      showToast("error", "Bulk Confirmation Failed", error.message || "Failed to confirm turnover");
    }
  };

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
      } else {
        // Normal status update for confirmed items
        await postService.updateTurnoverStatus(
          postToConfirm.id,
          status,
          currentUserId,
          notes
        );

        const statusMessage = `Item received confirmed for "${postToConfirm.title}"`;
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

  // Filter posts for turnover management with search functionality
  const turnoverPosts = useMemo(() => {
    return posts.filter((post) => {
      // Base filter for turnover management
      const isTurnoverPost =
        post.type === "found" &&
        post.turnoverDetails &&
        post.turnoverDetails.turnoverAction === "turnover to OSA" &&
        post.turnoverDetails.turnoverStatus === "declared";

      if (!isTurnoverPost) return false;

      // Search filter logic with fuzzy matching
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
        post.description.toLowerCase().includes(description.toLowerCase());

      const matchesLocation =
        location.trim() === "" ||
        post.location?.toLowerCase().includes(location.toLowerCase());

      return (
        matchesQuery && matchesCategory && matchesDescription && matchesLocation
      );
    });
  }, [posts, query, selectedCategoryFilter, description, location]);
  return (
    <div className="min-h-screen bg-gray-100 mb-13 font-manrope transition-colors duration-300">
      <NavHeader
        title="Turnover Management"
        description="Manage turnover to OSA posts"
      />

      <div className="w-full mx-auto mb-5">
        {/* Page Header */}
        <div className="hidden px-6 py-3 lg:px-8 lg:flex items-center justify-between bg-gray-50 border-b border-zinc-200">
          <div className="">
            <h1 className="text-base font-medium text-gray-900">
              Turnover Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage found items that need to be turned over to OSA (Office of
              Student Affairs)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              {turnoverPosts.length} Items
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <NavHeader
          title="Turnover Management"
          description="Manage turnover to OSA posts"
        />

        {/* Search Bar and Filter Controls */}
        <div className="px-6 py-4 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <SearchBar
                onSearch={handleSearch}
                onClear={handleClear}
                query={query}
                setQuery={setQuery}
                selectedCategoryFilter={selectedCategoryFilter}
                setSelectedCategoryFilter={setSelectedCategoryFilter}
              />
            </div>

            {/* MultiControl Panel */}
            {turnoverPosts.length > 0 && (
              <div className="flex-shrink-0">
                <MultiControlPanel
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  selectedCount={selectedPosts.size}
                  totalCount={turnoverPosts.length}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                  customActions={
                    selectedPosts.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleBulkTurnoverConfirm("confirmed")}
                          className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors shadow-sm"
                          title={`Confirm Received (${selectedPosts.size})`}
                        >
                          ✓ ({selectedPosts.size})
                        </button>
                        <button
                          onClick={() => handleBulkTurnoverConfirm("not_received")}
                          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors shadow-sm"
                          title={`Mark Not Received (${selectedPosts.size})`}
                        >
                          ✗ ({selectedPosts.size})
                        </button>
                      </div>
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 lg:px-8 mb-13">
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading turnover posts...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-80 text-red-500 p-4">
              <p className="mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Try Again
              </button>
            </div>
          ) : turnoverPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No Turnover Items
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                No items are currently awaiting turnover to OSA.
              </p>
            </div>
          ) : (
            <>
              {viewMode === "list" ? (
                <div className="space-y-4">
                  {turnoverPosts.map((post) => (
                    <AdminPostCardList
                      key={post.id}
                      post={post}
                      onClick={() => handleOpenAdminPostModal(post)}
                      onConfirmTurnover={handleConfirmTurnover}
                      highlightText={description}
                      hideDeleteButton={true}
                      // Hide admin controls that aren't relevant for turnover management
                      onDelete={undefined}
                      onStatusChange={undefined}
                      onActivateTicket={undefined}
                      onHidePost={undefined}
                      onUnhidePost={undefined}
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
                  {turnoverPosts.map((post) => (
                    <AdminPostCard
                      key={post.id}
                      post={post}
                      onClick={() => handleOpenAdminPostModal(post)}
                      onConfirmTurnover={handleConfirmTurnover}
                      highlightText={description}
                      hideDeleteButton={true}
                      // Hide admin controls that aren't relevant for turnover management
                      onDelete={undefined}
                      onStatusChange={undefined}
                      onActivateTicket={undefined}
                      onHidePost={undefined}
                      onUnhidePost={undefined}
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

      {/* Admin Post Modal */}
      {showAdminPostModal && selectedPost && (
        <AdminPostModal
          post={selectedPost}
          onClose={handleCloseAdminPostModal}
          onConfirmTurnover={handleConfirmTurnover}
        />
      )}
    </div>
  );
}
