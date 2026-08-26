import { useSyncExternalStore } from 'react'

/**
 * Whether Umber is the window being looked at: on screen, and in front.
 *
 * Chromium stops painting a window it considers hidden, but one that is merely
 * behind another app keeps every animation running at full rate. Umber leans on
 * continuous motion — drifting blobs read through a dozen glass surfaces — so
 * whether it is in front is the difference between a busy machine and an idle
 * one, and worth knowing about.
 */
function subscribe(onChange: () => void): () => void {
    window.addEventListener('focus', onChange)
    window.addEventListener('blur', onChange)
    document.addEventListener('visibilitychange', onChange)

    return () => {
        window.removeEventListener('focus', onChange)
        window.removeEventListener('blur', onChange)
        document.removeEventListener('visibilitychange', onChange)
    }
}

function active(): boolean {
    return !document.hidden && document.hasFocus()
}

export function useAppActive(): boolean {
    // The third argument is only reached when there is no document at all,
    // which for a desktop app means a test environment: assume watched, so
    // nothing renders as if it were in the background.
    return useSyncExternalStore(subscribe, active, () => true)
}
