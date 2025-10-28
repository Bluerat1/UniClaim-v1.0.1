// Network detection and connection quality utilities
// Helps optimize upload strategies based on connection speed

export type ConnectionQuality = 'fast' | 'moderate' | 'slow' | 'very-slow' | 'offline';

export interface NetworkInfo {
  quality: ConnectionQuality;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  isOnline: boolean;
}

export interface ConnectionRecommendations {
  maxConcurrentUploads: number;
  compressionQuality: number;
  timeoutMultiplier: number;
  message: string;
  tips: string[];
}

/**
 * Detect network connection quality
 */
export const detectConnectionQuality = async (): Promise<NetworkInfo> => {
  // Check if Network Information API is available
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;

    return {
      quality: mapEffectiveTypeToQuality(connection.effectiveType),
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
      isOnline: navigator.onLine
    };
  }

  // Fallback: measure actual connection speed
  return await measureConnectionSpeed();
};

/**
 * Map Network Information API effectiveType to our quality categories
 */
const mapEffectiveTypeToQuality = (effectiveType: string): ConnectionQuality => {
  switch (effectiveType) {
    case '4g':
      return 'fast';
    case '3g':
      return 'moderate';
    case '2g':
      return 'slow';
    case 'slow-2g':
      return 'very-slow';
    default:
      return 'moderate';
  }
};

/**
 * Measure actual connection speed as fallback
 */
const measureConnectionSpeed = async (): Promise<NetworkInfo> => {
  const isOnline = navigator.onLine;

  if (!isOnline) {
    return {
      quality: 'offline',
      isOnline: false
    };
  }

  try {
    // Measure download speed by requesting a small image
    const startTime = performance.now();
    const response = await fetch('/favicon.ico?' + Math.random(), {
      method: 'HEAD',
      cache: 'no-cache'
    });
    const endTime = performance.now();

    if (response.ok) {
      const responseTime = endTime - startTime;

      // Categorize based on response time
      if (responseTime < 500) return { quality: 'fast', isOnline: true };
      if (responseTime < 1500) return { quality: 'moderate', isOnline: true };
      if (responseTime < 3000) return { quality: 'slow', isOnline: true };
      return { quality: 'very-slow', isOnline: true };
    }
  } catch (error) {
    console.warn('Network speed measurement failed:', error);
  }

  return { quality: 'moderate', isOnline: true };
};

/**
 * Get upload recommendations based on connection quality
 */
export const getConnectionRecommendations = (networkInfo: NetworkInfo): ConnectionRecommendations => {
  switch (networkInfo.quality) {
    case 'fast':
      return {
        maxConcurrentUploads: 3,
        compressionQuality: 0.8,
        timeoutMultiplier: 1,
        message: 'Fast connection detected - uploading at full quality',
        tips: []
      };

    case 'moderate':
      return {
        maxConcurrentUploads: 2,
        compressionQuality: 0.7,
        timeoutMultiplier: 1.5,
        message: 'Good connection - optimizing for speed',
        tips: ['Consider switching to WiFi for even faster uploads']
      };

    case 'slow':
      return {
        maxConcurrentUploads: 1,
        compressionQuality: 0.6,
        timeoutMultiplier: 2.5,
        message: 'Slower connection detected - using optimized settings',
        tips: [
          'Upload one image at a time for better reliability',
          'Images are compressed more to speed up upload',
          'Consider switching to WiFi or moving to better signal area'
        ]
      };

    case 'very-slow':
      return {
        maxConcurrentUploads: 1,
        compressionQuality: 0.5,
        timeoutMultiplier: 4,
        message: 'Very slow connection - using maximum optimization',
        tips: [
          'Only one image uploads at a time',
          'Maximum compression applied for faster upload',
          'Consider switching to WiFi or finding better signal',
          'Upload may take several minutes - please be patient'
        ]
      };

    case 'offline':
      return {
        maxConcurrentUploads: 0,
        compressionQuality: 0.5,
        timeoutMultiplier: 0,
        message: 'No internet connection detected',
        tips: [
          'Please check your internet connection',
          'Your form data is saved locally - you can retry when connected',
          'Consider switching to WiFi or mobile data'
        ]
      };

    default:
      return {
        maxConcurrentUploads: 2,
        compressionQuality: 0.7,
        timeoutMultiplier: 1.5,
        message: 'Connection quality unknown - using safe defaults',
        tips: []
      };
  }
};

/**
 * Test actual upload speed for better recommendations
 */
export const testUploadSpeed = async (): Promise<number> => {
  try {
    // Create a small test file (1KB)
    const testData = new Array(1024).fill('x').join('');
    const blob = new Blob([testData], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, 'speed-test.txt');

    const startTime = performance.now();

    // Try to upload to a test endpoint (this might not work depending on CORS)
    // This is more of a conceptual implementation
    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      body: formData
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    if (response.ok) {
      // Calculate approximate upload speed in Mbps
      const fileSizeBits = blob.size * 8;
      const speedMbps = (fileSizeBits / (duration / 1000)) / 1000000;
      return speedMbps;
    }

    return 1; // Default slow speed if test fails
  } catch (error) {
    console.warn('Upload speed test failed:', error);
    return 1; // Default to slow speed
  }
};

/**
 * Get user-friendly connection status message
 */
export const getConnectionStatusMessage = (networkInfo: NetworkInfo): string => {
  if (!networkInfo.isOnline) {
    return 'No internet connection';
  }

  switch (networkInfo.quality) {
    case 'fast':
      return 'Fast connection';
    case 'moderate':
      return 'Good connection';
    case 'slow':
      return 'Slow connection';
    case 'very-slow':
      return 'Very slow connection';
    default:
      return 'Connection quality unknown';
  }
};
