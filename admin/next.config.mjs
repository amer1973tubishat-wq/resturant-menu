/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // do not advertise the framework
  images: { formats: ['image/avif', 'image/webp'] },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  experimental: { serverComponentsExternalPackages: ['@node-rs/argon2', 'sharp'] },
};

export default nextConfig;
