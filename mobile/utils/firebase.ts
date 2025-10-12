// Firebase configuration and utilities for React Native
// This file now imports from the new modular structure for backward compatibility
// All existing functionality is preserved - no breaking changes

// Import all services from the new modular structure
export { auth, db, app } from './firebase/config';
export { authService, userService } from './firebase/auth';
export type { UserData } from './firebase/auth';
export { messageService } from './firebase/messages';
export { postService } from './firebase/posts';
export { getFirebaseErrorMessage } from './firebase/utils';
export type { UserCredential } from 'firebase/auth';

// Note: All service implementations have been moved to separate modular files
// The services are now imported from:
// - ./firebase/auth.ts - Authentication and user services
// - ./firebase/messages.ts - Messaging and chat services  
// - ./firebase/posts.ts - Posts and items services


