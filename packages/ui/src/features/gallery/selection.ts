/**
 * The arithmetic of selecting creations, kept pure so the gestures can be
 * tested without a gallery around them. The rules are the ones every photo
 * library has taught: a click toggles one, Shift sweeps from the last one
 * touched, and whatever disappears from the wall leaves the selection with it.
 */

export interface SelectionState {
    readonly selected: ReadonlySet<string>
    /** The last creation touched, where the next Shift sweep starts from. */
    readonly anchorId: string | null
}

export const EMPTY_SELECTION: SelectionState = { selected: new Set(), anchorId: null }

/** Flips one creation in or out, and moves the anchor onto it either way. */
export function toggleSelection(state: SelectionState, id: string): SelectionState {
    const selected = new Set(state.selected)

    if (selected.has(id)) {
        selected.delete(id)
    } else {
        selected.add(id)
    }

    return { selected, anchorId: id }
}

/**
 * The Shift sweep: everything between the anchor and `id`, in wall order,
 * joins the selection. Additive rather than replacing, so sweeping a second
 * stretch keeps the first — deselecting stays a one-at-a-time gesture. With
 * no anchor to sweep from, the click means what a plain one would.
 */
export function extendSelection(
    state: SelectionState,
    orderedIds: readonly string[],
    id: string,
): SelectionState {
    const anchorIndex = state.anchorId === null ? -1 : orderedIds.indexOf(state.anchorId)

    if (anchorIndex === -1) {
        return toggleSelection(state, id)
    }

    const targetIndex = orderedIds.indexOf(id)

    if (targetIndex === -1) {
        return state
    }

    const [from, to] =
        anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
    const selected = new Set(state.selected)

    for (const swept of orderedIds.slice(from, to + 1)) {
        selected.add(swept)
    }

    return { selected, anchorId: state.anchorId }
}

/**
 * What a marquee sweep does to the selection, applied live as the rectangle
 * grows. Covering only unselected creations selects them all; the moment the
 * rectangle touches anything already selected, the sweep flips into an eraser
 * for everything it covers — sweeping "again" deselects, and a mixed sweep
 * clears rather than guessing which half was meant.
 */
export function sweepSelection(
    base: ReadonlySet<string>,
    covered: readonly string[],
): ReadonlySet<string> {
    const erasing = covered.some((id) => base.has(id))
    const selected = new Set(base)

    for (const id of covered) {
        if (erasing) {
            selected.delete(id)
        } else {
            selected.add(id)
        }
    }

    return selected
}

/** Everything at once; the anchor lands on the first so ⇧ still has a home. */
export function selectEvery(orderedIds: readonly string[]): SelectionState {
    return { selected: new Set(orderedIds), anchorId: orderedIds[0] ?? null }
}

/**
 * Drops whatever no longer hangs on the wall — deleted, or reloaded away.
 * Returns the state untouched (same reference) when nothing changed, so the
 * caller can run this on every reload without re-rendering anything.
 */
export function pruneSelection(
    state: SelectionState,
    orderedIds: readonly string[],
): SelectionState {
    if (state.selected.size === 0 && state.anchorId === null) {
        return state
    }

    const alive = new Set(orderedIds)
    const kept = [...state.selected].filter((id) => alive.has(id))
    const anchorAlive = state.anchorId !== null && alive.has(state.anchorId)

    if (kept.length === state.selected.size && (state.anchorId === null || anchorAlive)) {
        return state
    }

    return { selected: new Set(kept), anchorId: anchorAlive ? state.anchorId : null }
}
