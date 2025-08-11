/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // this is now the correct way
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

export default nextConfig
