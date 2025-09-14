// Announcement service for mobile app
import { db } from './config';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

export interface Announcement {
    id: string;
    message: string;
    priority: 'normal' | 'urgent';
    isActive: boolean;
    createdBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    expiresAt?: Timestamp;
}

export interface CreateAnnouncementData {
    message: string;
    priority: 'normal' | 'urgent';
    isActive: boolean;
    createdBy: string;
    expiresAt?: Date;
}

export interface UpdateAnnouncementData {
    message?: string;
    priority?: 'normal' | 'urgent';
    isActive?: boolean;
    expiresAt?: Date;
}

export class AnnouncementService {
    private static instance: AnnouncementService;
    private collectionName = 'announcements';

    private constructor() { }

    static getInstance(): AnnouncementService {
        if (!AnnouncementService.instance) {
            AnnouncementService.instance = new AnnouncementService();
        }
        return AnnouncementService.instance;
    }

    // Get all announcements (for admin use)
    async getAllAnnouncements(): Promise<Announcement[]> {
        try {
            const q = query(
                collection(db, this.collectionName),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const announcements: Announcement[] = [];

            querySnapshot.forEach((doc) => {
                announcements.push({
                    id: doc.id,
                    ...doc.data()
                } as Announcement);
            });

            return announcements;
        } catch (error) {
            console.error('Error fetching all announcements:', error);
            throw new Error('Failed to fetch announcements');
        }
    }

    // Get active announcements only
    async getActiveAnnouncements(): Promise<Announcement[]> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('isActive', '==', true),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const announcements: Announcement[] = [];
            const now = new Date();

            querySnapshot.forEach((doc) => {
                const announcement = {
                    id: doc.id,
                    ...doc.data()
                } as Announcement;

                // Check if announcement has expired
                if (announcement.expiresAt) {
                    const expirationDate = announcement.expiresAt.toDate();
                    if (expirationDate > now) {
                        announcements.push(announcement);
                    }
                } else {
                    // No expiration date, so it's still active
                    announcements.push(announcement);
                }
            });

            // Sort by priority (urgent first, then by creation date)
            return announcements.sort((a, b) => {
                if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
                if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            });
        } catch (error) {
            console.error('Error fetching active announcements:', error);
            throw new Error('Failed to fetch active announcements');
        }
    }

    // Create announcement (admin only)
    async createAnnouncement(data: CreateAnnouncementData): Promise<string> {
        try {
            const announcementData = {
                ...data,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                expiresAt: data.expiresAt ? Timestamp.fromDate(data.expiresAt) : null
            };

            const docRef = await addDoc(collection(db, this.collectionName), announcementData);
            return docRef.id;
        } catch (error) {
            console.error('Error creating announcement:', error);
            throw new Error('Failed to create announcement');
        }
    }

    // Update announcement (admin only)
    async updateAnnouncement(id: string, data: UpdateAnnouncementData): Promise<void> {
        try {
            const updateData = {
                ...data,
                updatedAt: serverTimestamp(),
                expiresAt: data.expiresAt ? Timestamp.fromDate(data.expiresAt) : undefined
            };

            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key as keyof typeof updateData] === undefined) {
                    delete updateData[key as keyof typeof updateData];
                }
            });

            await updateDoc(doc(db, this.collectionName, id), updateData);
        } catch (error) {
            console.error('Error updating announcement:', error);
            throw new Error('Failed to update announcement');
        }
    }

    // Delete announcement (admin only)
    async deleteAnnouncement(id: string): Promise<void> {
        try {
            await deleteDoc(doc(db, this.collectionName, id));
        } catch (error) {
            console.error('Error deleting announcement:', error);
            throw new Error('Failed to delete announcement');
        }
    }

    // Toggle announcement status (admin only)
    async toggleAnnouncementStatus(id: string): Promise<void> {
        try {
            const announcementRef = doc(db, this.collectionName, id);
            // Note: This would need to fetch current status first in a real implementation
            // For now, we'll assume the frontend handles this logic
            throw new Error('Toggle status not implemented - use updateAnnouncement instead');
        } catch (error) {
            console.error('Error toggling announcement status:', error);
            throw new Error('Failed to toggle announcement status');
        }
    }

    // Subscribe to real-time updates for active announcements
    subscribeToActiveAnnouncements(callback: (announcements: Announcement[]) => void): () => void {
        console.log('🔔 Creating announcement subscription...');

        const q = query(
            collection(db, this.collectionName),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (querySnapshot) => {
            console.log('📊 Query snapshot received:', querySnapshot.size, 'documents');

            const announcements: Announcement[] = [];
            const now = new Date();

            querySnapshot.forEach((doc) => {
                const announcement = {
                    id: doc.id,
                    ...doc.data()
                } as Announcement;

                // Check if announcement has expired
                if (announcement.expiresAt) {
                    const expirationDate = announcement.expiresAt.toDate();
                    if (expirationDate > now) {
                        announcements.push(announcement);
                    }
                } else {
                    // No expiration date, so it's still active
                    announcements.push(announcement);
                }
            });

            // Sort by priority after fetching (urgent first, then by creation date)
            const sortedAnnouncements = announcements.sort((a, b) => {
                if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
                if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            });

            console.log('📢 Processed announcements:', sortedAnnouncements.length);
            callback(sortedAnnouncements);
        }, (error) => {
            console.error('❌ Error in announcement subscription:', error);
            // Call callback with empty array on error to clear loading state
            callback([]);
        });
    }

    // Get announcements by admin (for admin dashboard)
    async getAnnouncementsByAdmin(adminId: string): Promise<Announcement[]> {
        try {
            const q = query(
                collection(db, this.collectionName),
                where('createdBy', '==', adminId),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const announcements: Announcement[] = [];

            querySnapshot.forEach((doc) => {
                announcements.push({
                    id: doc.id,
                    ...doc.data()
                } as Announcement);
            });

            return announcements;
        } catch (error) {
            console.error('Error fetching announcements by admin:', error);
            throw new Error('Failed to fetch admin announcements');
        }
    }
}

// Export singleton instance
export const announcementService = AnnouncementService.getInstance();
