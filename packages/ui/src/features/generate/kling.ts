import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { encodeBase64, fetchBinary, poll, readJson } from './shared'

/**
 * The Kling open platform (international endpoint). Kling signs every request
 * with a short-lived JWT built from the access/secret key pair, and answers in
 * a `{code, message, data}` envelope with polled tasks behind it.
 */

const API_ROOT = 'https://api-singapore.klingai.com/v1'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'kling-2-6': 'kling-v2-6',
    'kling-2-5-turbo': 'kling-v2-5-turbo',
    'kling-image-2-1': 'kling-v2-1',
}

function base64Url(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) {
        binary += String.fromCodePoint(byte)
    }

    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

/** The signed token Kling wants: HS256 over `{iss, exp, nbf}`, 30 min long. */
async function klingToken(accessKey: string, secretKey: string): Promise<string> {
    const encoder = new TextEncoder()
    const encode = (value: unknown) => base64Url(encoder.encode(JSON.stringify(value)))

    const now = Math.floor(Date.now() / 1000)
    const signable = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
        iss: accessKey,
        exp: now + 1800,
        nbf: now - 5,
    })}`

    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secretKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signable))

    return `${signable}.${base64Url(new Uint8Array(signature))}`
}

async function headersOf(request: EngineRequest): Promise<Readonly<Record<string, string>>> {
    const token = await klingToken(
        request.credentials['accessKey'] ?? '',
        request.credentials['secretKey'] ?? '',
    )

    return { Authorization: `Bearer ${token}` }
}

interface KlingEnvelope<T> {
    readonly code?: number
    readonly message?: string
    readonly data?: T
}

interface KlingTask {
    readonly task_id?: string
    readonly task_status?: string
    readonly task_status_msg?: string
    readonly task_result?: {
        readonly videos?: readonly { readonly url?: string }[]
        readonly images?: readonly { readonly url?: string }[]
    }
}

async function unwrap<T>(response: Response, providerAction: string): Promise<T> {
    if (response.status === 401) {
        throw new GenerationError('Kling rejected the key pair. Check both keys in Settings.')
    }

    const body = (await readJson(response)) as KlingEnvelope<T> | null

    if (!response.ok || body === null || body.code !== 0 || body.data === undefined) {
        throw new GenerationError(
            typeof body?.message === 'string' && body.message !== '' && body.message !== 'SUCCEED'
                ? `Kling: ${body.message}`
                : `Kling could not ${providerAction} (${response.status}).`,
        )
    }

    return body.data
}

function awaitTask(
    request: EngineRequest,
    pollPath: string,
    timeoutMs: number,
): Promise<KlingTask> {
    return poll({
        intervalMs: 5000,
        timeoutMs,
        timeoutMessage: `Kling is still rendering after ${Math.round(timeoutMs / 60_000)} minutes. Try again.`,
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/${pollPath}`, {
                headers: await headersOf(request),
            })
            const task = await unwrap<KlingTask>(response, 'report the run')

            if (task.task_status === 'succeed') {
                return task
            }

            if (task.task_status === 'failed') {
                throw new GenerationError(
                    task.task_status_msg === undefined || task.task_status_msg === ''
                        ? 'Kling could not finish this run.'
                        : `Kling: ${task.task_status_msg}`,
                )
            }

            return null
        },
    })
}

export async function generateKlingVideo(request: EngineRequest): Promise<Blob[]> {
    const reference = request.references[0]
    const endpoint = reference === undefined ? 'videos/text2video' : 'videos/image2video'

    // Kling still frames output tiers as modes (pro is its 1080p tier), and
    // wants reference images as raw base64, without the data: prefix.
    const payload = {
        model_name: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
        prompt: request.prompt,
        mode: request.resolution === '1080p' ? 'pro' : 'std',
        duration: String(request.durationSeconds),
        ...(reference === undefined
            ? { aspect_ratio: request.ratio }
            : { image: await encodeBase64(reference) }),
    }

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/${endpoint}`, {
            headers: await headersOf(request),
            json: payload,
        })
    } catch {
        throw offlineError('Kling')
    }

    const job = await unwrap<KlingTask>(created, 'start the run')

    if (typeof job.task_id !== 'string' || job.task_id === '') {
        throw new GenerationError('Kling accepted the run but returned no task to follow.')
    }

    const finished = await awaitTask(request, `${endpoint}/${job.task_id}`, 15 * 60_000)
    const url = finished.task_result?.videos?.[0]?.url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('Kling finished the run but returned no video.')
    }

    return [await fetchBinary('Kling', url, 'video/mp4')]
}

export async function generateKlingImages(request: EngineRequest): Promise<Blob[]> {
    const reference = request.references[0]

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/images/generations`, {
            headers: await headersOf(request),
            json: {
                model_name: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                prompt: request.prompt,
                n: request.count,
                resolution: request.resolution.toLowerCase(),
                aspect_ratio: request.ratio,
                ...(reference === undefined
                    ? {}
                    : { image: await encodeBase64(reference), image_reference: 'subject' }),
            },
        })
    } catch {
        throw offlineError('Kling')
    }

    const job = await unwrap<KlingTask>(created, 'start the run')

    if (typeof job.task_id !== 'string' || job.task_id === '') {
        throw new GenerationError('Kling accepted the run but returned no task to follow.')
    }

    const finished = await awaitTask(request, `images/generations/${job.task_id}`, 5 * 60_000)
    const urls = (finished.task_result?.images ?? [])
        .map((image) => image.url)
        .filter((url): url is string => typeof url === 'string' && url !== '')

    if (urls.length === 0) {
        throw new GenerationError('Kling finished the run but returned no images.')
    }

    return Promise.all(urls.map((url) => fetchBinary('Kling', url, 'image/png')))
}
