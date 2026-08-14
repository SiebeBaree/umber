import { useCallback, useMemo, useState } from 'react'

import { useShortcut, type Shortcut } from '../../lib/use-shortcut'
import type { DeleteSubject } from './delete-confirm-dialog'
import type { DeleteRequest, GalleryImage } from './gallery-tile'
import { isCreation, type GalleryEntry } from './use-gallery-entries'
import type { Selection } from './use-selection'

/**
 * What the gallery page *does* — opening a creation, deleting with a question
 * in front of it, and the keyboard that drives both — kept here so the page
 * itself is just the wall and the surfaces floating over it.
 */

export interface OpenImage {
    readonly image: GalleryImage | null
    readonly openId: string | null
    readonly open: (id: string) => void
    readonly close: () => void
    readonly deleteImages: (ids: readonly string[]) => void
}

/**
 * Which creation the detail view is showing, held by id rather than by value
 * so a reload behind the dialog cannot leave it pointing at a dead URL.
 */
export function useOpenImage(
    entries: readonly GalleryEntry[],
    remove: (ids: readonly string[]) => void,
): OpenImage {
    const [openId, setOpenId] = useState<string | null>(null)

    const image = useMemo(() => {
        const found = entries.find((entry) => isCreation(entry) && entry.id === openId)

        return found?.kind === 'creation' ? found.image : null
    }, [entries, openId])

    const close = useCallback(() => {
        setOpenId(null)
    }, [])

    // Deleting the open creation takes its view down with it.
    const deleteImages = useCallback(
        (ids: readonly string[]) => {
            setOpenId((current) => (current !== null && ids.includes(current) ? null : current))
            remove(ids)
        },
        [remove],
    )

    return { image, openId, open: setOpenId, close, deleteImages }
}

/**
 * What the confirmation is about. Pending ids with no entries behind them —
 * the run they belonged to reloaded the list underneath — ask about nothing,
 * so the question closes itself.
 */
function deleteSubject(
    entries: readonly GalleryEntry[],
    pendingIds: readonly string[] | null,
): DeleteSubject | null {
    if (pendingIds === null) {
        return null
    }

    const pending = new Set(pendingIds)
    const doomed = entries.filter(
        (entry): entry is Extract<GalleryEntry, { kind: 'creation' }> =>
            isCreation(entry) && pending.has(entry.id),
    )
    const [first] = doomed

    if (first === undefined) {
        return null
    }

    return doomed.length === 1
        ? { kind: 'one', prompt: first.image.prompt }
        : { kind: 'many', count: doomed.length }
}

export interface DeleteFlow {
    readonly request: DeleteRequest
    readonly confirm: () => void
    readonly cancel: () => void
    readonly subject: DeleteSubject | null
}

/**
 * Deleting, with the question in front of it: a request parks the creations
 * until the dialog comes back with an answer. Shift on the click skips
 * straight to the deletion, which is the whole point of the modifier — the
 * confirmation is there for the accidental click, not for the person clearing
 * out a dozen pictures on purpose.
 */
export function useDeleteFlow(
    entries: readonly GalleryEntry[],
    remove: (ids: readonly string[]) => void,
): DeleteFlow {
    const [pendingIds, setPendingIds] = useState<readonly string[] | null>(null)

    const request = useCallback<DeleteRequest>(
        (ids, immediate) => {
            if (ids.length === 0) {
                return
            }

            if (immediate) {
                remove(ids)

                return
            }

            setPendingIds(ids)
        },
        [remove],
    )

    const cancel = useCallback(() => {
        setPendingIds(null)
    }, [])

    const confirm = useCallback(() => {
        if (pendingIds !== null) {
            remove(pendingIds)
        }

        setPendingIds(null)
    }, [pendingIds, remove])

    const subject = useMemo(() => deleteSubject(entries, pendingIds), [entries, pendingIds])

    return { request, confirm, cancel, subject }
}

/** ⌘⌫, the system gesture for "throw this away". */
const DELETE_CREATION: Shortcut = { key: 'Backspace', meta: true }

/** ⌘A sweeps the whole wall into the selection. */
const SELECT_ALL: Shortcut = { key: 'a', meta: true }

/** Escape puts a selection down, the way it backs out of everything else. */
const CLEAR_SELECTION: Shortcut = { key: 'Escape' }

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
 * The gallery's keyboard. ⌘⌫ deletes the most deliberate thing on screen: the
 * creation open in the detail view, else the live selection — the biggest
 * thing "delete" could mean — else the tile holding focus. ⌘A and Escape only
 * answer while no dialog is up: an open dialog owns the keyboard, and Escape
 * is its way out.
 */
export function useGalleryShortcuts(
    entries: readonly GalleryEntry[],
    detail: OpenImage,
    deletion: DeleteFlow,
    selection: Selection,
): void {
    const dialogOpen = detail.image !== null || deletion.subject !== null
    const hasCreations = entries.some((entry) => isCreation(entry))

    useShortcut(DELETE_CREATION, () => {
        if (detail.openId !== null) {
            deletion.request([detail.openId], false)
        } else if (selection.active) {
            deletion.request(selection.ids, false)
        } else {
            const focused = focusedCreationId()

            if (focused !== null) {
                deletion.request([focused], false)
            }
        }
    })

    useShortcut(SELECT_ALL, selection.selectAll, hasCreations && !dialogOpen)
    useShortcut(CLEAR_SELECTION, selection.clear, selection.active && !dialogOpen)
}
