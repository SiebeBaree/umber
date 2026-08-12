import { X } from 'lucide-react'
import { useCallback } from 'react'

import type { ReferenceImage } from './use-reference-images'

interface ReferenceImageTileProps {
    readonly image: ReferenceImage
    readonly onRemove: (id: string) => void
}

function ReferenceImageTile({ image, onRemove }: ReferenceImageTileProps) {
    const remove = useCallback(() => {
        onRemove(image.id)
    }, [image.id, onRemove])

    return (
        <li className="group relative">
            {/* The wrapper clips, so a file the browser cannot decode leaves an
                empty tile rather than spilling its alt text across the composer. */}
            <span className="block size-16 overflow-hidden rounded-xl border border-line/80 bg-surface shadow-[0_2px_8px_-4px_var(--umber-glass-shadow)]">
                <img alt={image.name} className="size-full object-cover" src={image.previewUrl} />
            </span>
            <button
                aria-label={`Remove ${image.name}`}
                className="absolute -top-1.5 -right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-ink text-canvas opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={remove}
                type="button"
            >
                <X aria-hidden className="size-3" />
            </button>
        </li>
    )
}

export interface ReferenceImageStripProps {
    readonly images: readonly ReferenceImage[]
    readonly onRemove: (id: string) => void
}

/** The thumbnails of the images attached to the current prompt. */
export function ReferenceImageStrip({ images, onRemove }: ReferenceImageStripProps) {
    return (
        <ul aria-label="Reference images" className="flex flex-wrap gap-2 px-3 pt-1 pb-3">
            {images.map((image) => (
                <ReferenceImageTile image={image} key={image.id} onRemove={onRemove} />
            ))}
        </ul>
    )
}
