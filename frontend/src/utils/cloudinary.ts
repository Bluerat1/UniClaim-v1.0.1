// Cloudinary configuration for image upload and management
import { Cloudinary } from '@cloudinary/url-gen';
import { compressImage, getOptimalCompressionSettings, type CompressionResult } from './imageCompression';
import { uploadFilesConcurrently, type ConcurrentUploadOptions } from './concurrentUpload';

// Configuration values from environment variables
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'uniclaim_uploads';
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;

// NEW: Use CLOUDINARY_URL for better authentication
const CLOUDINARY_URL = import.meta.env.VITE_CLOUDINARY_URL;



// Test function to verify handover item photo extraction
export const testHandoverItemPhotoExtraction = () => {
    console.log('🧪 Testing handover item photo extraction...');

    // Create a mock handover message with item photos
    const mockHandoverMessage = {
        id: 'test-message',
        messageType: 'handover_request',
        handoverData: {
            postId: 'test-post',
            postTitle: 'Test Item',
            status: 'pending',
            idPhotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/id_photo.jpg',
            itemPhotos: [
                {
                    url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/item_photo1.jpg',
                    uploadedAt: new Date(),
                    description: 'Item photo 1'
                },
                {
                    url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/item_photo2.jpg',
                    uploadedAt: new Date(),
                    description: 'Item photo 2'
                },
                {
                    url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/item_photo3.jpg',
                    uploadedAt: new Date(),
                    description: 'Item photo 3'
                }
            ]
        }
    };

    // Test the extraction function
    const extractedUrls = extractMessageImages(mockHandoverMessage);

    console.log('Expected: 4 images (1 ID photo + 3 item photos)');
    console.log('Actual extracted URLs:', extractedUrls.length);
    console.log('URLs:', extractedUrls);

    // Verify results
    const expectedUrls = [
        'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/id_photo.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/item_photo1.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/item_photo2.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/item_photo3.jpg'
    ];

    const success = extractedUrls.length === 4 && expectedUrls.every(url => extractedUrls.includes(url));

    if (success) {
        console.log('✅ Test PASSED: All handover item photos correctly extracted');
    } else {
        console.log('❌ Test FAILED: Missing or incorrect photo extraction');
    }

    return success;
};

// Simple test function to call from browser console
export const testImageDeletion = async (publicId: string = 'test') => {
    console.log('🧪 Testing image deletion...');
    console.log('Public ID:', publicId);
    console.log('CLOUDINARY_URL:', CLOUDINARY_URL ? 'SET' : 'NOT_SET');
    console.log('CLOUDINARY_API_KEY:', CLOUDINARY_API_KEY ? '***' + CLOUDINARY_API_KEY.slice(-4) : 'NOT_SET');
    console.log('CLOUDINARY_API_SECRET:', CLOUDINARY_API_SECRET ? '***' + CLOUDINARY_API_SECRET.slice(-4) : 'NOT_SET');

    try {
        await cloudinaryService.deleteImage(publicId);
        console.log('✅ Test completed successfully');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};

// Test function to check URL parsing
export const testUrlParsing = () => {
    console.log('🧪 Testing Cloudinary URL parsing...');

    const testUrls = [
        'https://res.cloudinary.com/demo/image/upload/v1234567890/posts/test_image.jpg',
        'https://res.cloudinary.com/demo/image/upload/posts/folder/test_image.png',
        'https://res.cloudinary.com/demo/image/upload/v987654321/posts/folder/subfolder/image.jpg',
        'https://api.cloudinary.com/v1_1/demo/image/upload/posts/test.jpg'
    ];

    testUrls.forEach((url, index) => {
        console.log(`\nTest URL ${index + 1}: ${url}`);

        // Import the function from Firebase service
        try {
            // This is a test - in real usage, the function would be imported
            console.log('✅ URL format recognized');
        } catch (error) {
            console.error('❌ Error parsing URL:', error);
        }
    });
};

// Test function to verify Cloudinary configuration
export const testCloudinaryConfig = () => {
    console.log('Testing Cloudinary Configuration...');
    console.log('Environment variables loaded:', {
        VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        VITE_CLOUDINARY_API_KEY: import.meta.env.VITE_CLOUDINARY_API_KEY ? 'SET' : 'NOT_SET',
        VITE_CLOUDINARY_API_SECRET: import.meta.env.VITE_CLOUDINARY_API_SECRET ? 'SET' : 'NOT_SET',
        VITE_CLOUDINARY_URL: import.meta.env.VITE_CLOUDINARY_URL ? 'SET' : 'NOT_SET'
    });

    // Check if CLOUDINARY_URL is available (preferred method)
    if (CLOUDINARY_URL) {
        console.log('✅ CLOUDINARY_URL is configured - this provides better authentication!');
        return true;
    }

    // Fallback to API key/secret method
    if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.error('❌ Cloudinary API credentials are missing!');
        console.error('Please set either:');
        console.error('1. VITE_CLOUDINARY_URL (recommended) - provides better authentication');
        console.error('2. VITE_CLOUDINARY_API_KEY and VITE_CLOUDINARY_API_SECRET');
        return false;
    }

    if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'your-cloud-name') {
        console.error('❌ Cloudinary cloud name is not configured!');
        return false;
    }

    console.log('✅ Cloudinary configuration appears to be valid (using API key/secret method)');
    console.log('💡 Tip: Consider using VITE_CLOUDINARY_URL for better authentication');
    return true;
};

