import { expect, test } from 'vitest'

// Reached by path rather than through `@umber/ui`: the dealing rule is an
// internal of the gallery, not part of the package's public surface.
import { splitIntoColumns, type MasonryItem } from '../packages/ui/src/features/gallery/masonry'

function items(count: number): readonly MasonryItem[] {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index + 1}`, ratio: '1:1' }))
}

function shape(columns: readonly { readonly items: readonly unknown[] }[]): readonly number[] {
    return columns.map((column) => column.items.length)
}

test('a lone creation keeps its column width, with the rest of the row empty', () => {
    expect(shape(splitIntoColumns(items(1), 4))).toEqual([1, 0, 0])
})

test('the empty columns stop once there are enough creations to fill them', () => {
    expect(shape(splitIntoColumns(items(4), 4))).toEqual([1, 1, 1, 1])
})

test('a grid too narrow for three columns is never dealt three anyway', () => {
    expect(shape(splitIntoColumns(items(1), 2))).toEqual([1, 0])
})

test('everything is dealt, whatever the column count', () => {
    const columns = splitIntoColumns(items(7), 3)

    expect(shape(columns)).toEqual([3, 2, 2])
    expect(columns.flatMap((column) => column.items.map(({ item }) => item.id))).toHaveLength(7)
})
