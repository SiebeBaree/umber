import { useCallback, useEffect, useMemo, useState } from 'react'

import {
    EMPTY_SELECTION,
    extendSelection,
    pruneSelection,
    selectEvery,
    toggleSelection,
} from './selection'

export interface Selection {
    /** Membership, for painting each tile's state. */
    readonly selectedIds: ReadonlySet<string>
    /** The same selection in wall order, for acting on it. */
    readonly ids: readonly string[]
    readonly count: number
    /** True once anything is selected, which turns tile clicks into selection. */
    readonly active: boolean
    readonly toggle: (id: string) => void
    /** The Shift sweep from the last creation touched. */
    readonly extend: (id: string) => void
    /** Wholesale replacement, for the marquee's live sweep. */
    readonly replace: (ids: ReadonlySet<string>) => void
    readonly selectAll: () => void
    readonly clear: () => void
}

/**
 * Which creations are selected, against the wall as it currently hangs.
 * `orderedIds` is the creations in display order; whatever leaves that list —
 * deleted here, or reloaded away by a finishing run — leaves the selection
 * with it, so the count in the dock never promises more than the wall holds.
 */
export function useSelection(orderedIds: readonly string[]): Selection {
    const [state, setState] = useState(EMPTY_SELECTION)

    // Prune returns the same state when nothing changed, so this settles
    // without a second render on the reloads that touched nothing selected.
    useEffect(() => {
        setState((current) => pruneSelection(current, orderedIds))
    }, [orderedIds])

    const toggle = useCallback((id: string) => {
        setState((current) => toggleSelection(current, id))
    }, [])

    const extend = useCallback(
        (id: string) => {
            setState((current) => extendSelection(current, orderedIds, id))
        },
        [orderedIds],
    )

    // No anchor after a sweep: a marquee has no single "last touched" tile.
    const replace = useCallback((ids: ReadonlySet<string>) => {
        setState({ selected: new Set(ids), anchorId: null })
    }, [])

    const selectAll = useCallback(() => {
        setState(selectEvery(orderedIds))
    }, [orderedIds])

    const clear = useCallback(() => {
        setState(EMPTY_SELECTION)
    }, [])

    const ids = useMemo(
        () => orderedIds.filter((id) => state.selected.has(id)),
        [orderedIds, state.selected],
    )

    return {
        selectedIds: state.selected,
        ids,
        count: state.selected.size,
        active: state.selected.size > 0,
        toggle,
        extend,
        replace,
        selectAll,
        clear,
    }
}
