/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['i.imgur.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },

  // Performance optimizations
  swcMinify: true,
  poweredByHeader: false,
  compress: true,

  // Root goes straight to the client portal. This repo is the portal prototype:
  // the analyst app was copied along with it, but nobody demoing this is meant
  // to land on the internal login. Kept temporary (permanent: false, HTTP 307)
  // so browsers do not cache it — the analyst routes still work when typed
  // directly, and re-syncing this frontend with Centrix stays cheap.
  async redirects() {
    return [
      {
        source: '/',
        destination: '/portal/cotacoes',
        permanent: false,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // Public token-gated portals (agent proposal + client view). These pages
        // fetch their state client-side; without no-store, the Chrome bfcache can
        // restore a stale rendered state (e.g. "expired") on back/forward
        // navigation without re-running the fetch that would show current state.
        source: '/proposta/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/proposta-cliente/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
