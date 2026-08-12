import { motion, type Transition } from 'motion/react'
import { type FormEvent, type KeyboardEvent, useCallback, useState } from 'react'

import type { GenerationMode } from './catalog'
import { ComposerToolbar } from './composer-toolbar'
import { PromptField } from './prompt-field'
import { PROMPT_SUGGESTIONS } from './prompt-suggestions'
import { ReferenceImagePicker } from './reference-image-picker'
import { ReferenceImageStrip } from './reference-image-strip'
import { useComposerSettings } from './settings/use-composer-settings'
import { useReferenceImages } from './use-reference-images'

/** Shared with the toolbar's own reflow, so the whole panel moves as one. */
const PANEL_MOTION: Transition = { type: 'spring', stiffness: 620, damping: 42, mass: 0.7 }

function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Generation arrives together with the provider integrations; until then
    // submitting the composer is deliberately a no-op.
    event.preventDefault()
}

function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        event.currentTarget.form?.requestSubmit()
    }
}

/**
 * The prompt bar at the heart of the create page: what to make, with which
 * model, in which shape, and what that will cost.
 */
export function PromptComposer() {
    const [prompt, setPrompt] = useState('')
    const [mode, setMode] = useState<GenerationMode>('image')

    const composer = useComposerSettings(mode)
    const references = useReferenceImages()

    const handlePromptChange = useCallback((value: string) => {
        setPrompt(value)
    }, [])

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
            {references.images.length === 0 ? null : (
                <ReferenceImageStrip images={references.images} onRemove={references.remove} />
            )}

            {/* `items-start` keeps the `+` level with the first line of the
                prompt rather than drifting down as the field grows. */}
            <div className="flex items-start gap-1 pb-1.5">
                <ReferenceImagePicker onSelect={references.add} />
                <PromptField
                    onChange={handlePromptChange}
                    onKeyDown={submitOnEnter}
                    suggestions={PROMPT_SUGGESTIONS[mode]}
                    value={prompt}
                />
            </div>

            <ComposerToolbar
                canSubmit={prompt.trim() !== ''}
                composer={composer}
                mode={mode}
                onModeChange={setMode}
            />
        </motion.form>
    )
}
