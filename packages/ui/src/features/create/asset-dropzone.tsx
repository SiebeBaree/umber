import { ImageUp } from 'lucide-react'
import { AnimatePresence, motion, type Transition } from 'motion/react'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'

import { carriesFiles } from '../../lib/drag-drop'
import { intakeSlot } from './asset-fit'
import type { AssetCapabilities } from './catalog'
import type { AssetSlot } from './use-composer-assets'

/**
 * Files that arrive without the `+`: pasted from the clipboard or dragged onto
 * the window from anywhere on the page. Both land in the slot `intakeSlot`
 * picks for the model, and go through the same `add` as the picker, so the
 * type filtering and limits — and their notices — are identical. A model that
 * takes no files listens for neither.
 */
export interface AssetDropzone {
    /** True while files are being dragged over the window. */
    readonly dragging: boolean
    readonly slot: AssetSlot | null
}

type AddFiles = (files: FileList, slot: AssetSlot) => void

function usePasteIntake(slot: AssetSlot | null, onAdd: AddFiles) {
    useEffect(() => {
        if (slot === null) {
            return
        }

        const handlePaste = (event: ClipboardEvent) => {
            const files = event.clipboardData?.files

            if (files !== undefined && files.length > 0) {
                // Some sources put a text rendition beside the file — an
                // `<img>` fragment, a filename. The file is what was meant.
                event.preventDefault()
                onAdd(files, slot)
            }
        }

        window.addEventListener('paste', handlePaste)

        return () => {
            window.removeEventListener('paste', handlePaste)
        }
    }, [slot, onAdd])
}

/**
 * Says the composer will take the files, which is what puts the copy cursor
 * under the drag. Refusing the drop is `useDropGuard`'s job, and it has already
 * cancelled this event by the time we see it.
 */
function allowDrop(event: DragEvent) {
    if (carriesFiles(event)) {
        event.preventDefault()

        if (event.dataTransfer !== null) {
            event.dataTransfer.dropEffect = 'copy'
        }
    }
}

interface DragHandlers {
    readonly enter: (event: DragEvent) => void
    readonly leave: (event: DragEvent) => void
    readonly drop: (event: DragEvent) => void
    readonly settle: () => void
}

/**
 * Enter and leave fire for every element a drag crosses, so the depth counter
 * — not the events themselves — is what says whether the drag is still inside
 * the window; leaving it walks the depth back to zero.
 */
function dragHandlers(
    slot: AssetSlot,
    onAdd: AddFiles,
    depthRef: MutableRefObject<number>,
    setDragging: (dragging: boolean) => void,
): DragHandlers {
    const settle = () => {
        depthRef.current = 0
        setDragging(false)
    }

    return {
        settle,
        enter: (event) => {
            if (carriesFiles(event)) {
                depthRef.current += 1
                setDragging(true)
            }
        },
        leave: (event) => {
            if (carriesFiles(event) && depthRef.current > 0) {
                depthRef.current -= 1

                if (depthRef.current === 0) {
                    setDragging(false)
                }
            }
        },
        drop: (event) => {
            if (!carriesFiles(event)) {
                return
            }

            event.preventDefault()
            settle()

            const files = event.dataTransfer?.files

            if (files !== undefined && files.length > 0) {
                onAdd(files, slot)
            }
        },
    }
}

function useDragIntake(slot: AssetSlot | null, onAdd: AddFiles) {
    const [dragging, setDragging] = useState(false)
    const depthRef = useRef(0)

    useEffect(() => {
        if (slot === null) {
            return
        }

        const handlers = dragHandlers(slot, onAdd, depthRef, setDragging)

        window.addEventListener('dragenter', handlers.enter)
        window.addEventListener('dragleave', handlers.leave)
        window.addEventListener('dragover', allowDrop)
        window.addEventListener('drop', handlers.drop)
        window.addEventListener('dragend', handlers.settle)

        return () => {
            window.removeEventListener('dragenter', handlers.enter)
            window.removeEventListener('dragleave', handlers.leave)
            window.removeEventListener('dragover', allowDrop)
            window.removeEventListener('drop', handlers.drop)
            window.removeEventListener('dragend', handlers.settle)
            handlers.settle()
        }
    }, [slot, onAdd])

    return dragging
}

export function useAssetDropzone(capabilities: AssetCapabilities, onAdd: AddFiles): AssetDropzone {
    const slot = intakeSlot(capabilities)

    usePasteIntake(slot, onAdd)
    const dragging = useDragIntake(slot, onAdd)

    return { dragging, slot }
}

const OVERLAY_HIDDEN = { opacity: 0 }
const OVERLAY_SHOWN = { opacity: 1 }
const OVERLAY_FADE: Transition = { duration: 0.15 }

export interface AssetDropOverlayProps {
    readonly dropzone: AssetDropzone
}

/**
 * The full-window cue while files hover: a wash of canvas so the page visibly
 * changes state, and one pill saying what letting go will do. `aria-hidden`
 * and inert to the pointer — the drop itself lands on the window listeners.
 *
 * Portalled to the body because the composer panel's backdrop-filter would
 * otherwise become the containing block for `fixed` and pin this to the panel.
 */
export function AssetDropOverlay({ dropzone }: AssetDropOverlayProps) {
    return createPortal(
        <AnimatePresence>
            {dropzone.dragging && dropzone.slot !== null ? (
                <motion.div
                    animate={OVERLAY_SHOWN}
                    aria-hidden
                    className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-canvas/60"
                    exit={OVERLAY_HIDDEN}
                    initial={OVERLAY_HIDDEN}
                    transition={OVERLAY_FADE}
                >
                    <div className="glass-raised flex items-center gap-2.5 rounded-full px-5 py-3 text-sm text-ink">
                        <ImageUp aria-hidden className="size-4 text-muted" />
                        {dropzone.slot === 'reference'
                            ? 'Drop images to attach'
                            : 'Drop an image for the start frame'}
                    </div>
                </motion.div>
            ) : null}
        </AnimatePresence>,
        document.body,
    )
}
