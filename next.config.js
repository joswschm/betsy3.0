/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next.js 14.x uses this key (not top-level serverExternalPackages)
    serverComponentsExternalPackages: ['exceljs'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
