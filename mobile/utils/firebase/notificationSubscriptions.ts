// Notification subscription service for optimized notification delivery (Mobile)
import { db } from './config';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';
import {
    NotificationSubscription,
    CreateSubscriptionData,
    UpdateSubscriptionData,
    DEFAULT_SUBSCRIPTION_PREFERENCES
} from '../../types/NotificationSubscription';

export class NotificationSubscriptionService {
    private static instance: NotificationSubscriptionService;
    private readonly collectionName = 'notifications_subscriptions';

    static getInstance(): NotificationSubscriptionService {
        if (!NotificationSubscriptionService.instance) {
            NotificationSubscriptionService.instance = new NotificationSubscriptionService();
        }
        return NotificationSubscriptionService.instance;
    }

    // Ensure a user has a subscription document, creating one with default preferences if it doesn't exist
    async ensureUserHasSubscription(userId: string): Promise<void> {
        try {
            const existingSub = await this.getSubscription(userId);
            if (!existingSub) {
                // Create a default subscription for this user
                await this.createSubscription({
                    userId,
                    isActive: true,
                    preferences: {
                        // Use default preferences (all true, all categories and locations)
                        newPosts: true,
                        messages: true,
                        claimUpdates: true,
                        adminAlerts: true,
                        categories: [], // Empty array means interested in all categories
                        locations: [],  // Empty array means interested in all locations
                        quietHours: {
                            enabled: false,
                            start: "22:00",
                            end: "08:00"
                        },
                        soundEnabled: true
                    }
                });
                console.log(`✅ Created default notification subscription for user: ${userId}`);
            }
        } catch (error) {
            console.error(`❌ Error ensuring subscription for user ${userId}:`, error);
            throw error;
        }
    }

    // Create a new subscription for a user
    async createSubscription(data: CreateSubscriptionData): Promise<void> {
        try {
            const subscriptionData: NotificationSubscription = {
                userId: data.userId,
                preferences: {
                    ...DEFAULT_SUBSCRIPTION_PREFERENCES,
                    ...data.preferences
                },
                lastUpdated: serverTimestamp(),
                isActive: data.isActive ?? true
            };

            await setDoc(doc(db, this.collectionName, data.userId), subscriptionData);
            console.log('✅ Created notification subscription for user:', data.userId);
        } catch (error) {
            console.error('❌ Error creating notification subscription:', error);
            throw error;
        }
    }

