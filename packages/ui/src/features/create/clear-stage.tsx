import { useRouterState } from '@tanstack/react-router'
import { Eraser } from 'lucide-react'
import { motion } from 'motion/react'

import { Tooltip } from '../../components/ui/tooltip'
import { cn } from '../../lib/cn'
import { useShortcut, type Shortcut } from '../../lib/use-shortcut'
import { useGeneration } from '../generate/generation-context'

/**
 * Clearing the stage: a key, and one round control in the header beside
 * Settings.
 *
 * It sits up there rather than over the runs because the stage is the pictures
 * — putting a button on top of them is the one place in this app that cannot
 * afford furniture. In the header it borrows a shape that is already on
 * screen, and it appears only while there is something to clear.
 *
 * Only finished runs go; anything still working keeps its place, since its
 * skeletons are the only sign that it is happening.
 */

/** ⌘⌫ is the gallery's delete, so this takes the shifted form. It fires
 * mid-prompt: the hands are in the composer when the stage behind it fills up. */
const CLEAR_STAGE: Shortcut = { key: 'Backspace', meta: true, shift: true, whileTyping: true }

/** The settings link's shape, so the two read as one row of controls. */
const BUTTON_CLASSES = cn(
    'no-drag glass-control flex size-10 cursor-pointer items-center justify-center rounded-full text-muted outline-none select-none',
    'hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
)

const APPEAR = { opacity: 0, scale: 0.9 }
const SETTLED = { opacity: 1, scale: 1 }

export function ClearStageButton() {
    const { clearFinished, jobs, running } = useGeneration()
    const onCreatePage = useRouterState({ select: (state) => state.location.pathname === '/' })

    // The gallery has its own delete, and a run still rendering is not clutter.
    const available = onCreatePage && jobs.length > running

    useShortcut(CLEAR_STAGE, clearFinished, available)

    if (!available) {
        return null
    }

    return (
        <Tooltip label="Clear finished runs off the stage. They stay in the gallery.">
            <motion.button
                animate={SETTLED}
                aria-label="Clear the stage"
                className={BUTTON_CLASSES}
                initial={APPEAR}
                onClick={clearFinished}
                type="button"
            >
                <Eraser aria-hidden className="size-[18px]" />
            </motion.button>
        </Tooltip>
    )
}
