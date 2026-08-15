import { MoveRight, Plus, X } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'

import { Button } from '../../components/ui/button'
import type { AssetCapabilities } from './catalog'
import type { AssetSlot, ComposerAsset } from './use-composer-assets'

/**
 * The files attached to the current prompt. Reference images are quiet square
 * thumbnails; on video models the start and end frames sit first as a labelled
 * pair, with a dashed stand-in for whichever frame is still missing so the
 * idea of "from here to here" is visible before it is complete.
 */

const FRAME_LABELS: Readonly<Partial<Record<AssetSlot, string>>> = {
    start: 'Start',
    end: 'End',
}

const TILE_SHADOW = 'shadow-[0_2px_8px_-4px_var(--umber-glass-shadow)]'

interface TileProps {
    readonly asset: ComposerAsset
    readonly onRemove: (id: string) => void
}

function RemoveButton({ asset, onRemove }: TileProps) {
    const remove = useCallback(() => {
        onRemove(asset.id)
    }, [asset.id, onRemove])

    return (
        <Button
            aria-label={`Remove ${asset.name}`}
            className="absolute -top-1.5 -right-1.5 size-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [&_svg]:size-3"
            onClick={remove}
            size="icon-sm"
            variant="overlay"
        >
            <X aria-hidden />
        </Button>
    )
}

function ReferenceTile({ asset, onRemove }: TileProps) {
    return (
        <li className="group relative">
            {/* The wrapper clips, so a file the browser cannot decode leaves an
                empty tile rather than spilling its alt text across the composer. */}
            <span
                className={`block size-16 overflow-hidden rounded-xl border border-line/80 bg-surface ${TILE_SHADOW}`}
            >
                <img alt={asset.name} className="size-full object-cover" src={asset.previewUrl} />
            </span>
            <RemoveButton asset={asset} onRemove={onRemove} />
        </li>
    )
}

/** A filled frame slot: a wider tile wearing its role on a small badge. */
function FrameTile({ asset, onRemove }: TileProps) {
    return (
        <li className="group relative">
            <span
                className={`block h-16 w-[6.5rem] overflow-hidden rounded-xl border border-line/80 bg-surface ${TILE_SHADOW}`}
            >
                <img alt={asset.name} className="size-full object-cover" src={asset.previewUrl} />
            </span>
            <span className="absolute bottom-1 left-1 rounded-md bg-surface/90 px-1.5 py-px text-[10px] font-medium text-ink">
                {FRAME_LABELS[asset.slot]}
            </span>
            <RemoveButton asset={asset} onRemove={onRemove} />
        </li>
    )
}

interface EmptyFrameProps {
    readonly slot: AssetSlot
    readonly onOpen: (slot: AssetSlot) => void
}

/** A frame slot not yet filled, drawn as the tile it is waiting to become. */
function EmptyFrame({ onOpen, slot }: EmptyFrameProps) {
    const open = useCallback(() => {
        onOpen(slot)
    }, [onOpen, slot])

    return (
        <li>
            <button
                aria-label={slot === 'start' ? 'Add a start frame' : 'Add an end frame'}
                className="flex h-16 w-[6.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line bg-surface/40 text-muted transition-colors duration-150 ease-out hover:border-ink/25 hover:text-ink focus-visible:border-ink/25 focus-visible:text-ink"
                onClick={open}
                type="button"
            >
                <Plus aria-hidden className="size-3.5" />
                <span className="text-[10px] font-medium">{FRAME_LABELS[slot]}</span>
            </button>
        </li>
    )
}

export interface AssetStripProps {
    readonly assets: readonly ComposerAsset[]
    readonly capabilities: AssetCapabilities
    readonly onRemove: (id: string) => void
    readonly onOpen: (slot: AssetSlot) => void
}

export function AssetStrip({ assets, capabilities, onOpen, onRemove }: AssetStripProps) {
    const start = assets.find((asset) => asset.slot === 'start')
    const end = assets.find((asset) => asset.slot === 'end')
    const references = assets.filter((asset) => asset.slot === 'reference')

    const frames: ReactNode[] = []

    if (capabilities.frames) {
        frames.push(
            start === undefined ? (
                <EmptyFrame key="start" onOpen={onOpen} slot="start" />
            ) : (
                <FrameTile asset={start} key="start" onRemove={onRemove} />
            ),
        )

        if (capabilities.lastFrame) {
            frames.push(
                <li aria-hidden className="flex items-center" key="arrow">
                    <MoveRight className="size-4 text-muted/60" />
                </li>,
                end === undefined ? (
                    <EmptyFrame key="end" onOpen={onOpen} slot="end" />
                ) : (
                    <FrameTile asset={end} key="end" onRemove={onRemove} />
                ),
            )
        }
    }

    return (
        <ul
            aria-label="Attached files"
            className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-3"
        >
            {frames}

            {frames.length > 0 && references.length > 0 ? (
                <li aria-hidden className="mx-1 h-10 w-px bg-ink/10" />
            ) : null}

            {references.map((asset) => (
                <ReferenceTile asset={asset} key={asset.id} onRemove={onRemove} />
            ))}
        </ul>
    )
}
