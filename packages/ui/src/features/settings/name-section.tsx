import { Pencil } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '../../components/ui/button'
import { EditNameDialog } from './edit-name-dialog'

/**
 * The name onboarding asked for, with the way to change it. The name itself
 * lives in the dialog rather than on the page: every other change made from
 * here is asked for in a panel, and a lone input that saves as you type is a
 * different promise from the one the rest of the page makes.
 */
export function NameSection() {
    const [open, setOpen] = useState(false)

    const edit = useCallback(() => {
        setOpen(true)
    }, [])

    return (
        <section aria-labelledby="settings-name" className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold" id="settings-name">
                    Your name
                </h2>

                <Button className="shrink-0" onClick={edit} size="sm" variant="glass">
                    <Pencil aria-hidden />
                    Edit
                </Button>
            </div>

            <EditNameDialog onOpenChange={setOpen} open={open} />
        </section>
    )
}
