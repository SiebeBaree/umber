import { IMAGE_MODELS, type ImageModel } from '../create/catalog'
import type { ModeSettings } from '../create/settings/schema'
import { RECIPES, type Platform } from './platforms'

function templateModel(): ImageModel {
    const model = IMAGE_MODELS.find((candidate) => candidate.id === 'nano-banana-pro')

    if (model === undefined) {
        throw new Error('Templates needs Nano Banana Pro in the catalog')
    }

    return model
}

/**
 * Every Templates photo renders on this. No picker: the feature rests on how
 * well it keeps a face, and nothing else has been compared yet.
 */
export const TEMPLATE_MODEL = templateModel()

/** What one Templates render asks for, or a whole set when pricing it. */
export function templateSettings(platform: Platform, outputCount = 1): ModeSettings {
    return {
        modelId: TEMPLATE_MODEL.id,
        aspectRatio: RECIPES[platform].ratio,
        resolution: '2K',
        quality: 'medium',
        outputCount,
        durationSeconds: 0,
    }
}
