import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.0.11:5223';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
