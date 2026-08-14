import { mediaExtension } from '../../lib/media'
import type { GalleryImage } from './gallery-tile'

/**
 * Saving creations to disk. The single-file case is an `<a download>` in the
 * tile; this covers the dock's "download the selection", which has no anchor
 * of its own to click.
 */

/** The same name the tile's own download link uses. */
function downloadName(image: GalleryImage): string {
    return `umber-${image.id.slice(0, 8)}.${mediaExtension(image.mediaType, image.kind)}`
}

function save(image: GalleryImage) {
    const anchor = document.createElement('a')
    anchor.href = image.url
    anchor.download = downloadName(image)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
}

/**
 * A breath between files: fired back to back, the shell can coalesce or drop
 * downloads, and a beat apart they land as the separate saves they are.
 */
const SPACING_MS = 250

export function downloadImages(images: readonly GalleryImage[]): void {
    for (const [index, image] of images.entries()) {
        setTimeout(() => {
            save(image)
        }, index * SPACING_MS)
    }
}
