// Form persistence utilities for saving form data during upload attempts
// Ensures users never lose their input even if uploads fail or browser closes

import type { Post } from '@/types/Post';

export interface SavedFormData {
  id: string;
  timestamp: number;
  formData: {
    title: string;
    description: string;
    category: string;
    location: string;
    dateTime: string;
    selectedReport: 'lost' | 'found' | null;
    selectedFoundAction: 'keep' | 'turnover to OSA' | 'turnover to Campus Security' | null;
    coordinates: { lat: number; lng: number } | null;
  };
  uploadState: {
    selectedFiles: File[];
    uploadAttempts: number;
    failedFiles: string[];
    isUploading: boolean;
  };
  userId: string;
}

export interface FormRecoveryOptions {
  restoreForm: boolean;
  retryUpload: boolean;
  clearData: boolean;
}

const STORAGE_KEY_PREFIX = 'lostfound_form_';
const MAX_SAVED_FORMS = 5;
const FORM_EXPIRY_HOURS = 24;

/**
 * Save form data to localStorage
 */
export const saveFormData = (formData: Omit<SavedFormData, 'id' | 'timestamp'>): string => {
  const id = `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const savedData: SavedFormData = {
    id,
    timestamp: Date.now(),
    ...formData
  };

  try {
    // Get existing saved forms
    const existingForms = getAllSavedForms();

    // Add new form to the beginning
    existingForms.unshift(savedData);

    // Keep only the most recent forms
    const recentForms = existingForms.slice(0, MAX_SAVED_FORMS);

    // Save to localStorage
    localStorage.setItem(`${STORAGE_KEY_PREFIX}forms`, JSON.stringify(recentForms));

    // Also save individual form for quick access
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(savedData));

    console.log(`✅ Form data saved locally: ${id}`);
    return id;
  } catch (error) {
    console.error('Failed to save form data:', error);
    return id;
  }
};

/**
 * Get all saved forms
 */
export const getAllSavedForms = (): SavedFormData[] => {
  try {
    const forms = localStorage.getItem(`${STORAGE_KEY_PREFIX}forms`);
    if (!forms) return [];

    const parsedForms = JSON.parse(forms);

    // Filter out expired forms
    const now = Date.now();
    const validForms = parsedForms.filter((form: SavedFormData) => {
      const hoursElapsed = (now - form.timestamp) / (1000 * 60 * 60);
      return hoursElapsed < FORM_EXPIRY_HOURS;
    });

    // Update storage with only valid forms
    if (validForms.length !== parsedForms.length) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}forms`, JSON.stringify(validForms));
    }

    return validForms;
  } catch (error) {
    console.error('Failed to get saved forms:', error);
    return [];
  }
};

/**
 * Get a specific saved form by ID
 */
export const getSavedForm = (id: string): SavedFormData | null => {
  try {
    const form = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    if (!form) return null;

    const parsedForm = JSON.parse(form);

    // Check if form has expired
    const now = Date.now();
    const hoursElapsed = (now - parsedForm.timestamp) / (1000 * 60 * 60);

    if (hoursElapsed >= FORM_EXPIRY_HOURS) {
      // Remove expired form
      clearFormData(id);
      return null;
    }

    return parsedForm;
  } catch (error) {
    console.error('Failed to get saved form:', error);
    return null;
  }
};

/**
 * Update upload state for a saved form
 */
export const updateFormUploadState = (id: string, uploadState: Partial<SavedFormData['uploadState']>): boolean => {
  try {
    const form = getSavedForm(id);
    if (!form) return false;

    const updatedForm = {
      ...form,
      uploadState: {
        ...form.uploadState,
        ...uploadState
      }
    };

    localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(updatedForm));

    // Update in the forms array too
    const allForms = getAllSavedForms();
    const formIndex = allForms.findIndex(f => f.id === id);
    if (formIndex !== -1) {
      allForms[formIndex] = updatedForm;
      localStorage.setItem(`${STORAGE_KEY_PREFIX}forms`, JSON.stringify(allForms));
    }

    return true;
  } catch (error) {
    console.error('Failed to update form upload state:', error);
    return false;
  }
};

