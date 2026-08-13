import { AnimatePresence, motion, type Transition } from 'motion/react'

import { cn } from '../../lib/cn'
import { useGeneration, type GenerationJob } from '../generate/generation-context'
import { GenerationView } from './generation-view'
import { PromptComposer } from './prompt-composer'
import { RotatingTitle } from './rotating-title'

/** The same spring the composer panel uses, so the dock reads as one motion. */
const DOCK_MOTION: Transition = { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }

const FADE_ENTER = { opacity: 0, scale: 0.985 }
const FADE_SETTLED = { opacity: 1, scale: 1 }
const FADE_EXIT = { opacity: 0, scale: 0.985 }

const FADE_TRANSITION: Transition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] }

/**
 * The home page. Idle, it is an empty stage: title and composer at centre,
 * the prompt the only thing asking for attention. The first send docks the
 * composer at the bottom and the stage above carries the run — skeletons,
 * then the images, until the run is dismissed or replaced.
 */
/**
 * The area above the composer.
 *
 * Idle, the title sits at the *bottom* of it so it hugs the composer one gap
 * below — centring it here instead would strand it halfway up the empty half.
 * The matching spacer under the composer is what centres the pair as a group.
 *
 * No min-h-0: when the grid outgrows a short window, the stage must keep its
 * natural height so the page scrolls rather than the grid painting over the
 * composer.
 */
function Stage({ job }: { readonly job: GenerationJob | null }) {
    return (
        <div
            className={cn(
                'flex flex-1 flex-col items-center',
                job === null ? 'justify-end pb-8' : 'justify-center py-6',
            )}
        >
            <AnimatePresence mode="wait">
                {job === null ? (
                    <motion.div
                        animate={FADE_SETTLED}
                        className="w-full"
                        exit={FADE_EXIT}
                        initial={false}
                        key="title"
                        transition={FADE_TRANSITION}
                    >
                        <RotatingTitle />
                    </motion.div>
                ) : (
                    <motion.div
                        animate={FADE_SETTLED}
                        className="flex w-full flex-1 items-center justify-center"
                        exit={FADE_EXIT}
                        initial={FADE_ENTER}
                        key="stage"
                        transition={FADE_TRANSITION}
                    >
                        <GenerationView job={job} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function CreatePage() {
    const generation = useGeneration()
    const job = generation.activeJob

    return (
        // 63rem, not the 4xl this used to be: the composer's controls belong on
        // one row, and the widest row the catalog can produce — GPT Image 1
        // Mini, whose models add a quality picker — needs 924px, plus the 48px
        // this container spends on its own padding. Narrower and the toolbar
        // wraps onto a second line; much wider and the prompt starts to sprawl.
        <div className="mx-auto flex w-full max-w-[63rem] flex-1 flex-col px-6">
            <Stage job={job} />

            {/* The composer itself; `layout` glides it between centre stage and
                the dock as the spacer below comes and goes. */}
            <motion.div className="w-full pb-6" layout transition={DOCK_MOTION}>
                <PromptComposer />
            </motion.div>

            {/* Idle only: balances the title area so the group sits centred. */}
            {job === null ? <div aria-hidden className="flex-1 pb-16" /> : null}
        </div>
    )
}