    // Get subscription for a specific user
    async getSubscription(userId: string): Promise<NotificationSubscription & { id: string } | null> {
        try {
            const docRef = doc(db, this.collectionName, userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    id: docSnap.id,
                    ...(docSnap.data() as Omit<NotificationSubscription, 'id'>)
                } as NotificationSubscription & { id: string };
            }

            return null;
        } catch (error) {
            console.error('❌ Error getting notification subscription:', error);
            throw error;
        }
    }

    // Update subscription preferences
    async updateSubscription(userId: string, data: UpdateSubscriptionData): Promise<void> {
        try {
            const docRef = doc(db, this.collectionName, userId);
            const updateData: any = {
                lastUpdated: serverTimestamp()
            };

            // If preferences are being updated, merge them with existing preferences
            if (data.preferences) {
                // First, get the current subscription to merge with existing preferences
                const currentSubscription = await this.getSubscription(userId);
                
                // Start with current preferences or default preferences if none exists
                const currentPreferences: NotificationSubscription['preferences'] = currentSubscription?.preferences || {
                    newPosts: true,
                    messages: true,
                    claimUpdates: true,
                    adminAlerts: true,
                    categories: [],
                    locations: [],
                    quietHours: {
                        enabled: false,
                        start: "22:00",
                        end: "08:00"
                    },
                    soundEnabled: true
                };
                
                // Deep merge the preferences
                updateData.preferences = {
                    ...currentPreferences,
                    ...data.preferences,
                    // Ensure quietHours is properly merged if it exists in the update
                    ...(data.preferences.quietHours && {
                        quietHours: {
                            ...currentPreferences.quietHours,
                            ...data.preferences.quietHours
                        }
                    })
                };
            }

            if (data.isActive !== undefined) {
                updateData.isActive = data.isActive;
            }

            await updateDoc(docRef, updateData);
            console.log('✅ Updated notification subscription for user:', userId);
        } catch (error) {
            console.error('❌ Error updating notification subscription:', error);
            throw error;
        }
    }

    // Get users interested in new posts for a specific category
    async getUsersInterestedInCategory(category: string): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                where('preferences.newPosts', '==', true),
                where('preferences.categories', 'array-contains', category)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<NotificationSubscription, 'id'>)
            } as NotificationSubscription & { id: string }));
        } catch (error) {
            console.error('❌ Error getting users interested in category:', error);
            throw error;
        }
    }

    // Get users interested in new posts (all categories)
    async getUsersInterestedInNewPosts(): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            // First, get all active users who have newPosts enabled
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                where('preferences.newPosts', '==', true)
            );

            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<NotificationSubscription, 'id'>)
            } as NotificationSubscription & { id: string }));

            // Also include all campus_security users who might not have a subscription yet
            const usersRef = collection(db, 'users');
            const campusSecurityQuery = query(
                usersRef,
                where('role', '==', 'campus_security')
            );
            
            const campusSecuritySnapshot = await getDocs(campusSecurityQuery);
            const campusSecurityUserIds = campusSecuritySnapshot.docs.map(doc => doc.id);
            
            // Get subscriptions for campus_security users
            const subscriptionPromises = campusSecurityUserIds.map(async (userId) => {
                // Ensure the campus_security user has a subscription
                await this.ensureUserHasSubscription(userId);
                const subscription = await this.getSubscription(userId);
                return subscription;
            });
            
            const campusSecuritySubscriptions = await Promise.all(subscriptionPromises);
            
            // Combine both lists and remove duplicates
            const combined = [...users];
            for (const sub of campusSecuritySubscriptions) {
                if (sub && !combined.some(u => u.userId === sub.userId)) {
                    combined.push(sub);
                }
            }
            
            return combined as (NotificationSubscription & { id: string })[];
        } catch (error) {
            console.error('❌ Error getting users interested in new posts:', error);
            throw error;
        }
    }

    // Get users interested in specific location
    async getUsersInterestedInLocation(location: string): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                where('preferences.newPosts', '==', true),
                where('preferences.locations', 'array-contains', location)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<NotificationSubscription, 'id'>)
            } as NotificationSubscription & { id: string }));
        } catch (error) {
            console.error('❌ Error getting users interested in location:', error);
            throw error;
        }
    }

    // Get users for admin alerts
    async getUsersForAdminAlerts(): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                where('preferences.adminAlerts', '==', true)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<NotificationSubscription, 'id'>)
            } as NotificationSubscription & { id: string }));
        } catch (error) {
            console.error('❌ Error getting users for admin alerts:', error);
            throw error;
        }
    }

    // COMPOUND QUERIES - More efficient filtering with multiple criteria

    // Get users interested in specific category AND location
    async getUsersInterestedInCategoryAndLocation(category: string, location: string): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                where('preferences.newPosts', '==', true),
                where('preferences.categories', 'array-contains', category),
                where('preferences.locations', 'array-contains', location)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<NotificationSubscription, 'id'>)
            } as NotificationSubscription & { id: string }));
        } catch (error) {
            console.error('❌ Error getting users interested in category and location:', error);
            throw error;
        }
    }

    // Get users interested in specific category (with fallback for users interested in all categories)
    async getUsersInterestedInCategoryWithFallback(category: string): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            // First, get users specifically interested in this category
            const categorySpecificUsers = await this.getUsersInterestedInCategory(category);

            // Then, get users interested in all categories (empty categories array)
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                where('preferences.newPosts', '==', true),
                where('preferences.categories', '==', []) // Empty array means interested in all categories
            );

            const snapshot = await getDocs(q);
            const allCategoryUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<NotificationSubscription, 'id'>)
            } as NotificationSubscription & { id: string }));

            // Combine and deduplicate
            const allUsers = [...categorySpecificUsers, ...allCategoryUsers];
            const uniqueUsers = allUsers.filter((user, index, self) =>
                index === self.findIndex(u => u.userId === user.userId)
            );

            return uniqueUsers;
        } catch (error) {
            console.error('❌ Error getting users interested in category with fallback:', error);
            throw error;
        }
    }

    // Get users interested in specific location (with fallback for users interested in all locations)
    async getUsersInterestedInLocationWithFallback(location: string): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            // First, get users specifically interested in this location
            const locationSpecificUsers = await this.getUsersInterestedInLocation(location);

            // Then, get users interested in all locations (empty locations array)
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                where('preferences.newPosts', '==', true),
                where('preferences.locations', '==', []) // Empty array means interested in all locations
            );

            const snapshot = await getDocs(q);
            const allLocationUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<NotificationSubscription, 'id'>)
            } as NotificationSubscription & { id: string }));

            // Combine and deduplicate
            const allUsers = [...locationSpecificUsers, ...allLocationUsers];
            const uniqueUsers = allUsers.filter((user, index, self) =>
                index === self.findIndex(u => u.userId === user.userId)
            );

            return uniqueUsers;
        } catch (error) {
            console.error('❌ Error getting users interested in location with fallback:', error);
            throw error;
        }
    }

    // Get users for a post with optimal filtering (category + location + time awareness)
    async getOptimalUsersForPost(postData: {
        category: string;
        location: string;
        type: 'lost' | 'found';
    }): Promise<(NotificationSubscription & { id: string })[]> {
        try {
            // Start with users interested in this category (with fallback)
            let interestedUsers = await this.getUsersInterestedInCategoryWithFallback(postData.category);

            // If we have a specific location, further filter by location
            if (postData.location) {
                const locationInterestedUsers = await this.getUsersInterestedInLocationWithFallback(postData.location);

                // Find intersection of category and location interested users
                interestedUsers = interestedUsers.filter(user =>
                    locationInterestedUsers.some(locationUser => locationUser.userId === user.userId)
                );
            }
            
            // Always include all campus_security users
            try {
                const usersRef = collection(db, 'users');
                const campusSecurityQuery = query(
                    usersRef,
                    where('role', '==', 'campus_security')
                );
                
                const campusSecuritySnapshot = await getDocs(campusSecurityQuery);
                const campusSecurityUserIds = campusSecuritySnapshot.docs.map(doc => doc.id);
                
                // Ensure all campus_security users have subscriptions
                const subscriptionPromises = campusSecurityUserIds.map(async (userId) => {
                    await this.ensureUserHasSubscription(userId);
                    return this.getSubscription(userId);
                });
                
                const campusSecuritySubscriptions = (await Promise.all(subscriptionPromises)).filter(Boolean);
                
                // Add campus_security users if not already in the list
                for (const sub of campusSecuritySubscriptions) {
                    if (sub && !interestedUsers.some(u => u.userId === sub.userId)) {
                        interestedUsers.push(sub);
                    }
                }
            } catch (error) {
                console.error('❌ Error including campus_security users:', error);
                // Don't fail the whole operation if we can't get campus_security users
            }

            // Filter out users in quiet hours (this is done in JavaScript since Firestore doesn't support time-based queries easily)
            const currentTime = new Date();
            const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

            const activeUsers = interestedUsers.filter(user => {
                const { quietHours } = user.preferences;

                if (!quietHours.enabled) {
                    return true; // No quiet hours set
                }

                const startMinutes = this.timeToMinutes(quietHours.start);
                const endMinutes = this.timeToMinutes(quietHours.end);

                if (startMinutes > endMinutes) {
                    // Quiet hours span midnight
                    return !(currentMinutes >= startMinutes || currentMinutes <= endMinutes);
                } else {
                    // Normal quiet hours
                    return !(currentMinutes >= startMinutes && currentMinutes <= endMinutes);
                }
            });

            console.log(`🎯 Optimal filtering: ${interestedUsers.length} → ${activeUsers.length} users (filtered by quiet hours)`);
            return activeUsers;
        } catch (error) {
            console.error('❌ Error getting optimal users for post:', error);
            throw error;
        }
    }

    // Check if user should receive notification based on preferences
    shouldReceiveNotification(
        subscription: NotificationSubscription,
        postData: {
            category: string;
            location: string;
            type: 'lost' | 'found';
        }
    ): boolean {
        const { preferences } = subscription;

        // Check if new posts are enabled
        if (!preferences.newPosts) {
            return false;
        }

        // Check quiet hours
        if (preferences.quietHours.enabled) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const startTime = this.timeToMinutes(preferences.quietHours.start);
            const endTime = this.timeToMinutes(preferences.quietHours.end);

            if (startTime > endTime) {
                // Quiet hours span midnight
                if (currentTime >= startTime || currentTime <= endTime) {
                    return false;
                }
            } else {
                // Normal quiet hours
                if (currentTime >= startTime && currentTime <= endTime) {
                    return false;
                }
            }
        }

        // Check category filter (empty array means interested in all categories)
        if (preferences.categories.length > 0 && !preferences.categories.includes(postData.category)) {
            return false;
        }

        // Check location filter (empty array means interested in all locations)
        if (preferences.locations.length > 0 && !preferences.locations.includes(postData.location)) {
            return false;
        }

        return true;
    }

    // Helper function to convert time string to minutes
    private timeToMinutes(timeString: string): number {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Set up real-time listener for subscription changes
    setupSubscriptionListener(
        userId: string,
        onUpdate: (subscription: NotificationSubscription & { id: string } | null) => void,
        onError: (error: any) => void
    ): () => void {
        try {
            const docRef = doc(db, this.collectionName, userId);

            const unsubscribe = onSnapshot(docRef,
                (doc) => {
                    if (doc.exists()) {
                        onUpdate({
                            id: doc.id,
                            ...(doc.data() as Omit<NotificationSubscription, 'id'>)
                        } as NotificationSubscription & { id: string });
                    } else {
                        onUpdate(null);
                    }
                },
                (error) => {
                    console.error('❌ Subscription listener error:', error);
                    onError(error);
                }
            );

            return unsubscribe;
        } catch (error) {
            console.error('❌ Error setting up subscription listener:', error);
            onError(error);
            return () => { };
        }
    }
}

// Export singleton instance
export const notificationSubscriptionService = NotificationSubscriptionService.getInstance();