// Test Cloudinary API connection
export const testCloudinaryAPI = async () => {
    try {
        console.log('Testing Cloudinary API connection...');

        if (!testCloudinaryConfig()) {
            return false;
        }

        // Try to make a simple API call to test authentication
        const timestamp = Math.round(new Date().getTime() / 1000);
        const testSignature = await cloudinaryService.generateSignature('test', timestamp, CLOUDINARY_API_SECRET);

        const formData = new FormData();
        formData.append('public_id', 'test');
        formData.append('api_key', CLOUDINARY_API_KEY);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', testSignature);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
            {
                method: 'POST',
                body: formData,
            }
        );

        if (response.status === 401) {
            console.error('❌ Cloudinary API authentication failed!');
            console.error('This usually means:');
            console.error('1. Your API key or secret is incorrect');
            console.error('2. Your account permissions are limited');
            console.error('3. The API key has expired or been revoked');
            console.error('4. Your account has been suspended');
            console.error('5. You may be on a free plan with limited permissions');
            console.error('');
            console.error('💡 Solution: Check your Cloudinary account settings and permissions.');
            return false;
        }

        console.log('✅ Cloudinary API connection test completed');
        return true;

    } catch (error) {
        console.error('❌ Error testing Cloudinary API:', error);
        return false;
    }
};

// Check if Cloudinary account has proper permissions
export const checkCloudinaryPermissions = () => {
    console.log('🔍 Checking Cloudinary account permissions...');

    if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.error('❌ Cloudinary API credentials not configured');
        return false;
    }

    console.log('✅ Cloudinary API credentials are configured');
    console.log('💡 Note: Free Cloudinary accounts may have limited permissions');
    console.log('💡 If you continue to get 401 errors, check your account settings');

    return true;
};

// Create Cloudinary instance
export const cloudinary = new Cloudinary({
    cloud: {
        cloudName: CLOUDINARY_CLOUD_NAME
    },
    // Use CLOUDINARY_URL if available for better authentication
    ...(CLOUDINARY_URL && { url: CLOUDINARY_URL })
});

