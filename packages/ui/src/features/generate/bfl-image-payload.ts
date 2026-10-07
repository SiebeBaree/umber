import { FLUX_1_1_SIZE, FLUX_2_SIZE, pixelSize } from '../create/catalog'
import type { EngineRequest } from './request'
import { encodeBase64 } from './shared'

export function bflImagePayload(request: EngineRequest): Promise<Record<string, unknown>> {
    return request.modelId === 'flux-3-image'
        ? fluxThreePayload(request)
        : legacyImagePayload(request)
}

async function fluxThreePayload(request: EngineRequest): Promise<Record<string, unknown>> {
    return {
        prompt: request.prompt,
        aspect_ratio: request.ratio,
        resolution: request.resolution.toLowerCase(),
        images: await Promise.all(
            request.references.slice(0, 10).map((file) => encodeBase64(file)),
        ),
    }
}

/** The per-model request body, honouring each family's own size vocabulary. */
async function legacyImagePayload(request: EngineRequest): Promise<Record<string, unknown>> {
    const base = { prompt: request.prompt, output_format: 'png' }
    const references = request.references

    if (request.modelId === 'flux-1-kontext-pro') {
        const [first, second, third, fourth] = await Promise.all(
            references.slice(0, 4).map((file) => encodeBase64(file)),
        )

        return {
            ...base,
            aspect_ratio: request.ratio,
            ...(first === undefined ? {} : { input_image: first }),
            ...(second === undefined ? {} : { input_image_2: second }),
            ...(third === undefined ? {} : { input_image_3: third }),
            ...(fourth === undefined ? {} : { input_image_4: fourth }),
        }
    }

    if (request.modelId === 'flux-pro-1-1') {
        const { height, width } = pixelSize(request.ratio, '1K', FLUX_1_1_SIZE)
        const [imagePrompt] = await Promise.all(
            references.slice(0, 1).map((file) => encodeBase64(file)),
        )

        return {
            ...base,
            width,
            height,
            ...(imagePrompt === undefined ? {} : { image_prompt: imagePrompt }),
        }
    }

    // FLUX.2: free-form sizes, up to eight reference images.
    const { height, width } = pixelSize(request.ratio, request.resolution, FLUX_2_SIZE)
    const encoded = await Promise.all(
        references
            .slice(0, request.modelId.startsWith('flux-2-klein-') ? 4 : 8)
            .map((file) => encodeBase64(file)),
    )
    const referenceFields = Object.fromEntries(
        encoded.map((image, index) => [
            index === 0 ? 'input_image' : `input_image_${index + 1}`,
            image,
        ]),
    )

    return { ...base, width, height, ...referenceFields }
}
