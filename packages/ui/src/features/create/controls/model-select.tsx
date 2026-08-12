import { ChevronDown, Star } from 'lucide-react'
import { AnimatePresence, motion, type Transition } from 'motion/react'
import { type MouseEvent, useCallback } from 'react'

import { Button } from '../../../components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRichRadioItem,
    DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'
import { Tooltip } from '../../../components/ui/tooltip'
import { cn } from '../../../lib/cn'
import {
    groupModels,
    ProviderMark,
    starredModels,
    type GenerationMode,
    type Model,
} from '../catalog'

const ROW_MOTION: Transition = { type: 'spring', stiffness: 620, damping: 44, mass: 0.6 }

const COLLAPSED = { opacity: 0, height: 0 }
const OPEN = { opacity: 1, height: 'auto' as const }

const STAR_CLASSES =
    'ms-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors duration-150 hover:bg-[var(--umber-hover-tint)] focus-visible:outline-2 focus-visible:outline-accent'

interface ModelRowProps {
    readonly model: Model
    readonly starred: boolean
    readonly selected: boolean
    readonly onToggleStar: (modelId: string) => void
}

function ModelRow({ model, onToggleStar, selected, starred }: ModelRowProps) {
    const toggle = useCallback(
        (event: MouseEvent) => {
            // Without this the click also picks the model and closes the menu,
            // which makes starring several models in a row impossible.
            event.preventDefault()
            event.stopPropagation()
            onToggleStar(model.id)
        },
        [model.id, onToggleStar],
    )

    return (
        // The selected row is filled and tinted rather than flagged with a
        // glyph: at a glance the eye finds a block of colour long before it
        // finds a dot, and it leaves the row's right edge free for the star.
        <DropdownMenuRichRadioItem
            className="data-[state=checked]:bg-accent/10 data-[state=checked]:text-accent"
            value={model.id}
        >
            <ProviderMark
                className={cn('size-4 shrink-0', selected ? 'text-accent' : 'text-muted')}
                provider={model.provider}
            />
            <span className={cn('flex-1 whitespace-nowrap', selected && 'font-semibold')}>
                {model.name}
            </span>

            <Tooltip label={starred ? 'Unpin from the top' : 'Pin to the top of this list'}>
                <button
                    aria-label={starred ? `Unpin ${model.name}` : `Pin ${model.name} to the top`}
                    aria-pressed={starred}
                    className={cn(STAR_CLASSES, starred ? 'text-accent' : 'text-muted/50')}
                    onClick={toggle}
                    type="button"
                >
                    <Star
                        aria-hidden
                        className="size-3.5"
                        fill={starred ? 'currentColor' : 'none'}
                    />
                </button>
            </Tooltip>
        </DropdownMenuRichRadioItem>
    )
}

interface ModelMenuProps {
    readonly mode: GenerationMode
    readonly starred: ReadonlySet<string>
    readonly selectedId: string
    readonly onToggleStar: (modelId: string) => void
}

/**
 * Pinned models first, then one group per vendor, newest model at each top.
 *
 * A pinned model stays in its vendor group as well — the pin copies it up here
 * rather than moving it, so a vendor's line-up never looks incomplete. The
 * block grows and collapses rather than appearing outright, and carries no
 * separator: its heading is division enough.
 */
function PinnedGroup({ mode, onToggleStar, selectedId, starred }: ModelMenuProps) {
    const pinned = starredModels(mode, starred)

    return (
        <AnimatePresence initial={false}>
            {pinned.length === 0 ? null : (
                <motion.div
                    animate={OPEN}
                    className="overflow-hidden"
                    exit={COLLAPSED}
                    initial={COLLAPSED}
                    key="pinned"
                    layout
                    transition={ROW_MOTION}
                >
                    <DropdownMenuLabel>Pinned</DropdownMenuLabel>
                    <AnimatePresence initial={false}>
                        {pinned.map((model) => (
                            <motion.div
                                animate={OPEN}
                                className="overflow-hidden"
                                exit={COLLAPSED}
                                initial={COLLAPSED}
                                key={model.id}
                                layout
                                transition={ROW_MOTION}
                            >
                                <ModelRow
                                    model={model}
                                    onToggleStar={onToggleStar}
                                    selected={model.id === selectedId}
                                    starred
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function ModelMenu({ mode, onToggleStar, selectedId, starred }: ModelMenuProps) {
    return (
        <>
            <PinnedGroup
                mode={mode}
                onToggleStar={onToggleStar}
                selectedId={selectedId}
                starred={starred}
            />

            {groupModels(mode).map((group) => (
                <motion.div key={group.provider.id} layout transition={ROW_MOTION}>
                    <DropdownMenuLabel>{group.provider.name}</DropdownMenuLabel>
                    {group.models.map((model) => (
                        <ModelRow
                            key={model.id}
                            model={model}
                            onToggleStar={onToggleStar}
                            selected={model.id === selectedId}
                            starred={starred.has(model.id)}
                        />
                    ))}
                </motion.div>
            ))}
        </>
    )
}

export interface ModelSelectProps {
    readonly mode: GenerationMode
    readonly model: Model
    readonly starred: ReadonlySet<string>
    readonly onSelect: (modelId: string) => void
    readonly onToggleStar: (modelId: string) => void
}

/**
 * Picks the model. Pinned models come first in their own group, then one group
 * per vendor with that vendor's newest model at the top.
 */
export function ModelSelect({ mode, model, onSelect, onToggleStar, starred }: ModelSelectProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    aria-label={`Model: ${model.name}`}
                    className="group gap-2 ps-3 pe-3 text-[13px]"
                    variant="glass"
                >
                    <ProviderMark className="size-4 text-muted" provider={model.provider} />
                    {model.name}
                    <ChevronDown
                        aria-hidden
                        className="size-3.5 text-muted transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                    />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup onValueChange={onSelect} value={model.id}>
                    <ModelMenu
                        mode={mode}
                        onToggleStar={onToggleStar}
                        selectedId={model.id}
                        starred={starred}
                    />
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
