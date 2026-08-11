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
 * Applied as a response header to packaged builds only. The dev server serves
 * inline scripts for HMR, so attaching this during `electron-vite dev` would
 * break hot reload without making anything meaningfully safer.
 */
export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    // Vite emits a stylesheet, but React still sets `style` attributes inline.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
].join('; ')
