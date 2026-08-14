import type { BrowserWindowConstructorOptions } from 'electron'

import { APP_VERSION_ARGUMENT } from '../shared/bridge'

/**
 * Window sizing and renderer options, kept apart from `index.ts` so they can be
 * asserted in tests without booting Electron. The only Electron import here is a
 * type, which the compiler erases.
 */

export const WINDOW_DEFAULTS = {
    width: 1080,
    height: 760,
    minWidth: 720,
    minHeight: 520,
} as const

export function createWindowOptions(
    preloadPath: string,
    appVersion: string,
    platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
    const macOS = platform === 'darwin'

    return {
        ...WINDOW_DEFAULTS,
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: macOS ? 'hiddenInset' : 'default',
        // Centres the traffic lights on the header's own row, which the wordmark
        // shares with them (see `overlaidWindowControls`). That row runs from
        // 16px to 60px down the window, so its centre is 38px; the buttons are
        // 12px tall, hence a 32px top offset.
        ...(macOS ? { trafficLightPosition: { x: 20, y: 32 } } : {}),
        webPreferences: {
            preload: preloadPath,
            // The sandboxed preload cannot ask Electron what version this build
            // is, and a synchronous IPC to find out would block the first
            // paint. The command line carries it instead.
            additionalArguments: [`${APP_VERSION_ARGUMENT}${appVersion}`],
            // The renderer is treated as untrusted: no Node, isolated context, sandboxed.
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
        },
    }
}
