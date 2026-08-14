import { Outlet, useNavigate } from '@tanstack/react-router'

import { useShortcut, type Shortcut } from '../../lib/use-shortcut'
import { TooltipProvider } from '../ui/tooltip'
import { AppHeader } from './app-header'
import { CanvasBackdrop } from './canvas-backdrop'

/**
 * The three places one can be, on the keys next to them. All three fire while
 * typing: reaching Settings mid-prompt is exactly when it is wanted.
 */
const GO_TO_CREATE: Shortcut = { key: '1', meta: true, whileTyping: true }
const GO_TO_GALLERY: Shortcut = { key: '2', meta: true, whileTyping: true }
const OPEN_SETTINGS: Shortcut = { key: ',', meta: true, whileTyping: true }

/** The navigation shortcuts, live for as long as the app is on screen. */
function useNavigationShortcuts() {
    const navigate = useNavigate()

    useShortcut(GO_TO_CREATE, () => {
        void navigate({ to: '/' })
    })
    useShortcut(GO_TO_GALLERY, () => {
        void navigate({ to: '/gallery' })
    })
    useShortcut(OPEN_SETTINGS, () => {
        void navigate({ to: '/settings' })
    })
}

/**
 * The root layout every page renders inside: the animated canvas behind
 * everything, header on top, the matched page filling the rest.
 *
 * Pages scroll inside `main`, never the window. The header is the frameless
 * window's only drag region — and on macOS the traffic lights are painted over
 * its row at a fixed window offset — so if the document itself scrolled, a
 * page taller than the viewport would carry the drag surface away and leave
 * the traffic lights floating over page content.
 */
export function AppShell() {
    useNavigationShortcuts()

    return (
        <TooltipProvider>
            <div className="flex h-full flex-col">
                <CanvasBackdrop />
                <AppHeader />
                <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </TooltipProvider>
    )
}
