import { Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '../../components/ui/button'
import { EraseDataDialog } from './erase-data-dialog'

/**
 * The way out of Umber entirely: one button that leaves the app as it was on
 * the day it was installed.
 *
 * Last on the settings page, and the only control there that reddens under the
 * pointer, so it is never mistaken for one of its neighbours.
 */
export function EraseDataSection() {
    const [open, setOpen] = useState(false)

    const ask = useCallback(() => {
        setOpen(true)
    }, [])

    return (
        <section aria-labelledby="settings-erase" className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="font-semibold" id="settings-erase">
                        Erase all data
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                        Deletes every creation, provider key and saved setting from this device.
                    </p>
                </div>

                <Button
                    className="shrink-0 text-rose-600 hover:text-rose-700"
                    onClick={ask}
                    size="sm"
                    variant="glass"
                >
                    <Trash2 aria-hidden />
                    Erase
                </Button>
            </div>

            <EraseDataDialog onOpenChange={setOpen} open={open} />
        </section>
    )
}
