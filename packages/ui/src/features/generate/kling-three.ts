import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import { generateKlingLegacyVideo, KLING_DOMAIN, klingHeadersOf, unwrapKling } from './kling'
import type { EngineRequest } from './request'
import { encodeBase64, fetchBinary, poll } from './shared'

/**
 * Kling 3.0 and 4.0 on the API 2.0 surface, split from the legacy module
 * because the wire format changed underneath it: typed `contents`, a
 * `settings` object, and one shared `/tasks` query endpoint instead of
 * per-endpoint polling.
 */

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'kling-4-0-flash': 'kling-4.0-flash',
    'kling-4-0': 'kling-4.0',
    'kling-3-0-turbo': 'kling-3.0-turbo',
    'kling-3-0-omni': 'kling-3.0-omni',
    'kling-3-0': 'kling-3.0',
}

interface KlingV2Task {
    readonly id?: string
    readonly status?: string
    readonly message?: string
    readonly outputs?: readonly { readonly type?: string; readonly url?: string }[]
}

/** Kling 4.0 and 4.0 Flash: ten images, references only through Omni, audio always on. */
function isKlingFour(modelId: string): boolean {
    return modelId === 'kling-4-0' || modelId === 'kling-4-0-flash'
}

/** The stills for a grounded run, in the typed `contents` shape. */
async function klingThreeContents(request: EngineRequest): Promise<Record<string, unknown>[]> {
    const { firstFrame, lastFrame } = request

    if (lastFrame !== undefined && firstFrame === undefined) {
        throw new GenerationError(
            'Kling renders towards an end frame only from a start frame. Add one, or remove the end frame.',
        )
    }

    if (request.modelId === 'kling-3-0-turbo' && lastFrame !== undefined) {
        throw new GenerationError('Kling 3.0 Turbo does not accept an end frame.')
    }

    if (request.modelId === 'kling-4-0-flash' && lastFrame !== undefined) {
        throw new GenerationError('Kling 4.0 Flash does not accept an end frame.')
    }
    const imageLimit = isKlingFour(request.modelId) ? 10 : 7

    if (
        request.references.length +
            Number(firstFrame !== undefined) +
            Number(lastFrame !== undefined) >
        imageLimit
    ) {
        throw new GenerationError(`Kling accepts up to ${imageLimit} images, including frames.`)
    }

    return [
        { type: 'prompt', text: request.prompt },
        ...(await Promise.all(
            request.references.map(async (file) => ({
                type: 'refer_image',
                url: await encodeBase64(file),
            })),
        )),
        ...(firstFrame === undefined
            ? []
            : [{ type: 'first_frame', url: await encodeBase64(firstFrame) }]),
        ...(lastFrame === undefined
            ? []
            : [{ type: 'last_frame', url: await encodeBase64(lastFrame) }]),
    ]
}

/** Starts the run on the right endpoint for its grounding and returns its id. */
async function createKlingThreeTask(request: EngineRequest): Promise<string> {
    const grounded = request.firstFrame !== undefined
    const kling4 = isKlingFour(request.modelId)
    // Kling 4.0 takes reference images only on its Omni endpoint.
    const omni = request.modelId === 'kling-3-0-omni' || (kling4 && request.references.length > 0)
    const model = WIRE_MODEL_IDS[request.modelId] ?? 'kling-3.0'
    const endpoint = `${omni ? 'omni-video' : grounded ? 'image-to-video' : 'text-to-video'}/${model}`
    const contents = await klingThreeContents(request)

    const settings = {
        // A composer prompt is one shot; multi-shot is a prompt-format feature.
        // Turbo and 4.0 always render audio and take neither switch.
        ...(request.modelId === 'kling-3-0-turbo' || kling4
            ? {}
            : { multi_shot: false, audio: 'off' }),
        // Kling writes its tiers lowercase, `4k` included.
        resolution: request.resolution.toLowerCase(),
        duration: request.durationSeconds,
        ...(grounded ? {} : { aspect_ratio: request.ratio }),
    }

    let created: Response

    try {
        created = await httpFetch(`${KLING_DOMAIN}/${endpoint}`, {
            headers: await klingHeadersOf(request),
            json: grounded || omni ? { contents, settings } : { prompt: request.prompt, settings },
        })
    } catch {
        throw offlineError('Kling')
    }

    const job = await unwrapKling<KlingV2Task>(created, 'start the run')

    if (typeof job.id !== 'string' || job.id === '') {
        throw new GenerationError('Kling accepted the run but returned no task to follow.')
    }

    return job.id
}

/** Polls the shared `/tasks` endpoint until the run settles. */
function awaitKlingThreeTask(request: EngineRequest, taskId: string): Promise<KlingV2Task> {
    return poll({
        intervalMs: 10_000,
        timeoutMs: 20 * 60_000,
        timeoutMessage: 'Kling is still rendering after 20 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${KLING_DOMAIN}/tasks?task_ids=${taskId}`, {
                headers: await klingHeadersOf(request),
            })
            const tasks = await unwrapKling<readonly KlingV2Task[]>(response, 'report the run')
            const task = tasks[0]

            if (task?.status === 'succeeded') {
                return task
            }

            if (task?.status === 'failed') {
                throw new GenerationError(
                    task.message === undefined || task.message === ''
                        ? 'Kling could not finish this run.'
                        : `Kling: ${task.message}`,
                )
            }

            return null
        },
    })
}

/** One Kling entry point for the engine: 3.0 and 4.0 run on API 2.0,
 * everything else on the legacy surface, so the split happens here. */
export function generateKlingVideo(request: EngineRequest): Promise<Blob[]> {
    return Object.hasOwn(WIRE_MODEL_IDS, request.modelId)
        ? generateKlingThreeVideo(request)
        : generateKlingLegacyVideo(request)
}

async function generateKlingThreeVideo(request: EngineRequest): Promise<Blob[]> {
    if ((request.credentials['apiKey'] ?? '') === '') {
        throw new GenerationError(
            'Kling 3.0 and 4.0 need an API key, not the older key pair. Reconnect Kling in Settings with a key from the developer console.',
        )
    }

    const taskId = await createKlingThreeTask(request)
    const finished = await awaitKlingThreeTask(request, taskId)
    const url = finished.outputs?.find((output) => output.type === 'video')?.url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('Kling finished the run but returned no video.')
    }

    return [await fetchBinary('Kling', url, 'video/mp4')]
}
