/** @type {import('next').NextConfig} */
const nextConfig = {
  // exceljs stays external (native deps); pdfjs-dist is bundled by webpack
  serverExternalPackages: ['exceljs'],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
