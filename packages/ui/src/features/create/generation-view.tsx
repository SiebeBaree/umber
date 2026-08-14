import { TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { ImageDetailDialog, type ImageDetails } from '../gallery/image-detail-dialog'
import { useGeneration, type GenerationJob } from '../generate/generation-context'
import { RenderingTile } from '../generate/rendering-tile'
import { ratioParts } from './catalog'
import { ResultTile, VideoResultTile } from './result-tile'

/**
 * One run on the stage above the composer: skeletons while rendering, the
 * results once they land, a plain account of what went wrong if they don't.
 * Several of these stack when several runs are going at once.
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

/**
 * What a finished run leaves behind. With runs stacking up, an unlabelled grid
 * of pictures says nothing about which prompt or model made it — so the line
 * the run rendered under stays, in the past tense.
 */
function DoneLine({ job }: { readonly job: GenerationJob }) {
    if (job.status !== 'done') {
        return null
    }

    return (
        <p className="text-[13px] font-medium text-muted tabular-nums">
            {job.modelName} · {Math.max(1, Math.round(job.generationMs / 1000))}s
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
        mediaType: output.mediaType,
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
            <VideoResultTile
                index={index}
                job={job}
                key={output.id}
                mediaType={output.mediaType}
                url={output.url}
            />
        ))
    }

    return job.outputs.map((output, index) => (
        <ResultTile
            index={index}
            job={job}
            key={output.id}
            mediaType={output.mediaType}
            onOpen={onOpen}
            url={output.url}
        />
    ))
}

export function GenerationView({ job }: { readonly job: GenerationJob }) {
    const { dismiss } = useGeneration()
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

    const dismissJob = useCallback(() => {
        dismiss(job.id)
    }, [dismiss, job.id])

    if (job.status === 'failed') {
        return <FailedCard job={job} onDismiss={dismissJob} />
    }

    return (
        <div className="flex w-full flex-col items-center gap-5">
            <div className="grid w-full gap-4" style={gridStyle}>
                <RunTiles job={job} onOpen={setOpenIndex} />
            </div>

            {job.status === 'running' ? <StatusLine job={job} /> : <DoneLine job={job} />}

            {/* No delete here: these tiles mirror one run, and removing a
                creation is the gallery's job. */}
            <ImageDetailDialog image={openImage} onOpenChange={closeDetail} />
        </div>
    )
}
