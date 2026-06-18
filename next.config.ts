import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pizzip', 'docusign-esign'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflarestorage.com',
      },
    ],
  },
};

export default nextConfig;
// force reload
