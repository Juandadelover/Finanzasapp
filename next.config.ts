import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Supabase origins allowed for fetch/WebSocket. Wildcards cover hosted projects;
// the configured URL covers custom domains and local dev (http://127.0.0.1:54321).
const connectSrc = new Set([
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
]);
try {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    const u = new URL(raw);
    connectSrc.add(u.origin);
    if (u.protocol === "https:") connectSrc.add(`wss://${u.host}`);
    if (u.protocol === "http:") connectSrc.add(`ws://${u.host}`);
  }
} catch {
  // invalid URL: fall back to the wildcard entries only
}

// CSP choice: a STATIC policy with 'unsafe-inline' for scripts. Nonce-based CSP
// (see docs/01-app/02-guides/content-security-policy.md) requires generating a nonce
// per request in proxy.ts, which forces every page to render dynamically and disables
// static optimization/CDN caching; this app is a client-side Supabase PWA with mostly
// static pages, so we trade script-inline strictness for static rendering. Everything
// else stays locked down (no third-party script origins, object-src none, etc.).
// 'unsafe-eval' is only added in dev (React debugging), never in production.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  `connect-src ${[...connectSrc].join(" ")}`,
  "font-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
