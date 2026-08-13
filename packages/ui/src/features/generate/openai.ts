import { httpFetch } from '../../lib/http'
import { ratioParts, type AspectRatio } from '../create/catalog'
import { GenerationError } from './errors'
import type { EngineRequest } from './request'
import { decodeBase64Blob, readJson } from './shared'

/**
 * The OpenAI Images and Videos APIs, spoken with the user's own key. Plain
 * requests over `httpFetch`: no SDK, no shared state, errors translated once
 * into sentences the composer can show.
 */

const API_ROOT = 'https://api.openai.com/v1'

/** Catalog ids that differ from the wire name; anything absent is used as-is. */
const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'gpt-image-1-5': 'gpt-image-1.5',
}

/** Approximate pixel budgets behind the composer's resolution tiers. */
const TIER_PIXELS: Readonly<Record<string, number>> = {
    '1K': 1024 * 1024,
    '2K': 2048 * 2048,
    // The API's hard ceiling (3840 × 2160), reused as the 4K budget.
    '4K': 8_294_400,
}

const MAX_EDGE = 3840
const MAX_PIXELS = 8_294_400
const GRID = 16

/**
 * The fixed sizes every GPT Image model before 2 accepts, keyed by the
 * composer ratios that map onto them.
 */
const FIXED_SIZES: Readonly<Partial<Record<AspectRatio, string>>> = {
    '1:1': '1024x1024',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
}

/**
 * A concrete `WxH` for a ratio and tier, honouring gpt-image-2's free-form
 * size rules: multiples of 16 on both edges, no edge past 3840, at most
 * ~8.3MP. Rounded to the grid first, then walked down the long edge until the
 * pixel cap holds — at most a step or two, only ever near the 4K ceiling.
 */
export function freeFormSize(ratio: AspectRatio, resolution: string): string {
    const { height, width } = ratioParts(ratio)
    const budget = TIER_PIXELS[resolution] ?? TIER_PIXELS['1K'] ?? 1_048_576

    const scale = Math.sqrt(budget / (width * height))
    const snap = (edge: number) => Math.round(edge / GRID) * GRID

    let pixelWidth = snap(width * scale)
    let pixelHeight = snap(height * scale)

    // The 21:9 tiers can overshoot the edge limit before the pixel cap bites.
    if (Math.max(pixelWidth, pixelHeight) > MAX_EDGE) {
        const shrink = MAX_EDGE / Math.max(pixelWidth, pixelHeight)
        pixelWidth = snap(pixelWidth * shrink)
        pixelHeight = snap(pixelHeight * shrink)
    }

    while (pixelWidth * pixelHeight > MAX_PIXELS) {
        if (pixelWidth >= pixelHeight) {
            pixelWidth -= GRID
        } else {
            pixelHeight -= GRID
        }
    }

    return `${pixelWidth}x${pixelHeight}`
}

function sizeFor(modelId: string, ratio: AspectRatio, resolution: string): string {
    if (modelId === 'gpt-image-2') {
        return freeFormSize(ratio, resolution)
    }

    return FIXED_SIZES[ratio] ?? '1024x1024'
}

interface OpenAiErrorBody {
    readonly error?: { readonly message?: string; readonly code?: string }
}

/** Reads the API's own error message without trusting its shape. */
async function apiErrorMessage(response: Response): Promise<string | null> {
    const body = (await readJson(response)) as OpenAiErrorBody | null
    const message = body?.error?.message

    return typeof message === 'string' && message !== '' ? message : null
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const detail = await apiErrorMessage(response)

    if (response.status === 401) {
        return new GenerationError('OpenAI rejected the API key. Check it in Settings.')
    }

    if (response.status === 403 || detail?.toLowerCase().includes('verif') === true) {
        return new GenerationError(
            'Your OpenAI organisation is not verified for this model yet. Verify it in the OpenAI console, then try again.',
        )
    }

    if (response.status === 429) {
        return new GenerationError(
            detail?.toLowerCase().includes('quota') === true
                ? 'Your OpenAI account is out of credit. Top up billing in the OpenAI console.'
                : 'OpenAI is rate limiting this key. Give it a moment and try again.',
        )
    }

    if (
        detail?.toLowerCase().includes('moderation') === true ||
        detail?.toLowerCase().includes('safety') === true
    ) {
        return new GenerationError('OpenAI declined this prompt as against its usage policies.')
    }

    return new GenerationError(
        detail ?? `OpenAI returned an unexpected error (${response.status}).`,
    )
}

