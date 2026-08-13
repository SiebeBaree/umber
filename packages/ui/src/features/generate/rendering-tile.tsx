import { useMemo, type CSSProperties } from 'react'

import { cn } from '../../lib/cn'
import { ProviderMark, ratioToCss, type AspectRatio, type ProviderId } from '../create/catalog'

export interface RenderingTileProps {
    readonly ratio: AspectRatio
    readonly providerId: string
    readonly className?: string
}

/** A soft accent pool drifting behind the glass, so the tile reads as
 * something forming rather than a flat placeholder. */
const POOL_STYLE: CSSProperties = {
    background:
        'radial-gradient(45% 45% at 60% 40%, rgb(255 255 255 / 0.9), transparent 70%), radial-gradient(40% 40% at 30% 65%, color-mix(in srgb, var(--umber-accent) 22%, transparent), transparent 70%)',
}

/**
 * A tile that is still being rendered, drawn wherever the finished image will
 * land: the create stage while a run is in flight, and the gallery mirroring
 * it. Liquid glass at work — the surface itself, a light band sweeping it,
 * grain on top, and the provider's mark breathing at the centre.
 */
export function RenderingTile({ className, providerId, ratio }: RenderingTileProps) {
    const style = useMemo(() => ({ aspectRatio: ratioToCss(ratio) }), [ratio])

    return (
        <div
            className={cn('glass relative w-full overflow-hidden rounded-2xl', className)}
            style={style}
        >
            <div
                aria-hidden
                className="drift-b absolute -inset-[30%] opacity-60"
                style={POOL_STYLE}
            />

            {/* The sweeping light band. */}
            <div aria-hidden className="absolute inset-0 overflow-hidden">
                <div className="sheen absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            </div>

            <div aria-hidden className="film-grain absolute inset-0 opacity-25" />

            <div className="absolute inset-0 flex items-center justify-center">
                <ProviderMark
                    className="breathe size-8 text-ink/60"
                    provider={providerId as ProviderId}
                />
            </div>
        </div>
    )
}
