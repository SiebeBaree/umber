import { useRouteContext } from '@tanstack/react-router'

import { ApiKeysSection } from './api-keys-section'
import { FestiveModeSection } from './festive-mode-section'
import { ShortcutsSection } from './shortcuts-section'

/**
 * The settings page: provider keys, the shortcut reference and festive mode.
 * Every flow here is walkable end to end, but nothing persists beyond the
 * session or touches a real provider yet; the sections carry that caveat
 * themselves where it matters.
 */
export function SettingsPage() {
    const { runtime } = useRouteContext({ from: '__root__' })

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

            <div className="mt-6 flex flex-col gap-4">
                <ApiKeysSection />
                <ShortcutsSection />
                <FestiveModeSection />
            </div>

            {runtime === undefined ? null : (
                <p className="mt-auto pt-10 text-center text-xs text-muted">{runtime}</p>
            )}
        </div>
    )
}
