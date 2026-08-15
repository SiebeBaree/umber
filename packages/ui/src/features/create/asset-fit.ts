import type { AssetCapabilities } from './catalog'

/**
 * The pure half of the composer's attachments: what a slot is, and how an
 * attached set is forced to fit a model's declared capabilities. Everything
 * stateful lives in `use-composer-assets`.
 */

export type AssetSlot = 'reference' | 'start' | 'end'

export interface ComposerAsset {
    readonly id: string
    readonly name: string
    /** An object URL; owned by the assets hook, which revokes it when the asset goes away. */
    readonly previewUrl: string
    readonly file: File
    readonly slot: AssetSlot
}

export interface AssetFit {
    readonly kept: readonly ComposerAsset[]
    readonly notice: string | null
}

export function plural(count: number): string {
    return count === 1 ? 'image' : 'images'
}

function asReference(asset: ComposerAsset): ComposerAsset {
    return asset.slot === 'reference' ? asset : { ...asset, slot: 'reference' }
}

/**
 * The slot corrections `fitAssets` makes before any counting: frames collapse
 * into references on a model without frame slots, an end frame leaves when the
 * model has no concept of one, and on a model whose reference room is too
 * small the first reference keeps its old meaning by becoming the start frame.
 */
function reslotted(
    assets: readonly ComposerAsset[],
    capabilities: AssetCapabilities,
    modelName: string,
    notices: string[],
): readonly ComposerAsset[] {
    if (!capabilities.frames) {
        return assets.map((asset) => asReference(asset))
    }

    let fitted = assets

    if (!capabilities.lastFrame && fitted.some((asset) => asset.slot === 'end')) {
        notices.push(`Removed the end frame. ${modelName} doesn't take one.`)
        fitted = fitted.filter((asset) => asset.slot !== 'end')
    }

    if (!fitted.some((asset) => asset.slot === 'start')) {
        const first = fitted.find((asset) => asset.slot === 'reference')

        if (first !== undefined && fitted.length > capabilities.maxReferences) {
            const promoted = [...fitted]
            promoted[promoted.indexOf(first)] = { ...first, slot: 'start' }
            fitted = promoted
            notices.push('The first image became the start frame.')
        }
    }

    return fitted
}

/** One asset per frame slot, then the model's own cap on references. */
function capped(
    assets: readonly ComposerAsset[],
    capabilities: AssetCapabilities,
    modelName: string,
    notices: string[],
): readonly ComposerAsset[] {
    const kept: ComposerAsset[] = []
    let references = 0

    for (const asset of assets) {
        if (asset.slot !== 'reference') {
            if (!kept.some((taken) => taken.slot === asset.slot)) {
                kept.push(asset)
            }
        } else if (references < capabilities.maxReferences) {
            kept.push(asset)
            references += 1
        }
    }

    const overflow = assets.filter((asset) => asset.slot === 'reference').length - references

    if (overflow > 0) {
        notices.push(
            capabilities.maxReferences === 0
                ? `Removed ${overflow} ${plural(overflow)}. ${modelName} doesn't take reference images.`
                : `Removed ${overflow} ${plural(overflow)}. ${modelName} takes ${capabilities.maxReferences}.`,
        )
    }

    return kept
}

/**
 * Forces an attached set to be valid for a model — the asset counterpart of
 * `reconcileToModel`. Frames on an image model become plain references, a
 * reference on a video model becomes the start frame sooner than being lost,
 * and whatever the model cannot take is dropped and said out loud.
 */
export function fitAssets(
    assets: readonly ComposerAsset[],
    capabilities: AssetCapabilities,
    modelName: string,
): AssetFit {
    const notices: string[] = []

    // A model that takes nothing reports that as its limit, not as a type
    // mismatch — hence no type filtering when the accept list is empty.
    const supported =
        capabilities.types.length === 0
            ? assets
            : assets.filter((asset) => capabilities.types.includes(asset.file.type))

    if (supported.length < assets.length) {
        const gone = assets.length - supported.length
        notices.push(`Removed ${gone} ${plural(gone)} ${modelName} doesn't take.`)
    }

    const fitted = reslotted(supported, capabilities, modelName, notices)
    const kept = capped(fitted, capabilities, modelName, notices)

    // Same members in the same order means nothing actually changed; handing
    // back the original array lets callers skip a no-op commit.
    const unchanged =
        kept.length === assets.length && kept.every((asset, index) => asset === assets[index])

    return {
        kept: unchanged ? assets : kept,
        notice: notices.length === 0 ? null : notices.join(' '),
    }
}

/**
 * Where files land when they arrive without naming a slot — pasted from the
 * clipboard or dropped onto the page. References when the model takes them,
 * else the start frame; null means the model takes no files at all, and the
 * paste and drop listeners stay off entirely.
 */
export function intakeSlot(capabilities: AssetCapabilities): AssetSlot | null {
    if (capabilities.maxReferences > 0) {
        return 'reference'
    }

    return capabilities.frames ? 'start' : null
}

function toAsset(file: File, slot: AssetSlot): ComposerAsset {
    return {
        id: crypto.randomUUID(),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        file,
        slot,
    }
}

export interface Placement {
    readonly next: readonly ComposerAsset[] | null
    readonly notice: string | null
}

/** Where newly picked files land: a frame slot replaces, references append. */
export function placed(
    current: readonly ComposerAsset[],
    accepted: readonly File[],
    slot: AssetSlot,
    capabilities: AssetCapabilities,
    modelName: string,
): Placement {
    if (slot === 'reference') {
        const used = current.filter((asset) => asset.slot === 'reference').length
        const room = Math.max(0, capabilities.maxReferences - used)
        const taken = accepted.slice(0, room)
        const notice =
            taken.length < accepted.length
                ? `Kept ${taken.length} of ${accepted.length}. ${modelName} takes ${capabilities.maxReferences}.`
                : null

        return {
            next:
                taken.length === 0
                    ? null
                    : [...current, ...taken.map((file) => toAsset(file, 'reference'))],
            notice,
        }
    }

    const file = accepted[0]

    return {
        next:
            file === undefined
                ? null
                : [...current.filter((asset) => asset.slot !== slot), toAsset(file, slot)],
        notice: null,
    }
}
