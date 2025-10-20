import { useState, useMemo } from "react";
import type { Post } from "@/types/Post";

// components
import AdminPostCard from "@/components/AdminPostCard";
import AdminPostModal from "@/components/AdminPostModal";
import TurnoverConfirmationModal from "@/components/TurnoverConfirmationModal";
import MobileNavText from "@/components/NavHeadComp";
import SearchBar from "@/components/SearchBar";

// hooks
import { useAdminPosts } from "@/hooks/usePosts";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

export default function TurnoverManagementPage() {
  const { posts = [], loading, error } = useAdminPosts();
  const { showToast } = useToast();
  const { userData } = useAuth();

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
  return (
    <div className="min-h-screen bg-gray-100 mb-13 font-manrope transition-colors duration-300">
      <MobileNavText
        title="Turnover Management"
        description="Manage turnover to OSA posts"
      />

      {/* Header Section */}
      <div className="pt-4 px-6">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-lg font-bold text-gray-800 mb-2">
            Turnover Management
          </h1>
          <p className="text-gray-600 text-sm">
            Manage found items that need to be turned over to OSA (Office of
            Student Affairs)
          </p>
        </div>

        {/* Search Bar */}
        <SearchBar
          onSearch={handleSearch}
          onClear={handleClear}
          query={query}
          setQuery={setQuery}
          selectedCategoryFilter={selectedCategoryFilter}
          setSelectedCategoryFilter={setSelectedCategoryFilter}
        />
      </div>

      {/* Posts Grid */}
      <div className=" mt-5 grid grid-cols-1 gap-5 mx-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-80">
            <span className="text-gray-400">Loading turnover posts...</span>
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
        ) : turnoverPosts.length === 0 ? (
          <div className="col-span-full flex items-center justify-center h-80 text-gray-500">
            No turnover items found.
          </div>
        ) : (
          turnoverPosts.map((post) => (
            <AdminPostCard
              key={post.id}
              post={post}
              onClick={() => handleOpenAdminPostModal(post)}
              onConfirmTurnover={handleConfirmTurnover}
              highlightText=""
              hideDeleteButton={true}
              // Hide admin controls that aren't relevant for turnover management
              onDelete={undefined}
              onStatusChange={undefined}
              onActivateTicket={undefined}
              onRevertResolution={undefined}
              onHidePost={undefined}
              onUnhidePost={undefined}
              showUnclaimedMessage={false}
              hideStatusDropdown={true}
            />
          ))
        )}
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
