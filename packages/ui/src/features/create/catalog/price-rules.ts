import { FLUX_2_SIZE, GPT_IMAGE_2_SIZE, pixelSize } from './output-size'
import type { AspectRatio, ImageQuality, PriceContext } from './types'

/**
 * Published output-cost formulas for GPT Image models and FLUX.2.
 */

type LegacyImageQuality = 'low' | 'medium' | 'high'

/** USD per million output tokens, per GPT Image model. */
const GPT_IMAGE_TOKEN_RATES: Readonly<Record<string, number>> = {
    'gpt-image-2': 30,
    'gpt-image-1-5': 32,
    'gpt-image-1': 40,
    'gpt-image-1-mini': 8,
}

/** The grid OpenAI lays over the image, per quality tier. */
const GPT_IMAGE_2_BASE: Readonly<Record<LegacyImageQuality, number>> = {
    low: 16,
    medium: 48,
    high: 96,
}

/**
 * OpenAI's own published calculation for GPT Image 2: a quality-sized grid
 * scaled by the shape, then weighted by the pixel count. It reproduces every
 * figure in OpenAI's per-image table exactly, including the fact that a wide
 * 4K frame costs less than a 2K square.
 */
function gptImage2Tokens(quality: LegacyImageQuality, width: number, height: number): number {
    const base = GPT_IMAGE_2_BASE[quality]
    const longest = Math.max(width, height)
    const shortest = Math.min(width, height)
    const across = Math.round((base * shortest) / longest)
    const gridArea = width >= height ? base * across : across * base

    return Math.ceil((gridArea * (2e6 + width * height)) / 4e6)
}

/**
 * The models before GPT Image 2 render three fixed sizes, and OpenAI publishes
 * the output tokens for each. Keyed by the composer's ratios.
 */
const LEGACY_TOKENS: Readonly<
    Record<LegacyImageQuality, Readonly<Partial<Record<AspectRatio, number>>>>
> = {
    low: { '1:1': 272, '2:3': 408, '3:2': 400 },
    medium: { '1:1': 1056, '2:3': 1584, '3:2': 1568 },
    high: { '1:1': 4160, '2:3': 6240, '3:2': 6208 },
}

/**
 * What one GPT Image render costs at a quality tier. `gpt-image-1-mini` comes
 * out under OpenAI's own quoted figures, which appear to fold in a fixed
 * prompt cost; billing follows the tokens, so the tokens are what is used.
 */
export function gptImagePrice(modelId: string, quality: LegacyImageQuality) {
    const rate = GPT_IMAGE_TOKEN_RATES[modelId] ?? 30

    return (context: PriceContext): number => {
        if (modelId === 'gpt-image-2') {
            const { height, width } = pixelSize(context.ratio, context.resolution, GPT_IMAGE_2_SIZE)

            return (gptImage2Tokens(quality, width, height) * rate) / 1e6
        }

        const tokens = LEGACY_TOKENS[quality][context.ratio] ?? LEGACY_TOKENS[quality]['1:1'] ?? 0

        return (tokens * rate) / 1e6
    }
}

const GPT_IMAGE_25_BASE = { low: 16, medium: 24, high: 48, xhigh: 64, max: 96 } as const

/** 2.6 scales the 2.5 token count per quality, rounded to a whole token. */
const GPT_IMAGE_26_SCALE = { low: 4.2, medium: 3.3, high: 1, xhigh: 1, max: 1 } as const

/**
 * OpenAI's calculator for the 2.5 and 2.6 Flare and Sunburst models, including
 * round-half-to-even. Estimates output only; prompt and reference-image tokens
 * are billed separately.
 * https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency
 */
export function gptImageFlarePrice(version: '2.5' | '2.6', quality: Exclude<ImageQuality, 'auto'>) {
    return (context: PriceContext): number => {
        const { width, height } = pixelSize(context.ratio, context.resolution, GPT_IMAGE_2_SIZE)
        const base = GPT_IMAGE_25_BASE[quality]
        const scaled = base / (Math.max(width, height) / Math.min(width, height))
        const floor = Math.floor(scaled)
        const across = scaled - floor === 0.5 ? floor + (floor % 2) : Math.round(scaled)
        const tokens = Math.ceil((base * across * (2e6 + width * height)) / 4e6)
        const billed = version === '2.6' ? Math.round(tokens * GPT_IMAGE_26_SCALE[quality]) : tokens

        return (billed * 30) / 1e6
    }
}

const MEGAPIXEL = 1024 * 1024

/** BFL rounds every image up to a whole megapixel, and caps output at four. */
function billedMegapixels(pixels: number): number {
    return Math.min(4, Math.max(1, Math.ceil(pixels / MEGAPIXEL)))
}

/**
 * FLUX.2 [pro]: the first megapixel of output costs $0.03 and each one after
 * it $0.015, with every reference image charged as a further megapixel.
 */
export function fluxTwoPrice(context: PriceContext): number {
    const { height, width } = pixelSize(context.ratio, context.resolution, FLUX_2_SIZE)
    const output = billedMegapixels(width * height)

    return 0.03 + 0.015 * (output - 1) + 0.015 * context.references
}

