import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { postService } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';

// Simple in-memory cache to store last successful responses
const responseCache = new Map<string, any>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

// Helper function to get cache key
const getCacheKey = (userEmail: string, pageSize: number, lastDocId?: string) => {
  return `user-posts:${userEmail}:${pageSize}:${lastDocId || 'initial'}`;
};

export const usePaginatedUserPosts = (userEmail: string, pageSize = 10) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const lastDocRef = useRef<any>(null);
    const isInitialLoad = useRef(true);
    const retryCount = useRef(0);
    const maxRetries = 3;
    const requestInProgress = useRef(false);

    // Clear cache when user changes
    useEffect(() => {
        return () => {
            // Clean up cache when component unmounts or user changes
            responseCache.clear();
        };
    }, [userEmail]);

    const fetchPosts = useCallback(async (isInitial: boolean, lastDocParam: any = null) => {
        if (!user || !userEmail || requestInProgress.current) {
            return;
        }

        const cacheKey = getCacheKey(userEmail, pageSize, lastDocParam?.id);
        const cachedResponse = responseCache.get(cacheKey);
        
        // Return cached response if available and not expired
        if (cachedResponse && (Date.now() - cachedResponse.timestamp < CACHE_DURATION)) {
            const { posts: cachedPosts, lastDoc: cachedLastDoc, hasMore: cachedHasMore } = cachedResponse.data;
            
            if (isInitial) {
                setPosts(cachedPosts);
            } else {
                setPosts(prev => [...prev, ...cachedPosts]);
            }
            
            lastDocRef.current = cachedLastDoc;
            setHasMore(cachedHasMore);
            setLoading(false);
            setLoadingMore(false);
            return;
        }

        try {
            requestInProgress.current = true;
            
            if (isInitial) {
                setLoading(true);
                setError(null);
            } else {
                setLoadingMore(true);
            }

            // Add a small delay to prevent rapid successive requests
            await new Promise(resolve => setTimeout(resolve, 100));

            const { posts: newPosts, lastDoc, hasMore: more } = 
                await postService.getUserPostsPaginated(userEmail, lastDocParam, pageSize);
            
            // Update cache
            responseCache.set(cacheKey, {
                data: { posts: newPosts, lastDoc, hasMore: more },
                timestamp: Date.now()
            });
            
            // Update state
            if (isInitial) {
                setPosts(newPosts);
            } else {
                setPosts(prev => [...prev, ...newPosts]);
            }
            
            lastDocRef.current = lastDoc;
            setHasMore(more);
            setError(null);
            retryCount.current = 0; // Reset retry count on success
        } catch (error) {
            console.error('Error loading posts:', error);
            
            // Only show error if we've exhausted all retries
            if (retryCount.current >= maxRetries) {
                setError(error as Error);
            }
            
            // Implement exponential backoff for retries
            if (retryCount.current < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, retryCount.current), 10000); // Max 10s delay
                retryCount.current += 1;
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchPosts(isInitial, lastDocParam);
            }
        } finally {
            requestInProgress.current = false;
            setLoading(false);
            setLoadingMore(false);
            isInitialLoad.current = false;
        }
    }, [user, userEmail, pageSize]);

    const loadInitialPosts = useCallback(() => {
        if (!userEmail) return;
        
        isInitialLoad.current = true;
        lastDocRef.current = null;
        setHasMore(true);
        setError(null);
        retryCount.current = 0;
        
        // Clear cache for initial load to ensure fresh data
        const cachePrefix = `user-posts:${userEmail}:${pageSize}`;
        Array.from(responseCache.keys())
            .filter(key => key.startsWith(cachePrefix))
            .forEach(key => responseCache.delete(key));
            
        fetchPosts(true);
    }, [fetchPosts, userEmail, pageSize]);

    const loadMorePosts = useCallback(() => {
        if (!hasMore || loading || loadingMore || !lastDocRef.current || requestInProgress.current) {
            return;
        }
        fetchPosts(false, lastDocRef.current);
    }, [hasMore, loading, loadingMore, fetchPosts]);

    // Reset when userEmail or pageSize changes
    useEffect(() => {
        loadInitialPosts();
        
        // Cleanup function
        return () => {
            // Cancel any pending requests
            requestInProgress.current = false;
        };
    }, [loadInitialPosts]);

    // Memoize the return value to prevent unnecessary re-renders
    return useMemo(() => ({
        posts,
        loading,
        loadingMore,
        hasMore,
        error,
        loadMore: loadMorePosts,
        refresh: loadInitialPosts,
        retryCount: retryCount.current,
        maxRetries
    }), [posts, loading, loadingMore, hasMore, error, loadMorePosts, loadInitialPosts]);
};
