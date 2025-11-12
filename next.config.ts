import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
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
