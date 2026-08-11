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

export interface UmberBridge {
    readonly platform: 'desktop'
    readonly versions: UmberVersions
}
