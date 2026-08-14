import { httpFetch } from '../../lib/http'
import type { AspectRatio } from '../create/catalog'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { decodeBase64Blob, encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * ByteDance's BytePlus ModelArk: Seedream images synchronously, Seedance
 * video as a polled content-generation task. Image watermarks are on by
 * default on this API, so that path turns them off explicitly.
 */

const API_ROOT = 'https://ark.ap-southeast.bytepluses.com/api/v3'

/**
 * ModelArk addresses models by dated id, with no unversioned alias. The
 * `dreamina-` prefix is real and belongs to the Seedance 2.x line only.
 */
const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'seedream-4-5': 'seedream-4-5-251128',
    'seedream-4': 'seedream-4-0-250828',
    'seedance-2-0': 'dreamina-seedance-2-0-260128',
    'seedance-1-pro': 'seedance-1-0-pro-250528',
}

/**
 * The image endpoint has no ratio parameter: a bare `2K` lets the model pick a
 * shape from the prompt, which lands square unless the prompt happens to say
 * otherwise. Sending exact pixels is the only way to honour the composer, so
 * these are ByteDance's own published dimensions per tier and ratio.
 */
const SEEDREAM_SIZES: Readonly<Record<string, Readonly<Partial<Record<AspectRatio, string>>>>> = {
    '1K': {
        '1:1': '1024x1024',
        '3:2': '1248x832',
        '2:3': '832x1248',
        '4:3': '1152x864',
        '3:4': '864x1152',
        '16:9': '1280x720',
        '9:16': '720x1280',
    },
    '2K': {
        '1:1': '2048x2048',
        '3:2': '2496x1664',
        '2:3': '1664x2496',
        '4:3': '2304x1728',
        '3:4': '1728x2304',
        '16:9': '2848x1600',
        '9:16': '1600x2848',
    },
    '4K': {
        '1:1': '4096x4096',
        '3:2': '4992x3328',
        '2:3': '3328x4992',
        '4:3': '4704x3520',
        '3:4': '3520x4704',
        '16:9': '5504x3040',
        '9:16': '3040x5504',
    },
}

function seedreamSize(ratio: AspectRatio, resolution: string): string {
    const tier = SEEDREAM_SIZES[resolution] ?? SEEDREAM_SIZES['2K'] ?? {}

    return tier[ratio] ?? '2048x2048'
}

interface ArkError {
    readonly error?: { readonly message?: string; readonly code?: string }
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as ArkError | null

    if (response.status === 401 || response.status === 403) {
        return new GenerationError('ByteDance rejected the API key. Check it in Settings.')
    }

    if (response.status === 429) {
        return new GenerationError(
            'ByteDance is rate limiting this key. Give it a moment and try again.',
        )
    }

    const detail = body?.error?.message

    return new GenerationError(
        typeof detail === 'string' && detail !== ''
            ? detail
            : `ByteDance returned an unexpected error (${response.status}).`,
    )
}

interface SeedreamResponse {
    readonly data?: readonly { readonly b64_json?: string; readonly url?: string }[]
}

/** One image per call, so a multi-image run is parallel calls. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    const references = await Promise.all(
        request.references.slice(0, 14).map((file) => encodeDataUri(file)),
    )

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/images/generations`, {
            headers: headersOf(request),
            json: {
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                prompt: request.prompt,
                size: seedreamSize(request.ratio, request.resolution),
                response_format: 'b64_json',
                watermark: false,
                sequential_image_generation: 'disabled',
                ...(references.length === 0
                    ? {}
                    : { image: references.length === 1 ? references[0] : references }),
            },
        })
    } catch {
        throw offlineError('ByteDance')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as SeedreamResponse | null
    const b64 = body?.data?.find(
        (entry) => typeof entry.b64_json === 'string' && entry.b64_json !== '',
    )?.b64_json

    if (b64 === undefined) {
        throw new GenerationError('ByteDance returned no image for this prompt.')
    }

    // Seedream 4.x renders JPEG and takes no `output_format`.
    return decodeBase64Blob(b64, 'image/jpeg')
}

export function generateBytedanceImages(request: EngineRequest): Promise<Blob[]> {
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

interface SeedanceTask {
    readonly id?: string
    readonly status?: string
    readonly content?: { readonly video_url?: string }
    readonly error?: { readonly message?: string }
}

/** Starts the Seedance content-generation task and returns its id. */
async function createSeedanceTask(request: EngineRequest): Promise<string> {
    const reference = request.references[0]
    const content: Record<string, unknown>[] = [{ type: 'text', text: request.prompt }]

    if (reference !== undefined) {
        content.push({
            type: 'image_url',
            image_url: { url: await encodeDataUri(reference) },
            role: 'first_frame',
        })
    }

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/contents/generations/tasks`, {
            headers: headersOf(request),
            json: {
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                content,
                resolution: request.resolution.toLowerCase(),
                // Animating a still only accepts `adaptive`, which is also the
                // one value that will not centre-crop the given frame.
                ratio: reference === undefined ? request.ratio : 'adaptive',
                duration: request.durationSeconds,
                watermark: false,
            },
        })
    } catch {
        throw offlineError('ByteDance')
    }

    if (!created.ok) {
        throw await toGenerationError(created)
    }

    const task = (await readJson(created)) as SeedanceTask | null

    if (typeof task?.id !== 'string' || task.id === '') {
        throw new GenerationError('ByteDance accepted the run but returned no task to follow.')
    }

    return task.id
}

export async function generateBytedanceVideo(request: EngineRequest): Promise<Blob[]> {
    const taskId = await createSeedanceTask(request)

    const finished = await poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'ByteDance is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/contents/generations/tasks/${taskId}`, {
                headers: headersOf(request),
            })

            if (!response.ok) {
                throw await toGenerationError(response)
            }

            const state = (await readJson(response)) as SeedanceTask | null

            if (state?.status === 'succeeded') {
                return state
            }

            if (
                state?.status === 'failed' ||
                state?.status === 'cancelled' ||
                state?.status === 'expired'
            ) {
                throw new GenerationError(
                    state.error?.message ?? 'ByteDance could not finish this video.',
                )
            }

            return null
        },
    })

    const url = finished.content?.video_url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('ByteDance finished the run but returned no video.')
    }

    return [await fetchBinary('ByteDance', url, 'video/mp4')]
}
