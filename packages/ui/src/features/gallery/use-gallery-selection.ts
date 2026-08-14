import { useCallback, useMemo } from 'react'

import { downloadImages } from './download'
import type { DeleteRequest, GalleryImage, SelectRequest } from './gallery-tile'
import { useMarquee, type Marquee } from './marquee'
import { isCreation, type CreationEntry, type GalleryEntry } from './use-gallery-entries'
import { useSelection, type Selection } from './use-selection'

export interface GallerySelection {
    readonly selection: Selection
    /** A tile's ask: toggle this creation, or Shift-sweep a range onto it. */
    readonly select: SelectRequest
    /** The drag rectangle, wired to this selection. */
    readonly marquee: Marquee
    /** The dock's two verbs, already bound to whatever is selected. */
    readonly downloadSelection: () => void
    readonly deleteSelection: (immediate: boolean) => void
}

/**
 * The selection as the gallery page uses it: the raw state from
 * `useSelection`, plus its verbs bound to the wall — which creations the ids
 * stand for, and what downloading or deleting them actually calls.
 */
export function useGallerySelection(
    entries: readonly GalleryEntry[],
    requestDelete: DeleteRequest,
): GallerySelection {
    // The wall in display order, which is what a Shift sweep runs along.
    const creationIds = useMemo(
        () =>
            entries
                .filter((entry): entry is CreationEntry => isCreation(entry))
                .map((entry) => entry.id),
        [entries],
    )
    const selection = useSelection(creationIds)
    const marquee = useMarquee(selection.selectedIds, selection.replace)

    const select = useCallback<SelectRequest>(
        (id, mode) => {
            if (mode === 'range') {
                selection.extend(id)
            } else {
                selection.toggle(id)
            }
        },
        [selection],
    )

    const selectedImages = useMemo<readonly GalleryImage[]>(
        () =>
            entries
                .filter((entry): entry is CreationEntry => isCreation(entry))
                .filter((entry) => selection.selectedIds.has(entry.id))
                .map((entry) => entry.image),
        [entries, selection.selectedIds],
    )

    // Packing an archive takes a moment; the dock does not wait on it.
    const downloadSelection = useCallback(() => {
        void downloadImages(selectedImages)
    }, [selectedImages])

    const deleteSelection = useCallback(
        (immediate: boolean) => {
            requestDelete(selection.ids, immediate)
        },
        [requestDelete, selection.ids],
    )

    return { selection, select, marquee, downloadSelection, deleteSelection }
}
