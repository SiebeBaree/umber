import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fitAssets, placed, plural, type AssetSlot, type ComposerAsset } from './asset-fit'
import { assetCapabilitiesOf, type AssetCapabilities, type Model } from './catalog'

/**
 * The files attached to the current prompt, each in a slot: plain reference
 * images, and for video models the start and end frames. The slots are what
 * the provider integrations key on, so what a tile is labelled here is exactly
 * what the API will be told it is. The fitting rules live in `asset-fit`.
 */

export { fitAssets, type AssetFit, type AssetSlot, type ComposerAsset } from './asset-fit'

export interface ComposerAssets {
    readonly assets: readonly ComposerAsset[]
    readonly capabilities: AssetCapabilities
    /** One short line about what the last change did to the set, if anything. */
    readonly notice: string | null
    readonly add: (files: FileList, slot: AssetSlot) => void
    readonly remove: (id: string) => void
}

/** How long a notice stays before clearing itself, in milliseconds. */
const NOTICE_MS = 6000

/** A notice is a moment, not a state; it clears itself. */
function useNotice() {
    const [notice, setNotice] = useState<string | null>(null)

    useEffect(() => {
        if (notice === null) {
            return
        }

        const timer = setTimeout(() => {
            setNotice(null)
        }, NOTICE_MS)

        return () => {
            clearTimeout(timer)
        }
    }, [notice])

    return { notice, setNotice }
}

/**
 * The attached list and the one door into changing it. `commit` keeps a ref in
 * step with the state — so `add` and the model refit can read the current list
 * synchronously — and revokes the object URLs of whatever just left the set.
 */
function useAssetList() {
    const [assets, setAssets] = useState<readonly ComposerAsset[]>([])
    const assetsRef = useRef<readonly ComposerAsset[]>(assets)

    const commit = useCallback((next: readonly ComposerAsset[]) => {
        for (const asset of assetsRef.current) {
            if (!next.some((kept) => kept.id === asset.id)) {
                URL.revokeObjectURL(asset.previewUrl)
            }
        }

        assetsRef.current = next
        setAssets(next)
    }, [])

    useEffect(
        () => () => {
            for (const asset of assetsRef.current) {
                URL.revokeObjectURL(asset.previewUrl)
            }
        },
        [],
    )

    return { assets, assetsRef, commit }
}

type AssetList = ReturnType<typeof useAssetList>

/**
 * Switching models refits what is already attached, telling the user about
 * anything the new model made us let go of. Catalog entries are singletons,
 * so `model` only changes identity on a real switch.
 */
function useModelRefit(model: Model, list: AssetList, setNotice: (notice: string) => void) {
    const { assetsRef, commit } = list

    useEffect(() => {
        const fit = fitAssets(assetsRef.current, assetCapabilitiesOf(model), model.name)

        if (fit.kept !== assetsRef.current) {
            commit(fit.kept)
        }

        if (fit.notice !== null) {
            setNotice(fit.notice)
        }
    }, [model, assetsRef, commit, setNotice])
}

export function useComposerAssets(model: Model): ComposerAssets {
    const capabilities = useMemo(() => assetCapabilitiesOf(model), [model])
    const { notice, setNotice } = useNotice()
    const list = useAssetList()
    const { assets, assetsRef, commit } = list

    useModelRefit(model, list, setNotice)

    const add = useCallback(
        (files: FileList, slot: AssetSlot) => {
            const picked = [...files]
            const accepted = picked.filter((file) => capabilities.types.includes(file.type))
            const notices: string[] = []

            if (accepted.length < picked.length) {
                const gone = picked.length - accepted.length
                notices.push(`Skipped ${gone} ${plural(gone)} ${model.name} doesn't take.`)
            }

            const placement = placed(assetsRef.current, accepted, slot, capabilities, model.name)

            if (placement.next !== null) {
                commit(placement.next)
            }

            if (placement.notice !== null) {
                notices.push(placement.notice)
            }

            if (notices.length > 0) {
                setNotice(notices.join(' '))
            }
        },
        [assetsRef, capabilities, commit, model.name, setNotice],
    )

    const remove = useCallback(
        (id: string) => {
            commit(assetsRef.current.filter((asset) => asset.id !== id))
        },
        [assetsRef, commit],
    )

    return { assets, capabilities, notice, add, remove }
}
