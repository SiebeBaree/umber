import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import {
    SegmentedControl,
    type SegmentedControlOption,
} from '../../components/ui/segmented-control'
import { TextInput } from '../../components/ui/text-input'
import type { LimitPeriod, SpendingLimit } from '../local-api/contract'

/**
 * A new spending limit for the local API: an amount and the rolling window it
 * covers. Adding a second limit for the same window replaces the first.
 */

type PeriodValue = '1' | '7' | '30' | 'all'

const PERIOD_OPTIONS: readonly SegmentedControlOption<PeriodValue>[] = [
    { value: '1', label: '1 day' },
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: 'all', label: 'All time' },
]

const PERIODS: Readonly<Record<PeriodValue, LimitPeriod>> = { '1': 1, '7': 7, '30': 30, all: null }

/** How a limit's window reads after its amount, as in "$2 every 7 days". */
export function periodLabel(days: LimitPeriod): string {
    if (days === null) return 'all time'
    return days === 1 ? 'every day' : `every ${days} days`
}

export interface AddLimitDialogProps {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
    readonly onAdd: (limit: SpendingLimit) => void
}

/** The typed amount and chosen window, cleared each time the dialog opens. */
function useLimitDraft(open: boolean) {
    const [amount, setAmount] = useState('')
    const [period, setPeriod] = useState<PeriodValue>('7')

    useEffect(() => {
        if (open) {
            setAmount('')
            setPeriod('7')
        }
    }, [open])

    const onAmountChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setAmount(event.target.value)
    }, [])

    const usd = Number(amount)
    const valid = amount.trim() !== '' && Number.isFinite(usd) && usd > 0

    return { amount, onAmountChange, period, setPeriod, usd, valid }
}

function AmountField({
    onChange,
    value,
}: {
    readonly value: string
    readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
    return (
        <>
            <label className="mt-5 block text-[13px] font-medium" htmlFor="limit-amount">
                Amount
            </label>
            <div className="relative mt-1.5">
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-sm text-muted"
                >
                    $
                </span>
                <TextInput
                    autoComplete="off"
                    className="ps-7 tabular-nums"
                    id="limit-amount"
                    inputMode="decimal"
                    onChange={onChange}
                    placeholder="2.00"
                    value={value}
                />
            </div>
        </>
    )
}

export function AddLimitDialog({ onAdd, onOpenChange, open }: AddLimitDialogProps) {
    const { amount, onAmountChange, period, setPeriod, usd, valid } = useLimitDraft(open)

    const close = useCallback(() => onOpenChange(false), [onOpenChange])

    const submit = useCallback(
        (event: FormEvent) => {
            event.preventDefault()
            if (!valid) return
            onAdd({ usd: Math.round(usd * 100) / 100, days: PERIODS[period] })
            onOpenChange(false)
        },
        [valid, usd, period, onAdd, onOpenChange],
    )

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-sm" showClose={false}>
                <form onSubmit={submit}>
                    <DialogTitle className="pe-0">Add spending limit</DialogTitle>
                    <DialogDescription>
                        Umber rejects API requests that would pass this amount. It counts its own
                        estimates, not your provider bill.
                    </DialogDescription>

                    <AmountField onChange={onAmountChange} value={amount} />

                    <p className="mt-5 text-[13px] font-medium">Period</p>
                    <SegmentedControl
                        aria-label="Period"
                        className="mt-1.5 w-fit"
                        onValueChange={setPeriod}
                        options={PERIOD_OPTIONS}
                        value={period}
                    />

                    <div className="mt-6 flex justify-end gap-2">
                        <Button onClick={close} size="sm" variant="ghost">
                            Cancel
                        </Button>
                        <Button disabled={!valid} size="sm" type="submit" variant="glass">
                            Add limit
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
