/**
 * The contract between the preload script and the renderer.
 *
 * This is the only thing the desktop shell adds on top of `@umber/ui`. Keeping it
 * in one file means the preload script and the renderer can never disagree about
 * the shape of `window.umber`.
 */

/** The global the preload script exposes the bridge under. */
export const BRIDGE_KEY = 'umber'

export interface UmberVersions {
    readonly electron: string
    readonly chrome: string
    readonly node: string
}

/**
 * The host operating system, reduced to what the UI actually reacts to. macOS is
 * the only one that paints its window controls *over* the app's own chrome.
 */
export type UmberOperatingSystem = 'macos' | 'windows' | 'linux'

export interface UmberBridge {
    readonly os: UmberOperatingSystem
    readonly versions: UmberVersions
}

/**
 * Maps Node's `process.platform` onto the three cases the UI distinguishes.
 * Takes a plain `string` because this file is also compiled for the sandboxed
 * renderer, where the `NodeJS` namespace does not exist.
 */
export function toOperatingSystem(platform: string): UmberOperatingSystem {
    if (platform === 'darwin') {
        return 'macos'
    }

    return platform === 'win32' ? 'windows' : 'linux'
}
