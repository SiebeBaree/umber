import type { BrowserWindowConstructorOptions } from 'electron'

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
    platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
    return {
        ...WINDOW_DEFAULTS,
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'default',
        webPreferences: {
            preload: preloadPath,
            // The renderer is treated as untrusted: no Node, isolated context, sandboxed.
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
        },
    }
}
