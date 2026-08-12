import { Plus } from 'lucide-react'
import { type ChangeEvent, useCallback, useRef } from 'react'

import { Button } from '../../components/ui/button'

export interface ReferenceImagePickerProps {
    readonly onSelect: (files: FileList) => void
}

/**
 * Attaches reference images to the prompt. Sits beside the prompt field as a
 * bare `+` that only grows a surface on hover, so it stays quiet until wanted.
 * The `<input>` is hidden and out of the tab order because the button in front
 * of it is the control users see and reach.
 */
export function ReferenceImagePicker({ onSelect }: ReferenceImagePickerProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    const openPicker = useCallback(() => {
        inputRef.current?.click()
    }, [])

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            if (event.target.files !== null && event.target.files.length > 0) {
                onSelect(event.target.files)
            }

            // Lets the same file be picked again after it has been removed.
            event.target.value = ''
        },
        [onSelect],
    )

    return (
        <>
            <Button
                aria-label="Add a reference image"
                onClick={openPicker}
                size="icon"
                variant="ghost"
            >
                <Plus aria-hidden />
            </Button>
            <input
                accept="image/*"
                aria-hidden
                className="hidden"
                multiple
                onChange={handleChange}
                ref={inputRef}
                tabIndex={-1}
                type="file"
            />
        </>
    )
}
