import { X } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '../../components/ui/button'
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
            <Button
                aria-label={`Remove ${image.name}`}
                className="absolute -top-1.5 -right-1.5 size-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [&_svg]:size-3"
                onClick={remove}
                size="icon-sm"
                variant="overlay"
            >
                <X aria-hidden />
            </Button>
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
