import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from 'vitest'

// Reached by path rather than through `@umber/ui`: the archive is an internal
// of the gallery, not part of the package's public surface.
import { crc32, zipStored } from '../packages/ui/src/features/gallery/zip'

/**
 * The archive is hand-written, so it is checked against a real unzip rather
 * than against a reader of its own: an archive only this code can open would
 * pass every test and still be useless in the downloads folder.
 */

const STAMPED = new Date(2026, 7, 14, 12, 34, 56)

/** Bytes that are not text, so a mangled archive cannot read as "close enough". */
function bytesFor(seed: number, length: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(length)

    for (let index = 0; index < length; index++) {
        bytes[index] = (index * 31 + seed * 97) % 256
    }

    return bytes
}

function blobFor(seed: number, length: number): Blob {
    return new Blob([bytesFor(seed, length)])
}

async function writeArchive(files: readonly { name: string; blob: Blob }[]): Promise<string> {
    const archive = await zipStored(files, STAMPED)
    const directory = mkdtempSync(join(tmpdir(), 'umber-zip-'))
    const path = join(directory, 'creations.zip')

    writeFileSync(path, new Uint8Array(await archive.arrayBuffer()))

    return path
}

function hasUnzip(): boolean {
    try {
        execFileSync('unzip', ['-v'], { stdio: 'ignore' })

        return true
    } catch {
        return false
    }
}

test('the checksum matches the standard vector', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcb_f4_39_26)
})

test('an empty selection still makes a readable archive', async () => {
    const archive = await zipStored([], STAMPED)

    // Nothing but the end-of-central-directory record.
    expect(archive.size).toBe(22)
})

test.skipIf(!hasUnzip())('unzip reads the archive and finds every file intact', async () => {
    const files = [
        { name: 'umber-aaaaaaaa.png', blob: blobFor(1, 5000) },
        { name: 'umber-bbbbbbbb.mp4', blob: blobFor(2, 131_072) },
        { name: 'umber-cccccccc.webp', blob: blobFor(3, 1) },
    ]
    const path = await writeArchive(files)
    const into = mkdtempSync(join(tmpdir(), 'umber-unzip-'))

    // -t verifies every entry's CRC against its bytes.
    expect(execFileSync('unzip', ['-t', path], { encoding: 'utf8' })).toContain(
        'No errors detected',
    )

    execFileSync('unzip', ['-o', '-q', path, '-d', into])

    for (const [index, file] of files.entries()) {
        const extracted = readFileSync(join(into, file.name))

        expect([...extracted]).toEqual([...bytesFor(index + 1, extracted.length)])
        expect(extracted.length).toBe(file.blob.size)
    }
})

/**
 * Names go in as UTF-8, and bit 11 of the general purpose flags is what tells
 * a reader so. Asserted on the bytes rather than through unzip: the one macOS
 * ships is Info-ZIP 6.00, which ignores the flag and transliterates the name.
 */
test('every entry is flagged as carrying a UTF-8 name', async () => {
    const archive = await zipStored([{ name: 'ümber-café.webp', blob: blobFor(1, 8) }], STAMPED)
    const header = new DataView(await archive.arrayBuffer())

    expect(header.getUint32(0, true)).toBe(0x04_03_4b_50)
    expect(header.getUint16(6, true) & 0x08_00).toBe(0x08_00)
    // Fifteen characters, but two bytes each for ü and é.
    expect(header.getUint16(26, true)).toBe(17)
})

test.skipIf(!hasUnzip())('the archive lists its entries under the names it was given', async () => {
    const path = await writeArchive([
        { name: 'umber-aaaaaaaa.png', blob: blobFor(1, 64) },
        { name: 'umber-bbbbbbbb.png', blob: blobFor(2, 64) },
    ])
    const listing = execFileSync('unzip', ['-l', path], { encoding: 'utf8' })

    expect(listing).toContain('umber-aaaaaaaa.png')
    expect(listing).toContain('umber-bbbbbbbb.png')
    expect(listing).toContain('2 files')
})
