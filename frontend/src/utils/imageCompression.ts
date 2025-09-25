// Image compression utilities for optimizing uploads
// These utilities help reduce image file sizes while maintaining quality

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  dimensions: { width: number; height: number };
}

/**
 * Compress an image file using Canvas API
 */
export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    maxSizeKB = 500,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );

        canvas.width = width;
        canvas.height = height;

        // Draw and compress the image
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: Date.now()
            });

            const originalSize = file.size;
            const compressedSize = blob.size;
            const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

            // If still too large, try again with lower quality
            if (compressedSize > maxSizeKB * 1024 && quality > 0.3) {
              compressImage(file, { ...options, quality: quality * 0.8 })
                .then(resolve)
                .catch(reject);
              return;
            }

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize,
              compressionRatio,
              dimensions: { width, height }
            });
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Compress multiple images concurrently
 */
export const compressImages = async (
  files: File[],
  options: CompressionOptions = {}
): Promise<CompressionResult[]> => {
  const compressionPromises = files.map(file => compressImage(file, options));
  return Promise.all(compressionPromises);
};

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 */
const calculateDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const aspectRatio = originalWidth / originalHeight;

  let width = originalWidth;
  let height = originalHeight;

  // Scale down if larger than max dimensions
  if (width > maxWidth || height > maxHeight) {
    if (width / maxWidth > height / maxHeight) {
      width = maxWidth;
      height = width / aspectRatio;
    } else {
      height = maxHeight;
      width = height * aspectRatio;
    }
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
};

/**
 * Get optimal compression settings based on image size and type
 */
export const getOptimalCompressionSettings = (file: File): CompressionOptions => {
  const fileSizeKB = file.size / 1024;

  // Base settings
  let settings: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    format: 'jpeg'
  };

  // Adjust based on file size
  if (fileSizeKB > 2000) {
    // Very large images - aggressive compression
    settings = {
      ...settings,
      maxWidth: 1280,
      maxHeight: 720,
      quality: 0.6,
      maxSizeKB: 300
    };
  } else if (fileSizeKB > 1000) {
    // Large images - moderate compression
    settings = {
      ...settings,
      maxWidth: 1600,
      maxHeight: 900,
      quality: 0.7,
      maxSizeKB: 400
    };
  } else if (fileSizeKB > 500) {
    // Medium images - light compression
    settings = {
      ...settings,
      quality: 0.8,
      maxSizeKB: 500
    };
  } else {
    // Small images - minimal compression to preserve quality
    settings = {
      ...settings,
      quality: 0.9,
      maxSizeKB: 600
    };
  }

  // Use WebP for better compression if supported
  if (supportsWebP() && fileSizeKB > 200) {
    settings.format = 'webp';
  }

  return settings;
};

/**
 * Check if browser supports WebP format
 */
const supportsWebP = (): boolean => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
};

/**
 * Log compression statistics
 */
export const logCompressionStats = (results: CompressionResult[]): void => {
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const averageRatio = results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length;

  console.log(`🗜️ [COMPRESSION] Image compression completed:`);
  console.log(`  📊 Total images: ${results.length}`);
  console.log(`  📏 Original size: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  📏 Compressed size: ${(totalCompressed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  📈 Compression ratio: ${(averageRatio * 100).toFixed(1)}%`);
  console.log(`  💾 Space saved: ${(((totalOriginal - totalCompressed) / totalOriginal) * 100).toFixed(1)}%`);

  results.forEach((result, index) => {
    console.log(`  🖼️ Image ${index + 1}: ${result.dimensions.width}x${result.dimensions.height}, ${(result.compressionRatio * 100).toFixed(1)}% ratio`);
  });
};
