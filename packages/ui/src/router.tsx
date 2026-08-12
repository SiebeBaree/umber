import {
    createHashHistory,
    createRootRouteWithContext,
    createRoute,
    createRouter,
    Link,
} from '@tanstack/react-router'

import { AppShell } from './components/layout/app-shell'
import { Button } from './components/ui/button'
import { CreatePage } from './features/create/create-page'
import { GalleryPage } from './features/gallery/gallery-page'
import { SettingsPage } from './features/settings/settings-page'

/**
 * Values the host shell provides once at startup; every route can read them
 * via `useRouteContext`.
 */
export interface UmberRouterContext {
    readonly runtime: string | undefined
    readonly overlaidWindowControls: boolean
}

function NotFound() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24 text-center">
            <div>
                <h1 className="text-xl font-semibold tracking-tight">This page does not exist</h1>
                <p className="mt-2 text-sm text-muted">The link that led here is broken.</p>
            </div>
            <Button asChild size="sm" variant="glass">
                <Link to="/">Back to Create</Link>
            </Button>
        </div>
    )
}

const rootRoute = createRootRouteWithContext<UmberRouterContext>()({
    component: AppShell,
    notFoundComponent: NotFound,
})

const createRouteDefinition = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: CreatePage,
})

const galleryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/gallery',
    component: GalleryPage,
})

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: SettingsPage,
})

const routeTree = rootRoute.addChildren([createRouteDefinition, galleryRoute, settingsRoute])

/**
 * Builds the app router. History is hash-based because the packaged renderer is
 * served from a `file://` URL, where real paths have nowhere to point.
 */
export function createUmberRouter(context: UmberRouterContext) {
    return createRouter({ routeTree, context, history: createHashHistory() })
}

/**
 * Registers the concrete router type globally, which is what makes `<Link to>`
 * and friends typo-proof across the entire package.
 */
declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof createUmberRouter>
    }
}
