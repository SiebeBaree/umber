import type { AspectRatio } from '../catalog'

/**
 * A scale drawing of the ratio itself: the outline is the shape you will get
 * back, fitted inside a fixed 18×18 box so a row of them lines up.
 *
 * Deriving the rectangle from the ratio string means a new ratio in the catalog
 * gets an icon for free — there is no per-ratio artwork to forget to add.
 */
const BOX = 18
const STROKE = 1.6

export interface AspectRatioIconProps {
    readonly ratio: AspectRatio
    readonly className?: string | undefined
}

export function AspectRatioIcon({ className, ratio }: AspectRatioIconProps) {
    const [widthPart = '1', heightPart = '1'] = ratio.split(':')
    const width = Number(widthPart)
    const height = Number(heightPart)

    // Fit the longer side to the box and scale the other down to match.
    const longest = Math.max(width, height)
    const drawnWidth = (width / longest) * (BOX - STROKE)
    const drawnHeight = (height / longest) * (BOX - STROKE)

    return (
        <svg
            aria-hidden
            className={className}
            fill="none"
            viewBox={`0 0 ${BOX} ${BOX}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect
                height={drawnHeight}
                rx="1.6"
                stroke="currentColor"
                strokeWidth={STROKE}
                width={drawnWidth}
                x={(BOX - drawnWidth) / 2}
                y={(BOX - drawnHeight) / 2}
            />
        </svg>
    )
}