/**
 * FLUX.2 [max]: $0.07 for the first output megapixel, $0.03 for each one
 * after, and $0.03 per reference image — BFL's own calculator figures.
 */
export function fluxTwoMaxPrice(context: PriceContext): number {
    const { height, width } = pixelSize(context.ratio, context.resolution, FLUX_2_SIZE)
    const output = billedMegapixels(width * height)

    return 0.07 + 0.03 * (output - 1) + 0.03 * context.references
}

/** FLUX.2 [flex]: a flat $0.05 per megapixel, output and references alike. */
export function fluxTwoFlexPrice(context: PriceContext): number {
    const { height, width } = pixelSize(context.ratio, context.resolution, FLUX_2_SIZE)
    const output = billedMegapixels(width * height)

    return 0.05 * (output + context.references)
}

/**
 * Seedream 5.0 Pro: $0.045 per image at 1.5K and below, $0.09 above, with the
 * first reference image free and each further one $0.003 — ModelArk's own
 * price list, which draws its line at 2.61 megapixels rather than at a tier.
 */
export function seedreamFiveProPrice(context: PriceContext): number {
    const base = context.resolution === '2K' ? 0.09 : 0.045

    return base + 0.003 * Math.max(0, context.references - 1)
}

/**
 * Qwen-Image-3.0-Pro: per image by output tier, plus a small charge per input
 * image, both straight off Model Studio's Singapore price list.
 */
export function qwenImageThreeProPrice(context: PriceContext): number {
    const base = context.resolution === '2K' ? 0.075 : 0.04

    return base + 0.003 * context.references
}

/** Singapore list price for Qwen Image 3.0, including reference inputs. */
export function qwenImageThreePrice(context: PriceContext): number {
    return 0.03 + 0.003 * context.references
}

/** Klein bills the first output megapixel, then each additional megapixel. */
export function fluxKleinPrice(variant: '4b' | '9b') {
    return (context: PriceContext): number => {
        const { width, height } = pixelSize(context.ratio, context.resolution, FLUX_2_SIZE)
        const additional = billedMegapixels(width * height) - 1
        return variant === '4b' ? 0.014 + 0.001 * additional : 0.015 + 0.002 * additional
    }
}

type ImageTier = '1K' | '2K' | '4K'

/**
 * MiniMax H3 Image edits. MiniMax publishes what an edit costs with one and
 * with three 1K references per output tier; each reference past the first
 * adds half the gap between them.
 */
export function minimaxH3EditPrice(
    oneReference: Readonly<Record<ImageTier, number>>,
    threeReferences: Readonly<Record<ImageTier, number>>,
) {
    return (context: PriceContext): number => {
        const tier = context.resolution in oneReference ? (context.resolution as ImageTier) : '1K'
        const perExtra = (threeReferences[tier] - oneReference[tier]) / 2

        return oneReference[tier] + perExtra * Math.max(0, context.references - 1)
    }
}

/**
 * Seedream 5.5: $0.020 per image up to 1536² × 1.05² pixels and $0.035 up to
 * 2048² × 1.05², plus $0.008 for every reference image. Umber sends one image
 * per request, so the references are billed once per image.
 */
export function seedreamFiveFivePrice(context: PriceContext): number {
    const base = context.resolution === '2K' ? 0.035 : 0.02

    return base + 0.008 * context.references
}

const KLING_IMAGE_4_OUTPUT: Readonly<Record<string, number>> = {
    '2K': 0.063,
    '4K': 0.094,
    '8K': 0.157,
}

/**
 * Kling Image 4.0 bills each output image by tier plus $0.003 per reference
 * image or element. References are billed once per task, however many images
 * it returns, so their charge is shared across the outputs.
 */
export function klingImageFourPrice(context: PriceContext): number {
    const output = KLING_IMAGE_4_OUTPUT[context.resolution] ?? 0.063
    const outputs = Math.max(1, context.outputs ?? 1)

    return output + (0.003 * context.references) / outputs
}

type IdeogramQuality = 'low' | 'medium' | 'high'

/** Ideogram 4.6 per image. 1K bills at the 2K rate. */
const IDEOGRAM_4_6_PRICES: Readonly<
    Record<
        'text' | 'edit',
        Readonly<Record<IdeogramQuality, Readonly<Record<'2K' | '4K', number>>>>
    >
> = {
    text: {
        low: { '2K': 0.03, '4K': 0.06 },
        medium: { '2K': 0.06, '4K': 0.12 },
        high: { '2K': 0.1, '4K': 0.2 },
    },
    // Source images only change the high tier and medium at 4K.
    edit: {
        low: { '2K': 0.03, '4K': 0.06 },
        medium: { '2K': 0.06, '4K': 0.2 },
        high: { '2K': 0.22, '4K': 0.6 },
    },
}

/** Ideogram 4.6 by quality, output tier and whether source images are attached. */
export function ideogramFourSixPrice(quality: IdeogramQuality) {
    return (context: PriceContext): number => {
        const tier = context.resolution === '4K' ? '4K' : '2K'
        const table = context.references > 0 ? IDEOGRAM_4_6_PRICES.edit : IDEOGRAM_4_6_PRICES.text

        return table[quality][tier]
    }
}
