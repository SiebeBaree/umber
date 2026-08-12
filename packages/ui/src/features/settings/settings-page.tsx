import { useRouteContext } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'

/**
 * The settings page. Its real content — provider API keys, storage, appearance —
 * arrives with those features; until then it only sets the frame.
 */
export function SettingsPage() {
    const { runtime } = useRouteContext({ from: '__root__' })

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

            <div className="glass mt-6 flex flex-col items-center gap-4 rounded-3xl px-8 py-14 text-center">
                <div className="glass-raised flex size-14 items-center justify-center rounded-2xl">
                    <KeyRound aria-hidden className="size-6 text-muted" />
                </div>
                <div>
                    <h2 className="font-semibold">Nothing to configure yet</h2>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                        Your model providers and API keys will be managed here.
                    </p>
                </div>
            </div>

            {runtime === undefined ? null : (
                <p className="mt-auto pt-10 text-center text-xs text-muted">{runtime}</p>
            )}
        </div>
    )
}
