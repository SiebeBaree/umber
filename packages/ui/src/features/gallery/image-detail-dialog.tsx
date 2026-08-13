import { ArrowLeft, Download, Trash2 } from 'lucide-react'
import { useCallback, useRef, type ReactNode } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog'
import { ProviderMark, type AspectRatio, type ProviderId } from '../create/catalog'

/**
 * One creation at full size: how it was made on the left, the picture itself
 * on the right. Opened from a gallery tile or from a finished run on the
 * create page, which is why it takes a plain description rather than either
 * page's own shape.
 */

export interface ImageDetails {
    readonly id: string
    /** An object URL over the image; owned by whoever opened this. */
    readonly url: string
    readonly prompt: string
    readonly providerId: string
    readonly modelName: string
    readonly ratio: AspectRatio
    /** Absent when the creation predates recording it. */
    readonly resolution?: string | undefined
    /** Absent on models that do not price by quality. */
    readonly quality?: string | undefined
    /** Epoch milliseconds. */
    readonly createdAt: number
}

/**
 * "13 Aug 2026, 15:30" — the whole answer to "when", short enough to sit on
 * one line of the details card, which is why the parts are assembled here
 * rather than left to `dateStyle`/`timeStyle`.
 */
function formatCreatedAt(createdAt: number): string {
    const date = new Date(createdAt)

    if (Number.isNaN(date.getTime())) {
        return 'Unknown'
    }

    const day = date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

    return `${day}, ${time}`
}

/** The tiers arrive lower-cased from the API vocabulary; the UI says them. */
function formatQuality(quality: string): string {
    return quality.charAt(0).toUpperCase() + quality.slice(1)
}

function DetailRow({ children, label }: { readonly label: string; readonly children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-muted">{label}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-end font-medium">{children}</dd>
        </div>
    )
}

/** How the picture was made: the model, the moment, and the settings. */
function DetailRows({ image }: { readonly image: ImageDetails }) {
    return (
        <dl className="mt-2 divide-y divide-ink/[0.06] rounded-2xl bg-ink/[0.03] px-4 text-[13px]">
            <DetailRow label="Model">
                <ProviderMark
                    className="size-3.5 shrink-0 text-muted"
                    provider={image.providerId as ProviderId}
                />
                <span className="truncate">{image.modelName}</span>
            </DetailRow>
            <DetailRow label="Created">{formatCreatedAt(image.createdAt)}</DetailRow>
            <DetailRow label="Aspect ratio">{image.ratio}</DetailRow>
            {image.resolution === undefined ? null : (
                <DetailRow label="Resolution">{image.resolution}</DetailRow>
            )}
            {image.quality === undefined || image.quality === '' ? null : (
                <DetailRow label="Quality">{formatQuality(image.quality)}</DetailRow>
            )}
        </dl>
    )
}

interface DetailPanelProps {
    readonly image: ImageDetails
    readonly onClose: () => void
    readonly onDelete?: ((id: string) => void) | undefined
}

function DetailPanel({ image, onClose, onDelete }: DetailPanelProps) {
    const remove = useCallback(() => {
        onDelete?.(image.id)
        onClose()
    }, [image.id, onClose, onDelete])

    return (
        <div className="flex min-h-0 shrink-0 flex-col overflow-y-auto p-5 sm:w-[21rem] sm:p-6">
            <div>
                <Button aria-label="Close" onClick={onClose} size="icon-sm" variant="ghost">
                    <ArrowLeft aria-hidden />
                </Button>
            </div>

            {/* The prompt is the picture's only name, so it is the title. No
                subtitle under it: everything one would carry — the model, the
                moment — the details card below states exactly. */}
            <DialogTitle className="mt-4 pe-0 text-lg leading-snug">{image.prompt}</DialogTitle>

            <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm">
                    <a download={`umber-${image.id.slice(0, 8)}.png`} href={image.url}>
                        <Download aria-hidden />
                        Download
                    </a>
                </Button>
                {onDelete === undefined ? null : (
                    <Button
                        className="hover:text-rose-600"
                        onClick={remove}
                        size="sm"
                        variant="glass"
                    >
                        <Trash2 aria-hidden />
                        Delete
                    </Button>
                )}
            </div>

            <h3 className="mt-7 text-[11px] font-semibold tracking-wide text-muted uppercase">
                Details
            </h3>
            <DetailRows image={image} />
        </div>
    )
}

/** The picture itself, contained rather than cropped: this is the view you
 * open to see the whole thing. */
function BigPicture({ image }: { readonly image: ImageDetails }) {
    return (
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-5 sm:ps-0">
            <img
                alt={image.prompt}
                className="max-h-[min(72vh,36rem)] max-w-full rounded-2xl object-contain shadow-[0_16px_40px_-20px_var(--umber-glass-shadow)]"
                draggable={false}
                src={image.url}
            />
        </div>
    )
}

/*
 * Unpadded and free of a fixed height, so the panel takes the shape of what is
 * in it: a landscape picture makes a short wide dialog, a portrait a tall one,
 * with no empty frame either way. Its *width* stays definite though — sizing
 * that to the content as well would let the picture hug narrower shapes, but
 * then the image's `max-w-full` resolves against an indefinite basis and
 * collapses it to a few pixels.
 */
const PANEL_CLASSES = 'max-h-[min(90vh,48rem)] max-w-[62rem] p-0 sm:flex-row'

export interface ImageDetailDialogProps {
    /** The creation to show, or null when nothing is open. */
    readonly image: ImageDetails | null
    readonly onOpenChange: (open: boolean) => void
    /** Omitted where the surface offers no delete, as the create stage does not. */
    readonly onDelete?: ((id: string) => void) | undefined
}

/**
 * `showClose` is off because the panel's top-right corner belongs to the
 * picture; the details column carries the close control instead. And
 * `aria-describedby` is cleared because there is no description element — the
 * title is the prompt, which says it all.
 */
export function ImageDetailDialog({ image, onDelete, onOpenChange }: ImageDetailDialogProps) {
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
                        <DetailPanel image={shown} onClose={close} onDelete={onDelete} />
                        <BigPicture image={shown} />
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
