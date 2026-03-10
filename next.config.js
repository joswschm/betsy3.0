/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy server-side packages out of the webpack bundle
  serverExternalPackages: ['pdfjs-dist', 'exceljs'],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
