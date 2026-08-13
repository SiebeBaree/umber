import { Download, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState, type MouseEvent } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { cn } from '../../lib/cn'
import { ratioToCss, type AspectRatio } from '../create/catalog'

/**
 * A stored creation as the gallery renders it: enough to draw the tile, and
 * everything the detail view puts on the record — how it was made, and when.
 */
export interface GalleryImage {
    readonly id: string
    readonly prompt: string
    readonly ratio: AspectRatio
    readonly providerId: string
    readonly modelName: string
    /** Absent on rows stored before these were recorded. */
    readonly resolution?: string | undefined
    readonly quality?: string | undefined
    /** Epoch milliseconds. */
    readonly createdAt: number
    /** An object URL over the stored blob, owned by the page that loaded it. */
    readonly url: string
}

/**
 * Asks for a creation to be deleted. `immediate` carries whether the click
 * held Shift, which the gallery reads as "don't ask me" — the way past the
 * confirmation for someone clearing out several pictures in a row.
 */
export type DeleteRequest = (id: string, immediate: boolean) => void

export interface GalleryTileProps {
    readonly image: GalleryImage
    readonly onDelete: DeleteRequest
    readonly onOpen: (id: string) => void
}

/**
 * The controls over the picture, revealed on hover.
 *
 * The reveal lives on the wrapper so each button keeps its own hover/press
 * transitions untouched. `pointer-events` gates clicks while hidden, but
 * tabbing still reaches the buttons — `has-[:focus-visible]` brings them into
 * view for exactly that case.
 */
function TileControls({
    image,
    onDelete,
}: {
    readonly image: GalleryImage
    readonly onDelete: DeleteRequest
}) {
    const remove = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            onDelete(image.id, event.shiftKey)
        },
        [image.id, onDelete],
    )

    return (
        <span className="pointer-events-none absolute top-2.5 right-2.5 flex translate-y-1 gap-1.5 opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100">
            <Tooltip label="Download">
                <Button
                    aria-label={`Download “${image.prompt}”`}
                    asChild
                    size="icon-sm"
                    variant="overlay"
                >
                    <a download={`umber-${image.id.slice(0, 8)}.png`} href={image.url}>
                        <Download aria-hidden />
                    </a>
                </Button>
            </Tooltip>

            {/* Deleting is the one control here that cannot be undone, so it
                reddens under the pointer rather than looking like its harmless
                neighbour right up to the click. */}
            <Tooltip label="Delete">
                <Button
                    aria-label={`Delete “${image.prompt}”`}
                    className="hover:text-rose-600"
                    onClick={remove}
                    size="icon-sm"
                    variant="overlay"
                >
                    <Trash2 aria-hidden />
                </Button>
            </Tooltip>
        </span>
    )
}

const IMAGE_CLASSES = cn(
    'block w-full rounded-2xl object-cover shadow-[0_3px_12px_-4px_var(--umber-glass-shadow),0_2px_6px_-3px_var(--umber-glass-shadow)] inset-ring inset-ring-ink/10',
    'transition-[translate,box-shadow,opacity] duration-200 ease-out',
    'group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_32px_-12px_var(--umber-glass-shadow),0_8px_20px_-8px_var(--umber-glass-shadow),0_3px_8px_-3px_var(--umber-glass-shadow)]',
)

/**
 * Holds a picture back until its pixels exist. Decoding a stored blob takes
 * only a few milliseconds, but that is a frame or two of empty tiles — a wall
 * of blank cards flashing up before the gallery appeared behind them.
 *
 * The ref covers the case where the image is ready before React attaches
 * `onLoad`, which is every tile the browser already has decoded: a resize
 * dealing it into another column, or the same picture opened and closed.
 */
function useImageReady() {
    const [ready, setReady] = useState(false)

    const markReady = useCallback(() => {
        setReady(true)
    }, [])

    const attach = useCallback((node: HTMLImageElement | null) => {
        if (node?.complete === true) {
            setReady(true)
        }
    }, [])

    return { attach, markReady, ready }
}

/**
 * One creation in the masonry: the picture, which opens full size, and the
 * controls that surface while the tile is hovered or one of them holds
 * keyboard focus. The prompt doubles as the image's accessible name — it is
 * the only description of the picture that exists.
 *
 * The picture's edge is an inset hairline rather than a border: a border sits
 * outside the background and lets it shine through the translucent stroke,
 * which reads as a blurry fringe against the image colours. Shadow depth comes
 * from layering the shared `--umber-glass-shadow` token, the same way the
 * `glass-*` utilities build theirs, so a palette swap carries the gallery too.
 */
export function GalleryTile({ image, onDelete, onOpen }: GalleryTileProps) {
    const style = useMemo(() => ({ aspectRatio: ratioToCss(image.ratio) }), [image.ratio])
    const { attach, markReady, ready } = useImageReady()

    const open = useCallback(() => {
        onOpen(image.id)
    }, [image.id, onOpen])

    return (
        <div className="group relative">
            {/* A button rather than a click handler on the image: opening the
                picture is an action, and this way it is reachable by keyboard
                and announced as one. */}
            <button
                className="block w-full cursor-pointer rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={open}
                type="button"
            >
                {/* Nothing is drawn under the picture while it loads — no
                    placeholder fill, no ring, no shadow: an empty frame is
                    more conspicuous than empty space, and the tile holds its
                    place either way through the aspect ratio. */}
                <img
                    alt={image.prompt}
                    className={cn(IMAGE_CLASSES, ready ? 'opacity-100' : 'opacity-0')}
                    decoding="async"
                    draggable={false}
                    loading="lazy"
                    onError={markReady}
                    onLoad={markReady}
                    ref={attach}
                    src={image.url}
                    style={style}
                />
            </button>

            <TileControls image={image} onDelete={onDelete} />
        </div>
    )
}
