import { useCallback, useMemo, useState } from 'react'

import { useShortcut, type Shortcut } from '../../lib/use-shortcut'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { GalleryEmptyState } from './gallery-empty-state'
import type { DeleteRequest } from './gallery-tile'
import { ImageDetailDialog } from './image-detail-dialog'
import { Masonry } from './masonry-grid'
import { useGalleryEntries, type GalleryEntry } from './use-gallery-entries'

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

    return { image, openId, open: setOpenId, close, deleteImage }
}

/** ⌘⌫, the system gesture for "throw this away". */
const DELETE_CREATION: Shortcut = { key: 'Backspace', meta: true }

/**
 * Which creation the keyboard is on: the tile holding focus, found by walking
 * up from wherever focus actually sits — the tile's own open button, or one of
 * the controls over the picture.
 */
function focusedCreationId(): string | null {
    const active = document.activeElement

    if (!(active instanceof HTMLElement)) {
        return null
    }

    return active.closest<HTMLElement>('[data-creation-id]')?.dataset.creationId ?? null
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

/** The gallery: every creation in a masonry of the shapes they were made in. */
export function GalleryPage() {
    const { entries, loaded, remove } = useGalleryEntries()
    const detail = useOpenImage(entries, remove)
    const deletion = useDeleteFlow(entries, detail.deleteImage)

    // The creation on screen comes first: with the detail view open it is
    // plainly the one being looked at, and focus is trapped inside the dialog.
    useShortcut(DELETE_CREATION, () => {
        const target = detail.openId ?? focusedCreationId()

        if (target !== null) {
            deletion.request(target, false)
        }
    })

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
