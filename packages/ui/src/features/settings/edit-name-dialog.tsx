import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { TextInput } from '../../components/ui/text-input'
import { useProfile } from '../profile/profile-context'

/**
 * The name from onboarding, changed. Saving is a deliberate step rather than
 * every keystroke, so the create page's greeting never cycles through
 * half-typed names, and a blank field simply cannot be saved.
 */

/** The typed name, reset to what is stored each time the dialog opens. */
function useNameDraft(open: boolean) {
    const profile = useProfile()
    const [draft, setDraft] = useState(profile.name ?? '')

    useEffect(() => {
        if (open) {
            setDraft(profile.name ?? '')
        }
    }, [open, profile.name])

    const onDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setDraft(event.target.value)
    }, [])

    return { draft, onDraftChange, trimmed: draft.trim(), save: profile.setName }
}

/** Cancel first in the DOM, so a blank name is the easier way out of here. */
function EditActions({
    onCancel,
    saveable,
}: {
    readonly saveable: boolean
    readonly onCancel: () => void
}) {
    return (
        <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onCancel} size="sm" variant="ghost">
                Cancel
            </Button>
            <Button disabled={!saveable} size="sm" type="submit" variant="glass">
                Save
            </Button>
        </div>
    )
}

export interface EditNameDialogProps {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
}

export function EditNameDialog({ onOpenChange, open }: EditNameDialogProps) {
    const { draft, onDraftChange, save, trimmed } = useNameDraft(open)

    const close = useCallback(() => {
        onOpenChange(false)
    }, [onOpenChange])

    const submit = useCallback(
        (event: FormEvent) => {
            event.preventDefault()

            if (trimmed !== '') {
                save(trimmed)
                onOpenChange(false)
            }
        },
        [trimmed, save, onOpenChange],
    )

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-sm" showClose={false}>
                {/* The field is first in the DOM, so the dialog opens ready to type. */}
                <form onSubmit={submit}>
                    <DialogTitle className="pe-0">Your name</DialogTitle>
                    <DialogDescription>
                        What the create page greets you by. It stays on this device.
                    </DialogDescription>

                    <TextInput
                        aria-label="Your name"
                        autoComplete="off"
                        className="mt-4"
                        onChange={onDraftChange}
                        placeholder="Your first name"
                        spellCheck={false}
                        value={draft}
                    />

                    <EditActions onCancel={close} saveable={trimmed !== ''} />
                </form>
            </DialogContent>
        </Dialog>
    )
}
