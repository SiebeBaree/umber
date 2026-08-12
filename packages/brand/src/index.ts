/**
 * Umber's marks, as URLs an `<img>` can use.
 *
 * The SVG files in `assets/` are the single source of truth — nothing here
 * re-draws them, so a change to a file is a change everywhere it appears.
 *
 * They are referenced with `new URL(…, import.meta.url)` rather than imported.
 * That is plain ESM: the bundler rewrites it to the built asset's real path,
 * and unlike an `import` of a `.svg` it needs no ambient module declaration —
 * so a consumer never has to teach its own compiler what an SVG is.
 *
 * Which to use:
 *   • `UMBER_LOCKUP` — mark plus wordmark. The default for app chrome.
 *   • `UMBER_LOCKUP_DARK` — the same, lettered light, for dark surfaces.
 *   • `UMBER_MARK` — the ring alone, where the name is already nearby.
 *   • `UMBER_MARK_MONO` — single colour, for one-colour contexts.
 *   • `UMBER_ICON` — the ring on its plate. The installed app's icon; not for
 *     use inside the interface.
 */

export const UMBER_LOCKUP = new URL('../assets/lockup.svg', import.meta.url).href
export const UMBER_LOCKUP_DARK = new URL('../assets/lockup-dark.svg', import.meta.url).href
export const UMBER_MARK = new URL('../assets/mark.svg', import.meta.url).href
export const UMBER_MARK_MONO = new URL('../assets/mark-mono.svg', import.meta.url).href
export const UMBER_ICON = new URL('../assets/icon.svg', import.meta.url).href

/** The gradient the mark is drawn in, for surfaces that need to sit beside it. */
export const UMBER_BRAND_COLOURS = {
    highlight: '#e8a24c',
    mid: '#9a5b2c',
    shadow: '#3a2419',
    plate: '#f7f1e7',
    ink: '#1e1512',
} as const
