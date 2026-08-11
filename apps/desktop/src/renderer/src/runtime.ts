import type { UmberBridge } from '../../shared/bridge'

/**
 * Turns whatever the preload bridge exposed into the one-line runtime summary the
 * shared footer renders. Pure, so the fallback path is easy to test.
 */
export function describeRuntime(bridge: UmberBridge | undefined): string {
    if (bridge === undefined) {
        return 'Desktop · preload bridge unavailable'
    }

    const { electron, chrome, node } = bridge.versions
    return `Electron ${electron} · Chromium ${chrome} · Node ${node}`
}
