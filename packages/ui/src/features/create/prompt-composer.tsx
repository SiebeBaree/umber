import { motion, type Transition } from 'motion/react'
import { type FormEvent, type KeyboardEvent, useCallback, useState } from 'react'

import { ComposerToolbar } from './composer-toolbar'
import { PromptField } from './prompt-field'
import { PROMPT_SUGGESTIONS } from './prompt-suggestions'
import { ReferenceImagePicker } from './reference-image-picker'
import { ReferenceImageStrip } from './reference-image-strip'
import { useComposerSubmission } from './use-composer-submission'
import { useReferenceImages } from './use-reference-images'

/** Shared with the toolbar's own reflow, so the whole panel moves as one. */
const PANEL_MOTION: Transition = { type: 'spring', stiffness: 620, damping: 42, mass: 0.7 }

/**
 * The prompt bar at the heart of the create page: what to make, with which
 * model, in which shape, and what that will cost. Submitting hands the run to
 * the generation store; everything else here is choosing.
 */
function usePromptText(submission: ReturnType<typeof useComposerSubmission>) {
    const [prompt, setPrompt] = useState('')
    const references = useReferenceImages()

    const submitNow = useCallback(() => {
        submission.submit(
            prompt.trim(),
            references.images.map((image) => image.file),
        )
    }, [prompt, references.images, submission])

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

    return { prompt, references, handleSubmit, handleKeyDown, handlePromptChange }
}

export function PromptComposer() {
    const submission = useComposerSubmission()
    const { handleKeyDown, handlePromptChange, handleSubmit, prompt, references } =
        usePromptText(submission)

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
                    onKeyDown={handleKeyDown}
                    suggestions={PROMPT_SUGGESTIONS[submission.mode]}
                    value={prompt}
                />
            </div>

            <ComposerToolbar
                blocker={submission.blocker}
                busy={submission.busy}
                canSubmit={prompt.trim() !== ''}
                composer={submission.composer}
                mode={submission.mode}
                onModeChange={submission.setMode}
            />
        </motion.form>
    )
}
