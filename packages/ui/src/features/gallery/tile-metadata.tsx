import { CalendarDays, Clock3, Coins } from 'lucide-react'

import { formatCost } from '../create/pricing'
import type { GalleryImage } from './gallery-tile'

export function TileMetadata({ image }: { readonly image: GalleryImage }) {
    return (
        <>
            {image.version === undefined ? null : (
                <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-surface/70 px-2 py-0.5 text-[10px] font-medium backdrop-blur-md">
                    v{image.version}
                </span>
            )}
            <span className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-white/25 bg-surface/65 px-3 py-1.5 text-[10px] font-medium tabular-nums opacity-0 shadow-sm backdrop-blur-xl transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none">
                <span className="flex items-center gap-1" title="Estimated cost">
                    <Coins aria-hidden className="size-3" />
                    {image.estimatedCost == null ? '—' : formatCost(image.estimatedCost)}
                </span>
                {image.generationMs === undefined ? null : (
                    <span className="flex items-center gap-1">
                        <Clock3 aria-hidden className="size-3" />
                        {(image.generationMs / 1000).toFixed(1)}s
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <CalendarDays aria-hidden className="size-3" />
                    {new Date(image.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                    })}
                </span>
            </span>
        </>
    )
}
