import { Download, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { useCallback, type MouseEvent } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'

/** The composer dock's spring, so the two docks move like one material. */
const DOCK_SPRING: Transition = { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 }

/** For anyone who asked for less motion: there, then not. */
const INSTANT: Transition = { duration: 0 }

const OFFSTAGE = { y: 20, opacity: 0, scale: 0.95 }
const ON_STAGE = { y: 0, opacity: 1, scale: 1 }

export interface SelectionDockProps {
    /** How many creations are selected; the dock leaves the stage at zero. */
    readonly count: number
    readonly onClear: () => void
    /** `immediate` carries Shift, the gesture that skips the confirmation. */
    readonly onDelete: (immediate: boolean) => void
    readonly onDownload: () => void
}

/** The bar itself: the count, the two verbs, and the way out. */
function DockBar({ count, onClear, onDelete, onDownload }: SelectionDockProps) {
    const remove = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            onDelete(event.shiftKey)
        },
        [onDelete],
    )

    return (
        <div
            className="overlay-surface glass-raised flex items-center gap-1 rounded-full py-1.5 ps-4 pe-1.5"
            data-no-marquee
        >
            <span
                aria-live="polite"
                className="text-[13px] font-medium whitespace-nowrap tabular-nums"
            >
                {count} selected
            </span>

            <span aria-hidden className="mx-2.5 h-4 w-px bg-ink/15" />

            <Button onClick={onDownload} size="sm" variant="ghost">
                <Download aria-hidden />
                Download
            </Button>

            {/* Red only under the pointer, like the tile's own delete:
                dangerous on approach, quiet at rest. */}
            <Button className="hover:text-rose-600" onClick={remove} size="sm" variant="ghost">
                <Trash2 aria-hidden />
                Delete
            </Button>

            <span aria-hidden className="mx-1 h-4 w-px bg-ink/15" />

            <Tooltip label="Clear selection">
                <Button
                    aria-label="Clear selection"
                    onClick={onClear}
                    size="icon-sm"
                    variant="ghost"
                >
                    <X aria-hidden />
                </Button>
            </Tooltip>
        </div>
    )
}

/**
 * The floating bar that appears once anything is selected: the count, and what
 * can be done with it. Fixed to the bottom of the window rather than the page,
 * so it stays in reach however far the wall has scrolled.
 *
 * z-40 floats it over the page but under the dialog layer at z-50 — the delete
 * confirmation opens on top of it. The exiting dock keeps its last-rendered
 * content, which is how the count never flashes to zero on the way out.
 */
export function SelectionDock(props: SelectionDockProps) {
    const reducedMotion = useReducedMotion() === true

    return (
        <AnimatePresence>
            {props.count > 0 ? (
                <motion.div
                    animate={ON_STAGE}
                    className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
                    exit={OFFSTAGE}
                    initial={reducedMotion ? false : OFFSTAGE}
                    key="selection-dock"
                    transition={reducedMotion ? INSTANT : DOCK_SPRING}
                >
                    <DockBar {...props} />
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}
