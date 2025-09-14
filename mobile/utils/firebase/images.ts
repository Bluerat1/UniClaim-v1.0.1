// Image service for mobile app - handles image operations using Cloudinary
import { cloudinaryService, extractPublicIdFromUrl } from '../cloudinary';

// Helper function to extract Cloudinary public ID from URL
function extractCloudinaryPublicId(url: string): string | null {
    try {
        if (url.includes('res.cloudinary.com')) {
            const urlParts = url.split('/');
            const uploadIndex = urlParts.findIndex(part => part === 'upload');

            if (uploadIndex !== -1) {
                let publicIdParts = urlParts.slice(uploadIndex + 1);

                // Remove version number if present
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
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Image service for mobile app
export const imageService = {
    // Upload multiple images and return their URLs
    async uploadImages(files: (File | string)[]): Promise<string[]> {
        try {
            // For mobile, files are typically URIs (strings)
            const imageUris = files.filter(file => typeof file === 'string') as string[];
            return await cloudinaryService.uploadImages(imageUris);
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
                console.log('No Cloudinary profile picture to delete');
                return;
            }

            // Extract public ID from Cloudinary URL
            const publicId = extractCloudinaryPublicId(profilePictureUrl);

            if (!publicId) {
                console.log('Could not extract public ID from profile picture URL');
                return;
            }

            // Delete the image from Cloudinary
            await cloudinaryService.deleteImage(publicId);
            console.log(`Successfully deleted profile picture: ${publicId}`);

        } catch (error: any) {
            console.error('Error deleting profile picture:', error);
            throw new Error(`Failed to delete profile picture: ${error.message}`);
        }
    }
};

export default imageService;
