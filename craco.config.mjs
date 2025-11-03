// craco.config.mjs
import webpack from "webpack";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export default {
  webpack: {
    configure: (config) => {
      // Polyfills for node core modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer"),
        vm: require.resolve("vm-browserify"),
        assert: require.resolve("assert/"),
        os: require.resolve("os-browserify/browser"),
        path: require.resolve("path-browserify"),
        process: require.resolve("process/browser.js"), // ✅ direct .js path
      };

      // Plugins for providing global variables
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: "process/browser.js", // ✅ fix fully specified import
          Buffer: ["buffer", "Buffer"],
        })
      );

      return config;
    },
  },
};
