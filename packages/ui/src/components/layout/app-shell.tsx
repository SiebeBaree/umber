import { Outlet } from '@tanstack/react-router'

import { TooltipProvider } from '../ui/tooltip'
import { AppHeader } from './app-header'
import { CanvasBackdrop } from './canvas-backdrop'

/**
 * The root layout every page renders inside: the animated canvas behind
 * everything, header on top, the matched page filling the rest.
 */
export function AppShell() {
    return (
        <TooltipProvider>
            <div className="flex min-h-full flex-col">
                <CanvasBackdrop />
                <AppHeader />
                <main className="flex flex-1 flex-col">
                    <Outlet />
                </main>
            </div>
        </TooltipProvider>
    )
}
