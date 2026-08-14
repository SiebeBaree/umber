import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from 'react'

import {
    beginDrag,
    coveredIds,
    rectBetween,
    visibleRect,
    type DragState,
    type MarqueeRect,
} from './marquee-drag'
import { sweepSelection } from './selection'

/**
 * The marquee: press on the wall, drag, and a rectangle sweeps creations into
 * (or out of) the selection, applied live as it grows. A press only becomes a
 * sweep after a few pixels of travel, so ordinary clicks — open, toggle,
 * Shift-range — pass through untouched. Holding the pointer at the top or
 * bottom of the page pulls the wall along, so a sweep can reach further than
 * the window without letting go.
 */

export type { MarqueeRect } from './marquee-drag'

/** A value kept in a ref, so a press can read the latest one without every
 * handler being rebound each time it changes. */
function useLatest<T>(value: T): RefObject<T> {
    const ref = useRef(value)

    useEffect(() => {
        ref.current = value
    })

    return ref
}

export interface Marquee {
    /** The rectangle to draw, or null while no sweep is underway. */
    readonly rect: MarqueeRect | null
    /** Goes on the surface a sweep can start from — the whole page. */
    readonly containerRef: RefObject<HTMLDivElement | null>
    readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
}

export function useMarquee(
    selected: ReadonlySet<string>,
    replace: (ids: ReadonlySet<string>) => void,
): Marquee {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [rect, setRect] = useState<MarqueeRect | null>(null)
    const dragRef = useRef<DragState | null>(null)
    const stopRef = useRef<(() => void) | null>(null)

    const selectedRef = useLatest(selected)

    // The rectangle that hit-tests is the whole sweep, including whatever of
    // it has been scrolled out of sight; only the drawn one is cropped.
    const sweep = useCallback(() => {
        const drag = dragRef.current
        const container = containerRef.current

        if (drag === null || !drag.active || container === null) {
            return
        }

        const nextRect = rectBetween(drag)
        setRect(visibleRect(nextRect, drag.scroller))
        replace(sweepSelection(drag.base, coveredIds(container, nextRect)))
    }, [replace])

    const clearRect = useCallback(() => {
        setRect(null)
    }, [])

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            beginDrag(event, { clearRect, containerRef, dragRef, selectedRef, stopRef, sweep })
        },
        [clearRect, selectedRef, sweep],
    )

    // Never leave window listeners behind when the gallery unmounts mid-drag.
    useEffect(
        () => () => {
            stopRef.current?.()
        },
        [],
    )

    return { rect, containerRef, onPointerDown }
}

/** The sweep made visible: an accent-tinted pane under the floating layers. */
export function MarqueeOverlay({ rect }: { readonly rect: MarqueeRect | null }) {
    const style = useMemo(
        () =>
            rect === null
                ? undefined
                : { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        [rect],
    )

    if (rect === null) {
        return null
    }

    return (
        <div
            aria-hidden
            className="pointer-events-none fixed z-30 rounded-lg border border-accent/50 bg-accent/10"
            style={style}
        />
    )
}
