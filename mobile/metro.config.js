const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);
const defaultResolveRequest = config.resolver.resolveRequest;

// Pin Metro's project root to the mobile directory
config.projectRoot = projectRoot;

// Watch the entire monorepo so hoisted packages are visible
config.watchFolders = [monorepoRoot];

// Force Metro to look in local workspace's node_modules first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Exclude native build and temporary directories from the file watcher
config.resolver.blockList = [
  /[\\/]android[\\/]app[\\/]build[\\/]/,
  /[\\/]android[\\/]\.cxx[\\/]/,
  /[\\/]android[\\/]\.gradle[\\/]/,
  /[\\/]\.gradle[\\/]/,
  /[\\/]android[\\/].*[\\/]build[\\/]/,
  /[\\/]ios[\\/]build[\\/]/,
  /[\\/]codex[\\/]backend[\\/]/,
  /[\\/]codex[\\/]web[\\/]/,
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-keep-awake") {
    return {
      filePath: path.resolve(projectRoot, "src/shims/expoKeepAwake.ts"),
      type: "sourceFile"
    };
  }

  // Pin critical packages to mobile's node_modules resolution
  const pinnedModules = [
    "react",
    "react-native",
    "react-dom",
    "expo",
    "@react-native-async-storage/async-storage",
    "@react-native-community/netinfo",
    "react-native-gesture-handler",
    "react-native-reanimated",
    "react-native-safe-area-context",
    "react-native-screens",
    "react-native-worklets",
    "@expo/metro-runtime",
    "expo-router"
  ];

  if (pinnedModules.some(m => moduleName === m || moduleName.startsWith(m + "/"))) {
    try {
      const resolved = require.resolve(moduleName, { paths: [projectRoot] });
      return {
        filePath: resolved,
        type: "sourceFile"
      };
    } catch (e) {
      // Fallback if require.resolve fails
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
