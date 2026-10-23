import { estimateCost, formatCost } from '../create/pricing'
import { TEMPLATE_MODEL, templateSettings } from './template-model'
import { showsPrompt } from './template-set'
import type { TemplatesApi } from './templates-context'

/**
 * What the Templates bar's button does right now, and what that would cost.
 * Planning is free and needs no key, so the button only asks for Google or for
 * photos once there is something to render.
 */

export interface PrimaryAction {
    readonly label: string
    readonly run: () => void
    readonly disabled?: boolean
}

export function photosLabel(count: number): string {
    return count === 1 ? '1 photo' : `${count} photos`
}

/** How many photos the next press would render, or plan when there is no set. */
function nextBatch(templates: TemplatesApi): number {
    return templates.set === null
        ? templates.count
        : templates.set.shots.filter((shot) => showsPrompt(shot)).length
}

/**
 * In the order a first-timer runs into each need. `googleConnected` is null
 * until the vault has answered, and nothing is called blocked before then.
 */
export function primaryAction(
    templates: TemplatesApi,
    googleConnected: boolean | null,
    { connect, addPhotos }: { readonly connect: () => void; readonly addPhotos: () => void },
): PrimaryAction {
    const batch = nextBatch(templates)

    if (templates.set === null) {
        return { label: `Plan ${photosLabel(batch)}`, run: templates.plan }
    }

    if (batch === 0) {
        return { label: 'New set', run: templates.plan, disabled: templates.busy }
    }

    if (googleConnected === false) {
        return { label: 'Connect Google to make these', run: connect }
    }

    if (templates.you.ready && templates.you.photos.length === 0) {
        return { label: 'Add your photos', run: addPhotos }
    }

    return {
        label: `Make ${photosLabel(batch)}`,
        run: templates.make,
        disabled: googleConnected === null || !templates.you.ready,
    }
}

/** The estimate beside the button, or null when it has nothing left to make. */
export function batchPrice(templates: TemplatesApi): string | null {
    const batch = nextBatch(templates)

    if (batch === 0) {
        return null
    }

    return formatCost(
        estimateCost(
            TEMPLATE_MODEL,
            templateSettings(templates.platform, batch),
            templates.you.photos.length,
        ),
    )
}
