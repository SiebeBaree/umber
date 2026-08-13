import { defineConfig } from 'vite'

import { rendererConfig } from './electron.vite.config'

/**
 * Serves the renderer alone in a normal browser — no Electron window — for
 * quick visual checks. The recipe is the electron config's own renderer
 * section, so the preview cannot drift from what the app ships; only the root
 * (which electron-vite defaults for itself) and the server differ.
 *
 * The port comes from the preview harness via `PORT`. `||` rather than `??`
 * on purpose: an empty or non-numeric `PORT` yields 0 or NaN, and 0 would ask
 * Vite for a random ephemeral port — the opposite of `strictPort`'s intent.
 */
export default defineConfig({
    ...rendererConfig,
    root: 'src/renderer',
    server: { port: Number(process.env['PORT']) || 5175, strictPort: true },
})
