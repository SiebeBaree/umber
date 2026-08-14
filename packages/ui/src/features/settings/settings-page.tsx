import { useRouteContext } from '@tanstack/react-router'

import { ApiKeysSection } from './api-keys-section'
import { EraseDataSection } from './erase-data-section'
import { NameSection } from './name-section'
import { ShortcutsSection } from './shortcuts-section'

/**
 * The settings page: the name the app greets, the provider keys you generate
 * with, the shortcuts, and the way to erase the lot.
 */
export function SettingsPage() {
    const { runtime } = useRouteContext({ from: '__root__' })

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

            <div className="mt-6 flex flex-col gap-4">
                <NameSection />
                <ApiKeysSection />
                <ShortcutsSection />
                <EraseDataSection />
            </div>

            {runtime === undefined ? null : (
                <p className="mt-auto pt-10 text-center text-xs text-muted">{runtime}</p>
            )}
        </div>
    )
}
