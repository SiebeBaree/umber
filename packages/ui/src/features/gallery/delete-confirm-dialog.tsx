import { useCallback, useRef } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'

/**
 * What the dialog is being asked about: one creation, named by its prompt, or
 * a selection of several, named only by their number — a list of prompts would
 * scroll, and the person sweeping a selection just made it by eye.
 */
export type DeleteSubject =
    | { readonly kind: 'one'; readonly prompt: string }
    | { readonly kind: 'many'; readonly count: number }

/**
 * The way out and the way through, with the modifier that skips the question
 * next time noted beside them. Cancel comes first in the DOM so the dialog
 * opens with focus on the harmless one.
 */
function ConfirmActions({
    onCancel,
    onConfirm,
}: {
    readonly onConfirm: () => void
    readonly onCancel: () => void
}) {
    return (
        <div className="mt-5 flex items-center justify-between gap-4">
            <span className="text-xs text-muted">Shift-click to skip this</span>

            <div className="flex gap-2">
                <Button onClick={onCancel} size="sm" variant="ghost">
                    Cancel
                </Button>
                <Button
                    className="text-rose-600 hover:text-rose-700"
                    onClick={onConfirm}
                    size="sm"
                    variant="glass"
                >
                    Delete
                </Button>
            </div>
        </div>
    )
}

/** The question and its stakes, worded for one creation or for several. */
function SubjectWords({ shown }: { readonly shown: DeleteSubject }) {
    return (
        <>
            <DialogTitle className="pe-0">
                {shown.kind === 'many'
                    ? `Delete ${shown.count} creations?`
                    : 'Delete this creation?'}
            </DialogTitle>
            <DialogDescription>
                {shown.kind === 'many'
                    ? 'They only exist on this device, so this cannot be undone.'
                    : 'It only exists on this device, so this cannot be undone.'}
            </DialogDescription>
        </>
    )
}

export interface DeleteConfirmDialogProps {
    /** What is awaiting confirmation, or null when nothing is. */
    readonly subject: DeleteSubject | null
    readonly onConfirm: () => void
    readonly onCancel: () => void
}

/**
 * The question asked before creations are erased. A deleted picture is gone:
 * it exists nowhere but this device, and the gallery's other controls all lead
 * somewhere reversible, so this one stops and asks first.
 *
 * No ✕ in the corner. A dialog this small already offers Cancel, and a second
 * way out of it only crowds the panel.
 */
export function DeleteConfirmDialog({ onCancel, onConfirm, subject }: DeleteConfirmDialogProps) {
    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                onCancel()
            }
        },
        [onCancel],
    )

    /*
     * The panel names what it is about right through its exit animation:
     * dropping the words the moment the dialog closes would resize the panel
     * mid-flight. Written during render, which is safe because the same input
     * always produces the same value.
     */
    const lastShown = useRef<DeleteSubject>({ kind: 'one', prompt: '' })

    if (subject !== null) {
        lastShown.current = subject
    }

    const shown = lastShown.current

    return (
        <Dialog onOpenChange={handleOpenChange} open={subject !== null}>
            <DialogContent className="max-w-sm" showClose={false}>
                <SubjectWords shown={shown} />

                {/* Which picture, in its own words. Clamped: a long prompt has
                    said enough by the third line to be recognised. */}
                {shown.kind === 'one' ? (
                    <p className="mt-4 line-clamp-3 rounded-2xl bg-ink/[0.03] px-4 py-3 text-[13px] leading-relaxed">
                        {shown.prompt}
                    </p>
                ) : null}

                <ConfirmActions onCancel={onCancel} onConfirm={onConfirm} />
            </DialogContent>
        </Dialog>
    )
}
