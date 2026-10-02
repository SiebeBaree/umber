import { IMAGE_MODELS } from '../create/catalog'
import { getCreation, type CreationRecord } from '../gallery/creations-db'
import type { GenerationApi } from '../generate/generation-context'
import type { KeysApi } from '../keys/keys-context'
import type { LocalApiRequest, LocalApiResponse } from './contract'
import { ApiError, costOf, defaultSettings, parseImageRequest } from './request'

/** Keep every stored field; replace the renderer-only Blob with a downloadable resource. */
function imageMetadata(record: CreationRecord) {
    const { image, ...metadata } = record
    return {
        ...metadata,
        kind: 'image',
        estimatedCost: record.estimatedCost ?? null,
        mediaType: image.type,
        sizeBytes: image.size,
        downloadUrl: `/v1/images/${record.id}/file`,
    }
}

function models(keys: KeysApi) {
    return IMAGE_MODELS.map((model) => {
        const settings = defaultSettings(model)
        return {
            id: model.id,
            name: model.name,
            providerId: model.provider,
            kind: model.kind,
            connected: keys.connectedProviders.has(model.provider),
            aspectRatios: model.aspectRatios,
            resolutions: model.resolutions,
            qualities: model.quality?.options ?? [],
            maxOutputs: Math.min(4, model.maxOutputs),
            references: model.references,
            defaults: {
                aspectRatio: settings.aspectRatio,
                resolution: settings.resolution,
                quality: model.quality === undefined ? null : settings.quality,
                count: 1,
            },
        }
    })
}

async function readImage(request: LocalApiRequest): Promise<LocalApiResponse> {
    if (typeof request.body !== 'string')
        throw new ApiError(400, 'invalid_id', 'An image ID is required.')
    const record = await getCreation(request.body)
    if (record === undefined || record.kind === 'video')
        throw new ApiError(404, 'image_not_found', 'This image is no longer in the gallery.')
    return request.action === 'file'
        ? {
              status: 200,
              bytes: new Uint8Array(await record.image.arrayBuffer()),
              mediaType: record.image.type,
          }
        : { status: 200, body: imageMetadata(record) }
}

/** Same generation, persistence and usage path as the composer. */
export async function serveLocalApi(
    request: LocalApiRequest,
    keys: KeysApi,
    generation: GenerationApi,
): Promise<LocalApiResponse> {
    try {
        if (request.action === 'models') return { status: 200, body: { data: models(keys) } }
        if (request.action === 'image' || request.action === 'file') return await readImage(request)
        const input = await parseImageRequest(request.body)
        const cost = costOf(input)
        if (request.action === 'estimate')
            return { status: 200, body: { ...cost, settings: input.settings } }
        if (!keys.connectedProviders.has(input.model.provider))
            throw new ApiError(
                409,
                'provider_not_connected',
                "Connect this model's provider in Umber Settings first.",
            )
        return await generate(input, generation)
    } catch (error: unknown) {
        return error instanceof ApiError
            ? {
                  status: error.status,
                  body: { error: { code: error.code, message: error.message } },
              }
            : {
                  status: 500,
                  body: {
                      error: {
                          code: 'internal_error',
                          message: 'Umber could not complete this request.',
                      },
                  },
              }
    }
}

async function generate(
    input: Awaited<ReturnType<typeof parseImageRequest>>,
    generation: GenerationApi,
): Promise<LocalApiResponse> {
    const cost = costOf(input)
    const result = await generation.start(input)
    if ('error' in result) throw new ApiError(502, 'generation_failed', result.error)
    const { outputs: _outputs, ...job } = result.outcome
    const images = await Promise.all(
        result.records.map(async (record) => ({
            ...imageMetadata(record),
            // Preserve paid outputs even if local storage is full. Only this exceptional
            // case embeds a file in the response instead of keeping JSON lightweight.
            ...(result.persisted
                ? {}
                : { downloadUrl: null, base64: await blobBase64(record.image) }),
        })),
    )
    return {
        status: 200,
        body: {
            ...job,
            ...cost,
            estimatedTotalCost:
                cost.estimatedCost === null ? null : cost.estimatedCost * images.length,
            requestedEstimatedCost: cost.estimatedTotalCost,
            persisted: result.persisted,
            failures: result.failures,
            outputs: images,
        },
    }
}

function blobBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1] ?? ''))
        reader.addEventListener('error', () =>
            reject(new Error('Could not read the generated image.')),
        )
        reader.readAsDataURL(blob)
    })
}
