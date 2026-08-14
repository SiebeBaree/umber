import { useCallback, useEffect, useId, useState, type ChangeEvent } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { TextInput } from '../../components/ui/text-input'
import { countCreations } from '../gallery/creations-db'
import { useKeys } from '../keys/keys-context'
import { useEraseEverything } from './erase-everything'

/**
 * The question asked before the app is emptied.
 *
 * It lists what will go, with counts, because "everything" is not a quantity
 * anyone can picture. And it asks for the word to be typed out: this is the
 * one action in Umber that no amount of care afterwards can undo, so a click
 * on its own is not enough to trigger it.
 */

/** Typed exactly, give or take case and stray spaces, before the button lives. */
const CONFIRM_WORD = 'ERASE'

interface CountsProps {
    /** Null while the store is still being counted. */
    readonly creations: number | null
    readonly keys: number
}

function CountRow({ children, label }: { readonly label: string; readonly children: string }) {
    return (
        <li className="flex items-center justify-between gap-4 py-2.5">
            <span>{label}</span>
            <span className="font-medium tabular-nums">{children}</span>
        </li>
    )
}

/** What goes, itemised. */
function Counts({ creations, keys }: CountsProps) {
    return (
        <ul className="mt-4 divide-y divide-ink/[0.06] rounded-2xl bg-ink/[0.03] px-4 text-[13px]">
            <CountRow label="Creations">{creations === null ? '…' : String(creations)}</CountRow>
            <CountRow label="Provider keys">{String(keys)}</CountRow>
            <CountRow label="Composer settings">Reset</CountRow>
        </ul>
    )
}

/** The stored count, recounted each time the question is asked. */
function useCreationCount(open: boolean): number | null {
    const [count, setCount] = useState<number | null>(null)

    useEffect(() => {
        if (!open) {
            return
        }

        let cancelled = false

        const load = async () => {
            try {
                const counted = await countCreations()

                if (!cancelled) {
                    setCount(counted)
                }
            } catch {
                // An unreadable store has nothing to promise about; the row
                // keeps waiting rather than claiming a number it does not have.
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [open])

    return count
}

/** The typed word and the erase itself, reset each time the dialog opens. */
function useEraseFlow(open: boolean, onDone: () => void) {
    const erase = useEraseEverything()
    const [typed, setTyped] = useState('')
    const [busy, setBusy] = useState(false)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        setTyped('')
        setBusy(false)
        setFailed(false)
    }, [open])

    const onTypedChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setTyped(event.target.value)
    }, [])

    const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

    const run = useCallback(() => {
        if (!confirmed || busy) {
            return
        }

        setBusy(true)
        setFailed(false)

        const erased = async () => {
            try {
                await erase()
                onDone()
            } catch {
                setFailed(true)
            } finally {
                setBusy(false)
            }
        }

        void erased()
    }, [confirmed, busy, erase, onDone])

    return { typed, onTypedChange, confirmed, busy, failed, run }
}

type EraseFlow = ReturnType<typeof useEraseFlow>

/** The word, typed out. Nothing below it is clickable until it matches. */
function ConfirmField({ flow }: { readonly flow: EraseFlow }) {
    const fieldId = useId()

    return (
        <>
            <label className="mt-5 block text-[13px] text-muted" htmlFor={fieldId}>
                Type {CONFIRM_WORD} to confirm
            </label>
            <TextInput
                autoComplete="off"
                className="mt-1.5"
                id={fieldId}
                onChange={flow.onTypedChange}
                placeholder={CONFIRM_WORD}
                spellCheck={false}
                value={flow.typed}
            />

            {flow.failed ? (
                <p className="mt-2 text-[13px] text-rose-600">
                    Some of it could not be erased. Try again.
                </p>
            ) : null}
        </>
    )
}

/** Cancel first in the DOM, so the dialog opens with focus on the harmless one. */
function EraseActions({
    flow,
    onCancel,
}: {
    readonly flow: EraseFlow
    readonly onCancel: () => void
}) {
    return (
        <div className="mt-5 flex justify-end gap-2">
            <Button disabled={flow.busy} onClick={onCancel} size="sm" variant="ghost">
                Cancel
            </Button>
            <Button
                className="text-rose-600 hover:text-rose-700"
                disabled={!flow.confirmed || flow.busy}
                onClick={flow.run}
                size="sm"
                variant="glass"
            >
                {flow.busy ? 'Erasing' : 'Erase everything'}
            </Button>
        </div>
    )
}

export interface EraseDataDialogProps {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
}

export function EraseDataDialog({ onOpenChange, open }: EraseDataDialogProps) {
    const keys = useKeys()
    const creations = useCreationCount(open)

    const close = useCallback(() => {
        onOpenChange(false)
    }, [onOpenChange])

    const flow = useEraseFlow(open, close)

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-sm" showClose={false}>
                <DialogTitle className="pe-0">Erase everything?</DialogTitle>
                <DialogDescription>
                    All of it lives on this device and nowhere else, so there is nothing to restore
                    it from.
                </DialogDescription>

                <Counts creations={creations} keys={keys.connections.length} />
                <ConfirmField flow={flow} />
                <EraseActions flow={flow} onCancel={close} />
            </DialogContent>
        </Dialog>
    )
}
