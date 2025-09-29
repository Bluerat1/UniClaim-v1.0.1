// Concurrent upload utilities with progress tracking
// These utilities enable parallel uploads while providing detailed progress feedback

export interface UploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface ConcurrentUploadOptions {
  maxConcurrent?: number;
  onProgress?: (progress: UploadProgress[]) => void;
  onFileComplete?: (fileName: string, success: boolean, error?: string) => void;
  onComplete?: (results: { successful: number; failed: number; total: number }) => void;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  fileName: string;
}

/**
 * Upload multiple files concurrently with progress tracking
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
    onComplete
  } = options;

  if (files.length === 0) {
    onComplete?.({ successful: 0, failed: 0, total: 0 });
    return [];
  }

  const progressMap = new Map<string, UploadProgress>();
  const results: UploadResult[] = [];

  // Initialize progress for all files
  files.forEach(file => {
    progressMap.set(file.name, {
      fileName: file.name,
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: 'pending'
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
      // Create upload with progress tracking
      const result = await uploadWithProgress(file, uploadFunction);

      // Update progress as completed
      progress.status = 'completed';
      progress.percentage = 100;
      progress.loaded = file.size;
      onProgress?.(Array.from(progressMap.values()));
      onFileComplete?.(fileName, true);

      return { success: true, url: result, fileName };
    } catch (error: any) {
      // Update progress as failed
      progress.status = 'failed';
      progress.error = error.message;
      onProgress?.(Array.from(progressMap.values()));
      onFileComplete?.(fileName, false, error.message);

      return { success: false, error: error.message, fileName };
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
 * Upload a single file with progress tracking
 */
const uploadWithProgress = async (
  file: File,
  uploadFunction: (file: File) => Promise<string>
): Promise<string> => {
  return uploadFunction(file);
};

/**
 * Create a progress tracking upload function for Cloudinary
 */
export const createProgressTrackingUpload = (
  cloudinaryUpload: (file: File) => Promise<string>
) => {
  return async (file: File): Promise<string> => {
    // For now, we'll use the existing upload function
    // In a more advanced implementation, we could add XMLHttpRequest
    // progress tracking for the actual HTTP upload
    return cloudinaryUpload(file);
  };
};

/**
 * Get upload statistics
 */
export const getUploadStats = (progressArray: UploadProgress[]): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  uploading: number;
  totalProgress: number;
  averageProgress: number;
} => {
  const total = progressArray.length;
  const completed = progressArray.filter(p => p.status === 'completed').length;
  const failed = progressArray.filter(p => p.status === 'failed').length;
  const pending = progressArray.filter(p => p.status === 'pending').length;
  const uploading = progressArray.filter(p => p.status === 'uploading').length;

  const totalProgress = progressArray.reduce((sum, p) => sum + p.percentage, 0);
  const averageProgress = total > 0 ? totalProgress / total : 0;

  return {
    total,
    completed,
    failed,
    pending,
    uploading,
    totalProgress,
    averageProgress
  };
};

/**
 * Format progress for display
 */
export const formatProgressMessage = (stats: ReturnType<typeof getUploadStats>): string => {
  if (stats.total === 0) return 'No uploads';

  const parts = [];

  if (stats.completed > 0) {
    parts.push(`${stats.completed} completed`);
  }

  if (stats.uploading > 0) {
    parts.push(`${stats.uploading} uploading`);
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

  return `${parts.join(', ')}${progressText}`;
};
