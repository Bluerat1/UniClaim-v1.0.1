const { withPlugins } = require('@expo/config-plugins');
const { withAndroidManifest } = require('@expo/config-plugins');
const path = require('path');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
} catch (error) {
  console.warn('No .env file found or error loading it');
}

// Helper function to safely add network security config to AndroidManifest
function withAndroidNetworkSecurityConfig(config) {
  return withAndroidManifest(config, (config) => {
    try {
      const { manifest } = config.modResults;

      // Ensure the application element exists and is properly initialized
      if (!manifest.application) {
        manifest.application = [];
      }
      if (manifest.application.length === 0) {
        manifest.application.push({ $: {} });
      }

      // Ensure the $ object exists
      if (!manifest.application[0].$) {
        manifest.application[0].$ = {};
      }

      // Add network security configurations
      const appElement = manifest.application[0].$;
      appElement['android:networkSecurityConfig'] = "@xml/network_security_config";
      appElement['android:usesCleartextTraffic'] = "true";
      appElement['android:requestLegacyExternalStorage'] = "true";

    } catch (error) {
      console.error('Error configuring Android manifest:', error);
    }

    return config;
  });
}

// Main configuration
export default ({ config }) => {
  // Get environment variables with fallbacks
  const getEnv = (key, fallback = '') => {
    // First check process.env, then config.extra for EAS builds
    return process.env[key] || config.extra?.[key] || fallback;
  };

  // Define all environment variables with fallbacks
  // These will be available in the app through Constants.expoConfig.extra
  const envVars = {
    // Firebase - using EXPO_PUBLIC_ prefix for consistency
    EXPO_PUBLIC_FIREBASE_API_KEY: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: getEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    EXPO_PUBLIC_FIREBASE_APP_ID: getEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
    EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: getEnv('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID', ''),

    // Cloudinary
    EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: getEnv('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME'),
    EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: getEnv('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET'),
    EXPO_PUBLIC_CLOUDINARY_API_KEY: getEnv('EXPO_PUBLIC_CLOUDINARY_API_KEY'),
    EXPO_PUBLIC_CLOUDINARY_API_SECRET: getEnv('EXPO_PUBLIC_CLOUDINARY_API_SECRET'),

    // EAS
    eas: {
      projectId: getEnv('EXPO_PUBLIC_EAS_PROJECT_ID', 'dd26889c-f8ea-4cfe-94f4-84d87f7fa8a0')
    },

    // Preserve any existing extra config
    ...(config.extra || {})
  };

  // Log a warning if required environment variables are missing
  const requiredVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME',
    'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET'
  ];

  requiredVars.forEach(key => {
    if (!getEnv(key)) {
      console.warn(`⚠️  Missing required environment variable: ${key}`);
    }
  });

  // Create the updated config
  const updatedConfig = {
    ...config,
    extra: envVars,
    android: {
      ...config.android,
      notification: {
        ...config.android?.notification,
        icon: "./assets/images/notification-icon-large.png",
        color: "#FF6B35"
      }
    },
    plugins: [
      ...(Array.isArray(config.plugins) ? config.plugins : []),
      // Only include expo-router in web builds
      process.env.EXPO_TARGET === 'web' ? 'expo-router' : null
    ].filter(Boolean)
  };

  // Apply plugins
  return withPlugins(updatedConfig, [
    withAndroidNetworkSecurityConfig
  ]);
};
