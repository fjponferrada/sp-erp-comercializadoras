import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pizzip'],
  serverActions: {
    bodySizeLimit: '50mb',
  },
};

export default nextConfig;
// force reload
