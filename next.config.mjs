/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    proxyClientMaxBodySize: '250mb',
  },
  allowedDevOrigins: ['192.168.1.15', '192.168.1.88'],
}

export default nextConfig
