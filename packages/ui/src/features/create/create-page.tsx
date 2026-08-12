import { PromptComposer } from './prompt-composer'
import { RotatingTitle } from './rotating-title'

/**
 * The home page: an intentionally empty stage with the composer at centre,
 * so the prompt is the only thing asking for attention.
 */
export function CreatePage() {
    return (
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-24">
            <RotatingTitle />
            <PromptComposer />
        </div>
    )
}