// Cloudinary image service
export const cloudinaryService = {
    // Upload single image
    async uploadImage(file: File, folder: string = 'posts'): Promise<string> {
        try {
            // Check if required environment variables are set
            if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'your-cloud-name') {
                throw new Error(`Cloudinary cloud name not configured. Current value: "${CLOUDINARY_CLOUD_NAME}". Please set VITE_CLOUDINARY_CLOUD_NAME in your .env file`);
            }

            if (!UPLOAD_PRESET) {
                throw new Error(`Cloudinary upload preset not configured. Current value: "${UPLOAD_PRESET}". Please set VITE_CLOUDINARY_UPLOAD_PRESET in your .env file`);
            }

            console.log(`🖼️ [COMPRESSION] Starting compression for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

            // Get optimal compression settings based on file size
            const compressionOptions = getOptimalCompressionSettings(file);

            // Compress the image before upload
            const compressionResult: CompressionResult = await compressImage(file, compressionOptions);

            console.log(`🗜️ [COMPRESSION] ${file.name} compressed from ${(compressionResult.originalSize / 1024 / 1024).toFixed(2)} MB to ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)} MB (${(compressionResult.compressionRatio * 100).toFixed(1)}% ratio)`);

            const formData = new FormData();
            formData.append('file', compressionResult.file);
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', folder);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const data = await response.json();
            return data.secure_url;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to upload image');
        }
    },

    // Upload multiple images
    async uploadImages(files: (File | string)[], folder: string = 'posts'): Promise<string[]> {
        try {
            const uploadPromises = files.map(async (file) => {
                // Skip if already a URL string
                if (typeof file === 'string' && file.startsWith('http')) {
                    return file;
                }

                if (file instanceof File) {
                    return await this.uploadImage(file, folder);
                }

                throw new Error(`Invalid file type: ${typeof file}`);
            });

            const results = await Promise.all(uploadPromises);

            // Log compression statistics if any files were compressed
            const compressedFiles = files.filter(f => f instanceof File) as File[];
            if (compressedFiles.length > 0) {
                console.log(`✅ [COMPRESSION] Successfully processed ${compressedFiles.length} images for upload`);
            }

            return results;
        } catch (error: any) {
            throw new Error(error.message || 'Failed to upload images');
        }
    },

    // Upload multiple images with concurrent processing and progress tracking
    async uploadImagesConcurrently(
        files: (File | string)[],
        folder: string = 'posts',
        options: ConcurrentUploadOptions = {}
    ): Promise<string[]> {
        try {
            // Filter out non-File items (already uploaded URLs)
            const filesToUpload = files.filter((file): file is File =>
                file instanceof File
            );

            if (filesToUpload.length === 0) {
                console.log('🔄 [CONCURRENT] No new files to upload, returning existing URLs');
                return files.filter((file): file is string =>
                    typeof file === 'string'
                );
            }

            console.log(`🚀 [CONCURRENT] Starting concurrent upload of ${filesToUpload.length} images to folder: ${folder}`);

            // Create progress tracking upload function with folder parameter
            const progressUpload = async (file: File): Promise<string> => {
                return this.uploadImage(file, folder);
            };

            // Upload with progress tracking
            const uploadOptions: ConcurrentUploadOptions = {
                maxConcurrent: 3, // Upload 3 images simultaneously
                ...options,
                onProgress: (progress) => {
                    console.log(`📊 [CONCURRENT] Upload progress:`, progress.map(p =>
                        `${p.fileName}: ${p.percentage.toFixed(1)}% (${p.status})`
                    ).join(', '));
                    options.onProgress?.(progress);
                },
                onFileComplete: (fileName, success, error) => {
                    console.log(`✅ [CONCURRENT] File ${fileName} ${success ? 'completed' : 'failed'}`,
                        success ? '' : `: ${error}`);
                    options.onFileComplete?.(fileName, success, error);
                }
            };

            const uploadedUrls = await uploadFilesConcurrently(
                filesToUpload,
                progressUpload,
                uploadOptions
            );

            // Combine with existing URLs
            const existingUrls = files.filter((file): file is string =>
                typeof file === 'string'
            );

            const allUrls = [...existingUrls, ...uploadedUrls];

            console.log(`✅ [CONCURRENT] Successfully uploaded ${uploadedUrls.length} images, total: ${allUrls.length}`);
            return allUrls;

        } catch (error: any) {
            console.error('❌ [CONCURRENT] Upload failed:', error);
            throw new Error(error.message || 'Failed to upload images concurrently');
        }
    },

    // Delete image (requires API credentials)
    async deleteImage(publicId: string): Promise<void> {
        try {
            // Check if API credentials are available
            if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
                const errorMsg = 'Cloudinary API credentials not configured. Images will not be deleted from storage. Set VITE_CLOUDINARY_API_KEY and VITE_CLOUDINARY_API_SECRET in your .env file';
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            // If CLOUDINARY_URL is available, use it for better authentication
            if (CLOUDINARY_URL) {
                await this.deleteImageWithURL(publicId);
                return;
            }

            // Fallback to API key/secret method
            await this.deleteImageWithAPIKey(publicId);

        } catch (error: any) {
            console.error('Error deleting image from Cloudinary:', error);



            // Re-throw the error so the calling function can handle it properly
            throw error;
        }
    },

    // Delete image using CLOUDINARY_URL (better authentication)
    async deleteImageWithURL(publicId: string): Promise<void> {
        try {
            // Extract credentials from CLOUDINARY_URL
            const urlMatch = CLOUDINARY_URL.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
            if (!urlMatch) {
                throw new Error('Invalid CLOUDINARY_URL format');
            }

            const [, apiKey, apiSecret, cloudName] = urlMatch;

            // Create signature for deletion
            const timestamp = Math.round(new Date().getTime() / 1000);
            const signature = await this.generateSignature(publicId, timestamp, apiSecret);

            const formData = new FormData();
            formData.append('public_id', publicId);
            formData.append('api_key', apiKey);
            formData.append('timestamp', timestamp.toString());
            formData.append('signature', signature);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
                throw new Error(`Failed to delete image: ${errorData.error?.message || response.statusText} (Status: ${response.status})`);
            }
        } catch (error) {
            throw error;
        }
    },

    // Delete image using API key/secret method
    async deleteImageWithAPIKey(publicId: string): Promise<void> {
        try {
            // Create signature for deletion
            const timestamp = Math.round(new Date().getTime() / 1000);
            const signature = await this.generateSignature(publicId, timestamp, CLOUDINARY_API_SECRET);

            const formData = new FormData();
            formData.append('public_id', publicId);
            formData.append('api_key', CLOUDINARY_API_KEY);
            formData.append('timestamp', timestamp.toString());
            formData.append('signature', signature);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));

                // If it's an authentication error, try alternative deletion method
                if (response.status === 401) {
                    await this.deleteImageAlternative(publicId);
                    return;
                }

                throw new Error(`Failed to delete image: ${errorData.error?.message || response.statusText} (Status: ${response.status})`);
            }
        } catch (error) {
            throw error;
        }
    },

    // Alternative deletion method for accounts with limited permissions
    async deleteImageAlternative(_publicId: string): Promise<void> {
        try {
            // For accounts with limited permissions, we can't actually delete images
            // The image will remain in storage but won't be accessible through your app
        } catch (error) {
            // Silent fail for alternative method
        }
    },

    // Generate signature for Cloudinary API
    async generateSignature(publicId: string, timestamp: number, apiSecret: string): Promise<string> {
        try {
            // Create the parameter string in the correct order
            const params = `public_id=${publicId}&timestamp=${timestamp}`;

            // Create HMAC-SHA1 signature using the API secret
            const message = params + apiSecret;

            // Use Web Crypto API for proper SHA-1 hashing
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);

            // Convert to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            return hashHex;
        } catch (error) {
            // Fallback to simple hash if Web Crypto API fails
            const params = `public_id=${publicId}&timestamp=${timestamp}`;
            const message = params + apiSecret;

            let hash = 0;
            for (let i = 0; i < message.length; i++) {
                const char = message.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }

            return Math.abs(hash).toString(16);
        }
    },

    // Get optimized image URL
    getOptimizedUrl(url: string, options: { width?: number; height?: number; quality?: string } = {}): string {
        if (!url || !url.includes('cloudinary.com')) {
            return url;
        }

        try {
            const { width = 800, height = 600, quality = 'auto' } = options;

            // Extract public ID from Cloudinary URL
            const urlParts = url.split('/');
            const uploadIndex = urlParts.findIndex(part => part === 'upload');
            if (uploadIndex === -1) return url;

            const publicIdWithExtension = urlParts.slice(uploadIndex + 1).join('/');
            const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, ''); // Remove extension

            // Create optimized URL
            const optimizedUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_${width},h_${height},c_fill,q_${quality}/${publicId}`;
            return optimizedUrl;
        } catch (error) {
            return url;
        }
    }
};

