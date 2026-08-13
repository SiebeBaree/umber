import { motion, useReducedMotion, type Transition } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { RenderingTile } from '../generate/rendering-tile'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { GalleryEmptyState } from './gallery-empty-state'
import { GalleryTile, type DeleteRequest } from './gallery-tile'
import { ImageDetailDialog } from './image-detail-dialog'
import { splitIntoColumns } from './masonry'
import { useColumnCount } from './use-column-count'
import { useGalleryEntries, type GalleryEntry } from './use-gallery-entries'

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
}

function StaggeredTile({
    entry,
    index,
    onDelete,
    onOpen,
    reducedMotion,
    seenIds,
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
                <GalleryTile image={entry.image} onDelete={onDelete} onOpen={onOpen} />
            ) : (
                <RenderingTile providerId={entry.providerId} ratio={entry.ratio} />
            )}
        </motion.div>
    )
}

/**
 * Which creation the detail view is showing, held by id rather than by value
 * so a reload behind the dialog cannot leave it pointing at a dead URL.
 */
function useOpenImage(entries: readonly GalleryEntry[], remove: (id: string) => void) {
    const [openId, setOpenId] = useState<string | null>(null)

    const image = useMemo(() => {
        const found = entries.find((entry) => entry.kind === 'creation' && entry.id === openId)

        return found?.kind === 'creation' ? found.image : null
    }, [entries, openId])

    const close = useCallback(() => {
        setOpenId(null)
    }, [])

    // Deleting the open creation takes its view down with it.
    const deleteImage = useCallback(
        (id: string) => {
            setOpenId((current) => (current === id ? null : current))
            remove(id)
        },
        [remove],
    )

    return { image, open: setOpenId, close, deleteImage }
}

/**
 * Deleting, with the question in front of it: a request parks the creation
 * until the dialog comes back with an answer. Shift on the click skips
 * straight to the deletion, which is the whole point of the modifier — the
 * confirmation is there for the accidental click, not for the person clearing
 * out a dozen pictures on purpose.
 */
function useDeleteFlow(entries: readonly GalleryEntry[], remove: (id: string) => void) {
    const [pendingId, setPendingId] = useState<string | null>(null)

    const request = useCallback<DeleteRequest>(
        (id, immediate) => {
            if (immediate) {
                remove(id)

                return
            }

            setPendingId(id)
        },
        [remove],
    )

    const cancel = useCallback(() => {
        setPendingId(null)
    }, [])

    const confirm = useCallback(() => {
        if (pendingId !== null) {
            remove(pendingId)
        }

        setPendingId(null)
    }, [pendingId, remove])

    // The dialog names the creation it is about. A pending id with no entry
    // behind it — the run it belonged to reloaded the list underneath — asks
    // about nothing, so the question closes itself.
    const prompt = useMemo(() => {
        const found = entries.find((entry) => entry.kind === 'creation' && entry.id === pendingId)

        return found?.kind === 'creation' ? found.image.prompt : null
    }, [entries, pendingId])

    return { request, confirm, cancel, prompt }
}

interface MasonryProps {
    readonly entries: readonly GalleryEntry[]
    readonly onDelete: DeleteRequest
    readonly onOpen: (id: string) => void
}

/**
 * The wall itself. Columns are plain flex children; the masonry lives in how
 * items are dealt into them, not in CSS.
 */
function Masonry({ entries, onDelete, onOpen }: MasonryProps) {
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
        <div className="flex items-start gap-4" ref={gridRef}>
            {columns.map((column) => (
                <div className="flex min-w-0 flex-1 flex-col gap-4" key={column.key}>
                    {column.items.map(({ index, item }) => (
                        <StaggeredTile
                            entry={item}
                            index={index}
                            key={item.id}
                            onDelete={onDelete}
                            onOpen={onOpen}
                            reducedMotion={reducedMotion}
                            seenIds={seenIds}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

/** The gallery: every creation in a masonry of the shapes they were made in. */
export function GalleryPage() {
    const { entries, loaded, remove } = useGalleryEntries()
    const detail = useOpenImage(entries, remove)
    const deletion = useDeleteFlow(entries, detail.deleteImage)

    if (loaded && entries.length === 0) {
        return <GalleryEmptyState />
    }

    return (
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 pt-2 pb-16">
            {/* The pictures are the page; the only heading is for screen
                readers, which otherwise land on an unlabelled wall of images. */}
            <h1 className="sr-only">Gallery</h1>

            <Masonry entries={entries} onDelete={deletion.request} onOpen={detail.open} />

            <ImageDetailDialog
                image={detail.image}
                onDelete={deletion.request}
                onOpenChange={detail.close}
            />

            <DeleteConfirmDialog
                onCancel={deletion.cancel}
                onConfirm={deletion.confirm}
                prompt={deletion.prompt}
            />
        </div>
    )
}
