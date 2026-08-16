import { expect, test } from 'vitest'

// Reached by path rather than through a package export: these are internals of
// the desktop shell, and unit-testing them should not force them into
// anything's public surface.
import {
    isAllowedExternalUrl,
    isRendererUrl,
    proxyVerdictFor,
} from '../apps/desktop/src/main/security'

/**
 * The window is pinned to one document. Everything the preload exposes — the
 * vault above all — rides on the `webContents` rather than on an origin, so a
 * page that talked the window into navigating would inherit it. These are the
 * rules that decide what counts as leaving.
 */

const PACKAGED = 'file:///Applications/Umber.app/Contents/Resources/app/renderer/index.html'
const DEV_SERVER = 'http://localhost:5173'

test('the app document is recognised across its own routes', () => {
    expect(isRendererUrl(PACKAGED, PACKAGED)).toBe(true)
    // Routing is hash-only, and reloads keep the query the dev server adds.
    expect(isRendererUrl(`${PACKAGED}#/gallery`, PACKAGED)).toBe(true)
    expect(isRendererUrl(`${DEV_SERVER}/#/settings`, DEV_SERVER)).toBe(true)
    expect(isRendererUrl(`${DEV_SERVER}/?t=1#/`, DEV_SERVER)).toBe(true)
})

test('navigation away from the app document is refused', () => {
    expect(isRendererUrl('https://attacker.example/', PACKAGED)).toBe(false)
    expect(isRendererUrl('https://attacker.example/', DEV_SERVER)).toBe(false)

    // A dropped local file: same protocol, and under `file:` every origin is
    // `null`, so only the path tells the two apart.
    expect(isRendererUrl('file:///Users/someone/Downloads/page.html', PACKAGED)).toBe(false)
    expect(isRendererUrl('file:///etc/passwd', PACKAGED)).toBe(false)

    // A dev server on the loopback is not the dev server this build loaded.
    expect(isRendererUrl('http://localhost:5174/', DEV_SERVER)).toBe(false)
    expect(isRendererUrl(`${DEV_SERVER}/evil.html`, DEV_SERVER)).toBe(false)

    expect(isRendererUrl('javascript:alert(1)', PACKAGED)).toBe(false)
    expect(isRendererUrl('not a url', PACKAGED)).toBe(false)
    expect(isRendererUrl('', PACKAGED)).toBe(false)
})

test('only https links reach the browser', () => {
    expect(isAllowedExternalUrl('https://platform.openai.com/api-keys')).toBe(true)
    expect(isAllowedExternalUrl('http://example.com')).toBe(false)
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('nonsense')).toBe(false)
})

test('the proxy carries credentials to provider hosts and nothing else', () => {
    expect(proxyVerdictFor('https://api.openai.com/v1/images', 'POST')).toBe('full')
    // Finished files come back on CDN hosts that cannot be enumerated; a
    // header-less GET there is no more capable than an `<img src>`.
    expect(proxyVerdictFor('https://cdn.example.com/output.png', 'GET')).toBe('bare-get')
    expect(proxyVerdictFor('https://cdn.example.com/output.png', 'POST')).toBe('refuse')
    expect(proxyVerdictFor('http://api.openai.com/v1/images', 'GET')).toBe('refuse')
    expect(proxyVerdictFor('nonsense', 'GET')).toBe('refuse')
})
