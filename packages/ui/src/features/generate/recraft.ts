import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { decodeBase64Blob, nearestSize, readJson } from './shared'

/**
 * The Recraft API: OpenAI-shaped synchronous generation. Results are asked
 * for as base64 so nothing depends on Recraft's 24-hour storage window.
 */

const API_ROOT = 'https://external.api.recraft.ai/v1'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'recraft-v4-1': 'recraftv4_1',
    'recraft-v3': 'recraftv3',
}

/** The fixed size lists per model family, matched to the nearest ratio. */
const V4_SIZES: readonly string[] = [
    '1024x1024',
    '1536x768',
    '768x1536',
    '1280x832',
    '832x1280',
    '1216x896',
    '896x1216',
    '1344x768',
    '768x1344',
]

const V3_SIZES: readonly string[] = [
    '1024x1024',
    '2048x1024',
    '1024x2048',
    '1536x1024',
    '1024x1536',
    '1365x1024',
    '1024x1365',
    '1820x1024',
    '1024x1820',
]

interface RecraftResponse {
    readonly data?: readonly { readonly b64_json?: string }[]
    readonly message?: string
    readonly error?: { readonly message?: string }
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as RecraftResponse | null

    if (response.status === 401) {
        return new GenerationError('Recraft rejected the API key. Check it in Settings.')
    }

    if (response.status === 429) {
        return new GenerationError(
            'Recraft is rate limiting this key. Give it a moment and try again.',
        )
    }

    const detail = body?.error?.message ?? body?.message

    return new GenerationError(
        typeof detail === 'string' && detail !== ''
            ? detail
            : `Recraft returned an unexpected error (${response.status}).`,
    )
}

export async function generateRecraftImages(request: EngineRequest): Promise<Blob[]> {
    if (request.references.length > 0) {
        throw new GenerationError(
            'Recraft does not take reference images here. Remove them or switch models.',
        )
    }

    const sizes = request.modelId === 'recraft-v3' ? V3_SIZES : V4_SIZES

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/images/generations`, {
            headers: { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` },
            json: {
                prompt: request.prompt,
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                size: nearestSize(request.ratio, sizes),
                n: request.count,
                response_format: 'b64_json',
            },
        })
    } catch {
        throw offlineError('Recraft')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as RecraftResponse | null
    const images = (body?.data ?? [])
        .map((entry) => entry.b64_json)
        .filter((b64): b64 is string => typeof b64 === 'string' && b64 !== '')
        .map((b64) => decodeBase64Blob(b64, 'image/png'))

    if (images.length === 0) {
        throw new GenerationError('Recraft returned no images for this prompt.')
    }

    return images
}

/** A free authenticated call: the user profile, which includes the balance. */
export async function verifyRecraftKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/users/me`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
    } catch {
        return {
            ok: false,
            message: 'Could not reach Recraft. Check your connection and try again.',
        }
    }

    if (response.ok) {
        return { ok: true }
    }

    if (response.status === 401) {
        return {
            ok: false,
            message: 'Recraft rejected this key. Paste the full token from your Recraft profile.',
        }
    }

    return { ok: false, message: `Recraft returned an unexpected error (${response.status}).` }
}
