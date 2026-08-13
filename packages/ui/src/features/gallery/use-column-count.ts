import { useLayoutEffect, useState } from 'react'

/**
 * The design rule the column count expresses: a tile never renders narrower
 * than this. Everything else — how many columns that allows — is derived from
 * the measured grid width.
 */
const MIN_TILE_WIDTH = 256

/** Must match the `gap-4` between the page's columns. */
const COLUMN_GAP = 16

/** Where the layout settles when nothing can be measured (jsdom in tests). */
const FALLBACK_COLUMNS = 2

function columnsFor(width: number): number {
    // Each column costs its width plus one gap, except the last — hence the
    // gap added back onto the container before dividing.
    return Math.max(Math.floor((width + COLUMN_GAP) / (MIN_TILE_WIDTH + COLUMN_GAP)), 1)
}

/**
 * How many masonry columns fit, measured off the grid container itself:
 * attach the returned ref to the grid element.
 *
 * The count is `null` until the first measurement, which lands before paint.
 * Callers must render nothing into the grid for that one frame — mounting
 * tiles into a guessed layout and reshuffling them a beat later would double-
 * mount every tile, which is invisible to the eye but breaks anything keyed
 * to a tile's first mount (the entrance stagger learned this the hard way).
 *
 * Measuring the container rather than matching viewport breakpoints means the
 * page's own chrome — its max-width cap, its padding, any future sidebar — is
 * priced in automatically instead of being duplicated here as magic viewport
 * widths that silently go stale when the layout changes.
 */
export function useColumnCount(): readonly [(node: HTMLElement | null) => void, number | null] {
    const [container, setContainer] = useState<HTMLElement | null>(null)
    const [count, setCount] = useState<number | null>(null)

    // A layout effect so the first measurement lands before paint — the grid
    // never flashes empty on arrival.
    useLayoutEffect(() => {
        if (container === null) {
            return
        }

        // jsdom has no ResizeObserver; tests settle on the fixed fallback.
        if (typeof ResizeObserver !== 'function') {
            setCount(FALLBACK_COLUMNS)
            return
        }

        const measure = () => {
            setCount(columnsFor(container.clientWidth))
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(container)

        return () => {
            observer.disconnect()
        }
    }, [container])

    return [setContainer, count]
}
