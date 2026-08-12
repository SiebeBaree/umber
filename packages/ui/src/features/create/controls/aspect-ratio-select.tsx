import { ChevronDown } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import type { AspectRatio } from '../catalog'
import { AspectRatioIcon } from './aspect-ratio-icon'
import { LockedPill } from './locked-pill'

interface RatioMenuProps {
    readonly options: readonly AspectRatio[]
    readonly value: AspectRatio
    readonly onValueChange: (value: string) => void
}

function RatioMenu({ onValueChange, options, value }: RatioMenuProps) {
    return (
        <DropdownMenuContent align="start">
            <DropdownMenuLabel>Aspect ratio</DropdownMenuLabel>
            <DropdownMenuRadioGroup onValueChange={onValueChange} value={value}>
                {options.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                        <span className="flex items-center gap-3">
                            <AspectRatioIcon className="size-[18px] text-muted" ratio={option} />
                            {option}
                        </span>
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
        </DropdownMenuContent>
    )
}

export interface AspectRatioSelectProps {
    readonly options: readonly AspectRatio[]
    readonly value: AspectRatio
    readonly onValueChange: (value: string) => void
    readonly modelName: string
}

/**
 * Picks the output shape. Both the trigger and every row draw the ratio to
 * scale, so the icon on the button always matches the current choice.
 */
export function AspectRatioSelect({
    modelName,
    onValueChange,
    options,
    value,
}: AspectRatioSelectProps) {
    if (options.length <= 1) {
        return (
            <LockedPill
                ariaLabel={`Aspect ratio: ${value}`}
                tooltip={`${modelName} only outputs ${value}`}
                ratio={value}
                value={value}
            />
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    aria-label={`Aspect ratio: ${value}`}
                    className="group gap-2 ps-3 pe-3 text-[13px]"
                    variant="glass"
                >
                    <AspectRatioIcon className="size-[18px] text-muted" ratio={value} />
                    {value}
                    <ChevronDown
                        aria-hidden
                        className="size-3.5 text-muted transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                    />
                </Button>
            </DropdownMenuTrigger>

            <RatioMenu onValueChange={onValueChange} options={options} value={value} />
        </DropdownMenu>
    )
}
