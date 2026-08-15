/**
 * Vite serves `?raw` imports as the file's text. This package compiles without
 * `vite/client` in `types`, so the one form it uses is declared here.
 */
declare module '*.svg?raw' {
    const source: string
    export default source
}