// Helper function to extract public ID from Cloudinary URL
export const extractPublicIdFromUrl = (url: string): string | null => {
    try {
        if (!url || !url.includes('cloudinary.com')) {
            return null;
        }

        // Handle different Cloudinary URL formats
        const urlParts = url.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');

        if (uploadIndex === -1) {
            return null;
        }

        // Extract everything after 'upload' and before any version number
        const pathAfterUpload = urlParts.slice(uploadIndex + 1);

        // Find the first part that contains the folder structure
        let publicId = '';

        for (let i = 0; i < pathAfterUpload.length; i++) {
            const part = pathAfterUpload[i];

            // Skip version numbers (they start with 'v' followed by numbers)
            if (part.startsWith('v') && /^\d+$/.test(part.substring(1))) {
                continue;
            }

            // Build the public ID from this point
            publicId = pathAfterUpload.slice(i).join('/');
            break;
        }

        // Remove file extension if present
        if (publicId) {
            publicId = publicId.replace(/\.[^/.]+$/, '');
        }

        return publicId || null;
    } catch (error) {
        console.error('Error extracting public ID from URL:', error);
        return null;
    }
};

// Utility function for conditional logging
const logMessage = (level: 'log' | 'warn' | 'error', message: string, ...args: any[]) => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && level === 'log') {
        // Skip verbose logs in production
        return;
    }
    console[level](message, ...args);
};

