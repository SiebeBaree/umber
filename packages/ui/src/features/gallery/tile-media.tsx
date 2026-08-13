import { useCallback, useRef, useState, type CSSProperties } from 'react'

import { cn } from '../../lib/cn'

/**
 * What a gallery tile paints: a stored picture, or a clip that previews on
 * hover. Both are held back until they have pixels to show, which is the one
 * thing they share and the reason they live together here.
 */

const MEDIA_CLASSES = cn(
    'block w-full rounded-2xl object-cover shadow-[0_3px_12px_-4px_var(--umber-glass-shadow),0_2px_6px_-3px_var(--umber-glass-shadow)] inset-ring inset-ring-ink/10',
    'transition-[translate,box-shadow,opacity] duration-200 ease-out',
    'group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_32px_-12px_var(--umber-glass-shadow),0_8px_20px_-8px_var(--umber-glass-shadow),0_3px_8px_-3px_var(--umber-glass-shadow)]',
)

/**
 * Holds a tile back until its pixels exist. Decoding a stored blob takes only
 * a few milliseconds, but that is a frame or two of empty tiles — a wall of
 * blank cards flashing up before the gallery appeared behind them.
 *
 * The ref covers the case where the media is ready before React attaches its
 * load handler, which is every tile the browser already has decoded: a resize
 * dealing it into another column, or the same picture opened and closed. An
 * image answers that with `complete`, a clip with a `readyState` that has at
 * least reached its metadata.
 */
function useMediaReady() {
    const [ready, setReady] = useState(false)

    const markReady = useCallback(() => {
        setReady(true)
    }, [])

    const attach = useCallback((node: HTMLImageElement | HTMLVideoElement | null) => {
        if (node === null) {
            return
        }

        const decoded =
            node instanceof HTMLVideoElement ? node.readyState >= node.HAVE_METADATA : node.complete

        if (decoded) {
            setReady(true)
        }
    }, [])

    return { attach, markReady, ready }
}

/** The class that reveals a tile once it has something to show. */
function mediaClasses(ready: boolean): string {
    return cn(MEDIA_CLASSES, ready ? 'opacity-100' : 'opacity-0')
}

export interface TileMediaProps {
    /** An object URL over the stored blob, owned by the page that loaded it. */
    readonly src: string
    /** The media's accessible name — in Umber, the prompt behind it. */
    readonly label: string
    readonly style: CSSProperties
}

/*
 * Nothing is drawn under the picture while it loads — no placeholder fill, no
 * ring, no shadow: an empty frame is more conspicuous than empty space, and
 * the tile holds its place either way through the aspect ratio.
 */
export function TileImage({ label, src, style }: TileMediaProps) {
    const { attach, markReady, ready } = useMediaReady()

    return (
        <img
            alt={label}
            className={mediaClasses(ready)}
            decoding="async"
            draggable={false}
            loading="lazy"
            onError={markReady}
            onLoad={markReady}
            ref={attach}
            src={src}
            style={style}
        />
    )
}

/** A refused preview `play()` just leaves the still frame showing. */
const stayStill = () => {
    // Nothing to do; the first frame is already the preview.
}

/**
 * A muted first frame that plays silently while hovered, and rewinds when the
 * pointer leaves — so a wall of clips reads as stills until you go looking.
 *
 * Readiness comes off `loadedmetadata` as well as `loadeddata`: with
 * `preload="metadata"` the browser may never fetch a full frame on its own,
 * and waiting only for one would leave the tile invisible for good.
 */
export function TileVideo({ label, src, style }: TileMediaProps) {
    const { attach, markReady, ready } = useMediaReady()
    const videoRef = useRef<HTMLVideoElement | null>(null)

    const bind = useCallback(
        (node: HTMLVideoElement | null) => {
            videoRef.current = node
            attach(node)
        },
        [attach],
    )

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
            aria-label={label}
            className={mediaClasses(ready)}
            loop
            muted
            onError={markReady}
            onLoadedData={markReady}
            onLoadedMetadata={markReady}
            onMouseEnter={preview}
            onMouseLeave={rest}
            playsInline
            preload="metadata"
            ref={bind}
            src={src}
            style={style}
        />
    )
}
