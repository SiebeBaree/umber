import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'

// Reached by path rather than through `@umber/ui`: the guard is mounted by
// `App` and is not part of the package's public surface.
import { useDropGuard } from '../packages/ui/src/lib/drag-drop'

/**
 * A drop the page leaves unhandled falls through to the browser's default,
 * which is to navigate the window to whatever was let go of. In the desktop
 * shell that would take the window off the app document with the preload
 * bridge still attached, so the app has to refuse every drop it has no use for
 * — while leaving alone the one drop the browser handles harmlessly, text into
 * a field.
 */

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

function Guarded() {
    useDropGuard()

    return null
}

/** jsdom has no `DragEvent`, and the guard only reads these two fields. */
function dragEvent(type: 'dragover' | 'drop', types: readonly string[]): Event {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { types } })

    return event
}

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    act(() => {
        root.render(<Guarded />)
    })
})

afterEach(() => {
    act(() => {
        root.unmount()
    })
    container.remove()
})

test('a link dragged onto the app cannot navigate the window', () => {
    const over = dragEvent('dragover', ['text/uri-list', 'text/html'])
    window.dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)

    const drop = dragEvent('drop', ['text/uri-list', 'text/html'])
    window.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
})

test('a file dropped anywhere is refused by default', () => {
    const drop = dragEvent('drop', ['Files'])
    window.dispatchEvent(drop)

    expect(drop.defaultPrevented).toBe(true)
})

test('text still drops into a field', () => {
    const field = document.createElement('textarea')
    container.append(field)

    const drop = dragEvent('drop', ['text/plain'])
    field.dispatchEvent(drop)

    expect(drop.defaultPrevented).toBe(false)
})

test('a file dropped on a field is refused, because that navigates too', () => {
    const field = document.createElement('textarea')
    container.append(field)

    const drop = dragEvent('drop', ['Files'])
    field.dispatchEvent(drop)

    expect(drop.defaultPrevented).toBe(true)
})

test('the guard comes off when the app unmounts', () => {
    act(() => {
        root.unmount()
    })

    const drop = dragEvent('drop', ['text/uri-list'])
    window.dispatchEvent(drop)

    expect(drop.defaultPrevented).toBe(false)

    // `afterEach` unmounts again, which React allows.
    root = createRoot(document.createElement('div'))
})
