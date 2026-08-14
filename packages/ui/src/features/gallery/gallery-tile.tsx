import { Check, Download, Trash2 } from 'lucide-react'
import { useCallback, useMemo, type MouseEvent } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { cn } from '../../lib/cn'
import { mediaExtension } from '../../lib/media'
import { ratioToCss, type AspectRatio } from '../create/catalog'
import { DurationBadge, TileImage, TileVideo } from './tile-media'

/**
 * A stored creation as the gallery renders it: enough to draw the tile, and
 * everything the detail view puts on the record — how it was made, and when.
 */
export interface GalleryImage {
    readonly id: string
    /** What the tile holds; videos preview on hover and open as a player. */
    readonly kind: 'image' | 'video'
    readonly prompt: string
    readonly ratio: AspectRatio
    readonly providerId: string
    readonly modelName: string
    /** Absent on rows stored before these were recorded. */
    readonly resolution?: string | undefined
    readonly quality?: string | undefined
    /** Clip length in seconds; only videos carry one. */
    readonly durationSeconds?: number | undefined
    /** How long the run took, in milliseconds. Absent on older rows. */
    readonly generationMs?: number | undefined
    /** Epoch milliseconds. */
    readonly createdAt: number
    /** An object URL over the stored blob, owned by the page that loaded it. */
    readonly url: string
    /** The blob's own media type, so a download can be named correctly. */
    readonly mediaType: string
}

/**
 * Asks for creations to be deleted. `immediate` carries whether the click
 * held Shift, which the gallery reads as "don't ask me" — the way past the
 * confirmation for someone clearing out several pictures in a row.
 */
export type DeleteRequest = (ids: readonly string[], immediate: boolean) => void

/**
 * Asks for a creation's selection to change: `toggle` flips this one, `range`
 * is the Shift sweep from the last creation touched.
 */
export type SelectRequest = (id: string, mode: 'toggle' | 'range') => void

export interface GalleryTileProps {
    readonly image: GalleryImage
    readonly onDelete: DeleteRequest
    readonly onOpen: (id: string) => void
    readonly onSelect: SelectRequest
    readonly selected: boolean
    /** True once anything is selected, which turns tile clicks into selection. */
    readonly selectionActive: boolean
}

function DownloadControl({ image }: { readonly image: GalleryImage }) {
    return (
        <Tooltip label="Download">
            <Button
                aria-label={`Download “${image.prompt}”`}
                asChild
                size="icon-sm"
                variant="overlay"
            >
                <a
                    download={`umber-${image.id.slice(0, 8)}.${mediaExtension(image.mediaType, image.kind)}`}
                    href={image.url}
                >
                    <Download aria-hidden />
                </a>
            </Button>
        </Tooltip>
    )
}

/** Deleting is the one control here that cannot be undone, so it reddens
 * under the pointer rather than looking like its harmless neighbour right up
 * to the click. */
function DeleteControl({
    image,
    onDelete,
}: {
    readonly image: GalleryImage
    readonly onDelete: DeleteRequest
}) {
    const remove = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            onDelete([image.id], event.shiftKey)
        },
        [image.id, onDelete],
    )

    return (
        <Tooltip label="Delete">
            <Button
                aria-label={`Delete “${image.prompt}”`}
                className="hover:text-rose-600"
                onClick={remove}
                size="icon-sm"
                variant="overlay"
            >
                <Trash2 aria-hidden />
            </Button>
        </Tooltip>
    )
}

/**
 * The controls over the picture, revealed on hover.
 *
 * The reveal lives on the wrapper so each button keeps its own hover/press
 * transitions untouched. `pointer-events` gates clicks while hidden, but
 * tabbing still reaches the buttons — `has-[:focus-visible]` brings them into
 * view for exactly that case. While a selection is underway the controls stay
 * put away: the dock holds these actions for the whole selection, and a lone
 * delete button over a tile mid-sweep would invite the wrong click.
 */
function TileControls({
    hidden,
    image,
    onDelete,
}: {
    readonly hidden: boolean
    readonly image: GalleryImage
    readonly onDelete: DeleteRequest
}) {
    return (
        <span
            className={cn(
                'pointer-events-none absolute top-2.5 right-2.5 flex translate-y-1 gap-1.5 opacity-0 transition-[opacity,translate] duration-200 ease-out',
                !hidden &&
                    'group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100',
            )}
            data-no-marquee
        >
            <DownloadControl image={image} />
            <DeleteControl image={image} onDelete={onDelete} />
        </span>
    )
}

/**
 * The small square in the tile's corner that starts and grows a selection.
 * Hidden until the tile is hovered; once any selection exists it stays on
 * every tile, so the wall reads as a set of checkboxes mid-sweep. Filling
 * with the accent when selected, it is also the tile's loudest "picked" mark.
 */
