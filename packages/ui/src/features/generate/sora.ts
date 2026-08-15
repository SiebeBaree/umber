import { httpFetch } from '../../lib/http'
import { ratioParts, type AspectRatio } from '../create/catalog'
import { GenerationError } from './errors'
import {
    OPENAI_API_ROOT,
    OPENAI_OFFLINE_MESSAGE,
    OPENAI_WIRE_MODEL_IDS,
    openAiKeyOf,
    toOpenAiError,
} from './openai'
import type { EngineRequest } from './request'
import { fetchBinary, poll, readJson, resizeToCover } from './shared'

/**
 * The OpenAI Videos API — Sora, split from the image module because it is a
 * different lifecycle: a job is created, polled, and its finished clip
 * downloaded from the job's own content endpoint.
 */

/**
 * The sizes Sora renders, by orientation and tier. 1080p exists only on
 * sora-2-pro, which is also the only model the catalog offers it for.
 */
function soraSize(ratio: AspectRatio, resolution: string): string {
    const landscape = ratioParts(ratio).width >= ratioParts(ratio).height

    if (resolution === '1080p') {
        return landscape ? '1920x1080' : '1080x1920'
    }

    return landscape ? '1280x720' : '720x1280'
}

interface SoraJob {
    readonly id?: string
    readonly status?: string
    readonly error?: { readonly message?: string }
}

/** Creates the video job; multipart when a reference frame grounds it. */
async function createSoraJob(request: EngineRequest): Promise<Response> {
    const model = OPENAI_WIRE_MODEL_IDS[request.modelId] ?? request.modelId
    const size = soraSize(request.ratio, request.resolution)
    const seconds = String(request.durationSeconds)
    const reference = request.firstFrame

    if (reference === undefined) {
        return httpFetch(`${OPENAI_API_ROOT}/videos`, {
            headers: { Authorization: `Bearer ${openAiKeyOf(request)}` },
            json: { model, prompt: request.prompt, size, seconds },
        })
    }

    // Sora requires the reference frame to match the output size exactly.
    const [width, height] = size.split('x').map(Number)
    const frame = await resizeToCover(reference, width ?? 1280, height ?? 720)

    const form = new FormData()
    form.set('model', model)
    form.set('prompt', request.prompt)
    form.set('size', size)
    form.set('seconds', seconds)
    form.set('input_reference', new File([frame], 'reference.png', { type: 'image/png' }))

    return httpFetch(`${OPENAI_API_ROOT}/videos`, {
        headers: { Authorization: `Bearer ${openAiKeyOf(request)}` },
        form,
    })
}

/** Polls the job until it completes, translating failures on the way. */
function awaitSoraJob(jobId: string, headers: Readonly<Record<string, string>>): Promise<SoraJob> {
    return poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'OpenAI is still rendering after 15 minutes. Try a shorter clip.',
        check: async () => {
            const response = await httpFetch(`${OPENAI_API_ROOT}/videos/${jobId}`, { headers })

            if (!response.ok) {
                throw await toOpenAiError(response)
            }

            const state = (await readJson(response)) as SoraJob | null

            if (state?.status === 'completed') {
                return state
            }

            if (state?.status === 'failed' || state?.status === 'expired') {
                throw new GenerationError(
                    state.error?.message ?? 'OpenAI could not finish this video.',
                )
            }

            return null
        },
    })
}

export async function generateOpenAiVideo(request: EngineRequest): Promise<Blob[]> {
    let created: Response

    try {
        created = await createSoraJob(request)
    } catch {
        throw new GenerationError(OPENAI_OFFLINE_MESSAGE)
    }

    if (!created.ok) {
        throw await toOpenAiError(created)
    }

    const job = (await readJson(created)) as SoraJob | null

    if (typeof job?.id !== 'string' || job.id === '') {
        throw new GenerationError('OpenAI accepted the run but returned no job to follow.')
    }

    const headers = { Authorization: `Bearer ${openAiKeyOf(request)}` }
    await awaitSoraJob(job.id, headers)

    return [
        await fetchBinary(
            'OpenAI',
            `${OPENAI_API_ROOT}/videos/${job.id}/content`,
            'video/mp4',
            headers,
        ),
    ]
}
