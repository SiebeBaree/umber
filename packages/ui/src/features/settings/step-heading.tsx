import type { ComponentProps } from 'react'

import { DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { cn } from '../../lib/cn'

/**
 * The add-provider steps render in two hosts: the settings dialog and the
 * onboarding page. Radix's `DialogTitle` and `DialogDescription` throw when
 * rendered outside a dialog, so each step is told which host it is in and
 * these pick the matching element — Radix's, which wires the dialog's
 * accessible name, or a plain heading styled identically.
 */
export type StepPresentation = 'dialog' | 'page'

interface StepTitleProps extends ComponentProps<'h2'> {
    readonly presentation: StepPresentation
}

export function StepTitle({ children, className, presentation, ...rest }: StepTitleProps) {
    if (presentation === 'dialog') {
        return (
            <DialogTitle className={className} {...rest}>
                {children}
            </DialogTitle>
        )
    }

    return (
        <h2 className={cn('pe-8 text-lg font-semibold tracking-tight', className)} {...rest}>
            {children}
        </h2>
    )
}

interface StepDescriptionProps extends ComponentProps<'p'> {
    readonly presentation: StepPresentation
}

export function StepDescription({ className, presentation, ...rest }: StepDescriptionProps) {
    if (presentation === 'dialog') {
        return <DialogDescription className={className} {...rest} />
    }

    return <p className={cn('mt-1.5 text-sm leading-relaxed text-muted', className)} {...rest} />
}
