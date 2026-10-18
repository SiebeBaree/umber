const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

// Absent locally until NEXT_PUBLIC_POSTHOG_KEY is set in .env.local. Initialising with
// an empty token makes posthog-js log errors on every page, so stay quiet.
if (key) {
    // Loaded once the page goes idle (within a second and a half at most), so
    // analytics never competes with the first paint or hydration.
    const start = () =>
        import('posthog-js').then(({ default: posthog }) =>
            posthog.init(key, {
                // Same-origin path, rewritten to PostHog in next.config.ts.
                api_host: '/relay',
                // The toolbar and "view in PostHog" links need the real dashboard host,
                // which the proxy path can't stand in for.
                ui_host: 'https://eu.posthog.com',
                // Latest dated defaults; this is what turns on capture_pageview:
                // 'history_change', so App Router client navigations count as pageviews.
                defaults: '2026-06-25',
            }),
        )
    if ('requestIdleCallback' in window) {
        requestIdleCallback(start, { timeout: 1500 })
    } else {
        setTimeout(start, 1000)
    }
}
