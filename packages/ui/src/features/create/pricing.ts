import { isImageModel, type Model } from './catalog'
import type { ModeSettings } from './settings/schema'

/**
 * How much dearer a run gets at each step up in resolution. Applied on top of a
 * model's base price, which is quoted at its cheapest resolution.
 */
const RESOLUTION_MULTIPLIER: Readonly<Record<string, number>> = {
    '1K': 1,
    '2K': 1.8,
    '4K': 3.4,
    '480p': 1,
    '720p': 1.4,
    '1080p': 2.2,
}

/**
 * The estimate shown on the Generate button.
 *
 * Deliberately a pure function of the current settings: every control that
 * changes cost — resolution, image count, clip length — moves this number, so
 * the button always reflects what the next run would actually charge.
 *
 * Prices come from the hard-coded catalog and are estimates, not quotes.
 */
export function estimateCost(model: Model, settings: ModeSettings): number {
    const multiplier = RESOLUTION_MULTIPLIER[settings.resolution] ?? 1

    if (!isImageModel(model)) {
        return model.pricePerSecond * multiplier * settings.durationSeconds
    }

    // A tiered model is priced off the chosen quality; `reconcileToModel`
    // guarantees the tier is one the model offers.
    const perImage =
        model.quality?.pricePerImage[
            settings.quality as keyof typeof model.quality.pricePerImage
        ] ?? model.pricePerImage

    return perImage * multiplier * settings.outputCount
}

/**
 * Cents, with a `~` whenever the rounding actually hides something.
 *
 * Three images at $0.476 is shown as `~$1.43` while one at $0.14 is shown as a
 * flat `$0.14`: the tilde marks a figure that has been rounded, so an exact
 * price is never dressed up as an estimate, nor the reverse. Anything under a
 * cent would round to `$0.00` and read as free, so it gets its own form.
 */
export function formatCost(amount: number): string {
    if (amount > 0 && amount < 0.005) {
        return '<$0.01'
    }

    const rounded = Math.round(amount * 100) / 100
    // A tolerance, not equality: the catalog's decimals do not survive binary
    // floating point, so 0.28 × 2.2 × 5 lands a hair off its own exact 3.08.
    const isExact = Math.abs(rounded - amount) < 1e-9

    return `${isExact ? '' : '~'}$${rounded.toFixed(2)}`
}
