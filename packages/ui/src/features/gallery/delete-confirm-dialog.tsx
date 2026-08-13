import { useCallback, useRef } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'

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

export interface DeleteConfirmDialogProps {
    /** The prompt of the creation awaiting confirmation, or null when none is. */
    readonly prompt: string | null
    readonly onConfirm: () => void
    readonly onCancel: () => void
}

/**
 * The question asked before a creation is erased. A deleted picture is gone:
 * it exists nowhere but this device, and the gallery's other controls all lead
 * somewhere reversible, so this one stops and asks first.
 *
 * No ✕ in the corner. A dialog this small already offers Cancel, and a second
 * way out of it only crowds the panel.
 */
export function DeleteConfirmDialog({ onCancel, onConfirm, prompt }: DeleteConfirmDialogProps) {
    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                onCancel()
            }
        },
        [onCancel],
    )

    /*
     * The panel names the creation it is about right through its exit
     * animation: dropping the line the moment the dialog closes would resize
     * the panel mid-flight. Written during render, which is safe because the
     * same input always produces the same value.
     */
    const lastShown = useRef<string>('')

    if (prompt !== null) {
        lastShown.current = prompt
    }

    return (
        <Dialog onOpenChange={handleOpenChange} open={prompt !== null}>
            <DialogContent className="max-w-sm" showClose={false}>
                <DialogTitle className="pe-0">Delete this creation?</DialogTitle>
                <DialogDescription>
                    It only exists on this device, so this cannot be undone.
                </DialogDescription>

                {/* Which picture, in its own words. Clamped: a long prompt has
                    said enough by the third line to be recognised. */}
                <p className="mt-4 line-clamp-3 rounded-2xl bg-ink/[0.03] px-4 py-3 text-[13px] leading-relaxed">
                    {lastShown.current}
                </p>

                <ConfirmActions onCancel={onCancel} onConfirm={onConfirm} />
            </DialogContent>
        </Dialog>
    )
}
