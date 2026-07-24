const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * Package exports point at `lib/module/*.js` / `build/modern/*.js` with
 * extensioned ESM imports; Metro fails those under this Windows path
 * (folder name DOTO+). Force TypeScript / package main entry instead.
 */
function packageSrcEntry(pkg, candidates) {
  const pkgJson = require.resolve(`${pkg}/package.json`);
  const root = path.dirname(pkgJson);
  for (const candidate of candidates) {
    const filePath = path.join(root, candidate);
    try {
      require("fs").accessSync(filePath);
      return filePath;
    } catch {
      /* try next */
    }
  }
  throw new Error(`No source entry for ${pkg}`);
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-reanimated") {
    return {
      type: "sourceFile",
      filePath: require.resolve("react-native-reanimated"),
    };
  }
  if (moduleName === "react-native-worklets") {
    return {
      type: "sourceFile",
      filePath: require.resolve("react-native-worklets"),
    };
  }
  if (moduleName.startsWith("@tanstack/")) {
    try {
      return {
        type: "sourceFile",
        filePath: packageSrcEntry(moduleName, ["src/index.ts", "src/index.tsx"]),
      };
    } catch {
      /* fall through to default resolver */
    }
  }
  if (moduleName.startsWith("@react-navigation/")) {
    try {
      return {
        type: "sourceFile",
        filePath: packageSrcEntry(moduleName, ["src/index.tsx", "src/index.ts"]),
      };
    } catch {
      /* fall through to default resolver */
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
