import { httpFetch } from '../../lib/http'
import type { AspectRatio } from '../create/catalog'
import { GenerationError, offlineError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * The Runway API: image and video tasks, both async — POST creates a task,
 * `/tasks/{id}` is polled until it succeeds, and the output is a short-lived
 * signed URL downloaded straight away.
 */

const API_ROOT = 'https://api.dev.runwayml.com/v1'

/** Runway versions its API by date; this is the current documented value. */
const API_VERSION = '2024-11-06'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'gen-4-image': 'gen4_image',
    'gen-4-5': 'gen4.5',
    'gen-4-turbo': 'gen4_turbo',
}

/** The 720p-class image ratios, valid only for the shapes Runway renders there. */
const IMAGE_RATIOS_1K: Readonly<Partial<Record<AspectRatio, string>>> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '960:960',
}

const IMAGE_RATIOS_2K: Readonly<Partial<Record<AspectRatio, string>>> = {
    '16:9': '1920:1080',
    '9:16': '1080:1920',
    '1:1': '1080:1080',
    '4:3': '1440:1080',
    '3:4': '1080:1440',
    '21:9': '2112:912',
}

/** What image-to-video accepts; text-to-video is 16:9 and 9:16 only. */
const VIDEO_RATIOS: Readonly<Partial<Record<AspectRatio, string>>> = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '960:960',
    '4:3': '1104:832',
    '3:4': '832:1104',
    '21:9': '1584:672',
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return {
        Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}`,
        'X-Runway-Version': API_VERSION,
    }
}

interface RunwayErrorBody {
    readonly error?: string
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as RunwayErrorBody | null

    if (response.status === 401) {
        return new GenerationError('Runway rejected the API key. Check it in Settings.')
    }

    if (response.status === 429) {
        return new GenerationError(
            'Runway is rate limiting this key. Give it a moment and try again.',
        )
    }

    return new GenerationError(
        typeof body?.error === 'string' && body.error !== ''
            ? body.error
            : `Runway returned an unexpected error (${response.status}).`,
    )
}

interface RunwayTask {
    readonly id?: string
    readonly status?: string
    readonly output?: readonly string[]
    readonly failure?: string
}

async function createTask(
    request: EngineRequest,
    path: string,
    payload: Record<string, unknown>,
): Promise<string> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/${path}`, {
            headers: headersOf(request),
            json: payload,
        })
    } catch {
        throw offlineError('Runway')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const task = (await readJson(response)) as RunwayTask | null

    if (typeof task?.id !== 'string' || task.id === '') {
        throw new GenerationError('Runway accepted the run but returned no task to follow.')
    }

    return task.id
}

async function awaitTask(
    request: EngineRequest,
    taskId: string,
    timeoutMs: number,
): Promise<readonly string[]> {
    const finished = await poll({
        intervalMs: 5000,
        timeoutMs,
        timeoutMessage: 'Runway is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/tasks/${taskId}`, {
                headers: headersOf(request),
            })

            if (!response.ok) {
                throw await toGenerationError(response)
            }

            const task = (await readJson(response)) as RunwayTask | null

            if (task?.status === 'SUCCEEDED') {
                return task
            }

            if (task?.status === 'FAILED' || task?.status === 'CANCELLED') {
                throw new GenerationError(task.failure ?? 'Runway could not finish this run.')
            }

            // PENDING, THROTTLED and RUNNING all just mean "keep waiting".
            return null
        },
    })

    const outputs = (finished.output ?? []).filter((url) => typeof url === 'string' && url !== '')

    if (outputs.length === 0) {
        throw new GenerationError('Runway finished the run but returned no output.')
    }

    return outputs
}

function imageRatio(ratio: AspectRatio, resolution: string): string {
    const at1K = resolution === '1K' ? IMAGE_RATIOS_1K[ratio] : undefined

    return at1K ?? IMAGE_RATIOS_2K[ratio] ?? '1920:1080'
}

/** One image per task, so a multi-image run is parallel tasks. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    const references = await Promise.all(
        request.references.slice(0, 3).map(async (file, index) => ({
            uri: await encodeDataUri(file),
            tag: `Ref${index + 1}`,
        })),
    )

    const taskId = await createTask(request, 'text_to_image', {
        model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
        promptText: request.prompt,
        ratio: imageRatio(request.ratio, request.resolution),
        ...(references.length > 0 ? { referenceImages: references } : {}),
    })

    const outputs = await awaitTask(request, taskId, 5 * 60_000)

    return fetchBinary('Runway', outputs[0] ?? '', 'image/png')
}

export function generateRunwayImages(request: EngineRequest): Promise<Blob[]> {
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

export async function generateRunwayVideo(request: EngineRequest): Promise<Blob[]> {
    const model = WIRE_MODEL_IDS[request.modelId] ?? request.modelId
    const reference = request.references[0]

    let taskId: string

    if (reference === undefined) {
        if (model === 'gen4_turbo') {
            throw new GenerationError(
                'Gen-4 Turbo animates a picture. Add a reference image, or switch to Gen-4.5.',
            )
        }

        if (request.ratio !== '16:9' && request.ratio !== '9:16') {
            throw new GenerationError(
                `Runway renders text-to-video in 16:9 or 9:16 only. Add a reference image for ${request.ratio}.`,
            )
        }

        taskId = await createTask(request, 'text_to_video', {
            model,
            promptText: request.prompt,
            ratio: VIDEO_RATIOS[request.ratio],
            duration: request.durationSeconds,
        })
    } else {
        taskId = await createTask(request, 'image_to_video', {
            model,
            promptImage: await encodeDataUri(reference),
            promptText: request.prompt,
            ratio: VIDEO_RATIOS[request.ratio] ?? '1280:720',
            duration: request.durationSeconds,
        })
    }

    const outputs = await awaitTask(request, taskId, 15 * 60_000)

    return [await fetchBinary('Runway', outputs[0] ?? '', 'video/mp4')]
}

/** A free authenticated call: the org profile, which also proves the key. */
export async function verifyRunwayKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/organization`, {
            headers: { Authorization: `Bearer ${apiKey}`, 'X-Runway-Version': API_VERSION },
        })
    } catch {
        return {
            ok: false,
            message: 'Could not reach Runway. Check your connection and try again.',
        }
    }

    if (response.ok) {
        return { ok: true }
    }

    if (response.status === 401) {
        return {
            ok: false,
            message: 'Runway rejected this key. Paste the full key from the developer portal.',
        }
    }

    return { ok: false, message: `Runway returned an unexpected error (${response.status}).` }
}