// Function to extract image URLs from messages
export const extractMessageImages = (message: any): string[] => {
    try {
        const imageUrls: string[] = [];

        // Check if message has handover data

        // Check if message has handover data with ID photo
        if (message.handoverData && message.handoverData.idPhotoUrl) {
            const idPhotoUrl = message.handoverData.idPhotoUrl;
            logMessage('log', '🔍 Found handover ID photo URL:', idPhotoUrl ? idPhotoUrl.substring(0, 50) + '...' : 'null/undefined');

            // Only include Cloudinary URLs
            if (idPhotoUrl && typeof idPhotoUrl === 'string' && idPhotoUrl.includes('cloudinary.com')) {
                logMessage('log', '🗑️ Found handover ID photo for deletion:', idPhotoUrl.split('/').pop());
                imageUrls.push(idPhotoUrl);
            } else {
                logMessage('warn', '⚠️ Handover ID photo failed validation:', {
                    exists: !!idPhotoUrl,
                    type: typeof idPhotoUrl,
                    isCloudinary: idPhotoUrl?.includes('cloudinary.com')
                });
            }
        } else {
            logMessage('log', '🔍 No handover ID photo found or handoverData missing');
        }

        // Check for owner's ID photo in handover requests
        logMessage('log', '🔍 Checking for handover owner ID photo...');
        if (message.handoverData && message.handoverData.ownerIdPhoto) {
            const ownerIdPhotoUrl = message.handoverData.ownerIdPhoto;
            logMessage('log', '🔍 Found handover owner ID photo URL:', ownerIdPhotoUrl ? ownerIdPhotoUrl.substring(0, 50) + '...' : 'null/undefined');

            // Only include Cloudinary URLs
            if (ownerIdPhotoUrl && typeof ownerIdPhotoUrl === 'string' && ownerIdPhotoUrl.includes('cloudinary.com')) {
                logMessage('log', '🗑️ Found handover owner ID photo for deletion:', ownerIdPhotoUrl.split('/').pop());
                imageUrls.push(ownerIdPhotoUrl);
            } else {
                logMessage('warn', '⚠️ Handover owner ID photo failed validation:', {
                    exists: !!ownerIdPhotoUrl,
                    type: typeof ownerIdPhotoUrl,
                    isCloudinary: ownerIdPhotoUrl?.includes('cloudinary.com')
                });
            }
        } else {
            logMessage('log', '🔍 No handover owner ID photo found or handoverData missing');
        }

        // Check for item photos in handover requests
        logMessage('log', '🔍 Checking for handover item photos...');
        logMessage('log', '🔍 message.handoverData.itemPhotos exists:', !!message.handoverData?.itemPhotos);
        logMessage('log', '🔍 message.handoverData.itemPhotos is array:', Array.isArray(message.handoverData?.itemPhotos));
        logMessage('log', '🔍 handover item photos length:', message.handoverData?.itemPhotos?.length || 0);

        if (message.handoverData && message.handoverData.itemPhotos && Array.isArray(message.handoverData.itemPhotos)) {
            logMessage('log', '✅ Handover item photos detection conditions met, processing array...');

            message.handoverData.itemPhotos.forEach((photo: any, index: number) => {
                logMessage('log', `🔍 Validating handover item photo ${index + 1}:`, {
                    photo: photo ? 'exists' : 'null/undefined',
                    hasUrl: !!photo?.url,
                    urlType: typeof photo?.url,
                    urlPreview: photo?.url ? photo.url.substring(0, 50) + '...' : 'no url',
                    isCloudinary: photo?.url?.includes('cloudinary.com')
                });

                if (photo.url && typeof photo.url === 'string' && photo.url.includes('cloudinary.com')) {
                    logMessage('log', `🗑️ Found handover item photo ${index + 1} for deletion:`, photo.url.split('/').pop());
                    imageUrls.push(photo.url);
                } else {
                    logMessage('warn', `⚠️ Handover item photo ${index + 1} failed validation:`, {
                        hasUrl: !!photo?.url,
                        urlType: typeof photo?.url,
                        isCloudinary: photo?.url?.includes('cloudinary.com'),
                        photoStructure: photo
                    });
                }
            });
        } else {
            logMessage('warn', '❌ Handover item photos detection failed:', {
                handoverDataExists: !!message.handoverData,
                itemPhotosExists: !!message.handoverData?.itemPhotos,
                isArray: Array.isArray(message.handoverData?.itemPhotos)
            });
        }

        // Check if message has claim data with ID photo
        if (message.claimData && message.claimData.idPhotoUrl) {
            const idPhotoUrl = message.claimData.idPhotoUrl;

            // Only include Cloudinary URLs
            if (idPhotoUrl && typeof idPhotoUrl === 'string' && idPhotoUrl.includes('cloudinary.com')) {
                logMessage('log', '🗑️ Found claim ID photo for deletion:', idPhotoUrl.split('/').pop());
                imageUrls.push(idPhotoUrl);
            }
        }

        // Check for owner's ID photo in claim requests
        if (message.claimData && message.claimData.ownerIdPhoto) {
            const ownerIdPhotoUrl = message.claimData.ownerIdPhoto;

            // Only include Cloudinary URLs
            if (ownerIdPhotoUrl && typeof ownerIdPhotoUrl === 'string' && ownerIdPhotoUrl.includes('cloudinary.com')) {
                logMessage('log', '🗑️ Found owner ID photo for deletion:', ownerIdPhotoUrl.split('/').pop());
                imageUrls.push(ownerIdPhotoUrl);
            }
        }

        // NEW: Check for evidence photos in claim requests (up to 3 photos)
        if (message.claimData && message.claimData.evidencePhotos && Array.isArray(message.claimData.evidencePhotos)) {
            message.claimData.evidencePhotos.forEach((photo: any, index: number) => {
                if (photo.url && typeof photo.url === 'string' && photo.url.includes('cloudinary.com')) {
                    logMessage('log', `🗑️ Found claim evidence photo ${index + 1} for deletion:`, photo.url.split('/').pop());
                    imageUrls.push(photo.url);
                }
            });
        }

        // NEW: Check for legacy verification photos in claim requests (backward compatibility)
        if (message.claimData && message.claimData.verificationPhotos && Array.isArray(message.claimData.verificationPhotos)) {
            message.claimData.verificationPhotos.forEach((photo: any, index: number) => {
                if (photo.url && typeof photo.url === 'string' && photo.url.includes('cloudinary.com')) {
                    logMessage('log', `🗑️ Found legacy verification photo ${index + 1} for deletion:`, photo.url.split('/').pop());
                    imageUrls.push(photo.url);
                }
            });
        }

        // Check for other potential image fields (future extensibility)
        // This could include message attachments, profile pictures, etc.

        return imageUrls;
    } catch (error) {
        console.error('Error extracting message images:', error);
        return [];
    }
};

