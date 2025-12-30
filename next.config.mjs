/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.x.ai',
      },
      {
        protocol: 'https',
        hostname: 'api.x.ai',
      },
    ],
  },
};

export default nextConfig;
