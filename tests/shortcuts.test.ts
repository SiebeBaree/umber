import { expect, test } from 'vitest'

// Reached by path rather than through `@umber/ui`: the matcher is an internal
// of the shortcut hook, and unit-testing it should not force it into the
// package's public surface.
import { matchesShortcut, type Shortcut } from '../packages/ui/src/lib/use-shortcut'

const GO_TO_GALLERY: Shortcut = { key: '2', meta: true, whileTyping: true }
const FOCUS_PROMPT: Shortcut = { key: '/' }
const SWITCH_MODE: Shortcut = { key: 'm', meta: true, shift: true, whileTyping: true }

function press(init: KeyboardEventInit, target?: HTMLElement): KeyboardEvent {
    const event = new KeyboardEvent('keydown', init)

    if (target !== undefined) {
        // The target is read-only on a constructed event, so it only exists
        // once the event is actually dispatched at an element.
        document.body.append(target)
        target.dispatchEvent(event)
        target.remove()
    }

    return event
}

test('a shortcut matches its own key and modifier', () => {
    expect(matchesShortcut(press({ key: '2', metaKey: true }), GO_TO_GALLERY)).toBe(true)
    expect(matchesShortcut(press({ key: '2', ctrlKey: true }), GO_TO_GALLERY)).toBe(true)
})

test('a missing or extra modifier is not the shortcut', () => {
    expect(matchesShortcut(press({ key: '2' }), GO_TO_GALLERY)).toBe(false)
    expect(matchesShortcut(press({ key: '2', metaKey: true, altKey: true }), GO_TO_GALLERY)).toBe(
        false,
    )
    expect(matchesShortcut(press({ key: '2', metaKey: true, shiftKey: true }), GO_TO_GALLERY)).toBe(
        false,
    )
})

test('⌘⇧M matches the uppercase key shift produces', () => {
    expect(matchesShortcut(press({ key: 'M', metaKey: true, shiftKey: true }), SWITCH_MODE)).toBe(
        true,
    )
})

test('a held key repeats nothing', () => {
    expect(matchesShortcut(press({ key: '2', metaKey: true, repeat: true }), GO_TO_GALLERY)).toBe(
        false,
    )
})

test('a bare key stays out of the way while typing', () => {
    const field = document.createElement('textarea')

    expect(matchesShortcut(press({ key: '/', bubbles: true }, field), FOCUS_PROMPT)).toBe(false)
    expect(matchesShortcut(press({ key: '/', bubbles: true }), FOCUS_PROMPT)).toBe(true)
})

test('a modified shortcut still fires from inside a field', () => {
    const field = document.createElement('input')

    expect(
        matchesShortcut(press({ key: '2', metaKey: true, bubbles: true }, field), GO_TO_GALLERY),
    ).toBe(true)
})
