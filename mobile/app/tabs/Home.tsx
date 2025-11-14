import React, { useState, useEffect, useMemo } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import SearchWithToggle from "../../components/Input";
import PostCard from "../../components/PostCard";
import { PostCardSkeletonList } from "../../components/PostCardSkeleton";
import Layout from "../../layout/HomeLayout";
import { Ionicons } from "@expo/vector-icons";

// hooks
import { usePosts, useResolvedPosts } from "../../hooks/usePosts";

// Debounce utility for search optimization
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function Home() {
  const [activeButton, setActiveButton] = useState<
    "all" | "lost" | "found" | "resolved"
  >("all");
  const [query, setQuery] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [descriptionSearch, setDescriptionSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search inputs for better performance
  const debouncedQuery = useDebounce(query, 300);
  const debouncedDescriptionSearch = useDebounce(descriptionSearch, 300);
  const debouncedLocationSearch = useDebounce(locationSearch, 300);

  // Conditional hook usage - only call the active hook
  const isResolvedTab = activeButton === "resolved";
  const postsHook = usePosts();
  const resolvedPostsHook = useResolvedPosts();

  // Handle different return types from hooks
  const { posts, loading, error, isInitialLoad } = isResolvedTab
    ? { ...resolvedPostsHook, isInitialLoad: false } // resolved hook doesn't have isInitialLoad or invalidateCache yet
    : postsHook;

  // Simple scroll handling (like web version)
  const flatListRef = React.useRef<FlatList>(null);

  // Simple scroll handling - no complex preservation needed

  // Determine which posts to display based on activeButton
  const getPostsToDisplay = () => {
    // Get the appropriate posts based on active tab
    let basePosts = isResolvedTab ? resolvedPostsHook.posts || [] : posts || [];

    // For resolved posts, sort by updatedAt (falling back to createdAt) in descending order
    if (isResolvedTab) {
      return [...basePosts].sort((a, b) => {
        // Convert timestamps to Date objects if they're Firestore timestamps
        const dateA = a.updatedAt?.toDate
          ? a.updatedAt.toDate()
          : a.updatedAt
            ? new Date(a.updatedAt)
            : a.createdAt?.toDate
              ? a.createdAt.toDate()
              : new Date(a.createdAt || 0);

        const dateB = b.updatedAt?.toDate
          ? b.updatedAt.toDate()
          : b.updatedAt
            ? new Date(b.updatedAt)
            : b.createdAt?.toDate
              ? b.createdAt.toDate()
              : new Date(b.createdAt || 0);

        return dateB.getTime() - dateA.getTime(); // Most recent first
      });
    }

    // For active posts, sort by createdAt in descending order (newest first)
    return [...basePosts].sort((a, b) => {
      const dateA = a.createdAt?.toDate
        ? a.createdAt.toDate()
        : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate
        ? b.createdAt.toDate()
        : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const postsToDisplay = getPostsToDisplay();

  // Fuzzy match function to search user details
  const fuzzyMatch = (text: string, query: string, postUser?: any): boolean => {
    if (!query.trim()) return false;

    const cleanedText = (text || "").toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);

    // If no query words, return false (we don't want to match everything)
    if (queryWords.length === 0) return false;

    // Check if query matches user's name (excluding email)
    if (postUser) {
      // Handle both direct user object and nested user data
      const userData = postUser.user || postUser;

      if (userData) {
        const firstName = (userData.firstName || "").toLowerCase();
        const lastName = (userData.lastName || "").toLowerCase();
        const userName = `${firstName} ${lastName}`.trim();

        // Check if any query word matches user's name (excluding email)
        const userMatch = queryWords.some(
          (word) =>
            (userName && userName.includes(word)) ||
            (firstName && firstName.includes(word)) ||
            (lastName && lastName.includes(word))
        );

        if (userMatch) return true;
      }
    }

    // Also check the text content (title/description)
    if (!cleanedText) return false;

    // For single word queries, use partial matching
    if (queryWords.length === 1) {
      return cleanedText.includes(queryWords[0]);
    }

    // For multiple words, require at least one word to match
    return queryWords.some((word) => cleanedText.includes(word));
  };

  // Memoized filtered posts - only recalculate when dependencies change
  const filteredPosts = useMemo(() => {
    return postsToDisplay.filter((post) => {
      // Add data validation to prevent crashes
      if (
        !post ||
        !post.title ||
        !post.description ||
        !post.category ||
        !post.location
      ) {
        return false;
      }

      // Filter out unclaimed posts
      if (post.status === "unclaimed") return false;

      // For active tabs (not resolved tab), filter out completed posts
      if (!isResolvedTab && post.status === "completed") return false;

      // For resolved tab, only include resolved and completed posts
      if (
        isResolvedTab &&
        post.status !== "resolved" &&
        post.status !== "completed"
      )
        return false;

      // Filter out any posts that might have been missed by the service
      if (post.movedToUnclaimed || post.isHidden === true) {
        return false;
      }

      // Filter out items with turnoverStatus: "declared" for OSA turnover
      if (
        post.turnoverDetails &&
        post.turnoverDetails.turnoverStatus === "declared" &&
        post.turnoverDetails.turnoverAction === "turnover to OSA"
      ) {
        return false;
      }

      const queryWords = debouncedQuery.toLowerCase().trim().split(/\s+/);

      // Check if search query matches post title, description, or user details
      // Only search in title and description, not in user emails
      const searchMatch =
        debouncedQuery &&
        (fuzzyMatch(post.title || "", debouncedQuery, post) ||
          fuzzyMatch(post.description || "", debouncedQuery, post) ||
          (post.user && fuzzyMatch("", debouncedQuery, post.user)) ||
          (post.user?.firstName && fuzzyMatch("", debouncedQuery, post.user)));

      const descriptionMatch = debouncedDescriptionSearch
        ? post.description
            .toLowerCase()
            .includes(debouncedDescriptionSearch.toLowerCase().trim())
        : true;

      const categoryMatch = categorySearch
        ? post.category === categorySearch
        : true;

      const locationMatch = debouncedLocationSearch
        ? post.location
            .toLowerCase()
            .includes(debouncedLocationSearch.toLowerCase().trim())
        : true;

      // For active posts, make sure they're not resolved
      // For resolved view, we don't need to check status as resolvedPosts already contains only resolved posts
      const typeMatch =
        isResolvedTab ||
        (post.status !== "resolved" &&
          (activeButton === "all" || post.type === activeButton));

      // If there's a search query, prioritize search match
      const searchResults = debouncedQuery ? searchMatch : true;

      return (
        typeMatch &&
        searchResults &&
        categoryMatch &&
        locationMatch &&
        descriptionMatch
      );
    });
  }, [
    postsToDisplay,
    debouncedQuery,
    debouncedDescriptionSearch,
    debouncedLocationSearch,
    categorySearch,
    activeButton,
    isResolvedTab,
  ]);

  return (
    <Layout>
      <View className="flex-1 px-4">
        <SearchWithToggle
          query={query}
          setQuery={setQuery}
          categorySearch={categorySearch}
          setCategorySearch={setCategorySearch}
          locationSearch={locationSearch}
          setLocationSearch={setLocationSearch}
          descriptionSearch={descriptionSearch}
          setDescriptionSearch={setDescriptionSearch}
        />

        <View className="mt-4">
          <TouchableOpacity
            activeOpacity={0.3} // Controls how transparent it gets when pressed (0 to 1)
            delayPressIn={100} // Adds a small delay before the press effect triggers
            delayPressOut={100} // Adds delay before it resets back
            onPress={() => setShowFilters(!showFilters)}
            className="flex-row items-center justify-between bg-navyblue px-4 py-3 rounded-md active:bg-zinc-200"
          >
            {/* 👇 Display selected filter type dynamically */}
            <Text className="text-base font-manrope-semibold text-white">
              Item Report Types -{" "}
              <Text className="capitalize text-white">
                {activeButton === "all"
                  ? "All Items"
                  : activeButton === "lost"
                    ? "Lost Items"
                    : activeButton === "found"
                      ? "Found Items"
                      : activeButton === "resolved"
                        ? "Completed Items"
                        : "All Items"}
              </Text>
            </Text>

            <Ionicons
              name={showFilters ? "chevron-up-outline" : "chevron-down-outline"}
              size={20}
              color="#FFFFFF"
              className="ml-2"
            />
          </TouchableOpacity>

          {/* 🔽 Collapsible Buttons Section */}
          {showFilters && (
            <View className="mt-3">
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setActiveButton("all")}
                  className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                    activeButton === "all" ? "bg-navyblue" : "bg-zinc-200"
                  }`}
                >
                  <Text
                    className={`font-semibold text-base font-manrope-semibold ${
                      activeButton === "all" ? "text-white" : "text-black"
                    }`}
                  >
                    All Items
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveButton("lost")}
                  className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                    activeButton === "lost" ? "bg-navyblue" : "bg-zinc-200"
                  }`}
                >
                  <Text
                    className={`font-semibold text-base font-manrope-semibold ${
                      activeButton === "lost" ? "text-white" : "text-black"
                    }`}
                  >
                    Lost Items
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveButton("found")}
                  className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                    activeButton === "found" ? "bg-navyblue" : "bg-zinc-200"
                  }`}
                >
                  <Text
                    className={`font-semibold text-base font-manrope-semibold ${
                      activeButton === "found" ? "text-white" : "text-black"
                    }`}
                  >
                    Found Items
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row mt-2 gap-2">
                <TouchableOpacity
                  onPress={() => setActiveButton("resolved")}
                  className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
                    activeButton === "resolved" ? "bg-navyblue" : "bg-zinc-200"
                  }`}
                >
                  <Text
                    className={`font-semibold text-base font-manrope-semibold ${
                      activeButton === "resolved" ? "text-white" : "text-black"
                    }`}
                  >
                    Completed Items
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* 📄 Filtered Post List with Smart Loading & Error States */}
        {error ? (
          <View className="items-center justify-center mt-10">
            <Text className="text-red-500 text-base font-manrope-medium">
              Error loading posts: {error}
            </Text>
            <TouchableOpacity
              onPress={() => {
                /* Add retry functionality if needed */
              }}
              className="mt-3 px-4 py-2 bg-navyblue rounded"
            >
              <Text className="text-white font-manrope-medium">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : isInitialLoad && loading ? (
          <PostCardSkeletonList count={5} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={filteredPosts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCard post={item} descriptionSearch={descriptionSearch} />
            )}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <View className="items-center justify-center mt-10">
                <Text className="text-gray-500 text-base font-manrope-medium">
                  No posts/report found.
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
            className="mt-4"
          />
        )}
      </View>
    </Layout>
  );
}
