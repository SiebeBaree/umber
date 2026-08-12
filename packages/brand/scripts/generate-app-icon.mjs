// Rasterises `assets/icon.svg` into the PNG electron-builder turns into the
// installed app's icon on every platform.
//
// electron-builder only needs one square PNG of at least 512px — it derives the
// macOS `.icns` and Windows `.ico` itself — so this writes a single 1024px file
// and that file is committed. Running this is therefore a step you take when the
// mark changes, not part of the build, which matters because it shells out to
// `sips`: macOS-only, but already present there, and not worth a native image
// dependency in every contributor's install for a file that changes once a year.

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SIZE = 1024

const source = resolve(import.meta.dirname, '../assets/icon.svg')
const destination = resolve(import.meta.dirname, '../../../apps/desktop/build/icon.png')

if (process.platform !== 'darwin') {
    console.error(
        'generate-app-icon needs macOS (it uses sips).\n' +
            'The generated icon is committed, so this only has to run when the mark changes.',
    )
    process.exit(1)
}

mkdirSync(dirname(destination), { recursive: true })

execFileSync('sips', [
    '-s',
    'format',
    'png',
    '-z',
    String(SIZE),
    String(SIZE),
    source,
    '--out',
    destination,
])

console.log(`Wrote ${destination} at ${SIZE}×${SIZE}`)
