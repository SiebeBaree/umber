import { Link, useRouteContext, useRouterState } from '@tanstack/react-router'
import { UMBER_LOCKUP } from '@umber/brand'
import { Images, Settings, WandSparkles, type LucideIcon } from 'lucide-react'

import { useUpdates } from '../../features/updates/updates-context'
import { cn } from '../../lib/cn'
import { SlidingIndicator } from '../ui/sliding-indicator'

interface NavItem {
    readonly to: '/' | '/gallery'
    readonly label: string
    readonly icon: LucideIcon
}

const NAV_ITEMS: readonly NavItem[] = [
    { to: '/', label: 'Create', icon: WandSparkles },
    { to: '/gallery', label: 'Gallery', icon: Images },
]

// The nav pill is shared across a route change, so its id is a constant rather
// than a `useId()` — there is only ever one primary nav on screen.
const NAV_INDICATOR_ID = 'primary-nav-indicator'

const NAV_LINK_CLASSES = cn(
    'relative isolate flex h-full cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium text-muted transition-colors duration-200 ease-out outline-none select-none',
    'hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'data-[status=active]:text-ink',
)

/** The Create/Gallery switcher, with the pill sliding between the two. */
function PrimaryNav() {
    const pathname = useRouterState({ select: (state) => state.location.pathname })

    return (
        <nav aria-label="Primary" className="no-drag glass flex h-11 items-center rounded-full p-1">
            {NAV_ITEMS.map((item) => (
                <Link className={NAV_LINK_CLASSES} key={item.to} to={item.to}>
                    {pathname === item.to ? <SlidingIndicator layoutId={NAV_INDICATOR_ID} /> : null}
                    <item.icon aria-hidden className="size-4" />
                    {item.label}
                </Link>
            ))}
        </nav>
    )
}

/**
 * The app header: wordmark on the left, the Create/Gallery switcher floating in
 * the centre, settings on the right. It doubles as the window's drag handle,
 * which is why every control inside it opts out of the drag region.
 *
 * Where the OS paints its own window controls over the app — macOS — the
 * wordmark shares their row and steps aside for them, rather than the header
 * reserving a strip above itself. Reserving that strip would push every page
 * down by its full height for the sake of three buttons.
 *
 * The inset sits on the wordmark, not on the header, so the grid's two `1fr`
 * columns stay equal and the nav stays centred in the window.
 */
/**
 * The settings button, wearing an accent ring and a dot while an update is
 * waiting. Both, rather than one: the ring is what catches the eye across the
 * window, and the dot is what survives being seen out of the corner of it.
 */
function SettingsButton({ updateWaiting }: { readonly updateWaiting: boolean }) {
    return (
        <Link
            aria-label={updateWaiting ? 'Settings, update available' : 'Settings'}
            className={cn(
                'no-drag glass-control relative flex size-10 items-center justify-center justify-self-end rounded-full text-muted outline-none select-none',
                'hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'data-[status=active]:text-accent',
                // A ring rather than a border: `glass-control` owns the border,
                // and recolouring it would take the glass edge with it.
                updateWaiting && 'text-accent ring-2 ring-accent',
            )}
            to="/settings"
        >
            <Settings aria-hidden className="size-[18px]" />
            {updateWaiting ? (
                // Ringed in the header's own colour so it reads as sitting on
                // top of the button rather than punched out of its edge.
                <span
                    aria-hidden
                    className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-canvas"
                />
            ) : null}
        </Link>
    )
}

export function AppHeader() {
    const { overlaidWindowControls } = useRouteContext({ from: '__root__' })
    const updates = useUpdates()

    return (
        <header className="drag-region grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4">
            <Link
                aria-label="Umber — home"
                className={cn(
                    'no-drag flex items-center justify-self-start rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    // Clears the traffic lights, which end 72px from the window
                    // edge; the header's own 24px gutter covers the rest.
                    overlaidWindowControls && 'ms-[4.5rem]',
                )}
                to="/"
            >
                {/* The lockup carries the wordmark, so the link needs no text of
                    its own; the name is on the link for anyone not seeing it. */}
                <img alt="" className="h-8 w-auto" src={UMBER_LOCKUP} />
            </Link>

            <PrimaryNav />

            <SettingsButton updateWaiting={updates.available} />
        </header>
    )
}
