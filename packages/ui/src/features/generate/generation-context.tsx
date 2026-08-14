import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'

import { isImageModel, type AspectRatio, type Model } from '../create/catalog'
import type { ModeSettings } from '../create/settings/schema'
import { saveCreations, type CreationRecord } from '../gallery/creations-db'
import { useKeys } from '../keys/keys-context'
import { runGeneration } from './engine'
import { GenerationError } from './errors'

/**
 * The one in-flight generation and its outcome, shared app-wide: the create
 * page renders it front and centre, the gallery mirrors it as pending tiles,
 * and the composer locks its send button while it runs.
 */

export interface GeneratedOutput {
    readonly id: string
    /** An object URL over the stored blob; owned and revoked by this store. */
    readonly url: string
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

export interface GenerationApi {
    /** The latest job, in whatever state it is in; null before the first run. */
    readonly activeJob: GenerationJob | null
    /** Bumped when a run lands in the gallery, so galleries can re-query. */
    readonly completions: number
    readonly start: (input: StartInput) => void
    /** Clears a finished or failed job off the stage. */
    readonly reset: () => void
}

const GenerationContext = createContext<GenerationApi | null>(null)

function newJob(input: StartInput): GenerationJob {
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

type CredentialsOf = (providerId: string) => Promise<Readonly<Record<string, string>> | null>

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

/** The whole run, from credentials to stored blobs, with no component state. */
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

interface RunEffects {
    readonly settle: (outcome: GenerationJob) => void
    readonly replaceUrls: (urls: readonly string[]) => void
    readonly onPersisted: () => void
}

/** Runs the job and routes its outcome back into whatever state owns it. */
async function launchRun(
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

        effects.replaceUrls(
            outcome.status === 'done' ? outcome.outputs.map((output) => output.url) : [],
        )
        effects.settle(outcome)
    } catch (error: unknown) {
        effects.settle(failureOf(job, error))
    }
}

export function GenerationProvider({ children }: { readonly children: ReactNode }) {
    const keys = useKeys()
    const [activeJob, setActiveJob] = useState<GenerationJob | null>(null)
    const [completions, setCompletions] = useState(0)

    // The URLs of the job currently on stage, revoked when it leaves.
    const urlsRef = useRef<readonly string[]>([])

    const replaceUrls = useCallback((urls: readonly string[]) => {
        for (const url of urlsRef.current) {
            URL.revokeObjectURL(url)
        }
        urlsRef.current = urls
    }, [])

    const start = useCallback(
        (input: StartInput) => {
            const job = newJob(input)

            replaceUrls([])
            setActiveJob(job)

            void launchRun(job, input, keys.credentials, {
                // A newer run may already own the stage; a stale result must
                // not overwrite it.
                settle: (outcome) => {
                    setActiveJob((current) => (current?.id === job.id ? outcome : current))
                },
                replaceUrls,
                onPersisted: () => {
                    setCompletions((current) => current + 1)
                },
            })
        },
        [keys, replaceUrls],
    )

    const reset = useCallback(() => {
        replaceUrls([])
        setActiveJob(null)
    }, [replaceUrls])

    const value = useMemo<GenerationApi>(
        () => ({ activeJob, completions, start, reset }),
        [activeJob, completions, start, reset],
    )

    return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>
}

export function useGeneration(): GenerationApi {
    const api = useContext(GenerationContext)

    if (api === null) {
        throw new Error('useGeneration must be used inside a GenerationProvider')
    }

    return api
}
