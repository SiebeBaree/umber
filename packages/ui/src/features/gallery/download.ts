import { mediaExtension } from '../../lib/media'
import type { GalleryImage } from './gallery-tile'
import { zipStored, type ZipFile } from './zip'

/**
 * Saving creations to disk. The single-file case is an `<a download>` in the
 * tile; this covers the dock's "download the selection", which has no anchor
 * of its own to click.
 *
 * A selection comes down as one archive rather than as a burst of separate
 * saves: browsers and shells both throttle those, and a dozen files landing
 * loose in the downloads folder is not what was asked for either. One creation
 * is still just that creation — an archive around a single file is a chore to
 * open for nothing.
 */

/** The stem both a loose file and an archive entry are named from. */
function stemOf(image: GalleryImage): string {
    return `umber-${image.id.slice(0, 8)}`
}

/** The same name the tile's own download link uses. */
function downloadName(image: GalleryImage): string {
    return `${stemOf(image)}.${mediaExtension(image.mediaType, image.kind)}`
}

/** What the archive itself is called on the way down. */
const ARCHIVE_NAME = 'umber-creations.zip'

function save(url: string, name: string) {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
}

/**
 * A breath between files: fired back to back, the shell can coalesce or drop
 * downloads, and a beat apart they land as the separate saves they are.
 */
const SPACING_MS = 250

/** The old way, kept for the case where an archive could not be built. */
function saveSeparately(images: readonly GalleryImage[]): void {
    for (const [index, image] of images.entries()) {
        setTimeout(() => {
            save(image.url, downloadName(image))
        }, index * SPACING_MS)
    }
}

/**
 * Ids are unique, but the eight characters of them a name carries need not be,
 * and two entries under one name is a broken archive.
 */
function entryName(image: GalleryImage, taken: Set<string>): string {
    const stem = stemOf(image)
    const extension = mediaExtension(image.mediaType, image.kind)
    let name = `${stem}.${extension}`

    for (let copy = 2; taken.has(name); copy++) {
        name = `${stem}-${copy}.${extension}`
    }

    taken.add(name)

    return name
}

/** The stored blobs behind the tiles, back off their object URLs. */
async function archiveFiles(images: readonly GalleryImage[]): Promise<readonly ZipFile[]> {
    const taken = new Set<string>()

    return await Promise.all(
        images.map(async (image) => ({
            name: entryName(image, taken),
            blob: await (await fetch(image.url)).blob(),
        })),
    )
}

/**
 * Long enough for the shell to have taken the archive off the URL. Revoking
 * any sooner risks pulling it out from under a download still starting up.
 */
const REVOKE_AFTER_MS = 60_000

export async function downloadImages(images: readonly GalleryImage[]): Promise<void> {
    const [only] = images

    if (only === undefined) {
        return
    }

    if (images.length === 1) {
        save(only.url, downloadName(only))

        return
    }

    try {
        const archive = await zipStored(await archiveFiles(images), new Date())
        const url = URL.createObjectURL(archive)

        save(url, ARCHIVE_NAME)
        setTimeout(() => {
            URL.revokeObjectURL(url)
        }, REVOKE_AFTER_MS)
    } catch {
        // Whatever went wrong reading or packing them, the creations
        // themselves are still there to be saved one by one.
        saveSeparately(images)
    }
}
