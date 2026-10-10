import { z } from 'zod';

const config = z
  .object({ API_BASE_URL: z.string().url().default('http://localhost:3001') })
  .parse({ API_BASE_URL: process.env.API_BASE_URL });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@deallens/shared'],
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react'],
  },
  webpack: (webpackConfig) => {
    webpackConfig.infrastructureLogging = {
      level: 'error',
    };
    return webpackConfig;
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${config.API_BASE_URL.replace(/\/$/, '')}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
