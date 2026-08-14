import { isImageModel, priceAt, type Model, type Price, type PriceContext } from './catalog'
import type { ModeSettings } from './settings/schema'

/**
 * The estimate shown on the Generate button.
 *
 * Deliberately a pure function of the current settings: every control that
 * changes cost (resolution, shape, quality, image count, clip length, whether
 * a reference is attached) moves this number, so the button always reflects
 * what the next run would actually charge.
 *
 * Every figure comes from the catalog, which carries each vendor's own
 * published rate. Nothing here scales one tier off another, so a model that
 * charges the same at every resolution correctly shows a flat price.
 */

/** What one image or one second costs, given everything that can change it. */
function unitPrice(model: Model, context: PriceContext): number {
    const cheapest = model.resolutions[0]
    const fromImage = context.references > 0

    if (!isImageModel(model)) {
        const rate: Price =
            fromImage && model.pricePerSecondFromImage !== undefined
                ? model.pricePerSecondFromImage
                : model.pricePerSecond

        return priceAt(rate, context, cheapest)
    }

    // A tiered model is priced off the chosen quality; `reconcileToModel`
    // guarantees the tier is one the model offers.
    if (model.quality !== undefined) {
        const tier = context.quality as keyof typeof model.quality.pricePerImage

        return priceAt(model.quality.pricePerImage[tier] ?? model.pricePerImage, context, cheapest)
    }

    const rate: Price =
        fromImage && model.pricePerImageFromImage !== undefined
            ? model.pricePerImageFromImage
            : model.pricePerImage

    return priceAt(rate, context, cheapest)
}

export function estimateCost(model: Model, settings: ModeSettings, references = 0): number {
    const context: PriceContext = {
        resolution: settings.resolution,
        ratio: settings.aspectRatio as PriceContext['ratio'],
        quality: settings.quality,
        references,
    }

    const unit = unitPrice(model, context)

    if (!isImageModel(model)) {
        // Some vendors bill the supplied first frame on top of the clip.
        const firstFrame = references > 0 ? (model.firstFramePrice ?? 0) : 0

        return unit * settings.durationSeconds + firstFrame
    }

    return unit * settings.outputCount
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
