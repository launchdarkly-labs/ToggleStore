import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  // Turbopack configuration (Next.js 16+ default bundler)
  turbopack: {
    // Resolve aliases for Node.js modules that should be excluded from client bundle
    resolveAlias: {
      net: { browser: "./empty-module.js" },
      tls: { browser: "./empty-module.js" },
      fs: { browser: "./empty-module.js" },
      dns: { browser: "./empty-module.js" },
      child_process: { browser: "./empty-module.js" },
      encoding: { browser: "./empty-module.js" },
    },
  },
  // Keep webpack config for backwards compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
        encoding: false,
      };

      // Suppress warnings for server-only modules in client bundle
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /node_modules\/@launchdarkly\/observability-node/,
        },
        {
          message: /Module not found: Can't resolve 'encoding'/,
        },
        {
          message: /Critical dependency: the request of a dependency is an expression/,
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
