import { expect, test } from 'vitest'

// Reached by path rather than through `@umber/ui`: the selection arithmetic is
// an internal of the gallery, not part of the package's public surface.
import {
    EMPTY_SELECTION,
    extendSelection,
    pruneSelection,
    selectEvery,
    sweepSelection,
    toggleSelection,
    type SelectionState,
} from '../packages/ui/src/features/gallery/selection'

const WALL = ['a', 'b', 'c', 'd', 'e']

function ids(state: SelectionState): readonly string[] {
    return WALL.filter((id) => state.selected.has(id))
}

test('a toggle selects, a second toggle deselects', () => {
    const one = toggleSelection(EMPTY_SELECTION, 'b')

    expect(ids(one)).toEqual(['b'])
    expect(one.anchorId).toBe('b')

    expect(ids(toggleSelection(one, 'b'))).toEqual([])
})

test('a shift sweep selects everything between the anchor and the target', () => {
    const anchored = toggleSelection(EMPTY_SELECTION, 'b')

    expect(ids(extendSelection(anchored, WALL, 'd'))).toEqual(['b', 'c', 'd'])
})

test('a sweep runs backwards just as well', () => {
    const anchored = toggleSelection(EMPTY_SELECTION, 'd')

    expect(ids(extendSelection(anchored, WALL, 'a'))).toEqual(['a', 'b', 'c', 'd'])
})

test('a second sweep adds to the first instead of replacing it', () => {
    const first = extendSelection(toggleSelection(EMPTY_SELECTION, 'a'), WALL, 'b')
    const second = extendSelection(first, WALL, 'd')

    expect(ids(second)).toEqual(['a', 'b', 'c', 'd'])
})

test('the sweep keeps its anchor, so it re-extends from the same place', () => {
    const anchored = toggleSelection(EMPTY_SELECTION, 'b')
    const swept = extendSelection(anchored, WALL, 'e')

    expect(swept.anchorId).toBe('b')
})

test('a sweep with nothing to sweep from is just a click', () => {
    expect(ids(extendSelection(EMPTY_SELECTION, WALL, 'c'))).toEqual(['c'])
})

test('a marquee over unselected creations selects them all', () => {
    const swept = sweepSelection(new Set(), ['b', 'c'])

    expect([...swept].toSorted()).toEqual(['b', 'c'])
})

test('a marquee over only selected creations deselects them', () => {
    const swept = sweepSelection(new Set(['b', 'c', 'e']), ['b', 'c'])

    expect([...swept]).toEqual(['e'])
})

test('a mixed marquee deselects everything it covers', () => {
    const swept = sweepSelection(new Set(['b', 'e']), ['a', 'b', 'c'])

    expect([...swept]).toEqual(['e'])
})

test('a marquee leaves what it never touched alone', () => {
    const swept = sweepSelection(new Set(['e']), ['a', 'b'])

    expect([...swept].toSorted()).toEqual(['a', 'b', 'e'])
})

test('select all takes the whole wall', () => {
    expect(ids(selectEvery(WALL))).toEqual(WALL)
})

test('what leaves the wall leaves the selection', () => {
    const swept = extendSelection(toggleSelection(EMPTY_SELECTION, 'a'), WALL, 'c')
    const pruned = pruneSelection(swept, ['b', 'c', 'd', 'e'])

    expect([...pruned.selected].toSorted()).toEqual(['b', 'c'])
    expect(pruned.anchorId).toBeNull()
})

test('a prune that changes nothing returns the state untouched', () => {
    const state = toggleSelection(EMPTY_SELECTION, 'c')

    expect(pruneSelection(state, WALL)).toBe(state)
})
