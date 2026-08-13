import { Download, Play, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { ratioToCss, type AspectRatio } from '../create/catalog'

/**
 * A stored creation as the gallery renders it: enough to draw the tile, and
 * everything the detail view puts on the record — how it was made, and when.
 */
export interface GalleryImage {
    readonly id: string
    /** What the tile holds; videos preview on hover and open as a player. */
    readonly kind: 'image' | 'video'
    readonly prompt: string
    readonly ratio: AspectRatio
    readonly providerId: string
    readonly modelName: string
    /** Absent on rows stored before these were recorded. */
    readonly resolution?: string | undefined
    readonly quality?: string | undefined
    /** Clip length in seconds; only videos carry one. */
    readonly durationSeconds?: number | undefined
    /** Epoch milliseconds. */
    readonly createdAt: number
    /** An object URL over the stored blob, owned by the page that loaded it. */
    readonly url: string
}

/** `8` → `0:08`, matching the player's clock. */
function formatDuration(seconds: number): string {
    const whole = Math.max(0, Math.round(seconds))
    const remainder = whole % 60

    return `${Math.floor(whole / 60)}:${remainder < 10 ? '0' : ''}${remainder}`
}

export interface GalleryTileProps {
    readonly image: GalleryImage
    readonly onDelete: (id: string) => void
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
    readonly onDelete: (id: string) => void
}) {
    const remove = useCallback(() => {
        onDelete(image.id)
    }, [image.id, onDelete])

    return (
        <span className="pointer-events-none absolute top-2.5 right-2.5 flex translate-y-1 gap-1.5 opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100">
            <Tooltip label="Download">
                <Button
                    aria-label={`Download “${image.prompt}”`}
                    asChild
                    size="icon-sm"
                    variant="overlay"
                >
                    <a
                        download={`umber-${image.id.slice(0, 8)}.${image.kind === 'video' ? 'mp4' : 'png'}`}
                        href={image.url}
                    >
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
const MEDIA_CLASSES =
    'block w-full rounded-2xl bg-surface/40 object-cover shadow-[0_3px_12px_-4px_var(--umber-glass-shadow),0_2px_6px_-3px_var(--umber-glass-shadow)] inset-ring inset-ring-ink/10 transition-[translate,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_32px_-12px_var(--umber-glass-shadow),0_8px_20px_-8px_var(--umber-glass-shadow),0_3px_8px_-3px_var(--umber-glass-shadow)]'

/** The clip badge: says "video" at a glance, and how long, without playing. */
function DurationBadge({ image }: { readonly image: GalleryImage }) {
    return (
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-medium text-ink/80 shadow-[0_4px_12px_-4px_var(--umber-glass-shadow)] backdrop-blur-md tabular-nums">
            <Play aria-hidden className="size-3" />
            {formatDuration(image.durationSeconds ?? 0)}
        </span>
    )
}

/** A refused preview `play()` just leaves the still frame showing. */
const stayStill = () => {
    // Nothing to do; the first frame is already the preview.
}

/** A muted first-frame still that plays silently while hovered. */
function TileVideo({ image, style }: { readonly image: GalleryImage; readonly style: object }) {
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const preview = useCallback(() => {
        videoRef.current?.play().catch(stayStill)
    }, [])

    const rest = useCallback(() => {
        const video = videoRef.current

        if (video !== null) {
            video.pause()
            video.currentTime = 0
        }
    }, [])

    return (
        <video
            aria-label={image.prompt}
            className={MEDIA_CLASSES}
            loop
            muted
            onMouseEnter={preview}
            onMouseLeave={rest}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={image.url}
            style={style}
        />
    )
}

export function GalleryTile({ image, onDelete, onOpen }: GalleryTileProps) {
    const style = useMemo(() => ({ aspectRatio: ratioToCss(image.ratio) }), [image.ratio])

    const open = useCallback(() => {
        onOpen(image.id)
    }, [image.id, onOpen])

    return (
        <div className="group relative">
            {/* A button rather than a click handler on the media: opening the
                piece is an action, and this way it is reachable by keyboard
                and announced as one. */}
            <button
                className="block w-full cursor-pointer rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={open}
                type="button"
            >
                {image.kind === 'video' ? (
                    <TileVideo image={image} style={style} />
                ) : (
                    <img
                        alt={image.prompt}
                        className={MEDIA_CLASSES}
                        decoding="async"
                        draggable={false}
                        loading="lazy"
                        src={image.url}
                        style={style}
                    />
                )}
            </button>

            {image.kind === 'video' ? <DurationBadge image={image} /> : null}

            <TileControls image={image} onDelete={onDelete} />
        </div>
    )
}
