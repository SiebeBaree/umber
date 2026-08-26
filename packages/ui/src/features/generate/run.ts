import { saveCreations, type CreationRecord } from '../gallery/creations-db'
import { runGeneration, type EngineRequest } from './engine'
import { GenerationError, messageOf } from './errors'
import type { FinishedJob, GenerationJob, StartInput } from './job'

/**
 * One run from end to end: credentials, the provider call, the gallery write,
 * and the object URLs the results are shown through. No component state and no
 * shared state, so any number of these can be in flight together.
 */

export type CredentialsOf = (providerId: string) => Promise<Readonly<Record<string, string>> | null>

interface RunResult {
    readonly outcome: FinishedJob
    /** False when the render finished but could not be written to the gallery. */
    readonly persisted: boolean
    /**
     * One sentence per output that was asked for and did not arrive, where at
     * least one did. Empty for a run that delivered everything.
     */
    readonly failures: readonly string[]
}

/**
 * One finished output as the gallery stores it. Everything but the file comes
 * from the job, so the record says exactly how the piece was made.
 */
function toRecord(job: GenerationJob, media: Blob, generationMs: number): CreationRecord {
    return {
        id: crypto.randomUUID(),
        kind: job.kind,
        prompt: job.prompt,
        providerId: job.providerId,
        modelId: job.modelId,
        modelName: job.modelName,
        ratio: job.ratio,
        resolution: job.resolution,
        quality: job.quality,
        ...(job.kind === 'video' ? { durationSeconds: job.durationSeconds } : {}),
        generationMs,
        createdAt: Date.now(),
        image: media,
    }
}

/** What the job and the composer's input add up to, as the engine reads it. */
function requestFor(
    job: GenerationJob,
    input: StartInput,
    credentials: Readonly<Record<string, string>>,
    onAttemptFailed: (message: string) => void,
): EngineRequest {
    return {
        mode: job.kind,
        providerId: input.model.provider,
        credentials,
        modelId: input.model.id,
        prompt: input.prompt,
        count: job.count,
        ratio: job.ratio,
        resolution: input.settings.resolution,
        quality: input.settings.quality,
        durationSeconds: job.durationSeconds,
        references: input.references,
        onAttemptFailed,
        ...(input.firstFrame === undefined ? {} : { firstFrame: input.firstFrame }),
        ...(input.lastFrame === undefined ? {} : { lastFrame: input.lastFrame }),
    }
}

/**
 * Writes the finished files to the gallery and mints the object URLs the tiles
 * are shown through.
 *
 * The clock is read once, the moment the files are in hand, so every output of
 * a run reports the same figure — which is the truth: they rendered together.
 * A failed write must not eat a finished render, so it is reported rather than
 * thrown: the pictures still show, they just won't survive a restart.
 */
async function land(
    job: GenerationJob,
    blobs: readonly Blob[],
): Promise<{ readonly outcome: FinishedJob; readonly persisted: boolean }> {
    const generationMs = Date.now() - job.startedAt
    const records = blobs.map((blob) => toRecord(job, blob, generationMs))

    let persisted = true
    try {
        await saveCreations(records)
    } catch {
        persisted = false
    }

    const outputs = records.map((record) => ({
        id: record.id,
        url: URL.createObjectURL(record.image),
        mediaType: record.image.type,
    }))

    return { outcome: { ...job, status: 'done', outputs, generationMs }, persisted }
}

async function performRun(
    job: GenerationJob,
    input: StartInput,
    credentialsOf: CredentialsOf,
): Promise<RunResult> {
    const credentials = await credentialsOf(input.model.provider)

    if (credentials === null) {
        throw new GenerationError('No key is connected for this provider. Add one in Settings.')
    }

    // Runs that make several images at once make them with several independent
    // calls, and one of those failing is not the run failing. The ones that
    // landed are still wanted; what the rest hit is collected here and told
    // separately.
    const failures: string[] = []

    const blobs = await runGeneration(
        requestFor(job, input, credentials, (message) => {
            failures.push(message)
        }),
    )

    if (blobs.length === 0) {
        throw new GenerationError(`${job.modelName} sent nothing back. Try again.`)
    }

    // Providers that render every image in one call can quietly come back with
    // fewer than were asked for, and say nothing about it. The gap is the only
    // evidence, so it is what gets reported.
    if (blobs.length < job.count && failures.length === 0) {
        failures.push(`${job.modelName} sent back fewer images than you asked for.`)
    }

    const { outcome, persisted } = await land(job, blobs)

    return { outcome, persisted, failures }
}

export interface RunEffects {
    /** Hands the run's object URLs to the store, which owns them from there. */
    readonly adopt: (jobId: string, urls: readonly string[]) => void
    /** The run landed. `failures` names whatever it was asked for and missed. */
    readonly settle: (outcome: GenerationJob, failures: readonly string[]) => void
    /** The run made nothing at all, for this reason. */
    readonly fail: (reason: string) => void
    readonly onPersisted: () => void
}

/** Runs the job and routes its outcome back into whatever state owns it. */
export async function launchRun(
    job: GenerationJob,
    input: StartInput,
    credentialsOf: CredentialsOf,
    effects: RunEffects,
): Promise<void> {
    try {
        const { failures, outcome, persisted } = await performRun(job, input, credentialsOf)

        if (persisted) {
            effects.onPersisted()
        }

        effects.adopt(
            job.id,
            outcome.outputs.map((output) => output.url),
        )
        effects.settle(outcome, failures)
    } catch (error: unknown) {
        effects.fail(messageOf(error))
    }
}
