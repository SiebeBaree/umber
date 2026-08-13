import { z } from 'zod'

/**
 * What the composer remembers between launches.
 *
 * Every field is stored as a plain string or number rather than a union of the
 * catalog's literals: a saved value has to survive the catalog changing under
 * it, and `reconcile` is what turns it back into something the current model
 * actually supports.
 */
export const modeSettingsSchema = z.object({
    modelId: z.string(),
    aspectRatio: z.string(),
    resolution: z.string(),
    /** Render-effort tier. Only meaningful for models that price by quality. */
    quality: z.string().default('medium'),
    /** Images per run. Only meaningful for image models. */
    outputCount: z.number().int().min(1).max(4),
    /** Clip length in seconds. Only meaningful for video models. */
    durationSeconds: z.number().int().positive(),
})

export type ModeSettings = z.output<typeof modeSettingsSchema>

export const composerSettingsSchema = z.object({
    image: modeSettingsSchema,
    video: modeSettingsSchema,
    /** Model ids the user pinned to the top of the picker. Unbounded by design. */
    starredModelIds: z.array(z.string()),
})

export type ComposerSettings = z.output<typeof composerSettingsSchema>

/** Bumped alongside a breaking change to the shape above, to drop stale entries. */
export const COMPOSER_SETTINGS_KEY = 'umber.composer.v1'
