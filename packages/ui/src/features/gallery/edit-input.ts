import { IMAGE_MODELS } from '../create/catalog'
import type { ModeSettings } from '../create/settings/schema'
import type { StartInput } from '../generate/job'
import { getCreation } from './creations-db'
import type { ImageDetails } from './image-detail-dialog'

export function editConfiguration(image: ImageDetails) {
    const model = IMAGE_MODELS.find((candidate) => candidate.id === image.modelId)
    if (model === undefined || model.references.max === 0)
        return 'This model does not support image editing.'
    if (image.resolution === undefined || image.quality === undefined)
        return 'The original settings were not recorded for this image.'
    const settings: ModeSettings = {
        modelId: model.id,
        aspectRatio: image.ratio,
        resolution: image.resolution,
        quality: image.quality,
        outputCount: 1,
        durationSeconds: 5,
    }
    return { model, settings }
}

export async function editInput(image: ImageDetails, prompt: string): Promise<StartInput> {
    const config = editConfiguration(image)
    if (typeof config === 'string') throw new Error(config)
    const record = await getCreation(image.id)
    const blob = record === undefined ? await (await fetch(image.url)).blob() : record.image
    if (!config.model.references.types.includes(blob.type))
        throw new Error('This image format is not supported by the original model.')
    return {
        ...config,
        prompt: prompt.trim(),
        references: [new File([blob], `edit-${image.id}`, { type: blob.type })],
        parentId: image.id,
        rootId: image.rootId ?? image.id,
        version: (image.version ?? 1) + 1,
    }
}
