/**
 * Pages scroll inside the shell's `main`, never the window, so anything that
 * needs to move the page has to find that element first.
 */

/** Whatever actually scrolls above this node — the shell's `main`, in practice. */
export function scrollParentOf(node: HTMLElement | null): HTMLElement | null {
    for (let parent = node?.parentElement ?? null; parent !== null; parent = parent.parentElement) {
        if (/auto|scroll/u.test(getComputedStyle(parent).overflowY)) {
            return parent
        }
    }

    return null
}
