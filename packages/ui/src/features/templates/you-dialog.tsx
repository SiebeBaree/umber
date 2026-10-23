import { ImagePlus, X } from 'lucide-react'
import { useCallback, useRef, type ChangeEvent } from 'react'

import { Button } from '../../components/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '../../components/ui/dialog'
import type { YouPhotoView, YouPhotosApi } from './use-you-photos'
import { MAX_YOU_PHOTOS } from './you-photos'

// What a photo carries into every render. Selfies bring wide-angle faces and
// phone smoothing, filters bring plastic skin, old photos bring the wrong hair.
const TIPS = [
    'Taken by someone else, at most one selfie',
    'No filters, beauty mode or portrait blur',
    'Recent, with your current hair',
    'At least one full-length photo',
] as const

/** The types `fitPhoto` can read in every shell; HEIC needs converting first. */
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp'

function PhotoSlot({
    index,
    onRemove,
    photo,
}: {
    readonly photo: YouPhotoView
    readonly index: number
    readonly onRemove: (id: string) => void
}) {
    const remove = useCallback(() => {
        onRemove(photo.id)
    }, [onRemove, photo.id])

    return (
        <li className="relative aspect-square">
            <img
                alt={`You, number ${index + 1}`}
                className="size-full rounded-xl object-cover inset-ring inset-ring-ink/10"
                draggable={false}
                src={photo.url}
            />
            <Button
                aria-label={`Remove photo ${index + 1}`}
                className="absolute top-1 right-1 size-6 [&_svg]:size-3.5"
                onClick={remove}
                size="icon-sm"
                variant="overlay"
            >
                <X aria-hidden />
            </Button>
        </li>
    )
}

const ADD_TILE_CLASSES =
    'flex size-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-ink/20 text-muted transition-colors duration-200 ease-out outline-none hover:border-ink/35 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function AddTile({ onPick }: { readonly onPick: () => void }) {
    return (
        <li className="aspect-square">
            <button
                aria-label="Add photos"
                className={ADD_TILE_CLASSES}
                onClick={onPick}
                type="button"
            >
                <ImagePlus aria-hidden className="size-5" />
            </button>
        </li>
    )
}

/** The stored photos, then one tile to add more while there is room. */
function PhotoGrid({ you }: { readonly you: YouPhotosApi }) {
    const input = useRef<HTMLInputElement>(null)
    const { add } = you

    const pick = useCallback(() => {
        input.current?.click()
    }, [])

    const picked = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const files = [...(event.target.files ?? [])]

            // Cleared so picking the same file again still fires a change.
            event.target.value = ''
            void add(files)
        },
        [add],
    )

    return (
        <>
            <ul className="mt-5 grid grid-cols-5 gap-2">
                {you.photos.map((photo, index) => (
                    <PhotoSlot index={index} key={photo.id} onRemove={you.remove} photo={photo} />
                ))}

                {you.photos.length < MAX_YOU_PHOTOS ? <AddTile onPick={pick} /> : null}
            </ul>

            <input
                accept={ACCEPTED_TYPES}
                className="hidden"
                multiple
                onChange={picked}
                ref={input}
                type="file"
            />
        </>
    )
}

export interface YouDialogProps {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
    readonly you: YouPhotosApi
}

/** Adding and removing the photos every Templates render is made from. */
export function YouDialog({ onOpenChange, open, you }: YouDialogProps) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-lg">
                <DialogTitle>Your photos</DialogTitle>
                <DialogDescription>
                    Umber sends these with every photo it makes, so the face stays yours. They are
                    stored only on this computer.
                </DialogDescription>

                <PhotoGrid you={you} />

                {you.error === null ? null : (
                    <p className="mt-3 text-[13px] text-rose-600" role="alert">
                        {you.error}
                    </p>
                )}

                <ul className="mt-4 list-disc space-y-1 ps-5 text-[13px] text-muted">
                    {TIPS.map((tip) => (
                        <li key={tip}>{tip}</li>
                    ))}
                </ul>

                <div className="mt-6 flex justify-end">
                    <DialogClose asChild>
                        <Button>Done</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    )
}
