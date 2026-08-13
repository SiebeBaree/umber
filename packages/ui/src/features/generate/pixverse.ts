import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { fetchBinary, poll, readJson } from './shared'

/**
 * The PixVerse platform API. Every response rides in an `{ErrCode, ErrMsg,
 * Resp}` envelope, every request needs a fresh trace id (their idempotency
 * key), and image-to-video goes through a separate upload first.
 */

const API_ROOT = 'https://app-api.pixverse.ai/openapi/v2'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'pixverse-v6': 'v6',
    'pixverse-c1': 'c1',
}

function headersOf(apiKey: string): Readonly<Record<string, string>> {
    return { 'API-KEY': apiKey, 'Ai-trace-id': crypto.randomUUID() }
}

interface Envelope<T> {
    readonly ErrCode?: number
    readonly ErrMsg?: string
    readonly Resp?: T
}

/** Unwraps the envelope, translating its failure modes into one error type. */
async function unwrap<T>(response: Response): Promise<T> {
    if (response.status === 401 || response.status === 403) {
        throw new GenerationError('PixVerse rejected the API key. Check it in Settings.')
    }

    const body = (await readJson(response)) as Envelope<T> | null

    if (!response.ok || body === null || body.ErrCode !== 0 || body.Resp === undefined) {
        throw new GenerationError(
            typeof body?.ErrMsg === 'string' && body.ErrMsg !== ''
                ? `PixVerse: ${body.ErrMsg}`
                : `PixVerse returned an unexpected error (${response.status}).`,
        )
    }

    return body.Resp
}

interface UploadResult {
    readonly img_id?: number
}

async function uploadReference(apiKey: string, reference: File): Promise<number> {
    const form = new FormData()
    form.set('image', reference, reference.name)

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/image/upload`, {
            headers: headersOf(apiKey),
            form,
        })
    } catch {
        throw offlineError('PixVerse')
    }

    const result = await unwrap<UploadResult>(response)

    if (typeof result.img_id !== 'number') {
        throw new GenerationError('PixVerse could not take the reference image.')
    }

    return result.img_id
}

interface CreateResult {
    readonly video_id?: number
}

interface VideoResult {
    readonly status?: number
    readonly url?: string
}

/** Starts the PixVerse job and returns its video id. */
async function createPixverseJob(request: EngineRequest, apiKey: string): Promise<number> {
    const reference = request.references[0]

    const settings = {
        model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
        prompt: request.prompt,
        quality: request.resolution,
        duration: request.durationSeconds,
    }

    let created: Response

    try {
        created =
            reference === undefined
                ? await httpFetch(`${API_ROOT}/video/text/generate`, {
                      headers: headersOf(apiKey),
                      json: { ...settings, aspect_ratio: request.ratio },
                  })
                : await httpFetch(`${API_ROOT}/video/img/generate`, {
                      headers: headersOf(apiKey),
                      // The clip takes its shape from the image, so no ratio here.
                      json: { ...settings, img_id: await uploadReference(apiKey, reference) },
                  })
    } catch (error: unknown) {
        if (error instanceof GenerationError) {
            throw error
        }
        throw offlineError('PixVerse')
    }

    const job = await unwrap<CreateResult>(created)

    if (typeof job.video_id !== 'number') {
        throw new GenerationError('PixVerse accepted the run but returned no job to follow.')
    }

    return job.video_id
}

export async function generatePixverseVideo(request: EngineRequest): Promise<Blob[]> {
    const apiKey = request.credentials['apiKey'] ?? ''
    const videoId = await createPixverseJob(request, apiKey)

    const finished = await poll({
        intervalMs: 5000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'PixVerse is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/video/result/${videoId}`, {
                headers: headersOf(apiKey),
            })
            const state = await unwrap<VideoResult>(response)

            // 1 done · 5 still rendering · 7 moderated · 6/8 failed.
            if (state.status === 1) {
                return state
            }

            if (state.status === 7) {
                throw new GenerationError(
                    'PixVerse declined this prompt as against its usage policies.',
                )
            }

            if (state.status === 6 || state.status === 8) {
                throw new GenerationError('PixVerse could not finish this video.')
            }

            return null
        },
    })

    if (typeof finished.url !== 'string' || finished.url === '') {
        throw new GenerationError('PixVerse finished the run but returned no video.')
    }

    return [await fetchBinary('PixVerse', finished.url, 'video/mp4')]
}

/** A free authenticated call: the account's credit balance. */
export async function verifyPixverseKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/account/balance`, { headers: headersOf(apiKey) })
    } catch {
        return {
            ok: false,
            message: 'Could not reach PixVerse. Check your connection and try again.',
        }
    }

    try {
        await unwrap(response)

        return { ok: true }
    } catch (error: unknown) {
        return {
            ok: false,
            message:
                error instanceof GenerationError
                    ? error.message
                    : `PixVerse returned an unexpected error (${response.status}).`,
        }
    }
}
