import {
    defaultModel,
    durationOptions,
    findModel,
    isImageModel,
    type GenerationMode,
    type Model,
} from '../catalog'
import type { ModeSettings } from './schema'

/** Keeps a remembered choice when the model still offers it, otherwise the model's first option. */
function keepOrReset<Option extends string>(
    remembered: string,
    supported: readonly [Option, ...Option[]],
): Option {
    return supported.find((option) => option === remembered) ?? supported[0]
}

/** The clip length nearest the remembered one, so switching models loses as little as possible. */
function nearestDuration(remembered: number, options: readonly number[]): number {
    return options.reduce(
        (best, option) =>
            Math.abs(option - remembered) < Math.abs(best - remembered) ? option : best,
        options[0] ?? remembered,
    )
}

/**
 * Forces a set of remembered settings to be valid for `model`.
 *
 * This is the single rule behind "remember what I picked, unless the model I
 * just switched to cannot do it" — anything the new model supports is kept, and
 * anything it does not falls back to that model's own default rather than
 * silently sending an unsupported request.
 */
export function reconcileToModel(settings: ModeSettings, model: Model): ModeSettings {
    const aspectRatio = keepOrReset(settings.aspectRatio, model.aspectRatios)
    const resolution = keepOrReset(settings.resolution, model.resolutions)

    if (isImageModel(model)) {
        return {
            modelId: model.id,
            aspectRatio,
            resolution,
            outputCount: Math.min(settings.outputCount, model.maxOutputs),
            durationSeconds: settings.durationSeconds,
        }
    }

    return {
        modelId: model.id,
        aspectRatio,
        resolution,
        outputCount: settings.outputCount,
        durationSeconds: nearestDuration(
            settings.durationSeconds,
            durationOptions(model.durations),
        ),
    }
}

/** Resolves a remembered model id, falling back to the mode's newest model. */
export function resolveModel(mode: GenerationMode, modelId: string): Model {
    return findModel(mode, modelId) ?? defaultModel(mode)
}

/** A mode's settings from scratch, used on first launch and as the parse fallback. */
export function defaultModeSettings(mode: GenerationMode): ModeSettings {
    const model = defaultModel(mode)

    return reconcileToModel(
        {
            modelId: model.id,
            aspectRatio: model.aspectRatios[0],
            resolution: model.resolutions[0],
            outputCount: 1,
            durationSeconds: isImageModel(model) ? 5 : (durationOptions(model.durations)[0] ?? 5),
        },
        model,
    )
}
