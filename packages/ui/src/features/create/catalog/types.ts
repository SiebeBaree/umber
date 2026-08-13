/**
 * The shape of Umber's model catalog.
 *
 * Capabilities are declared per model rather than per mode, because what a model
 * accepts is the only thing that may ever populate the composer's pickers — a
 * model that cannot render 4K must not be able to be asked for it.
 */

export const PROVIDER_IDS = [
    'google',
    'openai',
    'blackForestLabs',
    'bytedance',
    'kuaishou',
    'minimax',
    'alibaba',
    'runway',
    'luma',
    'pixverse',
    'lightricks',
    'ideogram',
    'recraft',
    'stability',
] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface Provider {
    readonly id: ProviderId
    /** The company, not the model family — models are grouped under this. */
    readonly name: string
}

export type AspectRatio = '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9'

/**
 * The two sides of a ratio, parsed once and validated loudly — the single way
 * callers read the `w:h` encoding, mirroring what `durationOptions` is for
 * `DurationRule`. Throwing beats a silent fallback: a malformed ratio fed to
 * layout maths would otherwise surface as NaN geometry far from the mistake.
 */
export function ratioParts(ratio: AspectRatio): {
    readonly width: number
    readonly height: number
} {
    const [widthPart, heightPart] = ratio.split(':')
    const width = Number(widthPart)
    const height = Number(heightPart)

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error(`Malformed aspect ratio: ${ratio}`)
    }

    return { width, height }
}

/** The ratio in CSS `aspect-ratio` syntax — `'3:2'` becomes `'3 / 2'`. */
export function ratioToCss(ratio: AspectRatio): string {
    const { height, width } = ratioParts(ratio)

    return `${width} / ${height}`
}

export type ImageResolution = '1K' | '2K' | '4K'
export type VideoResolution = '480p' | '720p' | '1080p' | '4K'

/**
 * What a video model accepts for clip length. Some publish a handful of fixed
 * lengths, others any whole second inside a range, so both are expressible.
 */
export type DurationRule =
    | { readonly kind: 'list'; readonly seconds: readonly [number, ...number[]] }
    | { readonly kind: 'range'; readonly min: number; readonly max: number; readonly step: number }

/** Every allowed length, ascending — the single way callers read a rule. */
export function durationOptions(rule: DurationRule): readonly number[] {
    if (rule.kind === 'list') {
        return rule.seconds
    }

    const options: number[] = []
    for (let seconds = rule.min; seconds <= rule.max; seconds += rule.step) {
        options.push(seconds)
    }

    return options
}

interface ModelBase {
    readonly id: string
    readonly name: string
    readonly provider: ProviderId
    /**
     * Ordering key within a provider, newest first. An ISO date rather than a
     * version string, because version schemes differ between vendors.
     */
    readonly releasedOn: string
    readonly aspectRatios: readonly [AspectRatio, ...AspectRatio[]]
}

export interface ImageModel extends ModelBase {
    readonly kind: 'image'
    readonly resolutions: readonly [ImageResolution, ...ImageResolution[]]
    /** Most images this model will return in one request; the stepper caps at 4. */
    readonly maxOutputs: number
    /** USD for one image at the model's cheapest resolution. */
    readonly pricePerImage: number
}

export interface VideoModel extends ModelBase {
    readonly kind: 'video'
    readonly resolutions: readonly [VideoResolution, ...VideoResolution[]]
    readonly durations: DurationRule
    /** USD for one second at the model's cheapest resolution. */
    readonly pricePerSecond: number
}

export type Model = ImageModel | VideoModel
