const { withPlugins } = require('@expo/config-plugins');
const { withAndroidManifest } = require('@expo/config-plugins');

// Load environment variables
require('dotenv').config({ path: '.env' });

// Helper function to add network security config to AndroidManifest
function withAndroidNetworkSecurityConfig(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure the application element exists
    if (!androidManifest.application) {
      androidManifest.application = [];
    }

    // Add network security config
    androidManifest.application[0].$['android:networkSecurityConfig'] = "@xml/network_security_config";
    androidManifest.application[0].$['android:usesCleartextTraffic'] = "true";
    androidManifest.application[0].$['android:requestLegacyExternalStorage'] = "true";

    return config;
  });
}

// Main configuration
export default ({ config }) => {
  // Add environment variables to the app's extra field
  const extra = {
    ...config.extra,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    },
    cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
    cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '',
    cloudinaryApiKey: process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET || ''
  };

  const updatedConfig = {
    ...config,
    extra,
    plugins: [
      ...(config.plugins || []),
      // Only include expo-router in web builds
      process.env.EXPO_TARGET === 'web' ? 'expo-router' : null
    ].filter(Boolean)
  };

  return withPlugins(updatedConfig, [
    withAndroidNetworkSecurityConfig
  ]);
};
