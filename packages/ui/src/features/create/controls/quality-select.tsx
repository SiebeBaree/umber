import { ChevronDown, Sparkles } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import type { ImageQuality } from '../catalog'

const LABELS: Readonly<Record<ImageQuality, string>> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
}

export interface QualitySelectProps {
    readonly options: readonly ImageQuality[]
    readonly value: string
    readonly onValueChange: (value: string) => void
}

/**
 * Picks the render-effort tier on models that price by quality. Only mounted
 * for those models, so there is no locked single-option state to design for.
 */
export function QualitySelect({ onValueChange, options, value }: QualitySelectProps) {
    const label = LABELS[value as ImageQuality] ?? value

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    aria-label={`Quality: ${label}`}
                    className="group gap-2 ps-3 pe-3 text-[13px]"
                    variant="glass"
                >
                    <Sparkles aria-hidden className="text-muted" />
                    {label}
                    <ChevronDown
                        aria-hidden
                        className="size-3.5 text-muted transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                    />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
                <DropdownMenuLabel>Quality</DropdownMenuLabel>
                <DropdownMenuRadioGroup onValueChange={onValueChange} value={value}>
                    {options.map((option) => (
                        <DropdownMenuRadioItem key={option} value={option}>
                            {LABELS[option]}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
