import { useEffect, useRef } from 'react'

/**
 * Keyboard shortcuts, declared where the state they drive lives: the navigation
 * bindings sit in the shell, the composer's in the composer, the gallery's in
 * the gallery. A binding can then never outlive the control it stands in for,
 * which is what the settings reference promises.
 */

export interface Shortcut {
    /** The `KeyboardEvent.key` to match, compared case-insensitively. */
    readonly key: string
    /** ⌘ on macOS, Ctrl elsewhere. The two count as the same modifier. */
    readonly meta?: boolean
    readonly shift?: boolean
    /**
     * Whether the binding still fires while a field has focus. Off by default,
     * so a bare key types rather than firing. Modified bindings turn it on:
     * ⌘1 means "go to Create" even mid-prompt.
     */
    readonly whileTyping?: boolean
}

/** True when the key went to somewhere the user is entering text. */
function isTypingTarget(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
    )
}

/**
 * Whether this key press is the shortcut. Every modifier is checked in both
 * directions, so ⌘1 does not also answer to ⌥⌘1, and a held key repeats
 * nothing — a shortcut is one action per press.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
    if (event.repeat || event.altKey) {
        return false
    }

    if ((event.metaKey || event.ctrlKey) !== (shortcut.meta === true)) {
        return false
    }

    if (event.shiftKey !== (shortcut.shift === true)) {
        return false
    }

    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
        return false
    }

    return shortcut.whileTyping === true || !isTypingTarget(event.target)
}

/**
 * Runs `handler` when the shortcut is pressed anywhere in the app.
 *
 * `shortcut` is expected to be a module-level constant: the listener is bound
 * to its identity, and an object rebuilt every render would resubscribe on
 * every render. The handler itself is read through a ref, so it can close over
 * whatever it likes without that mattering.
 */
export function useShortcut(shortcut: Shortcut, handler: () => void, enabled = true): void {
    const handlerRef = useRef(handler)

    useEffect(() => {
        handlerRef.current = handler
    })

    useEffect(() => {
        if (!enabled) {
            return
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (!matchesShortcut(event, shortcut)) {
                return
            }

            // Claimed before the browser acts on it: ⌘⌫ is Back in a plain
            // browser window, and `/` opens quick-find in some builds.
            event.preventDefault()
            handlerRef.current()
        }

        window.addEventListener('keydown', onKeyDown)

        return () => {
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [enabled, shortcut])
}
