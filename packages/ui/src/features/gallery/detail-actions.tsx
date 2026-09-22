import { Download, Trash2 } from 'lucide-react'
import { useCallback, type MouseEvent } from 'react'

import { Button } from '../../components/ui/button'
import { mediaExtension } from '../../lib/media'
import type { DeleteRequest } from './gallery-tile'
import type { ImageDetails } from './image-detail-dialog'

/**
 * The two things one can do with a creation from here.
 *
 * Deleting does not close the panel: the request may still be waiting on a
 * confirmation, and this view is where that question belongs. Whoever owns the
 * deletion takes the view down with the picture once it actually goes.
 */
export function DetailActions({
    image,
    onDelete,
}: {
    readonly image: ImageDetails
    readonly onDelete?: DeleteRequest | undefined
}) {
    const remove = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            onDelete?.([image.id], event.shiftKey)
        },
        [image.id, onDelete],
    )

    return (
        <div className="mt-5 flex shrink-0 flex-wrap gap-2">
            <Button asChild size="sm">
                <a
                    download={`umber-${image.id.slice(0, 8)}.${mediaExtension(image.mediaType, image.kind)}`}
                    href={image.url}
                >
                    <Download aria-hidden />
                    Download
                </a>
            </Button>
            {onDelete === undefined ? null : (
                <Button className="hover:text-rose-600" onClick={remove} size="sm" variant="glass">
                    <Trash2 aria-hidden />
                    Delete
                </Button>
            )}
        </div>
    )
}
