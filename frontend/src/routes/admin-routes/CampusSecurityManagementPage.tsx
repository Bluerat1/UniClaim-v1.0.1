import { useState, useEffect, useCallback, useMemo } from "react";
import type { Post } from "@/types/Post";

// components
import AdminPostCard from "@/components/AdminPostCard";
import AdminPostModal from "@/components/AdminPostModal";
import AdminCampusSecurityTurnoverModal from "@/components/AdminCampusSecurityTurnoverModal";
import MobileNavText from "@/components/NavHeadComp";
import SearchBar from "@/components/SearchBar";

// hooks
import { useAdminPosts } from "@/hooks/usePosts";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

function fuzzyMatch(text: string, query: string): boolean {
  const cleanedText = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

  // Make sure every keyword appears in the text
  return queryWords.every((word) => cleanedText.includes(word));
}

export default function CampusSecurityManagementPage() {
  const { posts = [], loading, error } = useAdminPosts();
  const { showToast } = useToast();
  const { userData } = useAuth();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search state with debouncing
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("All");

  // Debounce search text to reduce excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // State for AdminPostModal
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // State for campus security collection confirmation modal
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [postToConfirm, setPostToConfirm] = useState<Post | null>(null);
  const [allowedActions, setAllowedActions] = useState<
    ("collected" | "not_available")[]
  >(["collected", "not_available"]);

  // Handle opening AdminPostModal
  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
  };

  // Handle closing AdminPostModal
  const handleCloseModal = () => {
    setSelectedPost(null);
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
        await postService.updateCampusSecurityTurnoverStatus(
          postToConfirm.id,
          status,
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

  // Filter posts for campus security management
  const campusSecurityPosts = useMemo(() => {
    return posts.filter((post) => {
      // Show ALL found items turned over to Campus Security (not just awaiting confirmation)
      // This includes all turnover statuses: declared, confirmed, not_received, transferred
      return (
        post.type === "found" &&
        post.turnoverDetails &&
        post.turnoverDetails.turnoverAction === "turnover to Campus Security"
      );
    });
  }, [posts]);

  // Apply search and category filtering to campus security posts
  const filteredCampusSecurityPosts = useMemo(() => {
    let filtered = campusSecurityPosts;

    // Apply category filter
    if (selectedCategoryFilter && selectedCategoryFilter !== "All") {
      filtered = filtered.filter(
        (post) =>
          post.category &&
          post.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
      );
    }

    // Apply search filter if debounced query exists
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((post) => {
        return (
          fuzzyMatch(post.title, query) ||
          fuzzyMatch(post.description || "", query) ||
          fuzzyMatch(post.category || "", query) ||
          fuzzyMatch(post.location || "", query) ||
          fuzzyMatch(`${post.user?.firstName} ${post.user?.lastName}`, query)
        );
      });
    }

    return filtered;
  }, [campusSecurityPosts, selectedCategoryFilter, debouncedSearchQuery]);

  // Pagination logic
  const totalPostsToShow = Math.min(
    filteredCampusSecurityPosts.length,
    currentPage * itemsPerPage
  );
  const hasMorePosts = filteredCampusSecurityPosts.length > totalPostsToShow;

  // Function to load more posts when scrolling
  const handleLoadMore = useCallback(() => {
    if (hasMorePosts && !loading) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMorePosts, loading]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, selectedCategoryFilter]);

  // Handle search
  const handleSearch = useCallback((query: string, filters: any) => {
    setSearchQuery(query);
    setSelectedCategoryFilter(filters.selectedCategory || "All");
  }, []);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSelectedCategoryFilter("All");
    setCurrentPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 mb-13 font-manrope transition-colors duration-300">
      <MobileNavText
        title="Campus Security Management"
        description="Manage items turned over to Campus Security"
      />

      {/* Header Section */}
      <div className="pt-4 border-b border-gray-300 bg-gray-50 px-6 mb-4">
        <div className="mb-4 hidden lg:flex items-center justify-between">
          <div className="">
            <h1 className="text-base lg:text-lg font-bold text-gray-800 mb-2">
              Campus Security Management
            </h1>
            <p className="text-gray-600 text-sm">
              Manage all found items that have been turned over to Campus
              Security, including collection confirmations and status updates
            </p>
          </div>
          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            {filteredCampusSecurityPosts.length} Campus Security Items
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6">
        <SearchBar
          onSearch={handleSearch}
          onClear={handleClearSearch}
          query={searchQuery}
          setQuery={setSearchQuery}
          selectedCategoryFilter={selectedCategoryFilter}
          setSelectedCategoryFilter={setSelectedCategoryFilter}
        />
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 gap-5 mx-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-80">
            <span className="text-gray-400">
              Loading campus security posts...
            </span>
          </div>
        ) : error ? (
          <div className="col-span-full flex flex-col items-center justify-center h-80 text-red-500 p-4">
            <p>Error loading posts: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : campusSecurityPosts.length === 0 ? (
          <div className="col-span-full flex items-center justify-center h-80 text-gray-500">
            No items have been turned over to Campus Security yet.
          </div>
        ) : (
          filteredCampusSecurityPosts.slice(0, totalPostsToShow).map((post) => (
            <AdminPostCard
              key={post.id}
              post={post}
              onClick={() => handlePostClick(post)}
              onConfirmCampusSecurityCollection={handleConfirmCollection}
              highlightText=""
              hideDeleteButton={true}
              // Hide admin controls that aren't relevant for campus security management
              onEdit={undefined}
              onDelete={undefined}
              onStatusChange={undefined}
              onActivateTicket={undefined}
              onRevertResolution={undefined}
              onHidePost={undefined}
              onUnhidePost={undefined}
              onConfirmTurnover={undefined} // Hide OSA turnover option
              showUnclaimedMessage={false}
              showCampusSecurityButtons={true}
              hideStatusDropdown={true}
            />
          ))
        )}
      </div>

      {/* Load More Button */}
      {hasMorePosts && !loading && (
        <div className="flex justify-center mt-8 mx-6">
          <button
            onClick={handleLoadMore}
            className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-teal-600 transition-colors shadow-sm"
          >
            Load More Posts (
            {filteredCampusSecurityPosts.length - totalPostsToShow} remaining)
          </button>
        </div>
      )}

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
        onConfirm={handleCollectionConfirmation}
        post={postToConfirm}
        allowedActions={allowedActions}
      />
    </div>
  );
}
