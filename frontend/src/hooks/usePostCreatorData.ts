import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Post } from '@/types/Post';

/**
 * Custom hook to get real-time user data for post creators
 * Returns current user data from AuthContext if the post creator is the current user
 * Falls back to static post.user data for other users' posts
 */
export const usePostCreatorData = (post: Post) => {
  const { userData: currentUserData } = useAuth();

  const creatorData = useMemo(() => {
    // If this post was created by the current user, use real-time data from AuthContext
    if (currentUserData && currentUserData.uid === post.creatorId) {
      return {
        ...currentUserData,
        // Override profile picture to prefer the newer field
        profilePicture: currentUserData.profilePicture || currentUserData.profileImageUrl,
      };
    }

    // For other users' posts, use the static data from the post
    return post.user || null;
  }, [currentUserData, post.creatorId, post.user]);

  return creatorData;
};
