// Error handling utilities for Firebase operations
// Extracted from waterbase.ts for better organization

// Firebase error message translator
export const getFirebaseErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred';

    const errorCode = error.code || '';

    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please check your credentials.';
        case 'auth/email-already-in-use':
            return 'An account with this email already exists.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters long.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many failed login attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        default:
            return error.message || 'An unexpected error occurred. Please try again.';
    }
};

// Helper function to check if error is a permission error (expected during logout)
export const isPermissionError = (error: any): boolean => {
    if (!error) return false;

    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';

    // Check for common permission error patterns
    return (
        errorCode === 'permission-denied' ||
        errorCode === 'PERMISSION_DENIED' ||
        errorMessage.includes('Missing or insufficient permissions') ||
        errorMessage.includes('permission-denied') ||
        errorMessage.includes('PERMISSION_DENIED') ||
        errorMessage.includes('not authorized') ||
        errorMessage.includes('authentication required')
    );
};

// Utility function to check if error is a quota error
export const isQuotaError = (error: any): boolean => {
    if (!error) return false;

    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || '';

    // Check for quota-related error patterns
    return (
        errorCode === 'resource-exhausted' ||
        errorCode === 'RESOURCE_EXHAUSTED' ||
        errorMessage.includes('Quota exceeded') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('resource exhausted') ||
        errorMessage.includes('Quota exceeded')
    );
};
