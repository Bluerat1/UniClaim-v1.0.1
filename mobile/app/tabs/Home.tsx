import React, { useState, useEffect } from "react";
import { FlatList, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import SearchWithToggle from "../../components/Input";
import PostCard from "../../components/PostCard";
import { PostCardSkeletonList } from "../../components/PostCardSkeleton";
import Layout from "../../layout/HomeLayout";
import type { Post } from "../../types/type";

// hooks
import { usePosts, useResolvedPosts } from "../../hooks/usePosts";

export default function Home() {
  // ✅ Use the custom hook for real-time posts with smart loading
  const { posts, loading, error, isInitialLoad } = usePosts();
  const { posts: resolvedPosts, loading: resolvedLoading, error: resolvedError } = useResolvedPosts();
  
  // Simple scroll handling (like web version)
  const flatListRef = React.useRef<FlatList>(null);
  
  const [activeButton, setActiveButton] = useState<"all" | "lost" | "found" | "completed">("all");
  const [query, setQuery] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [descriptionSearch, setDescriptionSearch] = useState("");

  // Simple scroll handling - no complex preservation needed

  // Determine which posts to display based on activeButton
  const getPostsToDisplay = () => {
    // Get the appropriate posts based on active tab
    let basePosts = activeButton === "completed" ? (resolvedPosts || []) : (posts || []);
    
    // Create a new array to avoid mutating the original
    // Sort by createdAt in descending order (newest first)
    return [...basePosts].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });
  };

  const postsToDisplay = getPostsToDisplay();

  const filteredPosts = postsToDisplay.filter((post) => {
    // ✅ Add data validation to prevent crashes
    if (!post || !post.title || !post.description || !post.category || !post.location) {
      return false;
    }
    
    // Filter out any posts that might have been missed by the service
    // This is just an extra safety check
    if (post.movedToUnclaimed || post.isHidden === true) {
      return false;
    }
    
    // Filter out items with turnoverStatus: "declared" for OSA turnover
    if (post.turnoverDetails && 
        post.turnoverDetails.turnoverStatus === "declared" && 
        post.turnoverDetails.turnoverAction === "turnover to OSA") {
      return false;
    }
    
    const queryWords = query.toLowerCase().trim().split(/\s+/);

    const titleMatch = queryWords.every((word) =>
      post.title.toLowerCase().includes(word)
    );

    const descriptionMatch = descriptionSearch
      ? post.description
          .toLowerCase()
          .includes(descriptionSearch.toLowerCase().trim())
      : true;

    const categoryMatch = categorySearch
      ? post.category === categorySearch
      : true;

    const locationMatch = locationSearch
      ? post.location === locationSearch
      : true;

    // For active posts, make sure they're not resolved
    // For completed view, we don't need to check status as resolvedPosts already contains only resolved posts
    const typeMatch = activeButton === "completed" || 
                     (post.status !== "resolved" && 
                      (activeButton === "all" || post.type === activeButton));

    return typeMatch && titleMatch && categoryMatch && locationMatch && descriptionMatch;
  });

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

        <View className="flex-row mt-5 gap-2">
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
            onPress={() => setActiveButton("completed")}
            className={`flex-1 h-[3.3rem] rounded-md items-center justify-center ${
              activeButton === "completed" ? "bg-navyblue" : "bg-zinc-200"
            }`}
          >
            <Text
              className={`font-semibold text-base font-manrope-semibold ${
                activeButton === "completed" ? "text-white" : "text-black"
              }`}
            >
              Completed Items
            </Text>
          </TouchableOpacity>
        </View>

        {/* 📄 Filtered Post List with Smart Loading & Error States */}
        {(error || resolvedError) ? (
          <View className="items-center justify-center mt-10">
            <Text className="text-red-500 text-base font-manrope-medium">
              Error loading posts: {error || resolvedError}
            </Text>
            <TouchableOpacity 
              onPress={() => {/* Add retry functionality if needed */}}
              className="mt-3 px-4 py-2 bg-navyblue rounded"
            >
              <Text className="text-white font-manrope-medium">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (isInitialLoad && (loading || resolvedLoading)) ? (
          // Show skeleton loading only on first load
          <PostCardSkeletonList count={5} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={filteredPosts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCard post={item} descriptionSearch={descriptionSearch} />
            )}
            scrollEventThrottle={16} // Optimize scroll performance
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
