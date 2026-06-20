import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pizzip', 'docusign-esign', 'ssh2', 'ssh2-sftp-client'],
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
