/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  transpilePackages: ['@serp-scout/types'],
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