function SelectToggle({
    image,
    onSelect,
    selected,
    selectionActive,
}: {
    readonly image: GalleryImage
    readonly onSelect: SelectRequest
    readonly selected: boolean
    readonly selectionActive: boolean
}) {
    const toggle = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            onSelect(image.id, event.shiftKey ? 'range' : 'toggle')
        },
        [image.id, onSelect],
    )

    return (
        <button
            aria-label={selected ? `Deselect “${image.prompt}”` : `Select “${image.prompt}”`}
            aria-pressed={selected}
            className={cn(
                'absolute top-2.5 left-2.5 flex size-6 cursor-pointer items-center justify-center rounded-lg outline-none transition-[opacity,background-color,box-shadow,scale] duration-200 ease-out focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-90',
                selected
                    ? 'bg-accent text-accent-ink shadow-[0_4px_12px_-4px_var(--umber-glass-shadow)]'
                    : 'bg-surface/90 inset-ring inset-ring-ink/15 shadow-[0_4px_12px_-4px_var(--umber-glass-shadow)] backdrop-blur-md hover:bg-surface',
                selected || selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            data-no-marquee
            onClick={toggle}
            type="button"
        >
            <Check
                aria-hidden
                className={cn(
                    'size-4 transition-[opacity,scale] duration-150 ease-out',
                    selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                )}
                strokeWidth={3}
            />
        </button>
    )
}

/**
 * The picture itself, as a button: opening the piece is an action, and this
 * way it is reachable by keyboard and announced as one. `select-none` keeps a
 * Shift sweep from painting a text selection across the wall.
 */
function TileFace({
    image,
    onActivate,
}: {
    readonly image: GalleryImage
    readonly onActivate: (event: MouseEvent<HTMLButtonElement>) => void
}) {
    const style = useMemo(() => ({ aspectRatio: ratioToCss(image.ratio) }), [image.ratio])

    return (
        <button
            className="relative block w-full cursor-pointer rounded-2xl outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onActivate}
            type="button"
        >
            {image.kind === 'video' ? (
                <TileVideo label={image.prompt} src={image.url} style={style} />
            ) : (
                <TileImage label={image.prompt} src={image.url} style={style} />
            )}

            {image.kind === 'video' ? <DurationBadge seconds={image.durationSeconds ?? 0} /> : null}
        </button>
    )
}

/** The accent frame, hugging the picture's own edge. It rides the same hover
 * lift as the media so the two never shear. */
function SelectedFrame({ selected }: { readonly selected: boolean }) {
    return (
        <span
            aria-hidden
            className={cn(
                'pointer-events-none absolute inset-0 rounded-2xl inset-ring-2 inset-ring-accent transition-[opacity,translate] duration-200 ease-out group-hover:-translate-y-0.5',
                selected ? 'opacity-100' : 'opacity-0',
            )}
        />
    )
}

/**
 * One creation in the masonry: the picture, which opens full size, the
 * selection square in one corner, and the hover controls in the other. The
 * prompt doubles as the media's accessible name — it is the only description
 * of the picture that exists. The id is on the wrapper so a key press can
 * find the creation the keyboard is currently inside, which is what ⌘⌫
 * deletes.
 */
export function GalleryTile({
    image,
    onDelete,
    onOpen,
    onSelect,
    selected,
    selectionActive,
}: GalleryTileProps) {
    // One click, three meanings, checked in the order a photo library taught:
    // Shift sweeps a range, ⌘ (or a selection already underway) toggles this
    // tile, and a plain click on a quiet wall opens the piece.
    const activate = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            if (event.shiftKey) {
                onSelect(image.id, 'range')
            } else if (event.metaKey || event.ctrlKey || selectionActive) {
                onSelect(image.id, 'toggle')
            } else {
                onOpen(image.id)
            }
        },
        [image.id, onOpen, onSelect, selectionActive],
    )

    return (
        <div className="group relative" data-creation-id={image.id}>
            {/* Selected, the whole tile shrinks as one piece — picture, frame
                and checkmark together, nothing left floating at the old
                bounds — revealing a sliver of canvas around it. */}
            <div
                className={cn(
                    'relative transition-[scale] duration-200 ease-out',
                    selected && 'scale-[0.94]',
                )}
            >
                <TileFace image={image} onActivate={activate} />
                <SelectedFrame selected={selected} />
                <SelectToggle
                    image={image}
                    onSelect={onSelect}
                    selected={selected}
                    selectionActive={selectionActive}
                />
                <TileControls hidden={selectionActive} image={image} onDelete={onDelete} />
            </div>
        </div>
    )
}
