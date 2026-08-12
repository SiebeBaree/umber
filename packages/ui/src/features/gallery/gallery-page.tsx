import { Link } from '@tanstack/react-router'
import { Images } from 'lucide-react'

import { Button } from '../../components/ui/button'

/**
 * The gallery page. Nothing can be generated yet, so all it has to say is
 * where creations will end up once something can be.
 */
export function GalleryPage() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24 text-center">
            <div className="glass flex size-16 items-center justify-center rounded-2xl">
                <Images aria-hidden className="size-7 text-muted" />
            </div>

            <div>
                <h1 className="text-xl font-semibold tracking-tight">Nothing here yet</h1>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                    Every image and video you generate will show up here.
                </p>
            </div>

            <Button asChild size="sm" variant="glass">
                <Link to="/">Start creating</Link>
            </Button>
        </div>
    )
}
