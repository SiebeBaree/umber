import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    readonly variant?: ButtonVariant | undefined
}

// Border *width* only. The colour belongs to the variants: two utilities setting
// the same property resolve by stylesheet order, not by the order they appear in
// the class attribute, so a `border-transparent` here would silently beat the
// `border-line` below.
const BASE_CLASSES =
    'cursor-pointer rounded-full border px-5 py-2.5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50'

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
    primary: 'border-transparent bg-accent text-accent-ink enabled:hover:bg-accent-strong',
    secondary: 'border-line text-ink enabled:hover:border-accent enabled:hover:text-accent',
}

/**
 * The only button in the design system so far. Defaults to `type="button"` so it
 * never submits a surrounding form by accident.
 */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
    const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], className]
        .filter((value) => value !== undefined && value !== '')
        .join(' ')

    return <button className={classes} type={type} {...rest} />
}
