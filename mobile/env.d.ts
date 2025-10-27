// Environment variables type declarations
declare module '@env' {
  export const EXPO_PUBLIC_FIREBASE_API_KEY: string;
  export const EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  export const EXPO_PUBLIC_FIREBASE_PROJECT_ID: string;
  export const EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  export const EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  export const EXPO_PUBLIC_FIREBASE_APP_ID: string;
  export const EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: string;

  // Cloudinary environment variables
  export const EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: string;
  export const EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: string;
  export const EXPO_PUBLIC_CLOUDINARY_API_KEY: string;
  export const EXPO_PUBLIC_CLOUDINARY_API_SECRET: string;

  export const EXPO_PUBLIC_APP_ENV: string;
  export const NODE_ENV: string;
}
