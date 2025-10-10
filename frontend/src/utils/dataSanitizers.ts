// Data sanitization utilities for Firebase operations
// Extracted from waterbase.ts for better organization

// Utility function to sanitize user data before saving to Firestore
export const sanitizeUserData = (userData: any): any => {
    if (!userData) return userData;

    const sanitized = { ...userData };

    // Ensure profilePicture is never undefined
    if (sanitized.profilePicture === undefined) {
        sanitized.profilePicture = null;
    }

    // Ensure profileImageUrl is never undefined
    if (sanitized.profileImageUrl === undefined) {
        sanitized.profileImageUrl = null;
    }

    // Ensure all string fields are never undefined
    const stringFields = ['firstName', 'lastName', 'email', 'contactNum', 'studentId'];
    stringFields.forEach(field => {
        if (sanitized[field] === undefined) {
            sanitized[field] = '';
        }
    });

    return sanitized;
};

// Utility function to sanitize post data before saving to Firestore
export const sanitizePostData = (postData: any): any => {
    if (!postData) return postData;

    const sanitized = { ...postData };

    // Sanitize user object within post
    if (sanitized.user) {
        sanitized.user = sanitizeUserData(sanitized.user);
    }

    // Ensure other optional fields are never undefined
    if (sanitized.coordinates === undefined) {
        sanitized.coordinates = null;
    }

    if (sanitized.foundAction === undefined) {
        sanitized.foundAction = null;
    }

    return sanitized;
};
