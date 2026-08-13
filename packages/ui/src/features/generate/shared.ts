import { httpFetch } from '../../lib/http'
import { ratioParts, type AspectRatio } from '../create/catalog'
import { GenerationError, offlineError } from './errors'

/**
 * The handful of moves every provider integration makes: polling an async
 * job, decoding base64 payloads, downloading a finished file. Kept together
 * so each provider module is only its API's vocabulary.
 */

export interface PollOptions<T> {
    /** Checks the job once; null means "not done yet, ask again". */
    readonly check: () => Promise<T | null>
    readonly intervalMs: number
    readonly timeoutMs: number
    /** Display-ready sentence for the give-up case. */
    readonly timeoutMessage: string
}

const wait = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })

/** Polls `check` until it yields, or gives up loudly after `timeoutMs`. */
export async function poll<T>(options: PollOptions<T>): Promise<T> {
    const deadline = Date.now() + options.timeoutMs

    for (;;) {
        const result = await options.check()

        if (result !== null) {
            return result
        }

        if (Date.now() >= deadline) {
            throw new GenerationError(options.timeoutMessage)
        }

        await wait(options.intervalMs)
    }
}

export function decodeBase64Blob(b64: string, mimeType: string): Blob {
    const bytes = Uint8Array.from(atob(b64), (character) => character.codePointAt(0) ?? 0)

    return new Blob([bytes], { type: mimeType })
}

/** A `File` as base64, for APIs that take reference images inline. */
export async function encodeBase64(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer())

    let binary = ''
    // Chunked: spreading a multi-megabyte image into one call overflows the
    // argument limit.
    const CHUNK = 0x8000
    for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        binary += String.fromCodePoint(...bytes.subarray(offset, offset + CHUNK))
    }

    return btoa(binary)
}

/**
 * Downloads a finished asset — providers hand results back as short-lived
 * URLs more often than as bytes. `fallbackType` names the blob's type when
 * the server does not.
 */
export async function fetchBinary(
    providerName: string,
    url: string,
    fallbackType: string,
    headers?: Readonly<Record<string, string>>,
): Promise<Blob> {
    let response: Response

    try {
        response = await httpFetch(url, headers === undefined ? {} : { headers })
    } catch {
        throw offlineError(providerName)
    }

    if (!response.ok) {
        throw new GenerationError(
            `${providerName} produced a result Umber could not download (${response.status}).`,
        )
    }

    const blob = await response.blob()

    return blob.type === '' ? new Blob([blob], { type: fallbackType }) : blob
}

/** Reads a JSON body without trusting it to be one. */
export async function readJson(response: Response): Promise<unknown> {
    try {
        return await response.json()
    } catch {
        return null
    }
}

/**
 * The size from a model's fixed list whose shape best matches `ratio`,
 * compared on log-ratio so landscape and portrait err evenly.
 */
export function nearestSize(ratio: AspectRatio, sizes: readonly string[], separator = 'x'): string {
    const { height, width } = ratioParts(ratio)
    const target = Math.log(width / height)

    let best = sizes[0] ?? '1024x1024'
    let bestDistance = Number.POSITIVE_INFINITY

    for (const size of sizes) {
        const [sizeWidth, sizeHeight] = size.split(separator).map(Number)

        if (sizeWidth === undefined || sizeHeight === undefined || sizeHeight === 0) {
            continue
        }

        const distance = Math.abs(Math.log(sizeWidth / sizeHeight) - target)

        if (distance < bestDistance) {
            best = size
            bestDistance = distance
        }
    }

    return best
}

/** A `File` as a `data:` URI, for APIs that take reference images by URL. */
export async function encodeDataUri(file: File): Promise<string> {
    const type = file.type === '' ? 'image/png' : file.type

    return `data:${type};base64,${await encodeBase64(file)}`
}

/**
 * Redraws an image to exactly `width`×`height`, cropping like `object-cover`.
 * For APIs that demand a reference frame in the output's own dimensions.
 */
export async function resizeToCover(file: File, width: number, height: number): Promise<Blob> {
    const bitmap = await createImageBitmap(file)

    try {
        const scale = Math.max(width / bitmap.width, height / bitmap.height)
        const drawWidth = bitmap.width * scale
        const drawHeight = bitmap.height * scale

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')

        if (context === null) {
            throw new GenerationError('This machine could not prepare the reference image.')
        }

        context.drawImage(
            bitmap,
            (width - drawWidth) / 2,
            (height - drawHeight) / 2,
            drawWidth,
            drawHeight,
        )

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob === null) {
                    reject(
                        new GenerationError('This machine could not prepare the reference image.'),
                    )
                } else {
                    resolve(blob)
                }
            }, 'image/png')
        })
    } finally {
        bitmap.close()
    }
}
