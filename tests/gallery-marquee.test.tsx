import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// Reached by path rather than through `@umber/ui`: the marquee is an internal
// of the gallery, not part of the package's public surface.
import { useMarquee } from '../packages/ui/src/features/gallery/marquee'

/**
 * The marquee sweeping past the bottom of the window: a wall of twenty tiles
 * inside a 600px scroller, with the geometry jsdom does not do stubbed in.
 * Holding the pointer in the bottom band has to pull the wall along and keep
 * selecting whatever it brings up, rather than stopping at the last tile that
 * happened to be on screen when the press landed.
 */

const TILE_COUNT = 20
const TILE_HEIGHT = 100
const VIEWPORT_HEIGHT = 600
const MAX_SCROLL = TILE_COUNT * TILE_HEIGHT - VIEWPORT_HEIGHT

const IDS = Array.from({ length: TILE_COUNT }, (_, index) => `tile-${index}`)

/** Only `overflowY` matters: it is what marks this the scrolling ancestor. */
const SCROLLER_STYLE = { overflowY: 'auto' } as const

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean
}

let selected: ReadonlySet<string> = new Set()
let frame: FrameRequestCallback | null = null
let clock = 0

function Harness() {
    const [ids, setIds] = useState<ReadonlySet<string>>(new Set())
    const marquee = useMarquee(ids, setIds)

    selected = ids

    return (
        <div data-testid="scroller" style={SCROLLER_STYLE}>
            <div onPointerDown={marquee.onPointerDown} ref={marquee.containerRef}>
                {IDS.map((id) => (
                    <div data-creation-id={id} key={id} />
                ))}
            </div>
        </div>
    )
}

/** Where a tile sits once the wall has scrolled `top` pixels past. */
function tileRect(index: number, scrolled: () => number): () => DOMRect {
    return () =>
        ({
            top: index * TILE_HEIGHT - scrolled(),
            bottom: (index + 1) * TILE_HEIGHT - scrolled(),
            left: 0,
            right: 300,
        }) as DOMRect
}

/** A scroller that actually scrolls, and tiles that move when it does. */
function stubGeometry(scroller: HTMLElement) {
    let top = 0

    Object.defineProperty(scroller, 'scrollTop', {
        get: () => top,
        set: (next: number) => {
            top = Math.max(0, Math.min(next, MAX_SCROLL))
        },
    })
    scroller.getBoundingClientRect = () =>
        ({ top: 0, bottom: VIEWPORT_HEIGHT, left: 0, right: 300 }) as DOMRect

    const tiles = scroller.querySelectorAll<HTMLElement>('[data-creation-id]')
    const scrolled = () => top

    for (const [index, tile] of [...tiles].entries()) {
        tile.getBoundingClientRect = tileRect(index, scrolled)
    }
}

function press(target: HTMLElement, x: number, y: number) {
    const event = new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: y,
    })

    Object.defineProperty(event, 'pointerType', { value: 'mouse' })
    act(() => {
        target.dispatchEvent(event)
    })

    // The frame clock starts where the press did, so the first frame's elapsed
    // time is a step forward rather than back.
    clock = performance.now()
}

function moveTo(x: number, y: number) {
    act(() => {
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
    })
}

function runFrames(count: number) {
    act(() => {
        for (let index = 0; index < count; index++) {
            const due = frame

            frame = null
            clock += 16
            due?.(clock)
        }
    })
}

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    clock = performance.now()
    frame = null
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frame = callback

        return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
        frame = null
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
    act(() => {
        window.dispatchEvent(new MouseEvent('pointerup'))
    })
})

function mount(): HTMLElement {
    const container = document.createElement('div')

    document.body.append(container)
    act(() => {
        createRoot(container).render(<Harness />)
    })

    const scroller = container.querySelector<HTMLElement>('[data-testid="scroller"]')

    if (scroller === null) {
        throw new Error('the harness never rendered')
    }

    stubGeometry(scroller)

    return scroller
}

test('a sweep held at the bottom pulls the wall along and goes on selecting', () => {
    const scroller = mount()
    const wall = scroller.firstElementChild as HTMLElement

    press(wall, 50, 10)
    moveTo(50, 40)

    // Only what the window can show, so far.
    expect(selected.size).toBeGreaterThan(0)
    expect(selected.has('tile-19')).toBe(false)

    moveTo(50, 590)
    runFrames(1)

    expect(scroller.scrollTop).toBeGreaterThan(0)

    runFrames(120)

    expect(scroller.scrollTop).toBe(MAX_SCROLL)
    expect(selected.size).toBe(TILE_COUNT)
})

test('the tiles swept past stay selected once they scroll out of sight', () => {
    const scroller = mount()
    const wall = scroller.firstElementChild as HTMLElement

    press(wall, 50, 10)
    moveTo(50, 40)
    moveTo(50, 590)
    runFrames(120)

    // The first tile is far above the window by now; the anchor went with it.
    expect(selected.has('tile-0')).toBe(true)
})

test('a sweep held in the middle of the page leaves the wall where it is', () => {
    const scroller = mount()
    const wall = scroller.firstElementChild as HTMLElement

    press(wall, 50, 10)
    moveTo(50, 300)
    runFrames(60)

    expect(scroller.scrollTop).toBe(0)
})

test('releasing stops the pull', () => {
    const scroller = mount()
    const wall = scroller.firstElementChild as HTMLElement

    press(wall, 50, 10)
    moveTo(50, 590)
    runFrames(2)

    const reached = scroller.scrollTop

    expect(reached).toBeGreaterThan(0)

    act(() => {
        window.dispatchEvent(new MouseEvent('pointerup'))
    })
    runFrames(30)

    expect(scroller.scrollTop).toBe(reached)
})
