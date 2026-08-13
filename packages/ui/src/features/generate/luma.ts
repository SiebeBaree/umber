import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { encodeBase64, fetchBinary, poll, readJson } from './shared'

/**
 * The Luma API (agents.lumalabs.ai): one `/generations` job endpoint for both
 * Uni images and Ray video, polled until it completes. Output URLs are
 * presigned and expire within the hour, so results are downloaded on arrival.
 */

const API_ROOT = 'https://agents.lumalabs.ai/v1'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'uni-1': 'uni-1',
    'uni-1-max': 'uni-1-max',
    'ray-3-2': 'ray-3.2',
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
}

interface LumaGeneration {
    readonly id?: string
    readonly state?: string
    readonly failure_reason?: string
    readonly output?: readonly { readonly url?: string }[]
}

interface LumaErrorBody {
    readonly detail?: string
    readonly message?: string
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as LumaErrorBody | null

    if (response.status === 401 || response.status === 403) {
        return new GenerationError('Luma rejected the API key. Check it in Settings.')
    }

    if (response.status === 429) {
        return new GenerationError(
            'Luma is rate limiting this key. Give it a moment and try again.',
        )
    }

    const detail = body?.detail ?? body?.message

    return new GenerationError(
        typeof detail === 'string' && detail !== ''
            ? detail
            : `Luma returned an unexpected error (${response.status}).`,
    )
}

async function createGeneration(
    request: EngineRequest,
    payload: Record<string, unknown>,
): Promise<string> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/generations`, {
            headers: headersOf(request),
            json: payload,
        })
    } catch {
        throw offlineError('Luma')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const generation = (await readJson(response)) as LumaGeneration | null

    if (typeof generation?.id !== 'string' || generation.id === '') {
        throw new GenerationError('Luma accepted the run but returned no job to follow.')
    }

    return generation.id
}

async function awaitGeneration(
    request: EngineRequest,
    id: string,
    timeoutMs: number,
): Promise<string> {
    const finished = await poll({
        intervalMs: 3000,
        timeoutMs,
        timeoutMessage: 'Luma is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/generations/${id}`, {
                headers: headersOf(request),
            })

            if (!response.ok) {
                throw await toGenerationError(response)
            }

            const generation = (await readJson(response)) as LumaGeneration | null

            if (generation?.state === 'completed') {
                return generation
            }

            if (generation?.state === 'failed') {
                throw new GenerationError(
                    generation.failure_reason ?? 'Luma could not finish this run.',
                )
            }

            return null
        },
    })

    const url = finished.output?.find((entry) => typeof entry.url === 'string')?.url

    if (url === undefined || url === '') {
        throw new GenerationError('Luma finished the run but returned no output.')
    }

    return url
}

function imageRefs(references: readonly File[]) {
    return Promise.all(
        references.slice(0, 9).map(async (file) => ({
            data: await encodeBase64(file),
            media_type: file.type === '' ? 'image/png' : file.type,
        })),
    )
}

/** One image per job, so a multi-image run is parallel jobs. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    const refs = await imageRefs(request.references)

    const id = await createGeneration(request, {
        model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
        type: 'image',
        prompt: request.prompt,
        aspect_ratio: request.ratio,
        ...(refs.length > 0 ? { image_ref: refs } : {}),
    })

    return fetchBinary('Luma', await awaitGeneration(request, id, 5 * 60_000), 'image/png')
}

export function generateLumaImages(request: EngineRequest): Promise<Blob[]> {
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

export async function generateLumaVideo(request: EngineRequest): Promise<Blob[]> {
    const reference = request.references[0]
    const startFrame =
        reference === undefined
            ? {}
            : {
                  start_frame: {
                      data: await encodeBase64(reference),
                      media_type: reference.type === '' ? 'image/png' : reference.type,
                  },
              }

    const id = await createGeneration(request, {
        model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
        type: 'video',
        prompt: request.prompt,
        aspect_ratio: request.ratio,
        video: {
            resolution: request.resolution,
            duration: `${request.durationSeconds}s`,
            ...startFrame,
        },
    })

    return [await fetchBinary('Luma', await awaitGeneration(request, id, 15 * 60_000), 'video/mp4')]
}
