import type { NextConfig } from 'next'

// PostHog Cloud EU. Browser traffic never names these hosts directly — it goes
// to /relay on our own domain and is rewritten here, so the requests survive the
// ad blockers that match on posthog.com.
const POSTHOG_INGEST = 'https://eu.i.posthog.com'
const POSTHOG_ASSETS = 'https://eu-assets.i.posthog.com'

const nextConfig: NextConfig = {
    reactCompiler: true,
    // The site reads the model catalog straight from the app's TypeScript source.
    transpilePackages: ['@umber/ui'],
    // AVIF first: the same images at roughly a fifth less weight than WebP.
    images: { formats: ['image/avif', 'image/webp'] },
    // PostHog's ingestion endpoints keep their trailing slash (/e/, /flags/).
    // Without this Next redirects them and the events are dropped.
    skipTrailingSlashRedirect: true,
    rewrites() {
        return Promise.resolve([
            {
                source: '/relay/static/:path*',
                destination: `${POSTHOG_ASSETS}/static/:path*`,
            },
            {
                source: '/relay/array/:path*',
                destination: `${POSTHOG_ASSETS}/array/:path*`,
            },
            {
                source: '/relay/:path*',
                destination: `${POSTHOG_INGEST}/:path*`,
            },
        ])
    },
}

export default nextConfig