interface ImagesResponse {
    readonly data?: readonly { readonly b64_json?: string }[]
}

function decodeResponse(body: ImagesResponse): Blob[] {
    const images = (body.data ?? [])
        .map((entry) => entry.b64_json)
        .filter((b64): b64 is string => typeof b64 === 'string' && b64 !== '')
        .map((b64) => decodeBase64Blob(b64, 'image/png'))

    if (images.length === 0) {
        throw new GenerationError('OpenAI returned no images for this prompt.')
    }

    return images
}

/** One network failure message, shared by generation and verification. */
const OFFLINE_MESSAGE = 'Could not reach OpenAI. Check your connection and try again.'

function apiKeyOf(request: EngineRequest): string {
    return request.credentials['apiKey'] ?? ''
}

function postJson(request: EngineRequest): Promise<Response> {
    return httpFetch(`${API_ROOT}/images/generations`, {
        headers: { Authorization: `Bearer ${apiKeyOf(request)}` },
        json: {
            model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
            prompt: request.prompt,
            n: request.count,
            size: sizeFor(request.modelId, request.ratio, request.resolution),
            quality: request.quality,
            output_format: 'png',
        },
    })
}

/** Edits are multipart: the same knobs, plus the reference images as files. */
function postEdit(request: EngineRequest): Promise<Response> {
    const form = new FormData()
    form.set('model', WIRE_MODEL_IDS[request.modelId] ?? request.modelId)
    form.set('prompt', request.prompt)
    form.set('n', String(request.count))
    form.set('size', sizeFor(request.modelId, request.ratio, request.resolution))
    form.set('quality', request.quality)

    for (const reference of request.references) {
        form.append('image[]', reference, reference.name)
    }

    return httpFetch(`${API_ROOT}/images/edits`, {
        headers: { Authorization: `Bearer ${apiKeyOf(request)}` },
        form,
    })
}

export async function generateOpenAiImages(request: EngineRequest): Promise<Blob[]> {
    let response: Response

    try {
        response = request.references.length > 0 ? await postEdit(request) : await postJson(request)
    } catch {
        throw new GenerationError(OFFLINE_MESSAGE)
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    return decodeResponse((await response.json()) as ImagesResponse)
}

/** Shared with the Sora module, which speaks the same API with the same key. */
export {
    API_ROOT as OPENAI_API_ROOT,
    OFFLINE_MESSAGE as OPENAI_OFFLINE_MESSAGE,
    WIRE_MODEL_IDS as OPENAI_WIRE_MODEL_IDS,
    apiKeyOf as openAiKeyOf,
    toGenerationError as toOpenAiError,
}

export type KeyVerification =
    | { readonly ok: true; readonly warning?: string }
    | { readonly ok: false; readonly message: string }

/**
 * Checks a key before it is saved: a cheap authenticated call, plus a look at
 * whether any GPT Image model is actually available to this organisation —
 * missing image models almost always means verification hasn't been done.
 */
export async function verifyOpenAiKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
    } catch {
        return { ok: false, message: OFFLINE_MESSAGE }
    }

    if (response.status === 401) {
        return {
            ok: false,
            message: 'OpenAI rejected this key. Paste the full key, starting with sk-.',
        }
    }

    if (!response.ok) {
        const detail = await apiErrorMessage(response)

        return {
            ok: false,
            message: detail ?? `OpenAI returned an unexpected error (${response.status}).`,
        }
    }

    try {
        const body = (await response.json()) as {
            readonly data?: readonly { readonly id?: string }[]
        }
        const hasImageModels = (body.data ?? []).some(
            (model) => typeof model.id === 'string' && model.id.startsWith('gpt-image'),
        )

        if (!hasImageModels) {
            return {
                ok: true,
                warning:
                    'The key works, but no image models are available to it yet. Verify your organisation in the OpenAI console to unlock them.',
            }
        }
    } catch {
        // A malformed model list is not worth blocking a valid key over.
    }

    return { ok: true }
}
