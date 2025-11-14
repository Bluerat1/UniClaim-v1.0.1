import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/services/firebase/config";
import type { Post } from "@/types/Post";
import { subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

export const usePostsAnalytics = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  // Fetch posts from Firestore
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const postsCollection = collection(db, "posts");
        const q = query(postsCollection, orderBy("createdAt", "desc"));

        const postsSnapshot = await getDocs(q);
        const postsData = postsSnapshot.docs.map((doc) => {
          const data = doc.data();
          const normalizeDate = (dateValue: any) => {
            if (!dateValue) return null;
            if (dateValue.toDate) return dateValue.toDate();
            if (dateValue.seconds) return new Date(dateValue.seconds * 1000);
            if (dateValue instanceof Date) return dateValue;
            return new Date(dateValue);
          };
          
          return {
            id: doc.id,
            ...data,
            createdAt: normalizeDate(data.createdAt),
            updatedAt: normalizeDate(data.updatedAt),
          } as Post;
        });

        setPosts(postsData);
      } catch (error) {
        console.error("Error fetching posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Filter posts by date range
  const filteredPosts = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return posts;
    
    return posts.filter((post) => {
      // Handle both Firestore Timestamp and Date objects
      const postDate = post.createdAt ? 
        (typeof post.createdAt === 'object' && 'toDate' in post.createdAt ? 
          post.createdAt.toDate() : 
          new Date(post.createdAt)) : 
        null;
      
      if (!postDate) return false;
      
      const startOfDayDate = startOfDay(dateRange.from!);
      const endOfDayDate = endOfDay(dateRange.to!);
      
      return postDate >= startOfDayDate && postDate <= endOfDayDate;
    });
  }, [posts, dateRange]);

  // Calculate 
  const stats = useMemo(() => {
    const totalPosts = filteredPosts.length;
    const lostItems = filteredPosts.filter((post) => post.type === "lost").length;
    const foundItems = filteredPosts.filter((post) => post.type === "found").length;
    const resolvedItems = filteredPosts.filter((post) => post.status === "resolved").length;

    return {
      totalPosts,
      lostItems,
      foundItems,
      resolvedItems,
      pendingItems: totalPosts - resolvedItems,
    };
  }, [filteredPosts]);

  return {
    posts: filteredPosts,
    loading,
    dateRange,
    setDateRange,
    stats,
  };
};