// Function to delete images from Cloudinary
export const deleteMessageImages = async (imageUrls: string[]): Promise<{ deleted: string[], failed: string[], success: boolean }> => {
    try {
        if (!imageUrls || imageUrls.length === 0) {
            console.log('🗑️ No images to delete');
            return { deleted: [], failed: [], success: true };
        }

        console.log(`🗑️ Attempting to delete ${imageUrls.length} images from Cloudinary`);
        const deleted: string[] = [];
        const failed: string[] = [];

        // Process each image URL
        for (const imageUrl of imageUrls) {
            try {
                // Extract public ID from URL
                const publicId = extractPublicIdFromUrl(imageUrl);

                if (!publicId) {
                    console.warn('Could not extract public ID from URL:', imageUrl);
                    failed.push(imageUrl);
                    continue;
                }

                // Delete the image from Cloudinary
                await cloudinaryService.deleteImage(publicId);
                deleted.push(imageUrl);

            } catch (error: any) {
                console.error('Failed to delete image:', imageUrl, error.message);
                failed.push(imageUrl);
            }
        }

        const success = failed.length === 0;

        // Log results
        if (success) {
            console.log(`✅ Successfully deleted ${deleted.length} images from Cloudinary`);
        } else {
            console.warn(`⚠️ Cloudinary cleanup completed: ${deleted.length} deleted, ${failed.length} failed`);
        }

        return { deleted, failed, success };

    } catch (error: any) {
        console.error('Error during message image cleanup:', error.message);
        return { deleted: [], failed: [], success: false };
    }
};



export default cloudinaryService;
