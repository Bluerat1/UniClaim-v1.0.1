const { withPlugins } = require('@expo/config-plugins');
const { withAndroidManifest } = require('@expo/config-plugins');

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

module.exports = ({ config }) => {
  return withPlugins(config, [
    withAndroidNetworkSecurityConfig
  ]);
};
