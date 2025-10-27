module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-worklets/plugin",
      [
        "module:react-native-dotenv",
        {
          "envName": "APP_ENV",
          "moduleName": "@env",
          "path": ".env",
          "blocklist": null,
          "allowlist": null,
          "blacklist": null,
          "whitelist": null,
          "safe": false,
          "allowUndefined": true,
          "verbose": false
        }
      ]
    ],
  };
};
