import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Composes class names, resolving Tailwind conflicts in favour of the later
 * value — so a caller's `className` can override a component's defaults.
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs))
}
