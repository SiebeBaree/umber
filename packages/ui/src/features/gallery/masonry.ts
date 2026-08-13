import { ratioParts, type AspectRatio } from '../create/catalog'

/** What the masonry needs to know about anything it lays out. */
export interface MasonryItem {
    readonly id: string
    readonly ratio: AspectRatio
}

export interface PlacedItem<Item extends MasonryItem> {
    readonly item: Item
    /** Position in the original newest-first list, driving the entrance stagger. */
    readonly index: number
}

export interface MasonryColumn<Item extends MasonryItem> {
    /** A stable React key — columns have no data identity of their own. */
    readonly key: string
    readonly items: readonly PlacedItem<Item>[]
}

/**
 * The fewest columns the wall is dealt into, however little is hanging on it.
 * A floor rather than a demand: on a window too narrow for three tiles, the
 * count measured off the container still wins.
 */
const MIN_COLUMNS = 3

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
export function splitIntoColumns<Item extends MasonryItem>(
    items: readonly Item[],
    columnCount: number,
): readonly MasonryColumn<Item>[] {
    // Empty columns are laid out too, down to `MIN_COLUMNS`: the page gives
    // every column `flex-1`, so the empty ones hold the tile width steady and
    // a gallery of one hangs a normal-sized picture in the corner instead of
    // blowing it up across the whole page. Above that floor the count follows
    // the items, so a wall of three never leaves a fourth column standing
    // empty. The lower bound of one keeps the `reduce` below seeded even for
    // an empty list or a bad count.
    const count = Math.max(Math.min(columnCount, Math.max(items.length, MIN_COLUMNS)), 1)

    const columns = Array.from({ length: count }, (_, index) => ({
        key: `column-${index + 1}`,
        height: 0,
        items: [] as PlacedItem<Item>[],
    }))

    for (const [index, item] of items.entries()) {
        const shortest = columns.reduce((a, b) => (b.height < a.height ? b : a))
        const { height, width } = ratioParts(item.ratio)
        shortest.items.push({ index, item })
        shortest.height += height / width
    }

    return columns.map(({ items: placed, key }) => ({ items: placed, key }))
}
