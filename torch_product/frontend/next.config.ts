import type { NextConfig } from 'next';

// Static export — `next build` produces a plain `out/` directory of HTML/JS/CSS.
// Vercel serves it from the CDN as static files: zero serverless function
// invocations per request. The entire dynamic surface (auth, data fetching)
// lives in the Cloud Run backend; the frontend is a pure SPA.
//
// Constraints encoded here:
//  - no <Image> optimization (use unoptimized; we don't render <Image> yet)
//  - no `next/headers` cookies/headers (we use localStorage on the client)
//  - no server-side fetch at request time (only client fetch to the backend)
//  - dynamic routes must be query-string-driven (e.g. /results?id=…) or have
//    generateStaticParams; we picked the query-string pattern for Phase 3.
const nextConfig: NextConfig = {
  output: 'export',
  // Trailing slash so Vercel/CDN serves `dashboard/index.html` correctly
  // for the URL `/dashboard` without a redirect hop.
  trailingSlash: true,
  images: { unoptimized: true },
  // @torch/core-shared is a workspace-local TypeScript package; Next must
  // transpile its source rather than expect a pre-built dist/. The engine
  // package (@torch/core) is deliberately NOT listed here — it's backend-only
  // and must not be bundled into the static export.
  transpilePackages: ['@torch/core-shared'],
  reactStrictMode: true,
};

export default nextConfig;
