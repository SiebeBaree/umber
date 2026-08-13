import { Download } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { ratioToCss } from '../create/catalog'
import type { GalleryItem } from './gallery-items'

/**
 * A 1×1 transparent SVG. The tile is a real `<img>` — carrying the prompt as
 * its alt text — but the picture itself is still a CSS gradient painted behind
 * this stand-in src. When generations land on disk, the file's path replaces
 * the src and the gradient goes; nothing else about the tile changes.
 */
const PLACEHOLDER_SRC =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E"

export interface GalleryTileProps {
    readonly item: GalleryItem
}

/**
 * One creation in the masonry: the picture, and a download control that only
 * surfaces while the tile is hovered or the control itself holds keyboard
 * focus. Saving is wired up together with real files; until then the button is
 * the affordance without the action.
 *
 * The picture's edge is an inset hairline rather than a border: a border sits
 * outside the background and lets it shine through the translucent stroke,
 * which reads as a blurry fringe against the image colours. Shadow depth comes
 * from layering the shared `--umber-glass-shadow` token, the same way the
 * `glass-*` utilities build theirs, so a palette swap carries the gallery too.
 */
export function GalleryTile({ item }: GalleryTileProps) {
    const style = useMemo(
        () => ({
            aspectRatio: ratioToCss(item.ratio),
            backgroundImage: item.gradient,
        }),
        [item.gradient, item.ratio],
    )

    return (
        <div className="group relative">
            <img
                alt={item.prompt}
                className="block w-full rounded-2xl shadow-[0_3px_12px_-4px_var(--umber-glass-shadow),0_2px_6px_-3px_var(--umber-glass-shadow)] inset-ring inset-ring-ink/10 transition-[translate,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_32px_-12px_var(--umber-glass-shadow),0_8px_20px_-8px_var(--umber-glass-shadow),0_3px_8px_-3px_var(--umber-glass-shadow)]"
                decoding="async"
                draggable={false}
                loading="lazy"
                src={PLACEHOLDER_SRC}
                style={style}
            />

            {/* The reveal lives on this wrapper so the button keeps its own
                hover/press transitions untouched. `pointer-events` gates
                clicks while hidden, but tabbing still reaches the button —
                `has-[:focus-visible]` brings it into view for exactly that
                case. */}
            <span className="pointer-events-none absolute top-2.5 right-2.5 translate-y-1 opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100">
                <Tooltip label="Download">
                    <Button
                        aria-label={`Download “${item.prompt}”`}
                        size="icon-sm"
                        variant="overlay"
                    >
                        <Download aria-hidden />
                    </Button>
                </Tooltip>
            </span>
        </div>
    )
}
