import { ArrowUp, Clapperboard, Image } from 'lucide-react'
import { motion, type Transition } from 'motion/react'
import { useCallback } from 'react'

import { Button } from '../../components/ui/button'
import {
    SegmentedControl,
    type SegmentedControlOption,
} from '../../components/ui/segmented-control'
import { Tooltip } from '../../components/ui/tooltip'
import { GENERATION_MODES, isImageModel, type AspectRatio, type GenerationMode } from './catalog'
import {
    AspectRatioSelect,
    DurationSelect,
    ModelSelect,
    OutputCountStepper,
    ResolutionSelect,
} from './controls'
import { estimateCost, formatCost } from './pricing'
import type { ComposerSettingsApi } from './settings/use-composer-settings'

/**
 * Every control sits in a layout-animated box, so when one changes width — a
 * longer model name, `4s` becoming `12s`, the stepper replacing the duration
 * picker — the rest of the row slides over instead of snapping.
 */
const REFLOW: Transition = { type: 'spring', stiffness: 620, damping: 42, mass: 0.7 }

const MODE_OPTIONS: readonly SegmentedControlOption<GenerationMode>[] = [
    { value: GENERATION_MODES[0], label: 'Image', icon: Image },
    { value: GENERATION_MODES[1], label: 'Video', icon: Clapperboard },
]

interface SettingsControlsProps {
    readonly composer: ComposerSettingsApi
    readonly mode: GenerationMode
}

/**
 * The model and its output settings. Which controls exist follows the model:
 * an image model gets a count stepper, a video model a clip-length slider.
 */
function OutputControl({ composer }: { readonly composer: ComposerSettingsApi }) {
    const { model, settings } = composer

    const setOutputCount = useCallback(
        (outputCount: number) => composer.update({ outputCount }),
        [composer],
    )
    const setDuration = useCallback(
        (durationSeconds: number) => composer.update({ durationSeconds }),
        [composer],
    )

    return isImageModel(model) ? (
        <OutputCountStepper
            max={model.maxOutputs}
            onValueChange={setOutputCount}
            value={settings.outputCount}
        />
    ) : (
        <DurationSelect
            modelName={model.name}
            onValueChange={setDuration}
            rule={model.durations}
            value={settings.durationSeconds}
        />
    )
}

function SettingsControls({ composer, mode }: SettingsControlsProps) {
    const { model, settings } = composer

    const setAspectRatio = useCallback(
        (aspectRatio: string) => composer.update({ aspectRatio }),
        [composer],
    )
    const setResolution = useCallback(
        (resolution: string) => composer.update({ resolution }),
        [composer],
    )

    return (
        <>
            <motion.div layout transition={REFLOW}>
                <ModelSelect
                    mode={mode}
                    model={model}
                    onSelect={composer.selectModel}
                    onToggleStar={composer.toggleStar}
                    starred={composer.starred}
                />
            </motion.div>

            <motion.div layout transition={REFLOW}>
                <AspectRatioSelect
                    modelName={model.name}
                    onValueChange={setAspectRatio}
                    options={model.aspectRatios}
                    value={settings.aspectRatio as AspectRatio}
                />
            </motion.div>

            <motion.div layout transition={REFLOW}>
                <ResolutionSelect
                    modelName={model.name}
                    onValueChange={setResolution}
                    options={model.resolutions}
                    value={settings.resolution}
                />
            </motion.div>

            <motion.div layout transition={REFLOW}>
                <OutputControl composer={composer} />
            </motion.div>
        </>
    )
}

export interface ComposerToolbarProps {
    readonly mode: GenerationMode
    readonly onModeChange: (mode: GenerationMode) => void
    readonly composer: ComposerSettingsApi
    readonly canSubmit: boolean
}

export function ComposerToolbar({ canSubmit, composer, mode, onModeChange }: ComposerToolbarProps) {
    const price = formatCost(estimateCost(composer.model, composer.settings))

    return (
        <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-wrap items-center gap-2">
                <motion.div layout transition={REFLOW}>
                    <SegmentedControl
                        aria-label="What to generate"
                        onValueChange={onModeChange}
                        options={MODE_OPTIONS}
                        value={mode}
                    />
                </motion.div>

                <SettingsControls composer={composer} mode={mode} />
            </div>

            {/*
             * The estimate sits beside the button rather than inside it: it is
             * information, not an action, and stacking it under the arrow forced
             * the primary control out of line with every other pill in the row.
             *
             * Deliberately *not* layout-animated. It is pinned to the end of a
             * row whose other side is `flex-1`, so it never actually needs to
             * move — and measuring it anyway made it drift a pixel or two every
             * time a control to its left changed width.
             */}
            <div className="flex items-center gap-2.5">
                <Tooltip label="Estimated cost of this run. Actual billing comes from your provider.">
                    <span
                        aria-hidden
                        className="cursor-default text-[13px] font-medium text-muted tabular-nums"
                    >
                        {price}
                    </span>
                </Tooltip>

                <Button
                    aria-label={`Generate — estimated ${price}`}
                    disabled={!canSubmit}
                    size="icon"
                    type="submit"
                >
                    <ArrowUp aria-hidden />
                </Button>
            </div>
        </div>
    )
}
