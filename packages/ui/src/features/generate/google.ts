import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { decodeBase64Blob, encodeBase64, readJson } from './shared'

/**
 * The Gemini API: Nano Banana image models via `generateContent`, Veo via the
 * long-running `predictLongRunning` operation flow. One AI Studio key drives
 * both.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'nano-banana-pro': 'gemini-3-pro-image',
    'nano-banana-2': 'gemini-3.1-flash-image',
    'nano-banana-2-lite': 'gemini-3.1-flash-lite-image',
    'nano-banana': 'gemini-2.5-flash-image',
    'veo-3-1': 'veo-3.1-generate-preview',
    'veo-3-1-fast': 'veo-3.1-fast-generate-preview',
}

/** Models that render one fixed 1K size, so an `imageSize` has nothing to
 * pick and is best left unsent. */
const FIXED_SIZE_MODELS = new Set(['nano-banana', 'nano-banana-2-lite'])

function apiKeyOf(request: EngineRequest): string {
    return request.credentials['apiKey'] ?? ''
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { 'x-goog-api-key': apiKeyOf(request) }
}

interface GoogleErrorBody {
    readonly error?: { readonly message?: string; readonly status?: string }
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as GoogleErrorBody | null
    const detail = body?.error?.message

    if (
        response.status === 400 &&
        body?.error?.status === 'INVALID_ARGUMENT' &&
        detail?.includes('API key') === true
    ) {
        return new GenerationError('Google rejected the API key. Check it in Settings.')
    }

    if (response.status === 401 || response.status === 403) {
        return new GenerationError('Google rejected the API key. Check it in Settings.')
    }

    if (response.status === 429) {
        return new GenerationError(
            'Google is rate limiting this key, or its quota is spent. Check your plan in AI Studio.',
        )
    }

    return new GenerationError(
        detail ?? `Google returned an unexpected error (${response.status}).`,
    )
}

interface InlinePart {
    readonly inlineData?: { readonly mimeType?: string; readonly data?: string }
}

interface GenerateContentResponse {
    readonly candidates?: readonly {
        readonly content?: { readonly parts?: readonly InlinePart[] }
    }[]
    readonly promptFeedback?: { readonly blockReason?: string }
}

/** All the image parts of a response; Gemini interleaves thinking text. */
function imagesOf(body: GenerateContentResponse): Blob[] {
    const parts = body.candidates?.[0]?.content?.parts ?? []

    return parts
        .map((part) => part.inlineData)
        .filter(
            (data): data is { mimeType?: string; data: string } =>
                typeof data?.data === 'string' && data.data !== '',
        )
        .map((data) => decodeBase64Blob(data.data, data.mimeType ?? 'image/png'))
}

function referenceParts(references: readonly File[]): Promise<InlinePart[]> {
    return Promise.all(
        references.map(async (file) => ({
            inlineData: {
                mimeType: file.type === '' ? 'image/png' : file.type,
                data: await encodeBase64(file),
            },
        })),
    )
}

/** One `generateContent` call — the API renders exactly one image per call. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    const model = WIRE_MODEL_IDS[request.modelId] ?? request.modelId
    const sized = !FIXED_SIZE_MODELS.has(request.modelId)

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/models/${model}:generateContent`, {
            headers: headersOf(request),
            json: {
                contents: [
                    {
                        parts: [
                            { text: request.prompt },
                            ...(await referenceParts(request.references)),
                        ],
                    },
                ],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    imageConfig: {
                        aspectRatio: request.ratio,
                        ...(sized ? { imageSize: request.resolution } : {}),
                    },
                },
            },
        })
    } catch {
        throw offlineError('Google')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as GenerateContentResponse | null
    const images = imagesOf(body ?? {})

    if (images[0] === undefined) {
        throw new GenerationError(
            body?.promptFeedback?.blockReason === undefined
                ? 'Google returned no image for this prompt.'
                : 'Google declined this prompt as against its usage policies.',
        )
    }

    return images[0]
}

export function generateGoogleImages(request: EngineRequest): Promise<Blob[]> {
    // One image per API call, so a multi-image run is parallel calls.
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

/** Shared with the Veo module, which speaks the same API with the same key. */
export {
    API_ROOT as GOOGLE_API_ROOT,
    WIRE_MODEL_IDS as GOOGLE_WIRE_MODEL_IDS,
    apiKeyOf as googleKeyOf,
    headersOf as googleHeadersOf,
    toGenerationError as toGoogleError,
}

/** A free authenticated call: lists one model, proving the key works. */
export async function verifyGoogleKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/models?pageSize=1`, {
            headers: { 'x-goog-api-key': apiKey },
        })
    } catch {
        return {
            ok: false,
            message: 'Could not reach Google. Check your connection and try again.',
        }
    }

    if (response.ok) {
        return { ok: true }
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
        return {
            ok: false,
            message:
                'Google rejected this key. Paste the full key from AI Studio, starting with AIza.',
        }
    }

    const body = (await readJson(response)) as GoogleErrorBody | null

    return {
        ok: false,
        message:
            body?.error?.message ?? `Google returned an unexpected error (${response.status}).`,
    }
}
