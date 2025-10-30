import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../utils/firebase';
import type { Post } from '../types/Post';

// Cache for admin status
const adminStatusCache = new Map<string, boolean>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

// Maximum number of emails to query at once (Firestore limit is 10 for 'in' queries)
const BATCH_SIZE = 10;

/**
 * Hook to get admin status for all users in posts
 * This pre-fetches admin status to avoid async calls in PostCard components
 */
export const useAdminStatus = (posts: Post[]) => {
    const [adminStatuses, setAdminStatuses] = useState<Map<string, boolean>>(new Map());
    const [, setIsLoading] = useState<boolean>(false);
    const [, setError] = useState<Error | null>(null);

    // Create a stable key for the current set of posts
    const postsKey = useMemo(() => {
        if (!Array.isArray(posts)) return '';
        return posts
            .map(post => post?.user?.email || '')
            .filter(Boolean)
            .sort()
            .join(',');
    }, [posts]);

    useEffect(() => {
        const fetchAdminStatuses = async () => {
            if (!Array.isArray(posts) || !posts.length) {
                setAdminStatuses(new Map());
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // Get unique user emails from posts
                const userEmails = new Set<string>();
                posts.forEach(post => {
                    if (post?.user?.email) {
                        userEmails.add(post.user.email);
                    }
                });

                if (userEmails.size === 0) {
                    setAdminStatuses(new Map());
                    return;
                }

                const newAdminStatuses = new Map<string, boolean>();
                const emailsToFetch: string[] = [];
                const now = Date.now();

                // Check cache first
                for (const email of userEmails) {
                    const cached = adminStatusCache.get(email);
                    const cacheTime = cacheTimestamps.get(email);

                    if (cached !== undefined && cacheTime && now - cacheTime < CACHE_DURATION) {
                        newAdminStatuses.set(email, cached);
                    } else {
                        emailsToFetch.push(email);
                    }
                }

                // Process emails in batches to respect Firestore's 'in' query limits
                if (emailsToFetch.length > 0) {
                    for (let i = 0; i < emailsToFetch.length; i += BATCH_SIZE) {
                        const batch = emailsToFetch.slice(i, i + BATCH_SIZE);
                        try {
                            const q = query(
                                collection(db, 'users'),
                                where('email', 'in', batch),
                                limit(BATCH_SIZE)
                            );

                            const querySnapshot = await getDocs(q);

                            querySnapshot.forEach(doc => {
                                const userData = doc.data();
                                const email = userData?.email;
                                if (email) {
                                    const isAdmin = userData.role === 'admin';
                                    adminStatusCache.set(email, isAdmin);
                                    cacheTimestamps.set(email, now);
                                    newAdminStatuses.set(email, isAdmin);
                                }
                            });

                            // Set default false for emails not found in this batch
                            batch.forEach(email => {
                                if (!newAdminStatuses.has(email)) {
                                    adminStatusCache.set(email, false);
                                    cacheTimestamps.set(email, now);
                                    newAdminStatuses.set(email, false);
                                }
                            });
                        } catch (batchError) {
                            console.error('Error fetching admin status batch:', batchError);
                            // Continue with other batches even if one fails
                        }
                    }
                }

                setAdminStatuses(newAdminStatuses);
            } catch (error) {
                console.error('Error in fetchAdminStatuses:', error);
                setError(error instanceof Error ? error : new Error('Failed to fetch admin statuses'));
                // Return empty map on error to avoid breaking the UI
                setAdminStatuses(new Map());
            } finally {
                setIsLoading(false);
            }
        };

        fetchAdminStatuses();
    }, [postsKey]);

    return adminStatuses;
};
