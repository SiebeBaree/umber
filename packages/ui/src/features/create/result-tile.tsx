import { Download } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useMemo } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { VideoPlayer } from '../../components/ui/video-player'
import { mediaExtension } from '../../lib/media'
import type { GenerationJob } from '../generate/generation-context'
import { ratioToCss } from './catalog'

/**
 * One finished output on the stage: a still that opens into the detail view,
 * or a clip that plays in place. Both carry the same download control.
 */

const IMAGE_ENTER = { opacity: 0, scale: 0.985, filter: 'blur(10px)' }
const IMAGE_SETTLED = { opacity: 1, scale: 1, filter: 'blur(0px)' }

export interface ResultTileProps {
    readonly job: GenerationJob
    readonly url: string
    /** The blob's own media type, which names the download. */
    readonly mediaType: string
    readonly index: number
    readonly onOpen: (index: number) => void
}

/** The download control, revealed while the tile is hovered or focused. */
function ResultTileControls({ index, job, mediaType, url }: Omit<ResultTileProps, 'onOpen'>) {
    const extension = mediaExtension(mediaType, job.kind)

    return (
        <span className="pointer-events-none absolute top-2.5 right-2.5 translate-y-1 opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:translate-y-0 has-[:focus-visible]:opacity-100">
            <Tooltip label="Download">
                <Button
                    aria-label={`Download ${job.kind} ${index + 1}`}
                    asChild
                    size="icon-sm"
                    variant="overlay"
                >
                    <a
                        download={`umber-${job.id.slice(0, 8)}-${index + 1}.${extension}`}
                        href={url}
                    >
                        <Download aria-hidden />
                    </a>
                </Button>
            </Tooltip>
        </span>
    )
}

const VIDEO_ENTER = { opacity: 0, scale: 0.985 }
const VIDEO_SETTLED = { opacity: 1, scale: 1 }
const VIDEO_TRANSITION = { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }

/**
 * A finished clip, playing in place. The player owns the surface, its controls
 * are the interaction, so unlike an image there is no button to a detail view.
 * Only the download control floats above it.
 */
export function VideoResultTile({ index, job, mediaType, url }: Omit<ResultTileProps, 'onOpen'>) {
    const style = useMemo(() => ({ aspectRatio: ratioToCss(job.ratio) }), [job.ratio])

    return (
        <motion.div
            animate={VIDEO_SETTLED}
            className="group relative"
            initial={VIDEO_ENTER}
            transition={VIDEO_TRANSITION}
        >
            <VideoPlayer
                autoPlay
                className="w-full shadow-[0_16px_40px_-18px_var(--umber-glass-shadow)] inset-ring inset-ring-ink/10"
                label={job.prompt}
                src={url}
                style={style}
            />

            <ResultTileControls index={index} job={job} mediaType={mediaType} url={url} />
        </motion.div>
    )
}

export function ResultTile({ index, job, mediaType, onOpen, url }: ResultTileProps) {
    const style = useMemo(() => ({ aspectRatio: ratioToCss(job.ratio) }), [job.ratio])
    const transition = useMemo(
        () => ({ duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay: index * 0.08 }),
        [index],
    )

    const open = useCallback(() => {
        onOpen(index)
    }, [index, onOpen])

    return (
        <div className="group relative">
            {/* A button rather than a click handler on the image: opening the
                picture is an action, and this way it is reachable by keyboard
                and announced as one. */}
            <button
                className="block w-full cursor-pointer rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={open}
                type="button"
            >
                <motion.img
                    alt={`${job.prompt} — image ${index + 1}`}
                    animate={IMAGE_SETTLED}
                    className="block w-full rounded-2xl object-cover shadow-[0_16px_40px_-18px_var(--umber-glass-shadow)] inset-ring inset-ring-ink/10"
                    draggable={false}
                    initial={IMAGE_ENTER}
                    src={url}
                    style={style}
                    transition={transition}
                />
            </button>

            <ResultTileControls index={index} job={job} mediaType={mediaType} url={url} />
        </div>
    )
}
