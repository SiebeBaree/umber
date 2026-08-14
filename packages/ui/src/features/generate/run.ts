import { saveCreations, type CreationRecord } from '../gallery/creations-db'
import { runGeneration } from './engine'
import { GenerationError } from './errors'
import type { GenerationJob, StartInput } from './job'

/**
 * One run from end to end: credentials, the provider call, the gallery write,
 * and the object URLs the results are shown through. No component state and no
 * shared state, so any number of these can be in flight together.
 */

export type CredentialsOf = (providerId: string) => Promise<Readonly<Record<string, string>> | null>

interface RunResult {
    readonly outcome: GenerationJob
    /** False when the render finished but could not be written to the gallery. */
    readonly persisted: boolean
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

async function performRun(
    job: GenerationJob,
    input: StartInput,
    credentialsOf: CredentialsOf,
): Promise<RunResult> {
    const credentials = await credentialsOf(input.model.provider)

    if (credentials === null) {
        throw new GenerationError('No key is connected for this provider. Add one in Settings.')
    }

    const blobs = await runGeneration({
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
    })

    // Measured once, the moment the files are in hand, so every output of a
    // run reports the same figure — which is the truth: they rendered together.
    const generationMs = Date.now() - job.startedAt
    const records = blobs.map((blob) => toRecord(job, blob, generationMs))

    // Persistence failing must not eat a finished render; the results still
    // show, they just won't survive a restart.
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

function failureOf(job: GenerationJob, error: unknown): GenerationJob {
    return {
        ...job,
        status: 'failed',
        error:
            error instanceof GenerationError
                ? error.message
                : 'Something went wrong while generating. Try again.',
    }
}

export interface RunEffects {
    /** Hands the run's object URLs to the store, which owns them from there. */
    readonly adopt: (jobId: string, urls: readonly string[]) => void
    readonly settle: (outcome: GenerationJob) => void
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
        const { outcome, persisted } = await performRun(job, input, credentialsOf)

        if (persisted) {
            effects.onPersisted()
        }

        effects.adopt(
            job.id,
            outcome.status === 'done' ? outcome.outputs.map((output) => output.url) : [],
        )
        effects.settle(outcome)
    } catch (error: unknown) {
        effects.settle(failureOf(job, error))
    }
}
