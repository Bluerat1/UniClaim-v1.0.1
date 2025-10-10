// Image service for Firebase - handles image upload, deletion, and Cloudinary operations
import {
    doc,
    updateDoc,
    serverTimestamp
} from 'firebase/firestore';

// Import Firebase instances and types
import { db } from './config';

// Import Cloudinary service
import { cloudinaryService } from '../../utils/cloudinary';

// Helper function to extract Cloudinary public ID from URL
export function extractCloudinaryPublicId(url: string): string | null {
    try {
        // Handle different Cloudinary URL formats
        if (url.includes('res.cloudinary.com')) {
            // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image_name.jpg
            const urlParts = url.split('/');
            const uploadIndex = urlParts.findIndex(part => part === 'upload');

            if (uploadIndex !== -1) {
                // Get everything after 'upload' but before any version number
                let publicIdParts = urlParts.slice(uploadIndex + 1);

                // Remove version number if present (starts with 'v' followed by numbers)
                const versionIndex = publicIdParts.findIndex(part => /^v\d+$/.test(part));
                if (versionIndex !== -1) {
                    publicIdParts = publicIdParts.slice(versionIndex + 1);
                }

                // Remove file extension from the last part
                if (publicIdParts.length > 0) {
                    const lastPart = publicIdParts[publicIdParts.length - 1];
                    const extensionIndex = lastPart.lastIndexOf('.');
                    if (extensionIndex !== -1) {
                        publicIdParts[publicIdParts.length - 1] = lastPart.substring(0, extensionIndex);
                    }
                }

                const publicId = publicIdParts.join('/');
                return publicId;
            }
        } else if (url.includes('api.cloudinary.com')) {
            // Format: https://api.cloudinary.com/v1_1/cloud_name/image/upload/...
            const urlParts = url.split('/');
            const uploadIndex = urlParts.findIndex(part => part === 'upload');

            if (uploadIndex !== -1) {
                const publicIdParts = urlParts.slice(uploadIndex + 1);
                const publicId = publicIdParts.join('/');
                return publicId;
            }
        }

        return null;

    } catch (error) {
        return null;
    }
}

// Image upload service using Cloudinary
export const imageService = {
    // Upload multiple images and return their URLs
    async uploadImages(files: (File | string)[]): Promise<string[]> {
        try {
            return await cloudinaryService.uploadImages(files, 'posts');
        } catch (error: any) {
            console.error('Error uploading images:', error);
            throw new Error(error.message || 'Failed to upload images');
        }
    },

    // Delete images from storage
    async deleteImages(imageUrls: string[]): Promise<void> {
        try {
            if (imageUrls.length === 0) {
                return;
            }

            const deletePromises = imageUrls.map(async (url) => {
                if (url.includes('cloudinary.com')) {
                    // Extract public ID from Cloudinary URL for deletion
                    const publicId = extractCloudinaryPublicId(url);

                    if (publicId) {
                        await cloudinaryService.deleteImage(publicId);
                    }
                }
            });

            await Promise.all(deletePromises);
        } catch (error: any) {
            // Check if it's a Cloudinary configuration issue
            if (error.message?.includes('not configured') || error.message?.includes('credentials')) {
                throw new Error('Cloudinary API credentials not configured. Images cannot be deleted from storage.');
            }

            // Check if it's a permission issue
            if (error.message?.includes('401') || error.message?.includes('permission')) {
                throw new Error('Cloudinary account permissions insufficient. Images cannot be deleted from storage.');
            }

            // Re-throw other errors so the calling function can handle them
            throw new Error(`Failed to delete images from Cloudinary: ${error.message}`);
        }
    },

    // Delete single profile picture from storage and update user profile
    async deleteProfilePicture(profilePictureUrl: string, userId?: string): Promise<void> {
        try {
            if (!profilePictureUrl || !profilePictureUrl.includes('cloudinary.com')) {
                return; // No Cloudinary image to delete
            }

            // Extract public ID from Cloudinary URL for deletion
            const publicId = extractCloudinaryPublicId(profilePictureUrl);

            if (publicId) {
                await cloudinaryService.deleteImage(publicId);

                // If userId is provided, update the user's profile in Firestore
                if (userId) {
                    try {
                        const userRef = doc(db, 'users', userId);
                        await updateDoc(userRef, {
                            profileImageUrl: null,
                            updatedAt: serverTimestamp()
                        });
                    } catch (updateError: any) {
                        console.error('Failed to update user profile in Firestore:', updateError.message);
                        // Don't throw error - image was deleted from Cloudinary successfully
                    }
                }
            }
        } catch (error: any) {
            // Check if it's a Cloudinary configuration issue
            if (error.message?.includes('not configured') || error.message?.includes('credentials')) {
                throw new Error('Cloudinary API credentials not configured. Profile picture cannot be deleted from storage.');
            }

            // Check if it's a permission issue
            if (error.message?.includes('401') || error.message?.includes('permission')) {
                throw new Error('Cloudinary account permissions insufficient. Profile picture cannot be deleted from storage.');
            }

            // Re-throw other errors so the calling function can handle them
            throw new Error(`Failed to delete profile picture from Cloudinary: ${error.message}`);
        }
    }
};
