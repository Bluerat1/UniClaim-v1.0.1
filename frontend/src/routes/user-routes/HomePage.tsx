import { useState, useCallback, useEffect } from "react";
import type { Post } from "@/types/Post";

// components
import PostCard from "@/components/PostCard";
import PostModal from "@/components/PostModal";
import MobileNavText from "@/components/NavHeadComp";
import SearchBar from "../../components/SearchBar";
import FlagModal from "@/components/FlagModal";

// hooks
import { usePosts, useResolvedPosts } from "@/hooks/usePosts";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { postService } from "@/services/firebase/posts";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

function fuzzyMatch(text: string, query: string): boolean {
  const cleanedText = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

  // If no query words, return true
  if (queryWords.length === 0) return true;

  // For single word queries, use partial matching
  if (queryWords.length === 1) {
    return cleanedText.includes(queryWords[0]);
  }

  // For multiple words, require at least 70% of words to match (more flexible)
  const matchedWords = queryWords.filter((word) => cleanedText.includes(word));
  return matchedWords.length >= Math.ceil(queryWords.length * 0.7);
}

export default function HomePage() {
  // ✅ Use the custom hooks for real-time posts
  const { posts, loading, error } = usePosts();
  const {
    posts: resolvedPosts,
    loading: resolvedLoading,
    error: resolvedError,
  } = useResolvedPosts();

  // Get admin statuses for all posts
  const allPosts = [...posts, ...resolvedPosts];
  const adminStatuses = useAdminStatus(allPosts);
  const [viewType, setViewType] = useState<
    "all" | "lost" | "found" | "completed"
  >("all");
  const [lastDescriptionKeyword, setLastDescriptionKeyword] = useState("");
  const [rawResults, setRawResults] = useState<Post[] | null>(null); // store-search-result-without-viewType-filter
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Flag modal state
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [postToFlag, setPostToFlag] = useState<Post | null>(null);
  const [isFlagging, setIsFlagging] = useState(false);

  const { user } = useAuth();
  const { showToast } = useToast();

  // Flag modal handlers
  const handleFlagPost = useCallback((post: Post) => {
    setPostToFlag(post);
    setShowFlagModal(true);
  }, []);

  const handleFlagSubmit = useCallback(
    async (reason: string) => {
      if (!user || !postToFlag) return;

      setIsFlagging(true);
      try {
        await postService.flagPost(postToFlag.id, user.uid, reason);
        setShowFlagModal(false);
        setPostToFlag(null);
        showToast("success", "Post has been flagged for review");
      } catch (error: any) {
        showToast("error", error.message || "Failed to flag post");
      } finally {
        setIsFlagging(false);
      }
    },
    [user, postToFlag, showToast]
  );

  // ✅ New state for instant category filtering
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("All");

  // e modify rani siya sa backend django
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  // e change dari pila ka post mu appear pag scroll down
  const itemsPerPage = 6; // Increased from 2 to 6 for better scroll experience

  const handleSearch = async (query: string, filters: any) => {
    setLastDescriptionKeyword(filters.description || "");

    // Always reset pagination when searching (now only manual searches)
    setCurrentPage(1);

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

  // Determine which posts to display based on viewType and category filter
  const getPostsToDisplay = () => {
    const basePosts =
      rawResults ?? (viewType === "completed" ? resolvedPosts : posts) ?? [];

    // Filter out unclaimed posts and items awaiting turnover confirmation from all views
    const filteredPosts = basePosts.filter((post) => {
      // Filter out unclaimed posts
      if (post.status === "unclaimed") return false;

      // Filter out hidden posts (flagged posts that admin chose to hide)
      if (post.isHidden === true) return false;

      // Filter out items with turnoverStatus: "declared" ONLY for OSA turnover (awaiting OSA confirmation)
      // Campus Security items with "transferred" status should be visible
      if (
        post.turnoverDetails &&
        post.turnoverDetails.turnoverStatus === "declared" &&
        post.turnoverDetails.turnoverAction === "turnover to OSA"
      ) {
        return false;
      }

      return true;
    });

    // Apply view type filtering
    let viewFilteredPosts;
    if (viewType === "all") viewFilteredPosts = filteredPosts;
    else if (viewType === "completed")
      viewFilteredPosts = filteredPosts; // resolvedPosts already filtered
    else
      viewFilteredPosts = filteredPosts.filter(
        (post) => post.type.toLowerCase() === viewType
      );

    // ✅ Apply instant category filtering
    if (selectedCategoryFilter && selectedCategoryFilter !== "All") {
      return viewFilteredPosts.filter(
        (post) =>
          post.category &&
          post.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
      );
    }

    return viewFilteredPosts;
  };

  const postsToDisplay = getPostsToDisplay();

  // Reset pagination when category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryFilter]);

  // Check if there are more posts to load - more accurate calculation
  const totalPostsToShow = Math.min(
    postsToDisplay.length,
    currentPage * itemsPerPage
  );
  const hasMorePosts = postsToDisplay.length > totalPostsToShow;

  // Function to load more posts when scrolling
  const handleLoadMore = useCallback(() => {
    if (hasMorePosts && !isLoading) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMorePosts, isLoading]);

  // Use the infinite scroll hook
  const loadingRef = useInfiniteScroll(handleLoadMore, hasMorePosts, isLoading);

  return (
    <div className="min-h-screen bg-gray-100 mb-13 font-manrope transition-colors duration-300">
      <MobileNavText title="Home" description="Welcome to home" />

      <div className="pt-4 px-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* SearchBar (grows to fill left side) */}
        <div className="w-full lg:flex-1">
          <SearchBar
            onSearch={handleSearch}
            onClear={() => {
              setRawResults(null);
              setLastDescriptionKeyword("");
              setSearchQuery("");
              setCurrentPage(1); // Reset pagination when clearing search
              setIsLoading(false); // Reset loading state
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
          <h1 className="text-sm font-medium">Home</h1>
          <p className="text-xs text-gray-600">
            Find your lost and found items here
          </p>
        </div>
      </div>

      {/* Lost / Found Toggle */}
      <div className="flex flex-wrap sm:justify-center items-center gap-3 w-full px-4 lg:justify-start lg:gap-3">
        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "all"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-dark-navyblue/15 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("all");
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          All Item Reports
        </button>

        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "lost"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-dark-navyblue/15 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("lost");
            setCurrentPage(1); // Reset pagination when switching views
            setRawResults(null); // Clear search results when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Lost Items
        </button>

        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "found"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-dark-navyblue/15 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("found");
            setCurrentPage(1); // Reset pagination when switching views
            setRawResults(null); // Clear search results when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Found Items
        </button>

        <button
          className={`px-4 py-2 cursor-pointer lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300 ${
            viewType === "completed"
              ? "bg-navyblue text-white"
              : "bg-gray-200 text-gray-700 hover:bg-dark-navyblue/15 border-gray-300"
          }`}
          onClick={() => {
            setIsLoading(true);
            setViewType("completed");
            setCurrentPage(1); // Reset pagination when switching views
            setRawResults(null); // Clear search results when switching views
            setTimeout(() => setIsLoading(false), 200);
          }}
        >
          Completed Items
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 mx-4 mt-7 sm:grid-cols-2 lg:grid-cols-3">
        {/* ✅ Handle Firebase loading state */}
        {loading || resolvedLoading || isLoading ? (
          <div className="col-span-full flex items-center justify-center h-80">
            <span className="text-gray-400">
              Loading {viewType === "completed" ? "completed" : viewType} report
              items...
            </span>
          </div>
        ) : error || resolvedError ? (
          <div className="col-span-full flex items-center justify-center h-80 text-red-500">
            <p>Error loading posts: {error || resolvedError}</p>
            <button
              onClick={() => window.location.reload()}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : postsToDisplay.length === 0 ? (
          <div className="col-span-full flex items-center justify-center h-80 text-gray-500">
            No results found.
          </div>
        ) : (
          // Show the oldest posts first by taking them from the start of the array
          // and then reversing the order so oldest appear at the top
          postsToDisplay
            .slice(0, totalPostsToShow)
            .map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => setSelectedPost(post)}
                highlightText={lastDescriptionKeyword}
                adminStatuses={adminStatuses}
                onFlag={handleFlagPost}
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

      {/* Flag Modal - rendered at HomePage level to avoid z-index conflicts */}
      {showFlagModal && postToFlag && (
        <FlagModal
          onClose={() => {
            setShowFlagModal(false);
            setPostToFlag(null);
          }}
          onSubmit={handleFlagSubmit}
          isLoading={isFlagging}
        />
      )}

      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          hideSendMessage={viewType === "completed"}
        />
      )}
    </div>
  );
}
