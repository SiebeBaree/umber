import { Download, TriangleAlert, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { VideoPlayer } from '../../components/ui/video-player'
import { ImageDetailDialog, type ImageDetails } from '../gallery/image-detail-dialog'
import { useGeneration, type GenerationJob } from '../generate/generation-context'
import { RenderingTile } from '../generate/rendering-tile'
import { ratioParts, ratioToCss } from './catalog'

/**
 * The stage above the composer while a run exists: skeletons while rendering,
 * the results once they land, a plain account of what went wrong if they
 * don't. One run at a time, front and centre.
 */

/** Grid shape by requested count: a single, a pair, or a 2×2. */
function columnsFor(count: number): number {
    return count <= 1 ? 1 : 2
}

/**
 * Everything around the stage that costs fixed height: header, the docked
 * composer, paddings and the status line. What the grid may use is the rest.
 */
const CHROME_HEIGHT = 330

/**
 * Caps the grid so the tallest layout still fits between header and composer.
 * Width follows from the tile height budget and the aspect ratio, so a
 * portrait single stays slim while an ultrawide single takes the row. Tiles
 * never drop under a readable minimum — on an absurdly short window the page
 * scrolls instead.
 */
function gridMaxWidth(job: GenerationJob): string {
    const { height, width } = ratioParts(job.ratio)
    const ratio = width / height
    const columns = columnsFor(job.count)
    const rows = Math.ceil(job.count / columns)

    const tileHeight = `max(140px, (100vh - ${CHROME_HEIGHT}px) / ${rows})`

    return `min(100%, calc(${columns} * (${tileHeight}) * ${ratio} + ${(columns - 1) * 16}px))`
}

const IMAGE_ENTER = { opacity: 0, scale: 0.985, filter: 'blur(10px)' }
const IMAGE_SETTLED = { opacity: 1, scale: 1, filter: 'blur(0px)' }

interface ResultTileProps {
    readonly job: GenerationJob
    readonly url: string
    readonly index: number
    readonly onOpen: (index: number) => void
}

/** The download control, revealed while the tile is hovered or focused. */
function ResultTileControls({ index, job, url }: Omit<ResultTileProps, 'onOpen'>) {
    const extension = job.kind === 'video' ? 'mp4' : 'png'

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
 * A finished clip, playing in place. The player owns the surface — its
 * controls are the interaction — so unlike an image there is no button to a
 * detail view; only the download control floats above it.
 */
function VideoResultTile({ index, job, url }: Omit<ResultTileProps, 'onOpen'>) {
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

            <ResultTileControls index={index} job={job} url={url} />
        </motion.div>
    )
}

function ResultTile({ index, job, onOpen, url }: ResultTileProps) {
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

            <ResultTileControls index={index} job={job} url={url} />
        </div>
    )
}

/** "Rendering with GPT Image 2 · 14s", ticking while the run is in flight. */
function StatusLine({ job }: { readonly job: GenerationJob }) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now())
        }, 1000)

        return () => {
            clearInterval(timer)
        }
    }, [])

    const seconds = Math.max(0, Math.round((now - job.startedAt) / 1000))

    return (
        <p className="flex items-center gap-2 text-[13px] font-medium text-muted tabular-nums">
            <span aria-hidden className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
                <span className="relative size-2 rounded-full bg-accent" />
            </span>
            Rendering with {job.modelName} · {seconds}s
        </p>
    )
}

function FailedCard({
    job,
    onDismiss,
}: {
    readonly job: GenerationJob
    readonly onDismiss: () => void
}) {
    return (
        <div className="glass flex w-full max-w-md flex-col items-center gap-4 rounded-3xl p-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/10">
                <TriangleAlert aria-hidden className="size-5 text-rose-600" />
            </div>
            <div>
                <h2 className="font-semibold">That run didn&rsquo;t make it</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {job.status === 'failed' ? job.error : null}
                </p>
            </div>
            <Button onClick={onDismiss} size="sm" variant="glass">
                <X aria-hidden />
                Dismiss
            </Button>
        </div>
    )
}

/**
 * The finished output the detail view is showing, described from the run that
 * made it. A job carries one set of settings, so every output in it shares
 * everything but the file.
 */
function detailsOf(job: GenerationJob, index: number): ImageDetails | null {
    if (job.status !== 'done') {
        return null
    }

    const output = job.outputs[index]

    if (output === undefined) {
        return null
    }

    return {
        id: output.id,
        kind: job.kind,
        url: output.url,
        prompt: job.prompt,
        providerId: job.providerId,
        modelName: job.modelName,
        ratio: job.ratio,
        resolution: job.resolution,
        quality: job.quality,
        ...(job.kind === 'video' ? { durationSeconds: job.durationSeconds } : {}),
        generationMs: job.generationMs,
        // The run's own clock: what the gallery stores is a few milliseconds
        // later, and neither is worth telling apart at minute resolution.
        createdAt: job.startedAt,
    }
}

/** The run's own tiles: its finished outputs, or one skeleton per expected one. */
function RunTiles({
    job,
    onOpen,
}: {
    readonly job: GenerationJob
    readonly onOpen: (index: number) => void
}) {
    if (job.status !== 'done') {
        return Array.from({ length: job.count }, (_, index) => (
            <RenderingTile key={index} providerId={job.providerId} ratio={job.ratio} />
        ))
    }

    if (job.kind === 'video') {
        return job.outputs.map((output, index) => (
            <VideoResultTile index={index} job={job} key={output.id} url={output.url} />
        ))
    }

    return job.outputs.map((output, index) => (
        <ResultTile index={index} job={job} key={output.id} onOpen={onOpen} url={output.url} />
    ))
}

export function GenerationView({ job }: { readonly job: GenerationJob }) {
    const generation = useGeneration()
    const gridStyle = useMemo(
        () => ({
            maxWidth: gridMaxWidth(job),
            gridTemplateColumns: `repeat(${columnsFor(job.count)}, minmax(0, 1fr))`,
        }),
        [job],
    )

    const [openIndex, setOpenIndex] = useState<number | null>(null)

    const closeDetail = useCallback(() => {
        setOpenIndex(null)
    }, [])

    const openImage = openIndex === null ? null : detailsOf(job, openIndex)

    if (job.status === 'failed') {
        return <FailedCard job={job} onDismiss={generation.reset} />
    }

    return (
        <div className="flex w-full flex-col items-center gap-5">
            <div className="grid w-full gap-4" style={gridStyle}>
                <RunTiles job={job} onOpen={setOpenIndex} />
            </div>

            {job.status === 'running' ? <StatusLine job={job} /> : null}

            {/* No delete here: these tiles mirror one run, and removing a
                creation is the gallery's job. */}
            <ImageDetailDialog image={openImage} onOpenChange={closeDetail} />
        </div>
    )
}
