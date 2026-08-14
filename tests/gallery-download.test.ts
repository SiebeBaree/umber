import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// Reached by path rather than through `@umber/ui`: saving creations is an
// internal of the gallery, not part of the package's public surface.
import { downloadImages } from '../packages/ui/src/features/gallery/download'
import type { GalleryImage } from '../packages/ui/src/features/gallery/gallery-tile'

/**
 * What the dock's download button actually puts on disk: one creation as
 * itself, a selection as a single archive, and — if the blobs cannot be read
 * back — the old file-at-a-time save rather than nothing at all.
 */

interface Save {
    readonly name: string
    readonly href: string | null
}

let saves: Save[] = []
let archived: Blob | null = null

function imageFor(id: string): GalleryImage {
    return {
        id,
        kind: 'image',
        prompt: 'a seeded tile',
        ratio: '1:1',
        providerId: 'seed',
        modelName: 'Seed',
        createdAt: 0,
        url: `blob:${id}`,
        mediaType: 'image/png',
    }
}

/** Every `<a download>` the module clicks, caught on the way up. */
const onClick = (event: MouseEvent) => {
    if (event.target instanceof HTMLAnchorElement) {
        saves.push({ name: event.target.download, href: event.target.getAttribute('href') })
    }

    event.preventDefault()
}

const createObjectURL = URL.createObjectURL
const revokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
    saves = []
    archived = null
    document.addEventListener('click', onClick)
    vi.stubGlobal('fetch', (url: string) => ({ blob: () => new Blob([url]) }))
    URL.createObjectURL = (blob: Blob) => {
        archived = blob

        return 'blob:archive'
    }
    URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
    document.removeEventListener('click', onClick)
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

/** The archive's bytes as text: names live uncompressed in its headers. */
async function archiveText(): Promise<string> {
    if (archived === null) {
        throw new Error('nothing was handed to createObjectURL')
    }

    return new TextDecoder('latin1').decode(await archived.arrayBuffer())
}

test('one creation is saved as itself, not as an archive', async () => {
    await downloadImages([imageFor('aaaaaaaa-1111')])

    expect(saves).toEqual([{ name: 'umber-aaaaaaaa.png', href: 'blob:aaaaaaaa-1111' }])
})

test('a selection comes down as a single archive', async () => {
    await downloadImages([imageFor('aaaaaaaa-1'), imageFor('bbbbbbbb-2'), imageFor('cccccccc-3')])

    expect(saves).toEqual([{ name: 'umber-creations.zip', href: 'blob:archive' }])
    expect(archived?.type).toBe('application/zip')
    expect(await archiveText()).toMatch(/^PK/u)
})

test('the archive holds every creation, under its own name', async () => {
    await downloadImages([imageFor('aaaaaaaa-1'), imageFor('bbbbbbbb-2')])

    const text = await archiveText()

    // Once in the local header and once in the table at the end.
    expect(text.match(/umber-aaaaaaaa\.png/gu)).toHaveLength(2)
    expect(text.match(/umber-bbbbbbbb\.png/gu)).toHaveLength(2)
})

test('creations whose names would collide are still told apart', async () => {
    await downloadImages([imageFor('aaaaaaaa-1'), imageFor('aaaaaaaa-2')])

    const text = await archiveText()

    expect(text).toContain('umber-aaaaaaaa.png')
    expect(text).toContain('umber-aaaaaaaa-2.png')
})

test('creations that cannot be read back are saved one by one instead', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('gone')))
    vi.useFakeTimers()

    await downloadImages([imageFor('aaaaaaaa-1'), imageFor('bbbbbbbb-2')])
    await vi.advanceTimersByTimeAsync(1000)

    expect(saves.map((save) => save.name)).toEqual(['umber-aaaaaaaa.png', 'umber-bbbbbbbb.png'])
})
