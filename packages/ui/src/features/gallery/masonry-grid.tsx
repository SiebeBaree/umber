import { motion, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'

import { RenderingTile } from '../generate/rendering-tile'
import { GalleryTile, type DeleteRequest, type SelectRequest } from './gallery-tile'
import { splitIntoColumns } from './masonry'
import { useColumnCount } from './use-column-count'
import type { GalleryEntry } from './use-gallery-entries'

/**
 * The wall of pictures: how entries are dealt into columns, and how each tile
 * makes its entrance. The page above it owns which entries there are and what
 * happens when one is clicked.
 */

const ENTER = { opacity: 0, scale: 0.98, y: 14 }
const SETTLED = { opacity: 1, scale: 1, y: 0 }

const ENTER_TRANSITION: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] }

/**
 * Each tile trails the one made just after it, so the grid pours in newest
 * first. The delay is capped: past the first screenful the stagger has made
 * its point, and everything further down arrives together.
 */
const STAGGER_STEP = 0.03
const STAGGER_LIMIT = 0.45

interface StaggeredTileProps {
    readonly entry: GalleryEntry
    /** Position in the newest-first list, which sets this tile's delay. */
    readonly index: number
    /** Ids whose entrance has already played during this visit. */
    readonly seenIds: Set<string>
    readonly reducedMotion: boolean
    readonly onDelete: DeleteRequest
    readonly onOpen: (id: string) => void
    readonly onSelect: SelectRequest
    readonly selectedIds: ReadonlySet<string>
    readonly selectionActive: boolean
}

function StaggeredTile({
    entry,
    index,
    onDelete,
    onOpen,
    onSelect,
    reducedMotion,
    seenIds,
    selectedIds,
    selectionActive,
}: StaggeredTileProps) {
    // Decided once, at mount, via the lazy initialiser (the sanctioned way to
    // consult a mutable registry during render): a tile that already entered
    // this visit — remounted because a resize dealt it into another column —
    // appears in place, while a genuinely new tile plays its entrance.
    const [initial] = useState(() => (reducedMotion || seenIds.has(entry.id) ? false : ENTER))

    // Registered after paint, so this mount's own entrance still plays.
    useEffect(() => {
        seenIds.add(entry.id)
    }, [entry.id, seenIds])

    const transition = useMemo(
        () => ({ ...ENTER_TRANSITION, delay: Math.min(index * STAGGER_STEP, STAGGER_LIMIT) }),
        [index],
    )

    // No exit animation: deleting re-deals every column, so a tile that moves
    // column unmounts and remounts, and an exit would ghost it in its old
    // place while it is already drawn in its new one. The removal is instant,
    // which is also the clearest confirmation that the click landed.
    return (
        <motion.div animate={SETTLED} initial={initial} transition={transition}>
            {entry.kind === 'creation' ? (
                <GalleryTile
                    image={entry.image}
                    onDelete={onDelete}
                    onOpen={onOpen}
                    onSelect={onSelect}
                    selected={selectedIds.has(entry.id)}
                    selectionActive={selectionActive}
                />
            ) : (
                <RenderingTile providerId={entry.providerId} ratio={entry.ratio} />
            )}
        </motion.div>
    )
}

export interface MasonryProps {
    readonly entries: readonly GalleryEntry[]
    readonly onDelete: DeleteRequest
    readonly onOpen: (id: string) => void
    readonly onSelect: SelectRequest
    readonly selectedIds: ReadonlySet<string>
    readonly selectionActive: boolean
}

/**
 * The wall itself. Columns are plain flex children; the masonry lives in how
 * items are dealt into them, not in CSS.
 */
export function Masonry({
    entries,
    onDelete,
    onOpen,
    onSelect,
    selectedIds,
    selectionActive,
}: MasonryProps) {
    const [gridRef, columnCount] = useColumnCount()
    const reducedMotion = useReducedMotion() === true

    // No columns until the grid has been measured — the count arrives before
    // paint, and mounting tiles into a guessed layout would remount them a
    // frame later, marking them "seen" before their entrance ever played.
    const columns = useMemo(
        () => (columnCount === null ? [] : splitIntoColumns(entries, columnCount)),
        [entries, columnCount],
    )

    // One registry per visit: which tiles have already made their entrance.
    // Per item rather than a page-wide latch so a breakpoint resize does not
    // replay the stagger, while a genuinely new item still animates in.
    const [seenIds] = useState(() => new Set<string>())

    return (
        <div className="flex items-start gap-3" ref={gridRef}>
            {columns.map((column) => (
                <div className="flex min-w-0 flex-1 flex-col gap-3" key={column.key}>
                    {column.items.map(({ index, item }) => (
                        <StaggeredTile
                            entry={item}
                            index={index}
                            key={item.id}
                            onDelete={onDelete}
                            onOpen={onOpen}
                            onSelect={onSelect}
                            reducedMotion={reducedMotion}
                            seenIds={seenIds}
                            selectedIds={selectedIds}
                            selectionActive={selectionActive}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}
