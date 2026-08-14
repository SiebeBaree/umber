import { cn } from '../../lib/cn'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import {
    useDeleteFlow,
    useGalleryShortcuts,
    useOpenImage,
    type DeleteFlow,
    type OpenImage,
} from './gallery-actions'
import { GalleryEmptyState } from './gallery-empty-state'
import { ImageDetailDialog } from './image-detail-dialog'
import { MarqueeOverlay } from './marquee'
import { Masonry } from './masonry-grid'
import { SelectionDock } from './selection-dock'
import { useGalleryEntries } from './use-gallery-entries'
import { useGallerySelection } from './use-gallery-selection'

/** The two dialogs over the wall: one creation at full size, and the question
 * asked before anything is erased. */
function GalleryDialogs({
    deletion,
    detail,
}: {
    readonly detail: OpenImage
    readonly deletion: DeleteFlow
}) {
    return (
        <>
            <ImageDetailDialog
                image={detail.image}
                onDelete={deletion.request}
                onOpenChange={detail.close}
            />

            <DeleteConfirmDialog
                onCancel={deletion.cancel}
                onConfirm={deletion.confirm}
                subject={deletion.subject}
            />
        </>
    )
}

/**
 * The gallery: every creation in a masonry of the shapes they were made in,
 * with a selection layered over it — checkboxes on the tiles, a floating dock
 * for the set — and the detail and delete dialogs on top. The extra bottom
 * padding while selecting keeps the last row of tiles clear of the dock.
 *
 * The root div is the marquee's surface: full-bleed and full-height, so a
 * sweep can start from any pixel of the page — the margins beside the wall
 * and the space below it included. The strip at the top annexes the header's
 * bottom padding for sweeps too: it lies over the empty band under the nav
 * pill (the header is `py-4` around an `h-11` row, so the band is the 1rem
 * above `main`), `fixed` so the scroll container cannot clip it, `no-drag`
 * so Electron yields it, and inside this div so its presses bubble into the
 * same handler. The header's controls end above it, and the rest of the
 * header stays the window's drag handle. `select-none` keeps a sweep from
 * painting text selections on the way through, and the heading is for screen
 * readers, which otherwise land on an unlabelled wall of images.
 */
export function GalleryPage() {
    const { entries, loaded, remove } = useGalleryEntries()
    const detail = useOpenImage(entries, remove)
    const deletion = useDeleteFlow(entries, detail.deleteImages)
    const { deleteSelection, downloadSelection, marquee, select, selection } = useGallerySelection(
        entries,
        deletion.request,
    )

    useGalleryShortcuts(entries, detail, deletion, selection)

    if (loaded && entries.length === 0) {
        return <GalleryEmptyState />
    }

    return (
        <div
            className={cn(
                'flex w-full flex-1 flex-col pt-2 transition-[padding] duration-200 ease-out select-none',
                selection.active ? 'pb-28' : 'pb-16',
            )}
            onPointerDown={marquee.onPointerDown}
            ref={marquee.containerRef}
        >
            <div aria-hidden className="no-drag fixed inset-x-0 top-[3.75rem] h-4" />
            <h1 className="sr-only">Gallery</h1>
            <div className="mx-auto w-full max-w-6xl px-6">
                <Masonry
                    entries={entries}
                    onDelete={deletion.request}
                    onOpen={detail.open}
                    onSelect={select}
                    selectedIds={selection.selectedIds}
                    selectionActive={selection.active}
                />
            </div>

            <MarqueeOverlay rect={marquee.rect} />

            <SelectionDock
                count={selection.count}
                onClear={selection.clear}
                onDelete={deleteSelection}
                onDownload={downloadSelection}
            />

            <GalleryDialogs deletion={deletion} detail={detail} />
        </div>
    )
}
