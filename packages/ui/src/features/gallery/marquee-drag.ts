import type { MutableRefObject, PointerEvent as ReactPointerEvent, RefObject } from 'react'

import { scrollParentOf } from '../../lib/scroll-parent'

/**
 * The mechanics under the marquee: what a held button does to the rectangle,
 * which tiles that rectangle covers, and how the wall moves when the pointer
 * reaches the edge of the page. Kept out of the hook so the rectangle's
 * arithmetic stays readable on its own.
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

/** The band along each edge of the page that pulls the wall while swept into. */
const EDGE_ZONE_PX = 72

/** How hard the very edge pulls, in pixels a second. */
const MAX_EDGE_SPEED = 1400

export interface DragState {
    /** The selection as it stood when the press landed; every sweep re-derives from this. */
    readonly base: ReadonlySet<string>
    readonly startX: number
    readonly startY: number
    /** What scrolls under the sweep — the shell's `main` — or null if nothing does. */
    readonly scroller: HTMLElement | null
    /** How far it had scrolled when the press landed, so the anchor can follow it. */
    readonly startScrollTop: number
    lastX: number
    lastY: number
    /** True once the pointer has travelled past the click threshold. */
    active: boolean
}

/**
 * The rectangle from the press to wherever the pointer has got to. The press
 * is pinned to the wall rather than to the window: scrolling mid-sweep slides
 * the anchor along with the tiles, so the rectangle goes on covering
 * everything swept since the press instead of shedding whatever scrolled off.
 */
export function rectBetween(drag: DragState): MarqueeRect {
    const scrolled = (drag.scroller?.scrollTop ?? 0) - drag.startScrollTop
    const startY = drag.startY - scrolled

    return {
        left: Math.min(drag.startX, drag.lastX),
        top: Math.min(startY, drag.lastY),
        width: Math.abs(drag.lastX - drag.startX),
        height: Math.abs(drag.lastY - startY),
    }
}

/**
 * The rectangle as it should be drawn: the one that does the hit-testing,
 * cropped to the scrolling region. A sweep that has pulled the wall a long way
 * reaches far above the window, and painting all of it would put the marquee
 * over the header.
 */
export function visibleRect(rect: MarqueeRect, scroller: HTMLElement | null): MarqueeRect {
    if (scroller === null) {
        return rect
    }

    const box = scroller.getBoundingClientRect()
    const top = Math.max(rect.top, box.top)
    const height = Math.max(Math.min(rect.top + rect.height, box.bottom) - top, 0)

    return { ...rect, top, height }
}

/**
 * How fast the wall should slide, given where the pointer is holding. Nothing
 * anywhere but the bands along the top and bottom of the scroller; from the
 * inner lip of a band to its edge the pull ramps up, so nudging in creeps and
 * pinning the pointer to the edge runs. Past the edge it stays at full speed.
 */
export function edgeScrollSpeed(
    box: { readonly top: number; readonly bottom: number },
    pointerY: number,
): number {
    const above = box.top + EDGE_ZONE_PX - pointerY
    const below = pointerY - (box.bottom - EDGE_ZONE_PX)

    if (above > 0) {
        return -MAX_EDGE_SPEED * Math.min(above / EDGE_ZONE_PX, 1)
    }

    if (below > 0) {
        return MAX_EDGE_SPEED * Math.min(below / EDGE_ZONE_PX, 1)
    }

    return 0
}

/** Every creation whose tile the rectangle touches, straight off the DOM —
 * the tiles already carry their ids for the ⌘⌫ focus walk. */
export function coveredIds(container: HTMLElement, rect: MarqueeRect): readonly string[] {
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

export interface DragContext {
    readonly dragRef: MutableRefObject<DragState | null>
    /** Recomputes the rectangle and the live selection from the drag state. */
    readonly sweep: () => void
    readonly clearRect: () => void
}

/**
 * The wall following a pointer held at the edge. This runs every frame for as
 * long as the button is down, scrolling by whatever speed the pointer's
 * position asks for — nothing at all while it stays in the middle of the page,
 * and nothing once the scroller has run out of wall to give. Sweeping after
 * each step keeps the selection level with what has just come into view.
 */
function followEdges({ dragRef, sweep }: DragContext): () => void {
    let frame = 0
    let previous = performance.now()

    const step = (now: number) => {
        const elapsed = now - previous
        previous = now
        frame = requestAnimationFrame(step)

        const drag = dragRef.current

        if (drag === null || !drag.active || drag.scroller === null) {
            return
        }

        const speed = edgeScrollSpeed(drag.scroller.getBoundingClientRect(), drag.lastY)

        if (speed === 0) {
            return
        }

        const before = drag.scroller.scrollTop
        drag.scroller.scrollTop = before + (speed * elapsed) / 1000

        if (drag.scroller.scrollTop !== before) {
            sweep()
        }
    }

    frame = requestAnimationFrame(step)

    return () => {
        cancelAnimationFrame(frame)
    }
}

/** Every move of a held pointer, which arms the sweep once it has travelled
 * far enough to have meant one. */
function dragMover({ dragRef, sweep }: DragContext): (move: PointerEvent) => void {
    return (move) => {
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
}

/**
 * The listeners that live only while a button is held: move grows the sweep,
 * scroll re-aims it (the rectangle is in viewport space, but the tiles under
 * it move), the edges pull the wall past the window, and release tears
 * everything down. Returns the teardown for the unmount-mid-drag case.
 */
function trackDrag(context: DragContext): () => void {
    const { clearRect, dragRef, sweep } = context
    const onMove = dragMover(context)
    const onScroll = () => {
        sweep()
    }
    const stopFollowing = followEdges(context)
    const cleanup = () => {
        stopFollowing()
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

export interface PressContext extends DragContext {
    readonly containerRef: RefObject<HTMLDivElement | null>
    readonly selectedRef: RefObject<ReadonlySet<string>>
    readonly stopRef: MutableRefObject<(() => void) | null>
}

/**
 * A press on the page, weighed and (maybe) armed. Mouse only — a touch drag
 * is how the page scrolls — and presses on anything marked `data-no-marquee`
 * (a tile's corner controls, the dock) stay clicks: a sweep from a button
 * helps nobody.
 */
export function beginDrag(event: ReactPointerEvent<HTMLDivElement>, context: PressContext): void {
    if (event.button !== 0 || event.pointerType !== 'mouse') {
        return
    }

    if (!(event.target instanceof Element) || event.target.closest('[data-no-marquee]') !== null) {
        return
    }

    const scroller = scrollParentOf(context.containerRef.current)

    context.dragRef.current = {
        base: context.selectedRef.current,
        startX: event.clientX,
        startY: event.clientY,
        scroller,
        startScrollTop: scroller?.scrollTop ?? 0,
        lastX: event.clientX,
        lastY: event.clientY,
        active: false,
    }
    context.stopRef.current?.()
    context.stopRef.current = trackDrag(context)
}
