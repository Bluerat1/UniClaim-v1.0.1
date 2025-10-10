// Post utility functions for sorting and processing
import type { Post } from '../types/Post';

/**
 * Sort posts by createdAt timestamp (most recent first)
 */
export const sortPostsByCreatedAt = (posts: Post[]): Post[] => {
    return posts.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime(); // Most recent first
    });
};

/**
 * Process posts from Firestore snapshot (convert timestamps and sort)
 */
export const processPostsFromSnapshot = (snapshot: any): Post[] => {
    const posts = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    })) as Post[];

    return sortPostsByCreatedAt(posts);
};
