import { useMemo } from 'react'

import { VideoPlayer } from '../../components/ui/video-player'
import { ratioToCss } from '../create/catalog'
import type { ImageDetails } from './image-detail-dialog'

/** The piece itself, contained rather than cropped: this is the view you
 * open to see the whole thing. A clip arrives playing, with sound. */
export function BigPicture({ image }: { readonly image: ImageDetails }) {
    const frameStyle = useMemo(() => ({ aspectRatio: ratioToCss(image.ratio) }), [image.ratio])

    return (
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-5 sm:ps-0">
            {image.kind === 'video' ? (
                <VideoPlayer
                    autoPlay
                    className="max-h-[min(36rem,calc(100dvh-10.5rem))] w-full max-w-full shadow-[0_16px_40px_-20px_var(--umber-glass-shadow)]"
                    label={image.prompt}
                    src={image.url}
                    style={frameStyle}
                />
            ) : (
                <img
                    alt={image.prompt}
                    className="max-h-[min(36rem,calc(100dvh-10.5rem))] max-w-full rounded-2xl object-contain shadow-[0_16px_40px_-20px_var(--umber-glass-shadow)]"
                    draggable={false}
                    src={image.url}
                />
            )}
        </div>
    )
}
