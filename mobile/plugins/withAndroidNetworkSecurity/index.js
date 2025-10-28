const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNetworkSecurityConfig = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const filePath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
        'network_security_config.xml'
      );

      // Ensure the directory exists
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

      // Write the network security config file
      await fs.promises.writeFile(
        filePath,
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">res.cloudinary.com</domain>
        <domain includeSubdomains="true">api.cloudinary.com</domain>
        <domain includeSubdomains="true">*.cloudinary.com</domain>
    </domain-config>
</network-security-config>`
      );

      return config;
    },
  ]);
};

const withAndroidNetworkSecurity = (config) => {
  // Apply the network security config
  config = withNetworkSecurityConfig(config);

  // Update AndroidManifest.xml
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest.application) {
      androidManifest.application = [];
    }

    if (androidManifest.application.length === 0) {
      androidManifest.application.push({ $: {} });
    }

    // Add network security config
    androidManifest.application[0].$['android:networkSecurityConfig'] = "@xml/network_security_config";
    androidManifest.application[0].$['android:usesCleartextTraffic'] = "true";
    androidManifest.application[0].$['android:requestLegacyExternalStorage'] = "true";

    return config;
  });
};

module.exports = withAndroidNetworkSecurity;
