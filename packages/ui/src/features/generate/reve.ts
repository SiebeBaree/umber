import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { decodeBase64Blob, encodeBase64, readJson } from './shared'

/**
 * The Reve v2 API: one synchronous create endpoint that folds generation,
 * editing and remixing together — send a prompt, optionally reference images,
 * get a base64 PNG back. Renders take 40 to 80 seconds, which is still a
 * single long request rather than a polled task.
 */

const API_ROOT = 'https://api.reve.com/v2'

interface ReveResponse {
    readonly image?: string
    readonly content_violation?: boolean
    readonly error_code?: string
    readonly message?: string
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return {
        Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}`,
        Accept: 'application/json',
    }
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as ReveResponse | null

    if (response.status === 401 || response.status === 403) {
        return new GenerationError('Reve rejected the API key. Check it in Settings.')
    }

    if (response.status === 402) {
        return new GenerationError(
            'Your Reve account is out of credits. Top up in the Reve console.',
        )
    }

    if (response.status === 429) {
        return new GenerationError(
            'Reve is rate limiting this key. Give it a moment and try again.',
        )
    }

    return new GenerationError(
        typeof body?.message === 'string' && body.message !== ''
            ? body.message
            : `Reve returned an unexpected error (${response.status}).`,
    )
}

/** One image per call, so a multi-image run is parallel calls. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    const references = await Promise.all(
        request.references.slice(0, 8).map(async (file) => ({ data: await encodeBase64(file) })),
    )

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/image/create`, {
            headers: headersOf(request),
            json: {
                prompt: request.prompt,
                aspect_ratio: request.ratio,
                version: 'latest',
                ...(references.length === 0 ? {} : { references }),
            },
        })
    } catch {
        throw offlineError('Reve')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as ReveResponse | null

    if (body?.content_violation === true) {
        throw new GenerationError('Reve declined this prompt as against its usage policies.')
    }

    if (typeof body?.image !== 'string' || body.image === '') {
        throw new GenerationError('Reve returned no image for this prompt.')
    }

    return decodeBase64Blob(body.image, 'image/png')
}

export function generateReveImages(request: EngineRequest): Promise<Blob[]> {
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}
