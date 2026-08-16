/**
 * Security policy for the desktop shell, kept free of Electron imports so it can
 * be asserted in plain unit tests.
 */

/** Protocols we are willing to hand to the user's default browser. */
const ALLOWED_EXTERNAL_PROTOCOLS: ReadonlySet<string> = new Set(['https:'])

/**
 * Whether a URL requested via `window.open` may be handed to the system browser.
 * Everything else — `file:`, `javascript:`, plain `http:` — is dropped.
 */
export function isAllowedExternalUrl(url: string): boolean {
    try {
        return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
    } catch {
        return false
    }
}

/**
 * Whether a navigation target is the app's own document.
 *
 * Everything Umber shows lives at one URL — the packaged `index.html`, or the
 * dev server's root — and the router moves between routes in the hash, so a
 * navigation that changes anything but the hash is leaving the app. That has to
 * be refused: Electron re-runs the preload for every document a `webContents`
 * loads, so a page that talked the window into navigating would be handed
 * `window.umber`, vault and all.
 *
 * `origin` is not used because a packaged build loads over `file:`, where every
 * URL's origin is `null` and so compares equal to every other.
 */
export function isRendererUrl(target: string, rendererUrl: string): boolean {
    try {
        const to = new URL(target)
        const own = new URL(rendererUrl)

        return to.protocol === own.protocol && to.host === own.host && to.pathname === own.pathname
    } catch {
        return false
    }
}

/**
 * Applied as a response header to packaged builds only. The dev server serves
 * inline scripts for HMR, so attaching this during `electron-vite dev` would
 * break hot reload without making anything meaningfully safer.
 */
export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    // Vite emits a stylesheet, but React still sets `style` attributes inline.
    "style-src 'self' 'unsafe-inline'",
    // blob: because generated images render from object URLs over stored blobs.
    "img-src 'self' data: blob:",
    // Generated videos play from object URLs the same way.
    "media-src 'self' blob:",
    "font-src 'self' data:",
    // Provider calls do not appear here: the renderer reaches providers only
    // through the main-process net proxy, which enforces its own allowlist.
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
].join('; ')

/**
 * The API hosts the net proxy will speak to with full requests — methods,
 * bodies and credential headers included. One entry per provider integration;
 * an integration that forgets its host fails loudly on the first call.
 */
export const PROVIDER_API_HOSTS: ReadonlySet<string> = new Set([
    'api.openai.com',
    'generativelanguage.googleapis.com',
    'api.bfl.ai',
    'api.eu.bfl.ai',
    'api.us.bfl.ai',
    'api.ideogram.ai',
    'external.api.recraft.ai',
    'api.dev.runwayml.com',
    'api-singapore.klingai.com',
    'ark.ap-southeast.bytepluses.com',
    'dashscope-intl.aliyuncs.com',
    'dashscope.aliyuncs.com',
    'api.minimax.io',
    'api.x.ai',
    'api.reve.com',
])

/**
 * What the proxy may do with a URL: everything for allowlisted API hosts,
 * header-less GETs for any other https host — providers hand finished files
 * back on short-lived CDN URLs whose hosts cannot be enumerated, and a bare
 * GET there is no more capable than an `<img src>`. Anything else is refused.
 */
export type ProxyVerdict = 'full' | 'bare-get' | 'refuse'

export function proxyVerdictFor(url: string, method: string): ProxyVerdict {
    let parsed: URL

    try {
        parsed = new URL(url)
    } catch {
        return 'refuse'
    }

    if (parsed.protocol !== 'https:') {
        return 'refuse'
    }

    if (PROVIDER_API_HOSTS.has(parsed.hostname)) {
        return 'full'
    }

    return method.toUpperCase() === 'GET' ? 'bare-get' : 'refuse'
}
