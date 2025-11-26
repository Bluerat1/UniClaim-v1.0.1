import { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase/config';

// Simple in-memory cache
const userCache = new Map<string, any>();

export const useUserData = (userId: string | undefined) => {
    const [userData, setUserData] = useState<{
        firstName?: string;
        lastName?: string;
        profilePicture?: string;
        email?: string;
        loading: boolean;
        error?: Error;
    }>({
        loading: !!userId // Only set loading to true if we have a userId
    });

    const loadingRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!userId) {
            setUserData({ loading: false });
            return;
        }

        // Check if we already have the data in cache
        if (userCache.has(userId)) {
            setUserData({ ...userCache.get(userId), loading: false });
            return;
        }

        // Prevent duplicate requests
        if (loadingRef.current[userId]) return;
        loadingRef.current[userId] = true;

        const fetchUserData = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const userInfo = {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        profilePicture: data.profilePicture,
                        email: data.email,
                        loading: false
                    };
                    // Update cache
                    userCache.set(userId, userInfo);
                    setUserData(userInfo);
                } else {
                    setUserData({ loading: false });
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                setUserData({
                    loading: false,
                    error: error instanceof Error ? error : new Error('Failed to fetch user data')
                });
            } finally {
                loadingRef.current[userId] = false;
            }
        };

        fetchUserData();

        // Cleanup function
        return () => {
            loadingRef.current[userId] = false;
        };
    }, [userId]);

    return userData;
};

// Export cache management functions
export const invalidateUserCache = (userId: string) => {
    userCache.delete(userId);
};

export const refreshUser = async (userId: string) => {
    if (!userId) return;

    // Remove from cache to force re-fetch
    invalidateUserCache(userId);

    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            const userInfo = {
                firstName: data.firstName,
                lastName: data.lastName,
                profilePicture: data.profilePicture,
                email: data.email,
                loading: false
            };
            // Update cache with fresh data
            userCache.set(userId, userInfo);
            return userInfo;
        }
    } catch (error) {
        console.error('Error refreshing user data:', error);
    }
};
