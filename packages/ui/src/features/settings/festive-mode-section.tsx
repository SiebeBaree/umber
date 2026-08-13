import { z } from 'zod'

import { Switch } from '../../components/ui/switch'
import { usePersistedState } from '../../lib/persisted-state'

/**
 * The festive mode section. The toggle persists, but no theme swap exists yet.
 * This section is the promise the theming feature will keep.
 */

const FESTIVE_MODE_KEY = 'umber.festive.v1'

const festiveModeSchema = z.boolean()

export function FestiveModeSection() {
    const [enabled, setEnabled] = usePersistedState(FESTIVE_MODE_KEY, festiveModeSchema, false)

    return (
        <section aria-labelledby="settings-festive" className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="font-semibold" id="settings-festive">
                        <label htmlFor="festive-mode">Festive mode</label>
                    </h2>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                        Umber swaps its theme for a few days around holidays like Christmas and
                        Easter.
                    </p>
                </div>
                <Switch checked={enabled} id="festive-mode" onCheckedChange={setEnabled} />
            </div>
        </section>
    )
}
