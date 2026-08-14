import { useRouteContext } from '@tanstack/react-router'

import { ApiKeysSection } from './api-keys-section'
import { EraseDataSection } from './erase-data-section'
import { NameSection } from './name-section'
import { ShortcutsSection } from './shortcuts-section'
import { UpdateSection } from './update-section'

/**
 * The settings page: any waiting update, the name the app greets, the provider
 * keys you generate with, the shortcuts, and the way to erase the lot.
 *
 * The update notice leads because it is the only section that arrives
 * unannounced, and the version it would replace closes the page.
 */
export function SettingsPage() {
    const { runtime, version } = useRouteContext({ from: '__root__' })

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

            <div className="mt-6 flex flex-col gap-4">
                <UpdateSection />
                <NameSection />
                <ApiKeysSection />
                <ShortcutsSection />
                <EraseDataSection />
            </div>

            <footer className="mt-auto pt-10 text-center text-xs text-muted">
                {version === undefined ? null : (
                    <p className="font-medium text-ink/70">Umber {version}</p>
                )}
                {runtime === undefined ? null : <p className="mt-1">{runtime}</p>}
            </footer>
        </div>
    )
}
