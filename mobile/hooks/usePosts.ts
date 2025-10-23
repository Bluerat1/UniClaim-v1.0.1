import { useState, useEffect, useRef } from 'react';
import { postService } from '../utils/firebase';
import type { Post } from '../types/type';
import { useAuth } from '../context/AuthContext';

// Global cache to persist data between component unmounts
const globalPostCache = new Map<string, { posts: Post[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Custom hook for real-time posts with smart caching
export const usePosts = () => {
    const { isAuthenticated } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const cacheKey = 'all-posts';
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Check if we have valid cached data
    const cachedData = globalPostCache.get(cacheKey);
    const hasValidCache = cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION;

    useEffect(() => {
        // If user is not authenticated, clear posts and don't set up listeners
        if (!isAuthenticated) {
            // Clear posts
            setPosts([]);
            setLoading(false);
            setIsInitialLoad(false);

            // Clean up any existing listener
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }

            // Clear cache to prevent stale data
            globalPostCache.delete(cacheKey);
            return;
        }

        // User is authenticated - set up listeners
        // If we have valid cached data, use it immediately
        if (hasValidCache) {
            setPosts(cachedData.posts);
            setLoading(false);
            setIsInitialLoad(false);
        } else {
            setLoading(true);
        }

        // Subscribe to real-time updates directly (like web version)
        // Using getActivePosts instead of getAllPosts for consistent ordering
        const unsubscribe = postService.getActivePosts((fetchedPosts) => {
            setPosts(fetchedPosts);
            setLoading(false);
            setIsInitialLoad(false);

            // Cache the data
            globalPostCache.set(cacheKey, {
                posts: fetchedPosts,
                timestamp: Date.now()
            });
        });

        // Store unsubscribe function for cleanup
        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribeRef.current = null;
            }
        };
    }, [isAuthenticated, hasValidCache]);

    return {
        posts,
        loading: isInitialLoad ? loading : false, // Only show loading on first load
        error,
        isInitialLoad
    };
};

// Custom hook for posts by type with caching
export const usePostsByType = (type: 'lost' | 'found') => {
    const { isAuthenticated } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const cacheKey = `posts-${type}`;
    const unsubscribeRef = useRef<(() => void) | null>(null);

    const cachedData = globalPostCache.get(cacheKey);
    const hasValidCache = cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION;

    useEffect(() => {
        // If user is not authenticated, clear posts and don't set up listeners
        if (!isAuthenticated) {
            // Clear posts
            setPosts([]);
            setLoading(false);
            setIsInitialLoad(false);

            // Clean up any existing listener
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }

            // Clear cache to prevent stale data
            globalPostCache.delete(cacheKey);
            return;
        }

        // User is authenticated - set up listeners
        if (hasValidCache) {
            setPosts(cachedData.posts);
            setLoading(false);
            setIsInitialLoad(false);
        } else {
            setLoading(true);
        }

        const unsubscribe = postService.getPostsByType(type, (fetchedPosts) => {
            setPosts(fetchedPosts);
            setLoading(false);
            setIsInitialLoad(false);

            globalPostCache.set(cacheKey, {
                posts: fetchedPosts,
                timestamp: Date.now()
            });
        });

        // Store unsubscribe function for cleanup
        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribeRef.current = null;
            }
        };
    }, [type, isAuthenticated, hasValidCache]);

    return {
        posts,
        loading: isInitialLoad ? loading : false,
        isInitialLoad
    };
};

// Custom hook for posts by category
export const usePostsByCategory = (category: string) => {
    const { isAuthenticated } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        // If user is not authenticated, clear posts and don't set up listeners
        if (!isAuthenticated) {
            // Clear posts
            setPosts([]);
            setLoading(false);

            // Clean up any existing listener
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            return;
        }

        // User is authenticated
        if (!category) {
            setPosts([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Note: getPostsByCategory doesn't exist in postService, using getAllPosts instead
        const unsubscribe = postService.getAllPosts((fetchedPosts) => {
            // Filter by category locally
            const filteredPosts = fetchedPosts.filter(post => post.category === category);
            setPosts(filteredPosts);
            setLoading(false);
        });

        // Store unsubscribe function for cleanup
        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribeRef.current = null;
            }
        };
    }, [category, isAuthenticated]);

    return { posts, loading };
};

// Custom hook for user's posts
export const useUserPosts = (userEmail: string) => {
    const { isAuthenticated } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        // If user is not authenticated, clear posts and don't set up listeners
        if (!isAuthenticated) {
            // Clear posts
            setPosts([]);
            setLoading(false);

            // Clean up any existing listener
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            return;
        }

        // User is authenticated
        if (!userEmail) {
            setPosts([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubscribe = postService.getUserPosts(userEmail, (fetchedPosts) => {
            setPosts(fetchedPosts);
            setLoading(false);
        });

        // Store unsubscribe function for cleanup
        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribeRef.current = null;
            }
        };
    }, [userEmail, isAuthenticated]);

    return { posts, loading };
};

// Custom hook for user's posts with setPosts functionality
export const useUserPostsWithSet = (userEmail: string) => {
    const { isAuthenticated } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        // Set mounted flag
        isMountedRef.current = true;

        // If user is not authenticated, clear posts and don't set up listeners
        if (!isAuthenticated) {
            if (isMountedRef.current) {
                setPosts([]);
                setLoading(false);
            }

            // Clean up any existing listener
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            return;
        }

        // User is authenticated
        if (!userEmail) {
            if (isMountedRef.current) {
                setPosts([]);
                setLoading(false);
            }
            return;
        }

        if (isMountedRef.current) {
            setLoading(true);
        }

        const unsubscribe = postService.getUserPosts(userEmail, (fetchedPosts) => {
            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setPosts(fetchedPosts);
                setLoading(false);
            }
        });

        // Store unsubscribe function for cleanup
        unsubscribeRef.current = unsubscribe;

        return () => {
            // Set mounted flag to false
            isMountedRef.current = false;

            // Clean up listener
            if (unsubscribe) {
                unsubscribe();
                unsubscribeRef.current = null;
            }
        };
    }, [userEmail, isAuthenticated]);

    return { posts, setPosts, loading };
};

// Custom hook for resolved posts (completed reports)
export const useResolvedPosts = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isAuthenticated } = useAuth();
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        // If user is not authenticated, clear posts and don't set up listeners
        if (!isAuthenticated) {
            // Clear posts
            setPosts([]);
            setLoading(false);
            setError(null);

            // Clean up any existing listener
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            return;
        }

        // User is authenticated - set up listeners
        setLoading(true);
        setError(null);

        // Subscribe to resolved posts directly (like web version)
        const unsubscribe = postService.getResolvedPosts((fetchedPosts: Post[]) => {
            setPosts(fetchedPosts);
            setLoading(false);
            setError(null);
        });

        // Store unsubscribe function for cleanup
        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribeRef.current = null;
            }
        };
    }, [isAuthenticated]);

    return { posts, loading, error };
};
