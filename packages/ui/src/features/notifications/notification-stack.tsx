import { X } from 'lucide-react'
import {
    AnimatePresence,
    motion,
    useReducedMotion,
    type PanInfo,
    type Transition,
} from 'motion/react'
import { useCallback } from 'react'

import { useNotifications, type AppNotification } from './notifications-context'

/**
 * The notices, stacked under the settings button in the top corner.
 *
 * They sit over the page rather than in it: a failed run is news about
 * something that is no longer on screen, and giving it a place in the layout
 * would mean the stage rearranging itself around bad news. Nothing here goes
 * away on its own — the card is dismissed by its close button, or by being
 * flung off the side.
 */

/** How far, or how fast, a card has to be pushed before it goes. */
const FLING_DISTANCE = 64
const FLING_VELOCITY = 420

const CARD_MOTION: Transition = { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }

const CARD_ENTER = { opacity: 0, x: 24 }
const CARD_SETTLED = { opacity: 1, x: 0 }
const CARD_EXIT = { opacity: 0, x: 40, transition: { duration: 0.16 } }

/** The same arrival and departure without the travel, for reduced motion. */
const CARD_ENTER_STILL = { opacity: 0 }
const CARD_EXIT_STILL = { opacity: 0, transition: { duration: 0.16 } }

/**
 * Rightwards is off the edge of the window, so that is the way a card gives.
 * Leftwards it barely moves, which says "not that way" without a cursor change
 * or a hint to read.
 */
const DRAG_LOCK = { left: 0, right: 0 }
const DRAG_GIVE = { left: 0.04, right: 0.7 }

/**
 * Hidden until the card is hovered, so a column of notices reads as text rather
 * than as a column of buttons. Focus brings it back for anyone arriving by
 * keyboard.
 */
function DismissButton({
    onDismiss,
    title,
}: {
    readonly onDismiss: () => void
    readonly title: string
}) {
    return (
        <button
            aria-label={`Dismiss “${title}”`}
            className="tint-control absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted opacity-0 outline-none group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onDismiss}
            type="button"
        >
            <X aria-hidden className="size-3.5" />
        </button>
    )
}

function NotificationCard({
    notification,
    onDismiss,
}: {
    readonly notification: AppNotification
    readonly onDismiss: (id: string) => void
}) {
    const reducedMotion = useReducedMotion()

    const dismiss = useCallback(() => {
        onDismiss(notification.id)
    }, [notification.id, onDismiss])

    const handleDragEnd = useCallback(
        (_event: unknown, info: PanInfo) => {
            if (info.offset.x > FLING_DISTANCE || info.velocity.x > FLING_VELOCITY) {
                dismiss()
            }
        },
        [dismiss],
    )

    return (
        <motion.li
            animate={CARD_SETTLED}
            drag="x"
            dragConstraints={DRAG_LOCK}
            dragElastic={DRAG_GIVE}
            exit={reducedMotion === true ? CARD_EXIT_STILL : CARD_EXIT}
            initial={reducedMotion === true ? CARD_ENTER_STILL : CARD_ENTER}
            layout
            onDragEnd={handleDragEnd}
            transition={CARD_MOTION}
        >
            <div className="glass-raised group pointer-events-auto relative rounded-2xl py-3 pr-9 pl-3.5">
                <p className="text-[13px] font-semibold">{notification.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{notification.body}</p>

                <DismissButton onDismiss={dismiss} title={notification.title} />
            </div>
        </motion.li>
    )
}

export function NotificationStack() {
    const { dismiss, notifications } = useNotifications()

    if (notifications.length === 0) {
        return null
    }

    return (
        // Clear of the header's own row — 72px of it — so the top card hangs
        // directly under the settings button. `pointer-events-none` on the
        // column keeps the gaps between cards from swallowing clicks meant for
        // the page behind them.
        <ul
            aria-live="polite"
            className="pointer-events-none fixed top-20 right-6 z-30 flex w-80 flex-col gap-2"
        >
            <AnimatePresence initial={false}>
                {notifications.map((notification) => (
                    <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onDismiss={dismiss}
                    />
                ))}
            </AnimatePresence>
        </ul>
    )
}
