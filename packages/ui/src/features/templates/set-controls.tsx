import { useMemo } from 'react'

import {
    SegmentedControl,
    type SegmentedControlOption,
} from '../../components/ui/segmented-control'
import { OutputCountStepper } from '../create/controls'
import { MAX_SET_SIZE, PLATFORMS, RECIPES, type Platform } from './platforms'
import { untouched } from './template-set'
import { useTemplates } from './templates-context'

/**
 * Which profile and how many photos. The platform locks while a set renders,
 * since switching plans a new set; the count can't drop below the cards that
 * have been edited, made or sent off.
 */

const PLATFORM_OPTIONS: readonly SegmentedControlOption<Platform>[] = PLATFORMS.map((id) => ({
    value: id,
    label: RECIPES[id].name,
}))

export function SetControls() {
    const templates = useTemplates()

    // Edited, rendered and rendering cards stay, so the set can't shrink past them.
    const minCount = useMemo(
        () => Math.max(1, templates.set?.shots.filter((shot) => !untouched(shot)).length ?? 1),
        [templates.set],
    )

    return (
        <>
            <SegmentedControl
                aria-label="Which profile"
                disabled={templates.busy}
                onValueChange={templates.choosePlatform}
                options={PLATFORM_OPTIONS}
                value={templates.platform}
            />
            <OutputCountStepper
                max={MAX_SET_SIZE}
                min={minCount}
                noun="photo"
                onValueChange={templates.resize}
                tooltip="How many photos in this set"
                value={templates.count}
            />
        </>
    )
}
