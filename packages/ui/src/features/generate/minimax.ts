import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * MiniMax's v2 video API, which is Hailuo 3: a multimodal `content` list is
 * submitted as a task, polled by id, and the finished clip arrives as a plain
 * URL. Errors ride a `base_resp` envelope beside the HTTP status.
 */

const API_ROOT = 'https://api.minimax.io/v2'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'minimax-h3': 'MiniMax-H3',
}

/** The tier names on the wire: lowercase in the catalog, MiniMax's own casing here. */
const RESOLUTIONS: Readonly<Record<string, string>> = {
    '768p': '768P',
    '2K': '2K',
}

interface BaseResp {
    readonly status_code?: number
    readonly status_msg?: string
}

interface MinimaxTask {
    readonly task_id?: string
    readonly status?: string
    readonly content?: { readonly url?: string }
    readonly base_resp?: BaseResp
}

interface MinimaxQueryBody extends MinimaxTask {
    readonly task?: MinimaxTask
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
}

/** Translates the `base_resp` codes MiniMax uses instead of HTTP statuses. */
function checkBaseResp(base: BaseResp | undefined): void {
    const code = base?.status_code

    if (code === undefined || code === 0) {
        return
    }

    if (code === 1004 || code === 2049) {
        throw new GenerationError('MiniMax rejected the API key. Check it in Settings.')
    }

    if (code === 1002) {
        throw new GenerationError(
            'MiniMax is rate limiting this key. Give it a moment and try again.',
        )
    }

    if (code === 1008) {
        throw new GenerationError(
            'Your MiniMax account is out of credit. Top up in the MiniMax platform.',
        )
    }

    if (code === 1026) {
        throw new GenerationError('MiniMax declined this prompt as against its usage policies.')
    }

    throw new GenerationError(
        typeof base?.status_msg === 'string' && base.status_msg !== ''
            ? `MiniMax: ${base.status_msg}`
            : `MiniMax returned an unexpected error (${code}).`,
    )
}

/**
 * The content list: the prompt, then every still with its role. The API takes
 * either fixed frames or reference images in one request, never both.
 */
async function minimaxContent(request: EngineRequest): Promise<Record<string, unknown>[]> {
    const { firstFrame, lastFrame } = request
    const references = request.references.slice(0, 9)

    if ((firstFrame !== undefined || lastFrame !== undefined) && references.length > 0) {
        throw new GenerationError(
            'Hailuo takes either frames or reference images, not both. Remove one or the other.',
        )
    }

    const content: Record<string, unknown>[] = [{ type: 'text', text: request.prompt }]

    const stills: readonly (readonly [File | undefined, string])[] = [
        [firstFrame, 'first_frame'],
        [lastFrame, 'last_frame'],
        ...references.map((file) => [file, 'reference_image'] as const),
    ]

    for (const [file, role] of stills) {
        if (file !== undefined) {
            content.push({
                type: 'image_url',
                image_url: { url: await encodeDataUri(file) },
                role,
            })
        }
    }

    return content
}

/** Starts the generation task and returns its id. */
async function createTask(request: EngineRequest): Promise<string> {
    const grounded = request.firstFrame !== undefined || request.lastFrame !== undefined

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/video_generation`, {
            headers: headersOf(request),
            json: {
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                content: await minimaxContent(request),
                duration: request.durationSeconds,
                resolution: RESOLUTIONS[request.resolution] ?? '768P',
                // Fixed frames only accept `adaptive`, which follows the still.
                ratio: grounded ? 'adaptive' : request.ratio,
            },
        })
    } catch {
        throw offlineError('MiniMax')
    }

    const body = (await readJson(created)) as MinimaxTask | null
    checkBaseResp(body?.base_resp)

    if (!created.ok) {
        throw new GenerationError(`MiniMax returned an unexpected error (${created.status}).`)
    }

    if (typeof body?.task_id !== 'string' || body.task_id === '') {
        throw new GenerationError('MiniMax accepted the run but returned no task to follow.')
    }

    return body.task_id
}

export async function generateMinimaxVideo(request: EngineRequest): Promise<Blob[]> {
    const taskId = await createTask(request)

    const finished = await poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'MiniMax is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/query/video_generation/${taskId}`, {
                headers: headersOf(request),
            })

            const body = (await readJson(response)) as MinimaxQueryBody | null
            checkBaseResp(body?.base_resp)

            if (!response.ok) {
                throw new GenerationError(
                    `MiniMax returned an unexpected error (${response.status}).`,
                )
            }

            const task = body?.task ?? body

            if (task?.status === 'succeeded') {
                return task
            }

            if (task?.status === 'failed' || task?.status === 'cancelled') {
                throw new GenerationError('MiniMax could not finish this video.')
            }

            return null
        },
    })

    const url = finished.content?.url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('MiniMax finished the run but returned no video.')
    }

    return [await fetchBinary('MiniMax', url, 'video/mp4')]
}
