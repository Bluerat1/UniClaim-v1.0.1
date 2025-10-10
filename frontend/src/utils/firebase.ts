// Main Firebase service hub - imports and re-exports all services
// This file maintains backward compatibility while using the existing modular structure

// Import Firebase configuration and core instances
import { auth, db } from '../services/firebase/config';
export { auth, db } from '../services/firebase/config';

// Import and re-export all service functions from the existing services
import {
    authService,
    messageService,
    postService,
    userService,
    imageService,
    profilePictureRecoveryService,
    ghostConversationService,
    backgroundCleanupService,
    quotaManager,
    getFirebaseErrorMessage,
    sanitizeUserData,
    sanitizePostData,
    firebaseOperationWithRetry
} from '../services/firebase';

export {
    authService,
    messageService,
    postService,
    userService,
    imageService,
    profilePictureRecoveryService,
    ghostConversationService,
    backgroundCleanupService,
    quotaManager,
    getFirebaseErrorMessage,
    sanitizeUserData,
    sanitizePostData,
    firebaseOperationWithRetry
} from '../services/firebase';

// Import and re-export types
export type { UserData } from '../services/firebase/types';
export type { Post } from '../types/Post';

// Import ListenerManager for centralized listener management
export { listenerManager } from './ListenerManager';

// Import Cloudinary service and utility functions
export { cloudinaryService, extractMessageImages, deleteMessageImages } from './cloudinary';

// Legacy exports for backward compatibility
// These ensure that existing code continues to work without changes
export const firebase = {
    auth: auth,
    db: db,
    authService: authService,
    messageService: messageService,
    postService: postService,
    userService: userService,
    imageService: imageService,
    profilePictureRecoveryService: profilePictureRecoveryService,
    ghostConversationService: ghostConversationService,
    backgroundCleanupService: backgroundCleanupService,
    quotaManager: quotaManager,
    getFirebaseErrorMessage: getFirebaseErrorMessage,
    sanitizeUserData: sanitizeUserData,
    sanitizePostData: sanitizePostData,
    firebaseOperationWithRetry: firebaseOperationWithRetry
};

// Default export for backward compatibility
export default firebase;
