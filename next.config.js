/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep heavy server-side packages out of the webpack bundle
  serverExternalPackages: ['pdfjs-dist', 'exceljs'],
  // Ensure pdfjs-dist files are included in Vercel serverless functions
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/pdfjs-dist/**/*'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
