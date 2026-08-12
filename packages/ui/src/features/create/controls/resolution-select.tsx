import { ChevronDown, SlidersHorizontal } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { LockedPill } from './locked-pill'

export interface ResolutionSelectProps {
    readonly options: readonly string[]
    readonly value: string
    readonly onValueChange: (value: string) => void
    readonly modelName: string
}

/** Picks the output resolution from whatever the current model supports. */
export function ResolutionSelect({
    modelName,
    onValueChange,
    options,
    value,
}: ResolutionSelectProps) {
    if (options.length <= 1) {
        return (
            <LockedPill
                ariaLabel={`Resolution: ${value}`}
                icon={SlidersHorizontal}
                tooltip={`${modelName} only renders at ${value}`}
                value={value}
            />
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    aria-label={`Resolution: ${value}`}
                    className="group gap-2 ps-3 pe-3 text-[13px]"
                    variant="glass"
                >
                    <SlidersHorizontal aria-hidden className="text-muted" />
                    {value}
                    <ChevronDown
                        aria-hidden
                        className="size-3.5 text-muted transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                    />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
                <DropdownMenuLabel>Resolution</DropdownMenuLabel>
                <DropdownMenuRadioGroup onValueChange={onValueChange} value={value}>
                    {options.map((option) => (
                        <DropdownMenuRadioItem key={option} value={option}>
                            {option}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
