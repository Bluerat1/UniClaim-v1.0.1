// Enhanced concurrent upload utilities with progress tracking, retry logic, and error recovery
// Integrates with network detection and form persistence for robust slow connection handling

import { detectConnectionQuality, getConnectionRecommendations, type NetworkInfo } from './networkDetection';
import { retryWithBackoff, getRetryOptionsForConnection } from './uploadRetry';
import { updateFormUploadState, clearFormData } from './formPersistence';

export interface UploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'retrying';
  error?: string;
  attempts?: number;
  nextRetryIn?: number;
}

export interface ConcurrentUploadOptions {
  maxConcurrent?: number;
  onProgress?: (progress: UploadProgress[]) => void;
  onFileComplete?: (fileName: string, success: boolean, error?: string) => void;
  onComplete?: (results: { successful: number; failed: number; total: number }) => void;
  onRetry?: (fileName: string, attempt: number, error: Error) => void;
  networkInfo?: NetworkInfo;
  formId?: string; // For form persistence
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  fileName: string;
  attempts?: number;
}

/**
 * Upload multiple files concurrently with progress tracking (original implementation enhanced)
 */
export const uploadFilesConcurrently = async (
  files: File[],
  uploadFunction: (file: File) => Promise<string>,
  options: ConcurrentUploadOptions = {}
): Promise<string[]> => {
  const {
    maxConcurrent = 3,
    onProgress,
    onFileComplete,
    onComplete,
    onRetry: _onRetry,
    formId: _formId,
    networkInfo: _networkInfo
  } = options;

  // Helper function to check if error is network-related
  const isNetworkError = (error: any): boolean => {
    return (
      error.code === 'network-failed' ||
      error.message?.includes('network') ||
      error.message?.includes('offline') ||
      error.message?.includes('timeout') ||
      error.message?.includes('failed to fetch')
    );
  };

  const progressMap = new Map<string, UploadProgress>();
  const results: UploadResult[] = [];

  // Initialize progress for all files
  files.forEach(file => {
    progressMap.set(file.name, {
      fileName: file.name,
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: 'pending',
      attempts: 0
    });
  });

  // Notify initial progress
  onProgress?.(Array.from(progressMap.values()));

  const uploadFile = async (file: File): Promise<UploadResult> => {
    const fileName = file.name;

    // Update status to uploading
    const progress = progressMap.get(fileName)!;
    progress.status = 'uploading';
    onProgress?.(Array.from(progressMap.values()));

    try {
      // Use enhanced upload with retry logic
      const result = await uploadFileWithRetry(file, uploadFunction, options);

      // Update progress as completed
      progress.status = 'completed';
      progress.percentage = 100;
      progress.loaded = file.size;
      progress.attempts = result.attempts;
      onProgress?.(Array.from(progressMap.values()));
      onFileComplete?.(fileName, true);

      return result;
    } catch (error: any) {
      // Check if this is a network error
      if (isNetworkError(error)) {
        // For network errors, mark as retrying instead of failed
        progress.status = 'retrying';
        progress.error = 'Poor connection. Retrying...';
        progress.attempts = (progress.attempts || 0) + 1;
        
        // Simple retry logic - retry up to 3 times with increasing delay
        if (progress.attempts <= 3) {
          const delay = progress.attempts * 2000; // 2s, 4s, 6s
          progress.nextRetryIn = delay / 1000;
          
          onProgress?.(Array.from(progressMap.values()));
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          return uploadFile(file); // Retry the upload
        }
      }
      
      // If we get here, either it's not a network error or we've exhausted retries
      progress.status = 'failed';
      progress.error = isNetworkError(error) 
        ? 'Upload failed due to poor network connection. Please check your internet and try again.' 
        : error.message;
      onProgress?.(Array.from(progressMap.values()));
      onFileComplete?.(fileName, false, progress.error);

      return { success: false, error: error.message, fileName: file.name, attempts: 1 };
    }
  };

  // Process files in batches
  const batches: File[][] = [];
  for (let i = 0; i < files.length; i += maxConcurrent) {
    batches.push(files.slice(i, i + maxConcurrent));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(file => uploadFile(file));
    const batchResults = await Promise.allSettled(batchPromises);

    // Process batch results
    batchResults.forEach((result, index) => {
      const fileName = batch[index].name;
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Upload failed for ${fileName}:`, result.reason);
        results.push({
          success: false,
          error: result.reason?.message || 'Unknown error',
          fileName
        });
      }
    });

    // Small delay between batches to prevent overwhelming the server
    if (batches.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  onComplete?.({ successful, failed, total: files.length });

  // Return only successful uploads
  return results.filter(r => r.success).map(r => r.url!);
};

/**
 * Upload multiple files concurrently with enhanced error handling and retry logic
 */
export const uploadFilesConcurrentlyEnhanced = async (
  files: File[],
  uploadFunction: (file: File) => Promise<string>,
  options: ConcurrentUploadOptions = {}
): Promise<string[]> => {
  const { onProgress: _onProgress, onFileComplete: _onFileComplete, onComplete, formId: _formId } = options;

  if (files.length === 0) {
    onComplete?.({ successful: 0, failed: 0, total: 0 });
    return [];
  }

  // Detect network conditions for optimal settings
  const networkInfo = options.networkInfo || await detectConnectionQuality();
  const recommendations = getConnectionRecommendations(networkInfo);

  console.log(`🌐 Network detected: ${networkInfo.quality} - Using ${recommendations.maxConcurrentUploads} concurrent uploads`);

  const enhancedOptions: ConcurrentUploadOptions = {
    ...options,
    maxConcurrent: recommendations.maxConcurrentUploads,
    networkInfo
  };

  try {
    // Save form state before starting upload
    if (_formId) {
      updateFormUploadState(_formId, {
        isUploading: true,
        uploadAttempts: 0,
        failedFiles: []
      });
    }

    const results = await uploadFilesConcurrently(files, uploadFunction, enhancedOptions);

    // Clear form data on successful completion
    if (_formId && results.length === files.length) {
      clearFormData(_formId);
    }

    return results;
  } catch (error) {
    console.error('Enhanced upload failed:', error);
    throw error;
  }
};

/**
 * Enhanced upload function for individual files with retry logic
 */
const uploadFileWithRetry = async (
  file: File,
  uploadFunction: (file: File) => Promise<string>,
  options: ConcurrentUploadOptions
): Promise<UploadResult> => {
  const { onProgress, onFileComplete, onRetry, formId, networkInfo } = options;
  const retryOptions = getRetryOptionsForConnection(networkInfo?.quality || 'moderate');

  let attempts = 0;
  let progress: UploadProgress = {
    fileName: file.name,
    loaded: 0,
    total: file.size,
    percentage: 0,
    status: 'pending',
    attempts: 0
  };

  const operation = async (): Promise<string> => {
    attempts++;
    progress.attempts = attempts;
    progress.status = attempts === 1 ? 'uploading' : 'retrying';
    onProgress?.(Array.from(new Map([[file.name, progress]]).values()));

    const result = await uploadWithProgress(file, uploadFunction);

    progress.status = 'completed';
    progress.percentage = 100;
    progress.loaded = file.size;
    onProgress?.(Array.from(new Map([[file.name, progress]]).values()));
    onFileComplete?.(file.name, true);

    return result;
  };

  try {
    const url = await retryWithBackoff(operation, {
      ...retryOptions,
      onRetry: (attempt, error) => {
        progress.status = 'retrying';
        progress.error = error.message;
        progress.nextRetryIn = (retryOptions.baseDelay || 1000) * Math.pow(2, attempt - 1);
        onProgress?.(Array.from(new Map([[file.name, progress]]).values()));
        onRetry?.(file.name, attempt, error);
        console.log(`🔄 Retrying ${file.name} (attempt ${attempt}):`, error.message);
      },
      onSuccess: () => {
        console.log(`✅ Upload successful for ${file.name} after ${attempts} attempts`);
        if (formId) {
          updateFormUploadState(formId, {
            failedFiles: (formId ? getFailedFiles(formId) : []).filter(f => f !== file.name)
          });
        }
      }
    });

    return { success: true, url, fileName: file.name, attempts };
  } catch (error: any) {
    progress.status = 'failed';
    progress.error = error.message;
    onProgress?.(Array.from(new Map([[file.name, progress]]).values()));
    onFileComplete?.(file.name, false, error.message);

    // Update form persistence with failed file
    if (formId) {
      const failedFiles = getFailedFiles(formId);
      updateFormUploadState(formId, {
        failedFiles: [...failedFiles, file.name]
      });
    }

    return { success: false, error: error.message, fileName: file.name, attempts };
  }
};

/**
 * Upload a single file with progress tracking
 */
const uploadWithProgress = async (
  file: File,
  uploadFunction: (file: File) => Promise<string>
): Promise<string> => {
  return uploadFunction(file);
};
const getFailedFiles = (formId: string): string[] => {
  try {
    const form = localStorage.getItem(`lostfound_form_${formId}`);
    if (form) {
      const parsedForm = JSON.parse(form);
      return parsedForm.uploadState?.failedFiles || [];
    }
  } catch (error) {
    console.error('Error getting failed files:', error);
  }
  return [];
};

/**
 * Enhanced upload statistics with retry information
 */
export const getEnhancedUploadStats = (progressArray: UploadProgress[]): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  uploading: number;
  retrying: number;
  totalProgress: number;
  averageProgress: number;
  totalAttempts: number;
} => {
  const total = progressArray.length;
  const completed = progressArray.filter(p => p.status === 'completed').length;
  const failed = progressArray.filter(p => p.status === 'failed').length;
  const pending = progressArray.filter(p => p.status === 'pending').length;
  const uploading = progressArray.filter(p => p.status === 'uploading').length;
  const retrying = progressArray.filter(p => p.status === 'retrying').length;

  const totalProgress = progressArray.reduce((sum, p) => sum + p.percentage, 0);
  const averageProgress = total > 0 ? totalProgress / total : 0;
  const totalAttempts = progressArray.reduce((sum, p) => sum + (p.attempts || 1), 0);

  return {
    total,
    completed,
    failed,
    pending,
    uploading,
    retrying,
    totalProgress,
    averageProgress,
    totalAttempts
  };
};

/**
 * Enhanced progress message with retry information
 */
export const formatEnhancedProgressMessage = (stats: ReturnType<typeof getEnhancedUploadStats>): string => {
  if (stats.total === 0) return 'No uploads';

  const parts = [];

  if (stats.completed > 0) {
    parts.push(`${stats.completed} completed`);
  }

  if (stats.uploading > 0) {
    parts.push(`${stats.uploading} uploading`);
  }

  if (stats.retrying > 0) {
    parts.push(`${stats.retrying} retrying`);
  }

  if (stats.pending > 0) {
    parts.push(`${stats.pending} pending`);
  }

  if (stats.failed > 0) {
    parts.push(`${stats.failed} failed`);
  }

  const progressText = stats.averageProgress > 0
    ? ` (${stats.averageProgress.toFixed(0)}% avg)`
    : '';

  const attemptsText = stats.totalAttempts > stats.total
    ? ` (${stats.totalAttempts} total attempts)`
    : '';

  return `${parts.join(', ')}${progressText}${attemptsText}`;
};
