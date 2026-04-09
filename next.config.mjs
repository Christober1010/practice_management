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
  async rewrites() {
    // Local dev convenience: proxy Launchpad PHP backend if you run it separately.
    // Example:
    //   LAUNCHPAD_PHP_ORIGIN=http://localhost:8080 pnpm dev
    // Then frontend calls to /launchpad/backend/*.php will be proxied to that origin.
    const origin = process.env.LAUNCHPAD_PHP_ORIGIN;
    if (!origin) return [];
    const base = String(origin).replace(/\/+$/, "");
    return [
      {
        source: "/launchpad/backend/:path*",
        destination: `${base}/backend/:path*`,
      },
    ];
  },
}

export default nextConfig
