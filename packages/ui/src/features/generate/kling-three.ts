import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import { generateKlingLegacyVideo, KLING_DOMAIN, klingHeadersOf, unwrapKling } from './kling'
import type { EngineRequest } from './request'
import { encodeBase64, fetchBinary, poll } from './shared'

/**
 * Kling 3.0 on the API 2.0 surface, split from the legacy module because the
 * wire format changed underneath it: typed `contents`, a `settings` object,
 * and one shared `/tasks` query endpoint instead of per-endpoint polling.
 */

interface KlingV2Task {
    readonly id?: string
    readonly status?: string
    readonly message?: string
    readonly outputs?: readonly { readonly type?: string; readonly url?: string }[]
}

/** The stills for a grounded run, in the typed `contents` shape. */
async function klingThreeContents(request: EngineRequest): Promise<Record<string, unknown>[]> {
    const { firstFrame, lastFrame } = request

    if (lastFrame !== undefined && firstFrame === undefined) {
        throw new GenerationError(
            'Kling renders towards an end frame only from a start frame. Add one, or remove the end frame.',
        )
    }

    return [
        { type: 'prompt', text: request.prompt },
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
    const endpoint = grounded ? 'image-to-video/kling-3.0' : 'text-to-video/kling-3.0'

    const settings = {
        // A composer prompt is one shot; multi-shot is a prompt-format feature.
        multi_shot: false,
        audio: 'off',
        // Kling writes its tiers lowercase, `4k` included.
        resolution: request.resolution.toLowerCase(),
        duration: request.durationSeconds,
        ...(grounded ? {} : { aspect_ratio: request.ratio }),
    }

    let created: Response

    try {
        created = await httpFetch(`${KLING_DOMAIN}/${endpoint}`, {
            headers: await klingHeadersOf(request),
            json: grounded
                ? { contents: await klingThreeContents(request), settings }
                : { prompt: request.prompt, settings },
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

/** One Kling entry point for the engine: 3.0 runs on API 2.0, everything
 * else on the legacy surface, so the split happens here. */
export function generateKlingVideo(request: EngineRequest): Promise<Blob[]> {
    return request.modelId === 'kling-3-0'
        ? generateKlingThreeVideo(request)
        : generateKlingLegacyVideo(request)
}

async function generateKlingThreeVideo(request: EngineRequest): Promise<Blob[]> {
    if ((request.credentials['apiKey'] ?? '') === '') {
        throw new GenerationError(
            'Kling 3.0 needs an API key, not the older key pair. Reconnect Kling in Settings with a key from the developer console.',
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
