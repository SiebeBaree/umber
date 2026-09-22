import type { ReactNode } from 'react'

import { ProviderMark, type ProviderId } from '../create/catalog'
import { formatCost } from '../create/pricing'
import type { ImageDetails } from './image-detail-dialog'

/**
 * "13 Aug 2026, 15:30" — the whole answer to "when", short enough to sit on
 * one line of the details card, which is why the parts are assembled here
 * rather than left to `dateStyle`/`timeStyle`.
 */
function formatCreatedAt(createdAt: number): string {
    const date = new Date(createdAt)

    if (Number.isNaN(date.getTime())) {
        return 'Unknown'
    }

    const day = date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

    return `${day}, ${time}`
}

/**
 * "8.4s", or "2m 13s" once a run passes the minute. Under a minute keeps its
 * decimal, which is the resolution at which two models actually differ.
 */
function formatGenerationTime(generationMs: number): string {
    const seconds = Math.round(Math.max(0, generationMs) / 100) / 10

    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`
    }

    const whole = Math.round(seconds)

    return `${Math.floor(whole / 60)}m ${whole % 60}s`
}

/** The tiers arrive lower-cased from the API vocabulary; the UI says them. */
function formatQuality(quality: string): string {
    return quality.charAt(0).toUpperCase() + quality.slice(1)
}

function DetailRow({ children, label }: { readonly label: string; readonly children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-muted">{label}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-end font-medium">{children}</dd>
        </div>
    )
}

/** How the picture was made: the model, the moment, and the settings. */
export function DetailRows({ image }: { readonly image: ImageDetails }) {
    return (
        <dl className="mt-2 shrink-0 divide-y divide-ink/[0.06] rounded-2xl bg-ink/[0.03] px-4 text-[13px]">
            <DetailRow label="Model">
                <ProviderMark
                    className="size-3.5 shrink-0 text-muted"
                    provider={image.providerId as ProviderId}
                />
                <span className="truncate">{image.modelName}</span>
            </DetailRow>
            {image.version === undefined ? null : (
                <DetailRow label="Version">v{image.version}</DetailRow>
            )}
            <DetailRow label="Estimated cost">
                {image.estimatedCost == null ? 'Not recorded' : formatCost(image.estimatedCost)}
            </DetailRow>
            <DetailRow label="Created">{formatCreatedAt(image.createdAt)}</DetailRow>
            {image.generationMs === undefined ? null : (
                <DetailRow label="Generation time">
                    <span className="tabular-nums">{formatGenerationTime(image.generationMs)}</span>
                </DetailRow>
            )}
            <DetailRow label="Aspect ratio">{image.ratio}</DetailRow>
            {image.resolution === undefined ? null : (
                <DetailRow label="Resolution">{image.resolution}</DetailRow>
            )}
            {image.quality === undefined || image.quality === '' ? null : (
                <DetailRow label="Quality">{formatQuality(image.quality)}</DetailRow>
            )}
            {image.durationSeconds === undefined ? null : (
                <DetailRow label="Duration">{image.durationSeconds}s</DetailRow>
            )}
        </dl>
    )
}
