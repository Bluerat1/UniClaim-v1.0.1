// Enhanced retry mechanism with exponential backoff for upload failures
// Provides robust error handling and recovery for slow connections

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number; // Base delay in milliseconds
  maxDelay?: number; // Maximum delay between retries
  timeoutMultiplier?: number; // Multiply timeouts based on connection quality
  onRetry?: (attempt: number, error: Error) => void;
  onMaxAttemptsReached?: (error: Error) => void;
  onSuccess?: () => void;
}

export interface RetryState {
  attempts: number;
  isRetrying: boolean;
  lastError?: Error;
  nextRetryIn?: number;
}

export interface UploadRetryContext {
  fileName: string;
  fileSize: number;
  uploadFunction: () => Promise<string>;
  options: RetryOptions;
  onProgress?: (state: RetryState) => void;
}

/**
 * Enhanced retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    timeoutMultiplier = 1,
    onRetry,
    onMaxAttemptsReached,
    onSuccess
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      onSuccess?.();
      return result;
    } catch (error) {
      lastError = error as Error;

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        onMaxAttemptsReached?.(lastError);
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
      const delay = (exponentialDelay + jitter) * timeoutMultiplier;

      console.log(`Retry attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms:`, error);

      onRetry?.(attempt, lastError);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

/**
 * Upload with retry logic specifically for image uploads
 */
export const uploadWithRetry = async (
  context: UploadRetryContext
): Promise<string> => {
  const { fileName, uploadFunction, options, onProgress } = context;

  let retryState: RetryState = {
    attempts: 0,
    isRetrying: false
  };

  const operation = async (): Promise<string> => {
    retryState.attempts++;
    retryState.isRetrying = true;

    try {
      onProgress?.(retryState);
      const result = await uploadFunction();
      retryState.isRetrying = false;
      onProgress?.(retryState);
      return result;
    } catch (error) {
      retryState.isRetrying = false;
      retryState.lastError = error as Error;
      onProgress?.(retryState);
      throw error;
    }
  };

  try {
    return await retryWithBackoff(operation, {
      ...options,
      onRetry: (attempt, error) => {
        console.log(`Retrying upload for ${fileName} (attempt ${attempt}):`, error.message);
        options.onRetry?.(attempt, error);
      },
      onSuccess: () => {
        console.log(`Upload successful for ${fileName} after ${retryState.attempts} attempts`);
        options.onSuccess?.();
      }
    });
  } catch (error) {
    console.error(`Upload failed for ${fileName} after ${options.maxAttempts} attempts:`, error);
    throw error;
  }
};

/**
 * Get user-friendly error messages based on error type and retry context
 */
export const getRetryErrorMessage = (error: Error, context: { attempts: number; fileName: string }): string => {
  const { attempts, fileName } = context;

  // Network-related errors
  if (error.message.includes('network') || error.message.includes('fetch')) {
    if (attempts < 3) {
      return `Network error uploading ${fileName}. Retrying... (Attempt ${attempts + 1}/3)`;
    }
    return `Network error uploading ${fileName}. Please check your connection and try again.`;
  }

  // Timeout errors
  if (error.message.includes('timeout') || error.message.includes('aborted')) {
    if (attempts < 3) {
      return `Upload timed out for ${fileName}. Retrying with longer timeout... (Attempt ${attempts + 1}/3)`;
    }
    return `Upload timed out for ${fileName}. Try using a smaller image or better connection.`;
  }

  // File size errors
  if (error.message.includes('size') || error.message.includes('large')) {
    return `Image ${fileName} is too large. Try selecting a smaller image or reducing its size.`;
  }

  // Generic errors
  if (attempts < 3) {
    return `Upload failed for ${fileName}. Retrying... (Attempt ${attempts + 1}/3)`;
  }

  return `Upload failed for ${fileName}. Please try again or use a different image.`;
};

/**
 * Get appropriate retry options based on connection quality
 */
export const getRetryOptionsForConnection = (
  connectionQuality: string,
  baseOptions: Partial<RetryOptions> = {}
): RetryOptions => {
  const baseRetryOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    timeoutMultiplier: 1,
    ...baseOptions
  };

  switch (connectionQuality) {
    case 'very-slow':
      return {
        ...baseRetryOptions,
        maxAttempts: 4,
        baseDelay: 2000,
        maxDelay: 60000,
        timeoutMultiplier: 3
      };

    case 'slow':
      return {
        ...baseRetryOptions,
        maxAttempts: 4,
        baseDelay: 1500,
        maxDelay: 45000,
        timeoutMultiplier: 2.5
      };

    case 'moderate':
      return {
        ...baseRetryOptions,
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        timeoutMultiplier: 1.5
      };

    case 'fast':
    default:
      return {
        ...baseRetryOptions,
        maxAttempts: 2,
        baseDelay: 500,
        maxDelay: 10000,
        timeoutMultiplier: 1
      };
  }
};

/**
 * Create upload function with retry logic for Cloudinary
 */
export const createRetryableUpload = (
  originalUpload: (file: File, folder?: string) => Promise<string>,
  connectionQuality: string
) => {
  return async (file: File, folder: string = 'posts'): Promise<string> => {
    const retryOptions = getRetryOptionsForConnection(connectionQuality);

    return uploadWithRetry({
      fileName: file.name,
      fileSize: file.size,
      uploadFunction: () => originalUpload(file, folder),
      options: retryOptions,
      onProgress: (state) => {
        console.log(`Upload ${file.name}: ${state.isRetrying ? 'Retrying' : 'Attempt'} ${state.attempts}`);
      }
    });
  };
};
