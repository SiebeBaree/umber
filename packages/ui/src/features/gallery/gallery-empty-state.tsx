import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { CSSProperties } from 'react'

import { Button } from '../../components/ui/button'
import { cn } from '../../lib/cn'
import { ratioToCss, type AspectRatio } from '../create/catalog'

/** The sheen every empty frame carries; a hint of picture, not a picture. */
const FRAME_FILL =
    'radial-gradient(80% 80% at 30% 20%, rgb(255 255 255 / 0.9), transparent 70%), linear-gradient(150deg, color-mix(in srgb, var(--umber-accent) 12%, transparent), transparent 75%)'

function frameStyle(ratio: AspectRatio): CSSProperties {
    return { aspectRatio: ratioToCss(ratio), backgroundImage: FRAME_FILL }
}

/** The shapes a gallery will hold, fanned out like the providers' card hand. */
const FANNED_FRAMES: readonly {
    readonly ratio: AspectRatio
    readonly tilt: string
    readonly style: CSSProperties
}[] = [
    { ratio: '2:3', tilt: '-rotate-12 translate-y-2', style: frameStyle('2:3') },
    { ratio: '1:1', tilt: '-rotate-6 translate-y-0.5', style: frameStyle('1:1') },
    { ratio: '3:2', tilt: 'rotate-0 -translate-y-0.5', style: frameStyle('3:2') },
    { ratio: '9:16', tilt: 'rotate-6 translate-y-0.5', style: frameStyle('9:16') },
    { ratio: '4:3', tilt: 'rotate-12 translate-y-2', style: frameStyle('4:3') },
]

/** The gallery before anything has been made: empty frames and one way out. */
export function GalleryEmptyState() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
            <div aria-hidden className="flex items-center -space-x-1.5">
                {FANNED_FRAMES.map(({ ratio, style, tilt }) => (
                    <div
                        className={cn('glass-raised h-14 rounded-lg', tilt)}
                        key={ratio}
                        style={style}
                    />
                ))}
            </div>

            <h2 className="mt-7 font-semibold">Nothing here yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                Everything you generate lands here and stays on this device.
            </p>

            <Button asChild className="mt-7">
                <Link to="/">
                    <Plus aria-hidden />
                    Start creating
                </Link>
            </Button>
        </div>
    )
}
