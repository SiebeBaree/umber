import { Outlet } from '@tanstack/react-router'

import { TooltipProvider } from '../ui/tooltip'
import { AppHeader } from './app-header'
import { CanvasBackdrop } from './canvas-backdrop'

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
