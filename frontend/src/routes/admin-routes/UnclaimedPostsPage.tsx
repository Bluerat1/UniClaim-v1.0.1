import { useState, useMemo } from "react";
import { useAdminPosts } from "../../hooks/usePosts";
import { useToast } from "../../context/ToastContext";
import { postService } from "../../services/firebase/posts";
import { notificationSender } from "../../services/firebase/notificationSender";
import type { Post } from "../../types/Post";
import PageWrapper from "../../components/PageWrapper";
import NavHeader from "../../components/NavHeadComp";
import AdminPostCard from "../../components/AdminPostCard";
import AdminUnclaimedPostModal from "../../components/AdminUnclaimedPostModal";
import SearchBar from "../../components/SearchBar";
import { useAuth } from "../../context/AuthContext";

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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  const [rawResults, setRawResults] = useState<Post[] | null>(null);
  const [lastDescriptionKeyword, setLastDescriptionKeyword] = useState("");

  // State for activation
  const [activatingPostId, setActivatingPostId] = useState<string | null>(null);

  // State for modal
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter posts to show only unclaimed ones
  const unclaimedPosts = useMemo(() => {
    if (rawResults) {
      return rawResults.filter(post =>
        post.status === 'unclaimed' || Boolean(post.movedToUnclaimed)
      );
    }

    return posts.filter(post =>
      post.status === 'unclaimed' || Boolean(post.movedToUnclaimed)
    );
  }, [posts, rawResults]);

  // Apply category filtering
  const filteredPosts = useMemo(() => {
    if (selectedCategoryFilter && selectedCategoryFilter !== "All") {
      return unclaimedPosts.filter(post =>
        post.category && post.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
      );
    }
    return unclaimedPosts;
  }, [unclaimedPosts, selectedCategoryFilter]);

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

  // Handle post activation (move back from unclaimed status)
  const handleActivatePost = async (post: Post) => {
    if (!post.movedToUnclaimed && post.status !== 'unclaimed') {
      showToast("error", "Cannot Activate", "This post is not in unclaimed status.");
      return;
    }

    const confirmMessage = post.movedToUnclaimed
      ? `Are you sure you want to activate "${post.title}"? This will move it back to active status with a new 30-day period.`
      : `Are you sure you want to activate "${post.title}"? This will move it back to active status with a new 30-day period.`;

    if (confirm(confirmMessage)) {
      try {
        setActivatingPostId(post.id);
        await postService.activateTicket(post.id);

        // Send notification to the post creator
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
            console.log("✅ Activate notification sent to user");
          } catch (notificationError) {
            console.warn(
              "⚠️ Failed to send activate notification:",
              notificationError
            );
            // Don't throw - notification failures shouldn't break main functionality
          }
        }

        const statusMessage = post.movedToUnclaimed
          ? `"${post.title}" has been activated from expired status and moved back to active status.`
          : `"${post.title}" has been activated and moved back to active status.`;

        showToast("success", "Post Activated", statusMessage);

        // Update local state to remove the activated post from unclaimed list
        setRawResults(prev => prev ? prev.filter(p => p.id !== post.id) : null);
      } catch (error: any) {
        console.error('Failed to activate post:', error);
        showToast("error", "Activation Failed", error.message || 'Failed to activate post');
      } finally {
        setActivatingPostId(null);
      }
    }
  };

  // Handle modal open
  const handleOpenModal = (post: Post) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
  };

  // Handle post activation from modal
  const handleModalActivatePost = async (postId: string) => {
    try {
      setActivatingPostId(postId);

      // Find the post object to get creator information for notifications
      const post = filteredPosts.find(p => p.id === postId);
      if (!post) {
        throw new Error('Post not found');
      }

      await postService.activateTicket(postId);

      // Send notification to the post creator
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
          console.log("✅ Activate notification sent to user");
        } catch (notificationError) {
          console.warn(
            "⚠️ Failed to send activate notification:",
            notificationError
          );
          // Don't throw - notification failures shouldn't break main functionality
        }
      }

      showToast("success", "Post Activated", "Post has been activated and moved back to active status.");
      handleCloseModal();
      // Update local state to remove the activated post from unclaimed list
      setRawResults(prev => prev ? prev.filter(p => p.id !== postId) : null);
    } catch (error: any) {
      console.error('Failed to activate post from modal:', error);
      showToast("error", "Activation Failed", error.message || 'Failed to activate post');
    } finally {
      setActivatingPostId(null);
    }
  };

  // Handle post deletion from modal
  const handleModalDeletePost = async (postId: string) => {
    try {
      // Find the post object to get creator information for notifications
      const post = filteredPosts.find(p => p.id === postId);
      if (!post) {
        throw new Error('Post not found');
      }

      await postService.deletePost(postId, false, userData?.email || 'admin');

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
            deletionType: 'soft',
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

      showToast("success", "Post Deleted", "Post has been moved to Recently Deleted");
      handleCloseModal();
      // Update local state to remove the deleted post from unclaimed list
      setRawResults(prev => prev ? prev.filter(p => p.id !== postId) : null);
    } catch (error: any) {
      console.error('Failed to delete post from modal:', error);
      showToast("error", "Delete Failed", error.message || 'Failed to delete post');
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
              Manage posts that have been automatically or manually marked as unclaimed
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

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 pb-20">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                No Unclaimed Posts
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                All posts are currently active! Posts will appear here when they are automatically moved to unclaimed status after 30 days or manually marked as unclaimed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <AdminPostCard
                  key={post.id}
                  post={post}
                  onClick={() => handleOpenModal(post)}
                  highlightText={lastDescriptionKeyword}
                  onActivateTicket={handleActivatePost}
                  onDelete={(post) => handleModalDeletePost(post.id)}
                  isDeleting={activatingPostId === post.id}
                  showUnclaimedMessage={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unclaimed Post Modal */}
      {isModalOpen && selectedPost && (
        <AdminUnclaimedPostModal
          post={selectedPost}
          onClose={handleCloseModal}
          onPostActivate={handleModalActivatePost}
          onPostDelete={handleModalDeletePost}
        />
      )}
    </PageWrapper>
  );
}
