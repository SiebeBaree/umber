import { motion, type Transition } from 'motion/react'
import { type FormEvent, type KeyboardEvent, useCallback, useState } from 'react'

import { AssetDropOverlay, useAssetDropzone } from './asset-dropzone'
import { AssetPicker, useAssetFilePicker, type AssetFilePicker } from './asset-picker'
import { AssetStrip } from './asset-strip'
import { ComposerToolbar } from './composer-toolbar'
import { PromptField } from './prompt-field'
import { PROMPT_SUGGESTIONS, type PromptSuggestions } from './prompt-suggestions'
import { useComposerAssets, type AssetSlot, type ComposerAssets } from './use-composer-assets'
import { useComposerSubmission } from './use-composer-submission'

/** Shared with the toolbar's own reflow, so the whole panel moves as one. */
const PANEL_MOTION: Transition = { type: 'spring', stiffness: 620, damping: 42, mass: 0.7 }

/**
 * The prompt bar at the heart of the create page: what to make, with which
 * model, in which shape, and what that will cost. Submitting hands the run to
 * the generation store; everything else here is choosing.
 */
function usePromptText(
    submission: ReturnType<typeof useComposerSubmission>,
    assets: ComposerAssets,
) {
    const [prompt, setPrompt] = useState('')

    const submitNow = useCallback(() => {
        submission.submit(prompt.trim(), assets.assets)
    }, [prompt, assets.assets, submission])

    const handleSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            submitNow()
        },
        [submitNow],
    )

    // Enter sends, Shift+Enter breaks the line. Submitted directly rather than
    // via `form.requestSubmit()`: a script-fired submit event is not reliably
    // redelivered to React's delegated listener in every Chromium build.
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submitNow()
            }
        },
        [submitNow],
    )

    const handlePromptChange = useCallback((value: string) => {
        setPrompt(value)
    }, [])

    return { prompt, handleSubmit, handleKeyDown, handlePromptChange }
}

interface ComposerAttachmentsProps {
    readonly assets: ComposerAssets
    readonly onOpen: (slot: AssetSlot) => void
}

/** What sits above the prompt: the change notice, then the attached files. */
function ComposerAttachments({ assets, onOpen }: ComposerAttachmentsProps) {
    return (
        <>
            {assets.notice === null ? null : (
                <output className="block px-3 pt-1 pb-2 text-[12px] text-muted">
                    {assets.notice}
                </output>
            )}

            {assets.assets.length === 0 ? null : (
                <AssetStrip
                    assets={assets.assets}
                    capabilities={assets.capabilities}
                    onOpen={onOpen}
                    onRemove={assets.remove}
                />
            )}
        </>
    )
}

interface PromptRowProps {
    readonly assets: ComposerAssets
    readonly picker: AssetFilePicker
    readonly modelName: string
    readonly suggestions: PromptSuggestions
    readonly prompt: string
    readonly onChange: (value: string) => void
    readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

/** The line the user types on: the `+`, its hidden input, and the field. */
function PromptRow({
    assets,
    modelName,
    onChange,
    onKeyDown,
    picker,
    prompt,
    suggestions,
}: PromptRowProps) {
    return (
        // `items-start` keeps the `+` level with the first line of the
        // prompt rather than drifting down as the field grows.
        <div className="flex items-start gap-1 pb-1.5">
            <AssetPicker
                assets={assets.assets}
                capabilities={assets.capabilities}
                modelName={modelName}
                onOpen={picker.open}
            />
            {picker.input}
            <PromptField
                onChange={onChange}
                onKeyDown={onKeyDown}
                suggestions={suggestions}
                value={prompt}
            />
        </div>
    )
}

export function PromptComposer() {
    const submission = useComposerSubmission()
    const assets = useComposerAssets(submission.composer.model)
    const picker = useAssetFilePicker(assets.capabilities, assets.add)
    const dropzone = useAssetDropzone(assets.capabilities, assets.add)
    const { handleKeyDown, handlePromptChange, handleSubmit, prompt } = usePromptText(
        submission,
        assets,
    )

    return (
        // The panel is layout-animated on the same spring as the controls
        // inside it. Without that, a prompt spilling onto a second line resized
        // the panel instantly while the toolbar — which animates — caught up a
        // beat later, and the two moving at different speeds read as a stutter.
        <motion.form
            aria-label="Create with AI"
            className="glass w-full rounded-[1.75rem] p-3"
            layout
            onSubmit={handleSubmit}
            transition={PANEL_MOTION}
        >
            <ComposerAttachments assets={assets} onOpen={picker.open} />

            <PromptRow
                assets={assets}
                modelName={submission.composer.model.name}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                picker={picker}
                prompt={prompt}
                suggestions={PROMPT_SUGGESTIONS[submission.mode]}
            />

            <ComposerToolbar
                blocker={submission.blocker}
                canSubmit={prompt.trim() !== ''}
                composer={submission.composer}
                mode={submission.mode}
                onModeChange={submission.setMode}
                references={assets.assets.length}
            />

            <AssetDropOverlay dropzone={dropzone} />
        </motion.form>
    )
}
