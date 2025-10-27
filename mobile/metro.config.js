const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add path alias support for @ symbol to match TypeScript config
config.resolver.alias = {
  ...config.resolver.alias,
  "@": __dirname,
};

module.exports = withNativeWind(config, { input: "./global.css" });
