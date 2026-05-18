/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ['*'] },
  experimental: { serverActions: { allowedOrigins: ['*'] } },
};
module.exports = nextConfig;
