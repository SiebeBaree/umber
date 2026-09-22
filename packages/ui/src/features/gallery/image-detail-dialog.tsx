import { useCallback, useRef } from 'react'

import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog'
import type { AspectRatio } from '../create/catalog'
import { BigPicture } from './big-picture'
import { DetailPanel } from './detail-panel'
import type { DeleteRequest } from './gallery-tile'
import type { VersionNavigation } from './version-strip'

/**
 * One creation at full size: how it was made on the left, the piece itself
 * on the right — a picture contained, or a clip in the player. Opened from a
 * gallery tile or from a finished run on the create page, which is why it
 * takes a plain description rather than either page's own shape.
 */

export interface ImageDetails {
    readonly id: string
    readonly parentId?: string | undefined
    readonly rootId?: string | undefined
    readonly version?: number | undefined
    /** Estimate captured at generation time, in USD. Null means unknown. */
    readonly estimatedCost?: number | null | undefined
    /** What the creation is; a video opens as a player instead of a still. */
    readonly kind: 'image' | 'video'
    /** An object URL over the media; owned by whoever opened this. */
    readonly url: string
    /** The blob's own media type, so a download can be named correctly. */
    readonly mediaType: string
    readonly prompt: string
    readonly providerId: string
    readonly modelId?: string | undefined
    readonly modelName: string
    readonly ratio: AspectRatio
    /** Absent when the creation predates recording it. */
    readonly resolution?: string | undefined
    /** Absent on models that do not price by quality. */
    readonly quality?: string | undefined
    /** Clip length in seconds; only videos carry one. */
    readonly durationSeconds?: number | undefined
    /** How long the run took, in milliseconds. Absent on older creations. */
    readonly generationMs?: number | undefined
    /** Epoch milliseconds. */
    readonly createdAt: number
}

// Keep the dialog below the native title-bar controls. A fixed viewport-bound
// height also keeps version navigation steady when the image or prompt changes.
const PANEL_CLASSES =
    'top-[calc(50%+2rem)] h-[min(calc(100dvh-8rem),48rem)] max-h-[calc(100dvh-8rem)] max-w-[62rem] p-0 sm:flex-row'

export interface ImageDetailDialogProps extends VersionNavigation {
    /** The creation to show, or null when nothing is open. */
    readonly image: ImageDetails | null
    readonly onOpenChange: (open: boolean) => void
    /** Omitted where the surface offers no delete, as the create stage does not. */
    readonly onDelete?: DeleteRequest | undefined
}

/**
 * `showClose` is off because the panel's top-right corner belongs to the
 * picture; the details column carries the close control instead. And
 * `aria-describedby` is cleared because there is no description element — the
 * the prompt has its own expandable reader.
 */
export function ImageDetailDialog({
    image,
    onDelete,
    onOpenChange,
    versions,
    onSelectVersion,
}: ImageDetailDialogProps) {
    const close = useCallback(() => {
        onOpenChange(false)
    }, [onOpenChange])

    /*
     * The panel keeps drawing the picture it was showing while it animates
     * out. Emptying it the moment it closes collapses the panel to nothing
     * mid-animation, `animationend` never fires, and Radix goes on holding a
     * scrim over an app nobody can click any more.
     *
     * Writing the ref during render is safe here: the same input always
     * produces the same value, so a double render cannot desynchronise it.
     */
    const lastShown = useRef<ImageDetails | null>(null)

    if (image !== null) {
        lastShown.current = image
    }

    const shown = image ?? lastShown.current

    return (
        <Dialog onOpenChange={onOpenChange} open={image !== null}>
            <DialogContent aria-describedby={undefined} className={PANEL_CLASSES} showClose={false}>
                {shown === null ? null : (
                    <>
                        <DialogTitle className="sr-only">
                            {shown.kind === 'video' ? 'Video details' : 'Image details'}
                        </DialogTitle>
                        <DetailPanel
                            image={shown}
                            onClose={close}
                            onDelete={onDelete}
                            versions={versions}
                            onSelectVersion={onSelectVersion}
                        />
                        <BigPicture image={shown} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