/**
 * Clear saved form data
 */
export const clearFormData = (id: string): boolean => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);

    // Also remove from forms array
    const allForms = getAllSavedForms();
    const filteredForms = allForms.filter(f => f.id !== id);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}forms`, JSON.stringify(filteredForms));

    console.log(`🗑️ Form data cleared: ${id}`);
    return true;
  } catch (error) {
    console.error('Failed to clear form data:', error);
    return false;
  }
};

/**
 * Clear all expired forms
 */
export const clearExpiredForms = (): number => {
  const allForms = getAllSavedForms();
  const now = Date.now();
  let clearedCount = 0;

  const validForms = allForms.filter(form => {
    const hoursElapsed = (now - form.timestamp) / (1000 * 60 * 60);
    if (hoursElapsed >= FORM_EXPIRY_HOURS) {
      // Also clear individual form storage
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${form.id}`);
      clearedCount++;
      return false;
    }
    return true;
  });

  localStorage.setItem(`${STORAGE_KEY_PREFIX}forms`, JSON.stringify(validForms));
  return clearedCount;
};

/**
 * Check if there are any saved forms that need recovery
 */
export const hasRecoverableForms = (): boolean => {
  const forms = getAllSavedForms();
  return forms.length > 0;
};

/**
 * Get the most recent recoverable form
 */
export const getLatestRecoverableForm = (): SavedFormData | null => {
  const forms = getAllSavedForms();
  return forms.length > 0 ? forms[0] : null;
};

/**
 * Convert saved form data back to Post format for submission
 */
export const savedFormToPostData = (savedForm: SavedFormData): Omit<Post, 'id' | 'createdAt' | 'creatorId'> => {
  return {
    title: savedForm.formData.title,
    description: savedForm.formData.description,
    category: savedForm.formData.category,
    location: savedForm.formData.location,
    type: savedForm.formData.selectedReport!,
    images: savedForm.uploadState.selectedFiles,
    dateTime: savedForm.formData.dateTime,
    creatorId: savedForm.userId,
    user: {
      firstName: '', // This would need to be populated from current user
      lastName: '',
      email: '',
      contactNum: '',
      studentId: '',
      role: 'user'
    },
    status: 'pending'
  };
};

/**
 * Get user-friendly message about saved forms
 */
export const getFormRecoveryMessage = (form: SavedFormData): string => {
  const minutesSinceSave = Math.round((Date.now() - form.timestamp) / (1000 * 60));

  if (form.uploadState.isUploading) {
    return `Upload in progress (${minutesSinceSave} min ago)`;
  }

  if (form.uploadState.failedFiles.length > 0) {
    return `Upload failed (${minutesSinceSave} min ago) - ${form.uploadState.failedFiles.length} images need retry`;
  }

  return `Draft saved (${minutesSinceSave} min ago)`;
};

/**
 * Create form data for saving from current form state
 */
export const createFormDataForSaving = (
  formState: {
    title: string;
    description: string;
    activeCategory: string;
    selectedLocation: string | null;
    selectedDateTime: string;
    selectedReport: 'lost' | 'found' | null;
    selectedFoundAction: 'keep' | 'turnover to OSA' | 'turnover to Campus Security' | null;
    coordinates: { lat: number; lng: number } | null;
    selectedFiles: File[];
  },
  userId: string,
  uploadState: {
    uploadAttempts: number;
    failedFiles: string[];
    isUploading: boolean;
  } = { uploadAttempts: 0, failedFiles: [], isUploading: false }
): Omit<SavedFormData, 'id' | 'timestamp'> => {
  return {
    formData: {
      title: formState.title,
      description: formState.description,
      category: formState.activeCategory,
      location: formState.selectedLocation || '',
      dateTime: formState.selectedDateTime,
      selectedReport: formState.selectedReport,
      selectedFoundAction: formState.selectedFoundAction,
      coordinates: formState.coordinates
    },
    uploadState: {
      selectedFiles: formState.selectedFiles,
      uploadAttempts: uploadState.uploadAttempts,
      failedFiles: uploadState.failedFiles,
      isUploading: uploadState.isUploading
    },
    userId
  };
};
