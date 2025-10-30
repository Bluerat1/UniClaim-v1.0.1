import { useState, useMemo } from "react";
import type { Post } from "@/types/Post";

// components
import AdminPostCard from "@/components/admin/AdminPostCard";
import AdminPostCardList from "@/components/admin/AdminPostCardList";
import MultiControlPanel from "@/components/common/MultiControlPanel";
import AdminPostModal from "@/components/admin/AdminPostModal";
import AdminCampusSecurityTurnoverModal from "@/components/admin/CampusSecurityTurnoverModal";
import NavHeader from "@/components/layout/NavHead";
import SearchBar from "@/components/common/SearchBar";

// hooks
import { useAdminPosts } from "@/hooks/usePosts";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

export default function CampusSecurityManagementPage() {
  const { posts = [], loading, error } = useAdminPosts();
  const { showToast } = useToast();
  const { userData } = useAuth();

  // State for view mode (card/list view)
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // State for post selection
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());

  // State for search functionality
  const [query, setQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  // State for AdminPostModal
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // State for campus security collection confirmation modal
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [postToConfirm, setPostToConfirm] = useState<Post | null>(null);
  const [allowedActions, setAllowedActions] = useState<
    ("collected" | "not_available")[]
  >(["collected", "not_available"]);

  // Filter posts for campus security management with search functionality
  const campusSecurityPosts = useMemo(() => {
    return posts.filter((post) => {
      // Base filter for campus security management
      const isCampusSecurityPost =
        post.type === "found" &&
        post.turnoverDetails &&
        post.turnoverDetails.turnoverAction === "turnover to Campus Security";

      if (!isCampusSecurityPost) return false;

      // Search filter logic
      const matchesQuery =
        query.trim() === "" ||
        post.title.toLowerCase().includes(query.toLowerCase()) ||
        post.description.toLowerCase().includes(query.toLowerCase());

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
    if (selectedPosts.size === campusSecurityPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(campusSecurityPosts.map((post) => post.id)));
    }
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedPosts(new Set());
  };

  // Handle bulk campus security collection
  const handleBulkCampusSecurityCollection = async (status: "confirmed" | "not_received") => {
    if (selectedPosts.size === 0) {
      showToast("error", "Error", "Please select posts to process");
      return;
    }

    const selectedPostObjects = campusSecurityPosts.filter(post => selectedPosts.has(post.id));

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const post of selectedPostObjects) {
        try {
          const { postService } = await import("../../services/firebase/posts");
          
          if (status === "not_received") {
            // Use soft delete to move to recently deleted
            await postService.deletePost(post.id, false, userData?.uid);
          } else {
            // Update status for confirmed items
            await postService.updateTurnoverStatus(
              post.id,
              status,
              userData?.uid || "",
              ""
            );
          }
          successCount++;
        } catch (error) {
          console.error(`Failed to process campus security collection for post ${post.id}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        const actionText = status === "confirmed" 
          ? "collected" 
          : "moved to recently deleted";
        showToast(
          "success", 
          status === "confirmed" ? "Bulk Collection Complete" : "Items Moved to Recently Deleted", 
          `Successfully ${actionText} ${successCount} items`
        );
      } else {
        showToast(
          "warning", 
          "Bulk Action Partial",
          `${status === "confirmed" ? "Collected" : "Moved to recently deleted"} ${successCount} items successfully, ${errorCount} failed`
        );
      }

      // Clear selection
      setSelectedPosts(new Set());

    } catch (error: any) {
      console.error("Bulk campus security collection failed:", error);
      showToast("error", "Bulk Action Failed", error.message || "Failed to process selected items");
    }
  };

  // Handle opening AdminPostModal
  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
  };

  // Handle closing AdminPostModal
  const handleCloseModal = () => {
    setSelectedPost(null);
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

  // Handle campus security collection confirmation
  const handleConfirmCollection = (
    post: Post,
    status: "collected" | "not_available"
  ) => {
    // Simply proceed with the collection process - no validation checks
    console.log(`🔄 Processing collection for post ${post.id}:`, {
      currentStatus: post.turnoverDetails?.turnoverStatus,
      currentOwner: post.user?.firstName + " " + post.user?.lastName,
      newOwner: userData?.uid,
    });

    setPostToConfirm(post);
    setAllowedActions([status]); // Only allow the selected action
    setShowCollectionModal(true);
  };

  const handleCollectionConfirmation = async (
    status: "collected" | "not_available",
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
        `🔑 Using admin user ID for campus security collection confirmation: ${currentUserId}`
      );

      if (status === "not_available") {
        // Delete the post when item is not available at campus security
        await postService.deletePost(postToConfirm.id);

        const statusMessage = `Item "${postToConfirm.title}" has been deleted from the system as it was not available at Campus Security.`;
        showToast("success", "Item Deleted", statusMessage);
        console.log(
          "Item deleted:",
          postToConfirm.title,
          "Reason: Not available at Campus Security"
        );
      } else {
        // Always update status and transfer ownership when "collected" is clicked
        await postService.updateTurnoverStatus(
          postToConfirm.id,
          status === "collected" ? "confirmed" : "not_received",
          currentUserId,
          notes
        );

        const statusMessage = `Item "${postToConfirm.title}" ownership has been transferred to you (Admin), turned over to OSA, and moved to top of homepage.`;
        showToast("success", "Ownership Transferred", statusMessage);
        console.log(
          "Campus security collection ownership transferred successfully:",
          postToConfirm.title,
          "New owner:",
          currentUserId
        );
      }
    } catch (error: any) {
      console.error(
        "Failed to process campus security collection confirmation:",
        error
      );
      const errorMessage =
        status === "not_available"
          ? "Failed to delete item from system"
          : "Failed to update collection status";
      showToast("error", "Operation Failed", error.message || errorMessage);
    } finally {
      setShowCollectionModal(false);
      setPostToConfirm(null);
    }
  };
  return (
    <div className="min-h-screen bg-gray-100 mb-13 font-manrope transition-colors duration-300">
      <NavHeader
        title="Campus Security Management"
        description="Manage items turned over to Campus Security"
      />

      <div className="w-full mx-auto mb-5">
        {/* Page Header */}
        <div className="hidden px-6 py-3 lg:px-8 lg:flex items-center justify-between bg-gray-50 border-b border-zinc-200">
          <div className="">
            <h1 className="text-base font-medium text-gray-900">
              Campus Security Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage all found items that have been turned over to Campus
              Security, including collection confirmations and status updates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {campusSecurityPosts.length} Items
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <NavHeader
          title="Campus Security Management"
          description="Manage items turned over to Campus Security"
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
            {campusSecurityPosts.length > 0 && (
              <div className="flex-shrink-0">
                <MultiControlPanel
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  selectedCount={selectedPosts.size}
                  totalCount={campusSecurityPosts.length}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                  customActions={
                    selectedPosts.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleBulkCampusSecurityCollection("confirmed")}
                          disabled={selectedPosts.size === 0}
                          className={`p-1.5 rounded transition-colors ${
                            selectedPosts.size > 0
                              ? "text-green-600 hover:bg-green-50"
                              : "text-gray-400 cursor-not-allowed"
                          }`}
                          title={`Collect Items (${selectedPosts.size})`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleBulkCampusSecurityCollection("not_received")}
                          disabled={selectedPosts.size === 0}
                          className={`p-1.5 rounded transition-colors ${
                            selectedPosts.size > 0
                              ? "text-red-600 hover:bg-red-50"
                              : "text-gray-400 cursor-not-allowed"
                          }`}
                          title={`Mark Not Available (${selectedPosts.size})`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
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
                <p className="text-gray-600">Loading campus security posts...</p>
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
          ) : campusSecurityPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No Campus Security Items
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                No items have been turned over to Campus Security yet.
              </p>
            </div>
          ) : (
            <>
              {viewMode === "list" ? (
                <div className="space-y-4">
                  {campusSecurityPosts.map((post) => (
                    <AdminPostCardList
                      key={post.id}
                      post={post}
                      onClick={() => handlePostClick(post)}
                      onConfirmCampusSecurityCollection={handleConfirmCollection}
                      highlightText=""
                      hideDeleteButton={true}
                      // Hide admin controls that aren't relevant for campus security management
                      onDelete={undefined}
                      onStatusChange={undefined}
                      onActivateTicket={undefined}
                      onHidePost={undefined}
                      onUnhidePost={undefined}
                      onConfirmTurnover={undefined} // Hide OSA turnover option
                      showUnclaimedMessage={false}
                      showCampusSecurityButtons={true}
                      hideStatusDropdown={true}
                      // Multi-select props
                      isSelected={selectedPosts.has(post.id)}
                      onSelectionChange={handlePostSelectionChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {campusSecurityPosts.map((post) => (
                    <AdminPostCard
                      key={post.id}
                      post={post}
                      onClick={() => handlePostClick(post)}
                      onConfirmCampusSecurityCollection={handleConfirmCollection}
                      highlightText=""
                      hideDeleteButton={true}
                      // Hide admin controls that aren't relevant for campus security management
                      onDelete={undefined}
                      onStatusChange={undefined}
                      onActivateTicket={undefined}
                      onHidePost={undefined}
                      onUnhidePost={undefined}
                      onConfirmTurnover={undefined} // Hide OSA turnover option
                      showUnclaimedMessage={false}
                      showCampusSecurityButtons={true}
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

      {/* AdminPostModal */}
      {selectedPost && (
        <AdminPostModal
          post={selectedPost}
          onClose={handleCloseModal}
          onConfirmTurnover={(post, status) => {
            if (status === "confirmed") {
              handleConfirmCollection(post, "collected");
            } else if (status === "not_received") {
              handleConfirmCollection(post, "not_available");
            }
          }}
          onConfirmCampusSecurityCollection={handleConfirmCollection}
          showCampusSecurityActions={true}
        />
      )}

      {/* Campus Security Collection Confirmation Modal */}
      <AdminCampusSecurityTurnoverModal
        isOpen={showCollectionModal}
        onClose={() => {
          setShowCollectionModal(false);
          setPostToConfirm(null);
          setAllowedActions(["collected", "not_available"]); // Reset to default
        }}
        onConfirm={(status, notes) => {
          if (status === "collected") {
            handleCollectionConfirmation("collected", notes);
          } else if (status === "not_available") {
            handleCollectionConfirmation("not_available", notes);
          }
        }}
        post={postToConfirm}
        allowedActions={allowedActions}
      />
    </div>
  );
}
