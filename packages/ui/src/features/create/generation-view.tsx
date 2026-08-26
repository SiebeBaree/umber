import { useCallback, useMemo, useState, useEffect } from 'react'

import { ImageDetailDialog, type ImageDetails } from '../gallery/image-detail-dialog'
import type { GenerationJob } from '../generate/generation-context'
import { RenderingTile } from '../generate/rendering-tile'
import { ratioParts } from './catalog'
import { ResultTile, VideoResultTile } from './result-tile'

/**
 * One run on the stage above the composer: skeletons while rendering, then the
 * results once they land. Several of these stack when several runs are going at
 * once. A run that made nothing is not here at all — it leaves the stage and
 * says why in a notification.
 */

/**
 * How many tiles this run puts on the stage.
 *
 * While it works, that is what was asked for. Once it lands, it is what
 * actually arrived: a pair of images where one call failed is one picture, and
 * the grid should be a single tile rather than a picture next to a hole.
 */
function tileCount(job: GenerationJob): number {
    return job.status === 'done' ? job.outputs.length : job.count
}

/** Grid shape by tile count: a single, a pair, or a 2×2. */
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
    const count = tileCount(job)
    const columns = columnsFor(count)
    const rows = Math.ceil(count / columns)

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
    const gridStyle = useMemo(
        () => ({
            maxWidth: gridMaxWidth(job),
            gridTemplateColumns: `repeat(${columnsFor(tileCount(job))}, minmax(0, 1fr))`,
        }),
        [job],
    )

    const [openIndex, setOpenIndex] = useState<number | null>(null)

    const closeDetail = useCallback(() => {
        setOpenIndex(null)
    }, [])

    const openImage = openIndex === null ? null : detailsOf(job, openIndex)

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
