// Main Firebase services export file
// Import all services from their respective modules

// Configuration and core Firebase instances
export { auth, db, app } from './config';

// Authentication and user management services
export { authService, userService } from './auth';
export type { UserData } from './auth';

// Messaging and chat services
export { messageService } from './messages';

// Posts and items services
export { postService } from './posts';

// Utility functions
export { getFirebaseErrorMessage } from './utils';

// Re-export commonly used Firebase types for convenience
export type { UserCredential } from 'firebase/auth';