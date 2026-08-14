import { RouterProvider } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { GenerationProvider } from './features/generate/generation-context'
import { KeysProvider } from './features/keys/keys-context'
import type { KeyVault } from './features/keys/vault'
import { OnboardingFlow } from './features/onboarding/onboarding-flow'
import { ProfileProvider, useProfile } from './features/profile/profile-context'
import { UpdatesProvider, type UpdateChecker } from './features/updates/updates-context'
import { setHttpTransport, type HttpTransport } from './lib/http'
import { createUmberRouter } from './router'

export interface AppProps {
    /**
     * The running build's version, shown at the foot of the settings page. The
     * shell knows it; the UI package has no way to find it out on its own.
     */
    readonly version?: string | undefined
    /**
     * A short line describing the host runtime, shown on the settings page. The
     * shell fills this in with whatever it knows about itself.
     */
    readonly runtime?: string | undefined
    /**
     * Whether the host paints its window controls on top of the app rather than
     * in a title bar of its own — true for macOS, where the header has to leave
     * the traffic lights room.
     */
    readonly overlaidWindowControls?: boolean | undefined
    /**
     * Where provider credentials are kept. The desktop shell passes one backed
     * by the OS keychain via `safeStorage`; without one, a `localStorage`
     * fallback keeps the browser preview and tests working.
     */
    readonly vault?: KeyVault | undefined
    /**
     * How provider requests reach the network. The desktop shell passes one
     * that crosses into the main process, where CORS does not apply; without
     * one, plain `fetch` keeps the browser preview and tests working.
     */
    readonly transport?: HttpTransport | undefined
    /**
     * How the app finds out a newer version has been published. Without one it
     * never reports an update, which is right for a browser preview: there is
     * nothing there to install.
     */
    readonly updates?: UpdateChecker | undefined
}

type UmberRouter = ReturnType<typeof createUmberRouter>

/**
 * The router plus the first-run gate. The app itself stays mounted underneath
 * onboarding — made `inert` so nothing beneath the overlay can be focused or
 * clicked — which lets the exit animation reveal a create page that is already
 * painted and greeting the new name.
 */
function AppContent({ router }: { readonly router: UmberRouter }) {
    const profile = useProfile()
    const [onboarding, setOnboarding] = useState(() => profile.name === null)

    // The name vanishing after mount means the settings page erased it; the
    // flow comes back exactly as it would on a fresh install.
    useEffect(() => {
        if (profile.name === null) {
            setOnboarding(true)
        }
    }, [profile.name])

    // As onboarding starts leaving, put Create beneath it: the flow may have
    // been re-entered from an erase, with the settings page still showing.
    const leave = useCallback(() => {
        void router.navigate({ to: '/' })
    }, [router])

    const done = useCallback(() => {
        setOnboarding(false)
    }, [])

    return (
        <>
            <div className="h-full" inert={onboarding}>
                <RouterProvider router={router} />
            </div>
            {onboarding ? <OnboardingFlow onDone={done} onLeaving={leave} /> : null}
        </>
    )
}

/**
 * The entire Umber application. `@umber/desktop` mounts this component and
 * nothing else, which keeps every product decision inside this package.
 *
 * All props are read once, when the component first mounts: they describe the
 * host shell, which cannot change while the app is running.
 */
export function App({
    overlaidWindowControls = false,
    runtime,
    transport,
    updates,
    vault,
    version,
}: AppProps) {
    const [router] = useState(() => createUmberRouter({ overlaidWindowControls, runtime, version }))

    // Installed before anything renders, so the first generation already goes
    // through the shell's network path. A singleton rather than context: the
    // transport describes the host, which cannot change while the app runs.
    useState(() => {
        setHttpTransport(transport)

        return null
    })

    return (
        <KeysProvider vault={vault}>
            <ProfileProvider>
                <GenerationProvider>
                    <UpdatesProvider checker={updates}>
                        <AppContent router={router} />
                    </UpdatesProvider>
                </GenerationProvider>
            </ProfileProvider>
        </KeysProvider>
    )
}
