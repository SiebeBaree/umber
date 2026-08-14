import { Pencil } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '../../components/ui/button'
import { useProfile } from '../profile/profile-context'
import { EditNameDialog } from './edit-name-dialog'

/**
 * The name onboarding asked for, with the way to change it. The section states
 * the name it is holding rather than sitting the field on the page: every other
 * change made from this page is asked for in a panel, and a lone input that
 * saves as you type is a different promise from the one the rest of it makes.
 */
export function NameSection() {
    const profile = useProfile()
    const [open, setOpen] = useState(false)

    const edit = useCallback(() => {
        setOpen(true)
    }, [])

    return (
        <section aria-labelledby="settings-name" className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="font-semibold" id="settings-name">
                        Your name
                    </h2>
                    <p className="mt-1 truncate text-sm leading-relaxed text-muted">
                        {profile.name === null
                            ? 'The create page greets you by name.'
                            : `The create page greets you as ${profile.name}.`}
                    </p>
                </div>

                <Button className="shrink-0" onClick={edit} size="sm" variant="glass">
                    <Pencil aria-hidden />
                    Edit
                </Button>
            </div>

            <EditNameDialog onOpenChange={setOpen} open={open} />
        </section>
    )
}
