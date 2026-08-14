import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from 'react'

import { sweepSelection } from './selection'

/**
 * The marquee: press on the wall, drag, and a rectangle sweeps creations into
 * (or out of) the selection, applied live as it grows. A press only becomes a
 * sweep after a few pixels of travel, so ordinary clicks — open, toggle,
 * Shift-range — pass through untouched.
 */

/** Viewport-space rectangle of an in-progress sweep. */
export interface MarqueeRect {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
}

/** Travel before a press stops being a click. Clicks wobble a pixel or two. */
const DRAG_THRESHOLD_PX = 6

interface DragState {
    /** The selection as it stood when the press landed; every sweep re-derives from this. */
    readonly base: ReadonlySet<string>
    readonly startX: number
    readonly startY: number
    lastX: number
    lastY: number
    /** True once the pointer has travelled past the click threshold. */
    active: boolean
}

function rectBetween(drag: DragState): MarqueeRect {
    return {
        left: Math.min(drag.startX, drag.lastX),
        top: Math.min(drag.startY, drag.lastY),
        width: Math.abs(drag.lastX - drag.startX),
        height: Math.abs(drag.lastY - drag.startY),
    }
}

/** Every creation whose tile the rectangle touches, straight off the DOM —
 * the tiles already carry their ids for the ⌘⌫ focus walk. */
function coveredIds(container: HTMLElement, rect: MarqueeRect): readonly string[] {
    const ids: string[] = []

    for (const tile of container.querySelectorAll<HTMLElement>('[data-creation-id]')) {
        const box = tile.getBoundingClientRect()
        const hit =
            box.left < rect.left + rect.width &&
            box.right > rect.left &&
            box.top < rect.top + rect.height &&
            box.bottom > rect.top
        const id = tile.dataset['creationId']

        if (hit && id !== undefined) {
            ids.push(id)
        }
    }

    return ids
}

const suppress = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
}

/**
 * The click that fires as a finished sweep releases would also toggle (or
 * open) whatever tile the pointer happens to end on; eaten here, once. The
 * timeout clears the trap for the release paths that fire no click at all.
 */
function suppressNextClick() {
    window.addEventListener('click', suppress, { capture: true, once: true })
    setTimeout(() => {
        window.removeEventListener('click', suppress, { capture: true })
    }, 0)
}

interface DragContext {
    readonly dragRef: MutableRefObject<DragState | null>
    /** Recomputes the rectangle and the live selection from the drag state. */
    readonly sweep: () => void
    readonly clearRect: () => void
}

/**
 * The listeners that live only while a button is held: move grows the sweep,
 * scroll re-aims it (the rectangle is in viewport space, but the tiles under
 * it move), and release tears everything down. Returns the teardown for the
 * unmount-mid-drag case.
 */
function trackDrag({ clearRect, dragRef, sweep }: DragContext): () => void {
    const onMove = (move: PointerEvent) => {
        const drag = dragRef.current

        if (drag === null) {
            return
        }

        drag.lastX = move.clientX
        drag.lastY = move.clientY

        if (!drag.active) {
            if (
                Math.hypot(move.clientX - drag.startX, move.clientY - drag.startY) <
                DRAG_THRESHOLD_PX
            ) {
                return
            }

            drag.active = true
        }

        sweep()
    }
    const onScroll = () => {
        sweep()
    }
    const cleanup = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('scroll', onScroll, { capture: true })
    }
    const end = () => {
        if (dragRef.current?.active === true) {
            suppressNextClick()
        }

        dragRef.current = null
        clearRect()
        cleanup()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('scroll', onScroll, { capture: true })

    return cleanup
}

interface PressContext extends DragContext {
    readonly selectedRef: RefObject<ReadonlySet<string>>
    readonly stopRef: MutableRefObject<(() => void) | null>
}

/**
 * A press on the page, weighed and (maybe) armed. Mouse only — a touch drag
 * is how the page scrolls — and presses on anything marked `data-no-marquee`
 * (a tile's corner controls, the dock) stay clicks: a sweep from a button
 * helps nobody.
 */
function beginDrag(event: ReactPointerEvent<HTMLDivElement>, context: PressContext): void {
    if (event.button !== 0 || event.pointerType !== 'mouse') {
        return
    }

    if (!(event.target instanceof Element) || event.target.closest('[data-no-marquee]') !== null) {
        return
    }

    context.dragRef.current = {
        base: context.selectedRef.current,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        active: false,
    }
    context.stopRef.current?.()
    context.stopRef.current = trackDrag(context)
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

    // A ref, so a press can snapshot the selection without rebinding handlers.
    const selectedRef = useRef(selected)

    useEffect(() => {
        selectedRef.current = selected
    })

    const sweep = useCallback(() => {
        const drag = dragRef.current
        const container = containerRef.current

        if (drag === null || !drag.active || container === null) {
            return
        }

        const nextRect = rectBetween(drag)
        setRect(nextRect)
        replace(sweepSelection(drag.base, coveredIds(container, nextRect)))
    }, [replace])

    const clearRect = useCallback(() => {
        setRect(null)
    }, [])

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            beginDrag(event, { clearRect, dragRef, selectedRef, stopRef, sweep })
        },
        [clearRect, sweep],
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
