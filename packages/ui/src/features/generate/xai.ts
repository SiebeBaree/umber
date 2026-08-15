import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { decodeBase64Blob, encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * The xAI Imagine API: images synchronously through the generations and edits
 * endpoints, video as a polled request. One console key drives both, and the
 * request shapes are OpenAI-flavoured JSON rather than multipart.
 */

const API_ROOT = 'https://api.x.ai/v1'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'grok-imagine-image-2': 'grok-imagine-image-2.0',
    'grok-imagine-video-1-5': 'grok-imagine-video-1.5',
}

interface XaiErrorBody {
    readonly error?: { readonly message?: string } | string
    readonly message?: string
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
}

/** xAI's own error text, wherever this response hid it. */
async function xaiDetailOf(response: Response): Promise<string | undefined> {
    const body = (await readJson(response)) as XaiErrorBody | null
    const detail =
        typeof body?.error === 'string' ? body.error : (body?.error?.message ?? body?.message)

    return typeof detail === 'string' && detail !== '' ? detail : undefined
}

/**
 * xAI's status codes read differently from most vendors: a wrong key is a 400
 * `invalid-argument`, 401 means no key reached them at all, and 403 is the
 * key's *team* being out of usable credits — never the key itself.
 */
async function toGenerationError(response: Response): Promise<GenerationError> {
    const detail = await xaiDetailOf(response)

    if (response.status === 401) {
        return new GenerationError('xAI rejected the API key. Check it in Settings.')
    }

    if (response.status === 403) {
        return new GenerationError(
            detail ??
                'xAI blocked this run: the key’s team has no usable credits. Check billing in the xAI console.',
        )
    }

    if (response.status === 429) {
        return new GenerationError('xAI is rate limiting this key. Give it a moment and try again.')
    }

    return new GenerationError(detail ?? `xAI returned an unexpected error (${response.status}).`)
}

interface XaiImagesResponse {
    readonly data?: readonly { readonly b64_json?: string; readonly url?: string }[]
}

/** The images request body, shared by generation and editing. */
async function imagesBody(request: EngineRequest): Promise<Record<string, unknown>> {
    const references = await Promise.all(
        request.references.slice(0, 3).map(async (file) => ({
            url: await encodeDataUri(file),
            type: 'image_url',
        })),
    )

    return {
        model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
        prompt: request.prompt,
        n: request.count,
        aspect_ratio: request.ratio,
        // xAI writes its tiers lowercase: `1k` and `2k`.
        resolution: request.resolution.toLowerCase(),
        response_format: 'b64_json',
        ...(references.length === 0
            ? {}
            : references.length === 1
              ? { image: references[0] }
              : { images: references }),
    }
}

/**
 * One images call for the whole run: generation when the prompt stands alone,
 * the edits endpoint when reference images ground it.
 */
export async function generateXaiImages(request: EngineRequest): Promise<Blob[]> {
    const editing = request.references.length > 0

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/images/${editing ? 'edits' : 'generations'}`, {
            headers: headersOf(request),
            json: await imagesBody(request),
        })
    } catch {
        throw offlineError('xAI')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const parsed = (await readJson(response)) as XaiImagesResponse | null
    const images = (parsed?.data ?? [])
        .map((entry) => entry.b64_json)
        .filter((b64): b64 is string => typeof b64 === 'string' && b64 !== '')
        .map((b64) => decodeBase64Blob(b64, 'image/png'))

    if (images.length === 0) {
        throw new GenerationError('xAI returned no images for this prompt.')
    }

    return images
}

interface XaiVideoState {
    readonly request_id?: string
    readonly status?: string
    readonly video?: { readonly url?: string }
    readonly error?: { readonly message?: string }
}

/** Starts the video request and returns its id. */
async function createVideoRequest(request: EngineRequest): Promise<string> {
    const references = await Promise.all(
        request.references.slice(0, 3).map(async (file) => ({ url: await encodeDataUri(file) })),
    )

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/videos/generations`, {
            headers: headersOf(request),
            json: {
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                prompt: request.prompt,
                duration: request.durationSeconds,
                resolution: request.resolution,
                aspect_ratio: request.ratio,
                ...(request.firstFrame === undefined
                    ? {}
                    : { image: { url: await encodeDataUri(request.firstFrame) } }),
                ...(references.length === 0 ? {} : { reference_images: references }),
            },
        })
    } catch {
        throw offlineError('xAI')
    }

    if (!created.ok) {
        throw await toGenerationError(created)
    }

    const body = (await readJson(created)) as XaiVideoState | null

    if (typeof body?.request_id !== 'string' || body.request_id === '') {
        throw new GenerationError('xAI accepted the run but returned no job to follow.')
    }

    return body.request_id
}

export async function generateXaiVideo(request: EngineRequest): Promise<Blob[]> {
    const requestId = await createVideoRequest(request)

    const finished = await poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'xAI is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/videos/${requestId}`, {
                headers: headersOf(request),
            })

            if (!response.ok) {
                throw await toGenerationError(response)
            }

            const state = (await readJson(response)) as XaiVideoState | null

            if (state?.status === 'done') {
                return state
            }

            if (state?.status === 'failed' || state?.status === 'expired') {
                throw new GenerationError(
                    state.error?.message ?? 'xAI could not finish this video.',
                )
            }

            return null
        },
    })

    const url = finished.video?.url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('xAI finished the run but returned no video.')
    }

    return [await fetchBinary('xAI', url, 'video/mp4')]
}

interface XaiKeyInfo {
    readonly api_key_blocked?: boolean
    readonly api_key_disabled?: boolean
    readonly team_blocked?: boolean
}

/**
 * A free authenticated call: the key's own status record, which says exactly
 * why a key would not work — disabled, blocked, or on a team without usable
 * credits — where a plain inference call only says 403.
 */
export async function verifyXaiKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/api-key`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
    } catch {
        return { ok: false, message: 'Could not reach xAI. Check your connection and try again.' }
    }

    // xAI answers a wrong key with 400 `invalid-argument`, not 401.
    if (response.status === 400 || response.status === 401) {
        return {
            ok: false,
            message: 'xAI rejected this key. Paste the full key from the xAI console.',
        }
    }

    if (!response.ok) {
        const detail = await xaiDetailOf(response)

        return {
            ok: false,
            message: detail ?? `xAI returned an unexpected error (${response.status}).`,
        }
    }

    const info = (await readJson(response)) as XaiKeyInfo | null

    if (info?.api_key_disabled === true || info?.api_key_blocked === true) {
        return {
            ok: false,
            message: 'This xAI key is disabled or blocked. Create a fresh key in the xAI console.',
        }
    }

    if (info?.team_blocked === true) {
        return {
            ok: true,
            warning:
                'The key works, but its team is blocked — usually credits that ran out or sit on a different team. Check billing in the xAI console.',
        }
    }

    return { ok: true }
}
