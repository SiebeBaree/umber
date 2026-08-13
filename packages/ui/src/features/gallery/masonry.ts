import { ratioParts } from '../create/catalog'
import type { GalleryItem } from './gallery-items'

export interface PlacedItem {
    readonly item: GalleryItem
    /** Position in the original newest-first list, driving the entrance stagger. */
    readonly index: number
}

export interface MasonryColumn {
    /** A stable React key — columns have no data identity of their own. */
    readonly key: string
    readonly items: readonly PlacedItem[]
}

/**
 * Deals items into masonry columns: each goes to the currently shortest one,
 * measured in units of column width (all columns are equally wide, so a tile's
 * height contribution is just height/width).
 *
 * CSS `columns` would be less code, but it fills each column top to bottom
 * before starting the next, which buries the newest work at the top of column
 * one and the oldest at the top of the last — this keeps reading order roughly
 * left to right, newest first, and lands every column at nearly the same
 * height.
 */
export function splitIntoColumns(
    items: readonly GalleryItem[],
    columnCount: number,
): readonly MasonryColumn[] {
    // Never more columns than items: the page gives every column `flex-1`, so
    // an empty column would still claim its share of the row and shrink a
    // short gallery's tiles to a fraction of the width. The lower bound of one
    // keeps the `reduce` below seeded even for an empty list or a bad count.
    const count = Math.max(Math.min(columnCount, items.length), 1)

    const columns = Array.from({ length: count }, (_, index) => ({
        key: `column-${index + 1}`,
        height: 0,
        items: [] as PlacedItem[],
    }))

    for (const [index, item] of items.entries()) {
        const shortest = columns.reduce((a, b) => (b.height < a.height ? b : a))
        const { height, width } = ratioParts(item.ratio)
        shortest.items.push({ index, item })
        shortest.height += height / width
    }

    return columns.map(({ items: placed, key }) => ({ items: placed, key }))
}
