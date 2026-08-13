import { motion, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'

import { GALLERY_ITEMS, type GalleryItem } from './gallery-items'
import { GalleryTile } from './gallery-tile'
import { splitIntoColumns } from './masonry'
import { useColumnCount } from './use-column-count'

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
    readonly item: GalleryItem
    /** Position in the newest-first list, which sets this tile's delay. */
    readonly index: number
    /** Ids whose entrance has already played during this visit. */
    readonly seenIds: Set<string>
    readonly reducedMotion: boolean
}

function StaggeredTile({ index, item, reducedMotion, seenIds }: StaggeredTileProps) {
    // Decided once, at mount, via the lazy initialiser (the sanctioned way to
    // consult a mutable registry during render): a tile that already entered
    // this visit — remounted because a resize dealt it into another column —
    // appears in place, while a genuinely new tile plays its entrance.
    const [initial] = useState(() => (reducedMotion || seenIds.has(item.id) ? false : ENTER))

    // Registered after paint, so this mount's own entrance still plays.
    useEffect(() => {
        seenIds.add(item.id)
    }, [item.id, seenIds])

    const transition = useMemo(
        () => ({ ...ENTER_TRANSITION, delay: Math.min(index * STAGGER_STEP, STAGGER_LIMIT) }),
        [index],
    )

    return (
        <motion.div animate={SETTLED} initial={initial} transition={transition}>
            <GalleryTile item={item} />
        </motion.div>
    )
}

/** The gallery: every creation in a masonry of the shapes they were made in. */
export function GalleryPage() {
    const [gridRef, columnCount] = useColumnCount()
    // No columns until the grid has been measured — the count arrives before
    // paint, and mounting tiles into a guessed layout would remount them a
    // frame later, marking them "seen" before their entrance ever played.
    const columns = useMemo(
        () => (columnCount === null ? [] : splitIntoColumns(GALLERY_ITEMS, columnCount)),
        [columnCount],
    )
    const reducedMotion = useReducedMotion()

    // One registry per visit: which tiles have already made their entrance.
    // Per item rather than a page-wide latch so a breakpoint resize does not
    // replay the stagger, while a genuinely new item still animates in.
    const [seenIds] = useState(() => new Set<string>())

    return (
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 pt-2 pb-16">
            {/* The pictures are the page; the only heading is for screen
                readers, which otherwise land on an unlabelled wall of images. */}
            <h1 className="sr-only">Gallery</h1>

            {/* Columns are plain flex children; the masonry lives in how items
                are dealt into them, not in CSS. */}
            <div className="flex items-start gap-4" ref={gridRef}>
                {columns.map((column) => (
                    <div className="flex min-w-0 flex-1 flex-col gap-4" key={column.key}>
                        {column.items.map(({ index, item }) => (
                            <StaggeredTile
                                index={index}
                                item={item}
                                key={item.id}
                                reducedMotion={reducedMotion === true}
                                seenIds={seenIds}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
