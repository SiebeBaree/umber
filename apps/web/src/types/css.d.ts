// A module augmentation only applies once the module is imported.
// oxlint-disable-next-line import/no-unassigned-import
import 'react'

// Lets `style` carry CSS custom properties without casting.
declare module 'react' {
    interface CSSProperties {
        [property: `--${string}`]: string | number | undefined
    }
}
