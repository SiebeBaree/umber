import { useEffect } from 'react'

/**
 * What the app does with a drag it did not ask for.
 *
 * A drop the page leaves unhandled falls through to the browser's own default,
 * which is to navigate the window to whatever was let go of: a link dragged out
 * of a page, a file dragged off the desktop. In a desktop shell that is not a
 * cosmetic bug — the window would leave the app for good, carrying its bridge
 * with it — so the app refuses every drop it has no use for, on every route.
 * The composer layers its own listeners on top for the drops it does want.
 */

/** Text selections get dragged too; only a drag carrying files counts. */
export function carriesFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes('Files') ?? false
}

/**
 * Text let go of over a field is inserted there rather than navigated to, so
 * that one drop is the browser's to handle. Files are not: dropping one on a
 * textarea navigates like anywhere else.
 */
function insertsAsText(event: DragEvent): boolean {
    const target = event.target

    if (carriesFiles(event) || !(target instanceof HTMLElement)) {
        return false
    }

    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
    )
}

export function useDropGuard(): void {
    useEffect(() => {
        const suppress = (event: DragEvent) => {
            if (!insertsAsText(event)) {
                event.preventDefault()
            }
        }

        window.addEventListener('dragover', suppress)
        window.addEventListener('drop', suppress)

        return () => {
            window.removeEventListener('dragover', suppress)
            window.removeEventListener('drop', suppress)
        }
    }, [])
}
