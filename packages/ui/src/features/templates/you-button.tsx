import { ImagePlus } from 'lucide-react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { useTemplates } from './templates-context'

/** The bar's way into the user's photos: a few faces, or the ask for them. */
export function YouButton({ onOpen }: { readonly onOpen: () => void }) {
    const { you } = useTemplates()

    if (you.ready && you.photos.length === 0) {
        return (
            <Button onClick={onOpen} variant="glass">
                <ImagePlus aria-hidden />
                Add your photos
            </Button>
        )
    }

    return (
        <Tooltip label="Your photos">
            <Button aria-label="Your photos" className="ps-1.5" onClick={onOpen} variant="glass">
                <span className="flex">
                    {you.photos.slice(0, 3).map((photo) => (
                        <img
                            alt=""
                            className="-ms-2 size-6 rounded-full object-cover ring-2 ring-white first:ms-0"
                            draggable={false}
                            key={photo.id}
                            src={photo.url}
                        />
                    ))}
                </span>
                You
            </Button>
        </Tooltip>
    )
}
