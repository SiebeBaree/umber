import { motion, type Transition } from 'motion/react'

import { cn } from '../../lib/cn'
import { SetView } from './set-view'
import { TemplateBar } from './template-bar'
import { useTemplates } from './templates-context'

/**
 * The Templates page, laid out like Create: idle, a question and the bar at
 * centre; once a set is planned, its cards fill the stage and the bar docks
 * at the bottom. Each card is the prompt for one photo, editable until it
 * renders, and turns into that photo in place.
 */

/** The same spring Create docks its composer on. */
const DOCK_MOTION: Transition = { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }

export function TemplatesPage() {
    const { set } = useTemplates()
    const idle = set === null

    return (
        <div className="mx-auto flex w-full max-w-[63rem] flex-1 flex-col px-6">
            <div className={cn('flex flex-1 flex-col', idle ? 'justify-end pb-8' : 'pt-2 pb-6')}>
                {idle ? (
                    <h1 className="px-4 text-center text-4xl font-semibold tracking-tight text-balance">
                        Which profile needs new photos?
                    </h1>
                ) : (
                    <SetView set={set} />
                )}
            </div>

            {/* Docked like Create's composer, with the same frosted strip
                below it so photos passing under it don't show through sharp. */}
            <motion.div
                className={cn(
                    'sticky bottom-0 z-10 w-full pb-6',
                    idle ||
                        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-6 after:backdrop-blur-md after:content-[''] after:[mask-image:linear-gradient(to_top,black,transparent)]",
                )}
                layout
                transition={DOCK_MOTION}
            >
                <TemplateBar />
            </motion.div>

            {idle ? <div aria-hidden className="flex-1 pb-16" /> : null}
        </div>
    )
}
