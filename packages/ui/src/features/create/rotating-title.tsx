import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'

import { useProfile } from '../profile/profile-context'

/** How long each line holds before the next one takes its place. */
const HOLD = 4600

const TRANSITION: Transition = { duration: 0.82, ease: [0.22, 1, 0.36, 1] }

/**
 * The incoming line waits this long before it starts. Just enough for the
 * outgoing one to commit to leaving, so the two read as a hand-off rather than
 * as two lines moving in lockstep.
 */
const ENTER_TRANSITION: Transition = { ...TRANSITION, delay: 0.125 }

/*
 * The outgoing line rises and the incoming one follows it up from below, both
 * blurring as they travel.
 *
 * Nothing clips them. An earlier version put the pair inside an
 * `overflow-hidden` box, which sliced the glyphs — and the blur that is
 * supposed to soften the exit — against a hard horizontal edge. Travelling a
 * short distance and letting opacity do the hiding means there is no edge to
 * cut against, so the swap stays clean at any font size.
 */
const TRAVEL = 34

const ENTER = { y: TRAVEL, opacity: 0, filter: 'blur(10px)' }
const CENTRE = { y: 0, opacity: 1, filter: 'blur(0px)', transition: ENTER_TRANSITION }
const EXIT = { y: -TRAVEL, opacity: 0, filter: 'blur(10px)', transition: TRANSITION }

/**
 * The greeting at the top of the create page, cycling between two lines.
 *
 * The wrapper is a fixed height so the page never reflows as lines swap, and
 * `popLayout` takes the outgoing line out of flow so both move at once.
 */
export function RotatingTitle() {
    const reducedMotion = useReducedMotion()
    const profile = useProfile()
    const [index, setIndex] = useState(0)

    // The greeting needs the onboarding name; while it is briefly absent —
    // the create page renders under the flow itself — the question stands alone.
    const titles = useMemo(
        () =>
            profile.name === null
                ? ['What will you create today?']
                : [`Welcome back, ${profile.name}`, 'What will you create today?'],
        [profile.name],
    )

    useEffect(() => {
        if (reducedMotion || titles.length < 2) {
            return
        }

        const timer = setInterval(() => {
            setIndex((current) => (current + 1) % titles.length)
        }, HOLD)

        return () => {
            clearInterval(timer)
        }
    }, [reducedMotion, titles.length])

    return (
        <div className="relative flex h-16 w-full items-center justify-center">
            <AnimatePresence initial={false} mode="popLayout">
                <motion.h1
                    animate={CENTRE}
                    className="px-4 text-center text-4xl font-semibold tracking-tight text-balance"
                    exit={EXIT}
                    initial={ENTER}
                    key={index % titles.length}
                >
                    {titles[index % titles.length]}
                </motion.h1>
            </AnimatePresence>
        </div>
    )
}
