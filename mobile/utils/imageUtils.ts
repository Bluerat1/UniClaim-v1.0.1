import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses and resizes an image to optimize upload size.
 * Resizes to a max width of 1080px and compresses to 0.7 quality JPEG.
 * 
 * @param uri The local URI of the image to compress
 * @returns The URI of the compressed image, or the original URI if compression fails
 */
export const compressImage = async (uri: string): Promise<string> => {
    try {
        // Skip compression if URI is already a remote URL
        if (uri.startsWith('http')) {
            return uri;
        }

        console.log('🖼️ Compressing image:', uri.substring(0, 50) + '...');

        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1080 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        console.log('✅ Image compressed successfully:', result.uri.substring(0, 50) + '...');
        return result.uri;
    } catch (error) {
        console.error('❌ Image compression failed:', error);
        return uri; // Return original URI if compression fails
    }
};
