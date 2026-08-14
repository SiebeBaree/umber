import { AnimatePresence, motion, type Transition } from 'motion/react'
import { useEffect, useRef } from 'react'

import { cn } from '../../lib/cn'
import { scrollParentOf } from '../../lib/scroll-parent'
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
 * composer at the bottom and the stage above carries the runs — oldest at the
 * top, the newest right above the composer, each with its own skeletons and
 * results. Sending again never waits on what is already rendering.
 */

/**
 * Brings a new run into view by scrolling the page to its very bottom, rather
 * than to the bottom of the run itself: the composer is docked over the last
 * stretch of the page, so stopping where the run ends leaves it sitting behind
 * the panel and the last inch to scroll left to whoever is watching.
 *
 * The scroll is repeated once the docking spring has settled, because the
 * first run of a session changes the page's height while it animates and the
 * bottom it was heading for moves out from under it.
 */
function useFollowNewest(newestId: string | undefined) {
    const stackRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (newestId === undefined) {
            return
        }

        const scroller = scrollParentOf(stackRef.current)

        const toBottom = () => {
            scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
        }

        toBottom()

        // ...unless the page is deliberately scrolled in the meantime, in
        // which case following the run would be taking the page back off
        // whoever is reading it.
        const settled = setTimeout(toBottom, 500)

        const cancel = () => {
            clearTimeout(settled)
        }

        scroller?.addEventListener('wheel', cancel, { once: true, passive: true })
        scroller?.addEventListener('touchmove', cancel, { once: true, passive: true })

        return () => {
            cancel()
            scroller?.removeEventListener('wheel', cancel)
            scroller?.removeEventListener('touchmove', cancel)
        }
    }, [newestId])

    return stackRef
}

/**
 * The runs, in the order they were asked for, with the newest scrolled to.
 * A finished run stays where it is: it is not the point of attention any more,
 * and moving it would pull the eye off whatever just started.
 */
function RunStack({ jobs }: { readonly jobs: readonly GenerationJob[] }) {
    const stackRef = useFollowNewest(jobs.at(-1)?.id)

    return (
        <div className="flex w-full flex-col items-center gap-12" ref={stackRef}>
            {jobs.map((job) => (
                <motion.div
                    animate={FADE_SETTLED}
                    className="flex w-full justify-center"
                    initial={FADE_ENTER}
                    key={job.id}
                    transition={FADE_TRANSITION}
                >
                    <GenerationView job={job} />
                </motion.div>
            ))}
        </div>
    )
}

/**
 * The area above the composer.
 *
 * Idle, the title sits at the *bottom* of it so it hugs the composer one gap
 * below — centring it here instead would strand it halfway up the empty half.
 * The matching spacer under the composer is what centres the pair as a group.
 *
 * No min-h-0: when the runs outgrow a short window, the stage must keep its
 * natural height so the page scrolls rather than the grids painting over the
 * composer.
 */
function Stage({ jobs }: { readonly jobs: readonly GenerationJob[] }) {
    const idle = jobs.length === 0

    return (
        <div
            className={cn(
                'flex flex-1 flex-col items-center',
                idle ? 'justify-end pb-8' : 'justify-center py-6',
            )}
        >
            <AnimatePresence mode="wait">
                {idle ? (
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
                    // No exit: clearing the stage takes the runs in the same
                    // frame, so the page collapses once and the composer makes
                    // the trip to the centre as a single motion. Fading them
                    // out first would hold the page at full height while the
                    // composer waited on it.
                    <motion.div
                        animate={FADE_SETTLED}
                        className="flex w-full flex-1 items-center justify-center"
                        initial={FADE_ENTER}
                        key="stage"
                        transition={FADE_TRANSITION}
                    >
                        <RunStack jobs={jobs} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function CreatePage() {
    const { jobs } = useGeneration()
    const idle = jobs.length === 0

    return (
        // 63rem, not the 4xl this used to be: the composer's controls belong on
        // one row, and the widest row the catalog can produce — GPT Image 1
        // Mini, whose models add a quality picker — needs 924px, plus the 48px
        // this container spends on its own padding. Narrower and the toolbar
        // wraps onto a second line; much wider and the prompt starts to sprawl.
        <div className="mx-auto flex w-full max-w-[63rem] flex-1 flex-col px-6">
            <Stage jobs={jobs} />

            {/* The composer itself. Idle it is centred, and `layout` glides it
                down to the dock as the spacer below goes away; once runs are on
                the stage it stays stuck to the bottom of the window, so a page
                full of results never scrolls the prompt out of reach.

                It is `sticky` in both states, not only while docked: idle there
                is nothing to scroll and sticky changes nothing, whereas taking
                it off mid-transition drops the panel to its place at the foot
                of a page that is still full height — which is a teleport, not
                a glide.

                Docked, the strip of window below the panel is frosted: results
                pass *under* the composer as the page scrolls, and without it a
                picture would show through that gap in full focus, sharper than
                the glass above it. Blur only, faded in by a mask — a tinted
                strip reads as a band of colour sitting on the page, which is
                exactly what this is meant not to be. */}
            <motion.div
                className={cn(
                    // `sticky` is itself a positioned box, so the frosted strip
                    // below anchors to it without a `relative` of its own.
                    'sticky bottom-0 z-10 w-full pb-6',
                    idle ||
                        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-6 after:backdrop-blur-md after:content-[''] after:[mask-image:linear-gradient(to_top,black,transparent)]",
                )}
                layout
                transition={DOCK_MOTION}
            >
                <PromptComposer />
            </motion.div>

            {/* Idle only: balances the title area so the group sits centred. */}
            {idle ? <div aria-hidden className="flex-1 pb-16" /> : null}
        </div>
    )
}
