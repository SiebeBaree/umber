import { Images, Plus, SkipBack, SkipForward, type LucideIcon } from 'lucide-react'
import { useCallback, useRef, type ChangeEvent, type ReactNode } from 'react'

import { Button } from '../../components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { Tooltip } from '../../components/ui/tooltip'
import type { AssetCapabilities } from './catalog'
import type { AssetSlot, ComposerAsset } from './use-composer-assets'

/**
 * Attaching files to the prompt. One hidden `<input type="file">` serves every
 * slot: `open` notes which slot asked before clicking it, so the strip's empty
 * frame tiles and the `+` button all funnel through the same element.
 */
export interface AssetFilePicker {
    readonly open: (slot: AssetSlot) => void
    /** The hidden input; render it once, anywhere in the composer. */
    readonly input: ReactNode
}

export function useAssetFilePicker(
    capabilities: AssetCapabilities,
    onAdd: (files: FileList, slot: AssetSlot) => void,
): AssetFilePicker {
    const inputRef = useRef<HTMLInputElement>(null)
    const slotRef = useRef<AssetSlot>('reference')

    const open = useCallback((slot: AssetSlot) => {
        const input = inputRef.current

        if (input === null) {
            return
        }

        slotRef.current = slot
        // A frame slot holds one file; only references take a batch.
        input.multiple = slot === 'reference'
        input.click()
    }, [])

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            if (event.target.files !== null && event.target.files.length > 0) {
                onAdd(event.target.files, slotRef.current)
            }

            // Lets the same file be picked again after it has been removed.
            event.target.value = ''
        },
        [onAdd],
    )

    const input = (
        <input
            accept={capabilities.types.join(',')}
            aria-hidden
            className="hidden"
            onChange={handleChange}
            ref={inputRef}
            tabIndex={-1}
            type="file"
        />
    )

    return { open, input }
}

interface SlotOption {
    readonly slot: AssetSlot
    readonly label: string
    readonly icon: LucideIcon
    readonly detail: string | null
    readonly disabled: boolean
}

function slotOptions(
    capabilities: AssetCapabilities,
    assets: readonly ComposerAsset[],
): readonly SlotOption[] {
    const options: SlotOption[] = []
    const has = (slot: AssetSlot) => assets.some((asset) => asset.slot === slot)

    if (capabilities.frames) {
        options.push({
            slot: 'start',
            label: 'Start frame',
            icon: SkipBack,
            detail: has('start') ? 'replaces' : null,
            disabled: false,
        })
    }

    if (capabilities.lastFrame) {
        options.push({
            slot: 'end',
            label: 'End frame',
            icon: SkipForward,
            detail: has('end') ? 'replaces' : null,
            disabled: false,
        })
    }

    if (capabilities.maxReferences > 0) {
        const used = assets.filter((asset) => asset.slot === 'reference').length

        options.push({
            slot: 'reference',
            label: capabilities.frames ? 'Reference image' : 'Add images',
            icon: Images,
            detail: used > 0 ? `${used} of ${capabilities.maxReferences}` : null,
            disabled: used >= capabilities.maxReferences,
        })
    }

    return options
}

interface SlotMenuItemProps {
    readonly option: SlotOption
    readonly onOpen: (slot: AssetSlot) => void
}

function SlotMenuItem({ onOpen, option }: SlotMenuItemProps) {
    const select = useCallback(() => {
        onOpen(option.slot)
    }, [onOpen, option.slot])

    return (
        <DropdownMenuItem disabled={option.disabled} onSelect={select}>
            <option.icon aria-hidden className="size-4 text-muted" />
            {option.label}
            {option.detail === null ? null : (
                <span className="ml-auto pl-4 text-xs text-muted">{option.detail}</span>
            )}
        </DropdownMenuItem>
    )
}

interface SoleSlotButtonProps {
    readonly option: SlotOption
    readonly limit: number
    readonly modelName: string
    readonly onOpen: (slot: AssetSlot) => void
}

/** The `+` when only one kind of file exists to add: no menu, straight in. */
function SoleSlotButton({ limit, modelName, onOpen, option }: SoleSlotButtonProps) {
    const open = useCallback(() => {
        onOpen(option.slot)
    }, [onOpen, option.slot])

    const button = (
        <Button
            aria-label={option.slot === 'reference' ? 'Add reference images' : 'Add a start frame'}
            disabled={option.disabled}
            onClick={open}
            size="icon"
            variant="ghost"
        >
            <Plus aria-hidden />
        </Button>
    )

    // The one case that most needs explaining is the one that cannot be
    // clicked: the strip is full for this model.
    return option.disabled ? (
        <Tooltip label={`${modelName} takes ${limit} images.`} wrapTrigger>
            {button}
        </Tooltip>
    ) : (
        button
    )
}

export interface AssetPickerProps {
    readonly capabilities: AssetCapabilities
    readonly assets: readonly ComposerAsset[]
    readonly modelName: string
    readonly onOpen: (slot: AssetSlot) => void
}

/**
 * The `+` beside the prompt field. For a model that takes one kind of file it
 * opens the picker straight away; for one with frame slots it grows a small
 * menu naming what the file will become. Models that take nothing get no
 * button at all — an upload that would be rejected is not offered.
 */
export function AssetPicker({ assets, capabilities, modelName, onOpen }: AssetPickerProps) {
    const options = slotOptions(capabilities, assets)
    const only = options.length === 1 ? options[0] : undefined

    if (options.length === 0) {
        return null
    }

    if (only !== undefined) {
        return (
            <SoleSlotButton
                limit={capabilities.maxReferences}
                modelName={modelName}
                onOpen={onOpen}
                option={only}
            />
        )
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button aria-label="Attach files" size="icon" variant="ghost">
                    <Plus aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {options.map((option) => (
                    <SlotMenuItem key={option.slot} onOpen={onOpen} option={option} />
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
