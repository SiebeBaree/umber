import { isImageModel, type AspectRatio, type Model } from '../create/catalog'
import type { ModeSettings } from '../create/settings/schema'

/**
 * What one run is: the request that started it, and whatever became of it.
 * Runs are independent, so everything a job needs to render and to be stored
 * is captured here at the moment it starts.
 */

export interface GeneratedOutput {
    readonly id: string
    /** An object URL over the stored blob; owned and revoked by the store. */
    readonly url: string
    /** The blob's own media type, so a download can be named correctly. */
    readonly mediaType: string
}

interface JobBase {
    readonly id: string
    /** What the run makes; decides how its tiles render and store. */
    readonly kind: 'image' | 'video'
    readonly prompt: string
    readonly providerId: string
    readonly modelId: string
    readonly modelName: string
    readonly ratio: AspectRatio
    readonly resolution: string
    readonly quality: string
    /** How many outputs the run was asked for; sizes the skeleton grid. */
    readonly count: number
    /** Clip length in seconds; zero for image runs. */
    readonly durationSeconds: number
    readonly startedAt: number
}

export type GenerationJob =
    | (JobBase & { readonly status: 'running' })
    | (JobBase & {
          readonly status: 'done'
          readonly outputs: readonly GeneratedOutput[]
          /** How long the run took, in milliseconds. */
          readonly generationMs: number
      })
    | (JobBase & { readonly status: 'failed'; readonly error: string })

export interface StartInput {
    readonly prompt: string
    readonly model: Model
    readonly settings: ModeSettings
    readonly references: readonly File[]
}

export function newJob(input: StartInput): GenerationJob {
    const image = isImageModel(input.model)

    return {
        id: crypto.randomUUID(),
        kind: input.model.kind,
        prompt: input.prompt,
        providerId: input.model.provider,
        modelId: input.model.id,
        modelName: input.model.name,
        ratio: input.settings.aspectRatio as AspectRatio,
        resolution: input.settings.resolution,
        // Only models with tiers price by quality; for the rest the remembered
        // tier is dormant and saying so would be inventing a setting.
        quality: image && input.model.quality !== undefined ? input.settings.quality : '',
        // Video runs render one clip; the count stepper is an image control.
        count: image ? input.settings.outputCount : 1,
        durationSeconds: image ? 0 : input.settings.durationSeconds,
        startedAt: Date.now(),
        status: 'running',
    }
}

/**
 * How many runs the stage keeps. Older finished ones are dropped as new ones
 * arrive — every output is already in the gallery, so nothing is lost, and the
 * files behind the dropped tiles stop costing memory.
 *
 * Comfortably above the number that may run at once, so a batch fired off
 * together is never half-eaten the moment it lands.
 */
const MAX_JOBS_KEPT = 12

/**
 * Trims the stage back to its limit, oldest first. A run still working is
 * never dropped: it has results coming, and its skeletons are the only sign
 * that anything is happening.
 */
export function pruned(jobs: readonly GenerationJob[]): readonly GenerationJob[] {
    if (jobs.length <= MAX_JOBS_KEPT) {
        return jobs
    }

    let toDrop = jobs.length - MAX_JOBS_KEPT

    return jobs.filter((job) => {
        if (toDrop === 0 || job.status === 'running') {
            return true
        }

        toDrop -= 1

        return false
    })
}
