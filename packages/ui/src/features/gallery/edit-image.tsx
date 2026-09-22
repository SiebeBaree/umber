import { ArrowUp } from 'lucide-react'

import { Button } from '../../components/ui/button'
import { estimateCost, formatCost } from '../create/pricing'
import type { ImageDetails } from './image-detail-dialog'
import { useImageEdit } from './use-image-edit'

/** Editing uses the selected output as its single reference and never mutates it. */
export function EditImage({ image }: { readonly image: ImageDetails }) {
    const edit = useImageEdit(image)
    if (image.kind !== 'image') return null
    if (typeof edit.config === 'string')
        return <p className="mt-5 text-xs text-muted">{edit.config}</p>
    const price = formatCost(estimateCost(edit.config.model, edit.config.settings, 1))
    return (
        <form className="mt-6 shrink-0" onSubmit={edit.submit}>
            <label className="text-[13px] font-medium" htmlFor={`edit-${image.id}`}>
                Continue editing
            </label>
            <div className="mt-2 rounded-2xl bg-ink/[0.03] p-3 inset-ring inset-ring-ink/[0.06] focus-within:inset-ring-accent/40">
                <textarea
                    className="min-h-16 w-full resize-y bg-transparent text-[13px] outline-none placeholder:text-muted"
                    id={`edit-${image.id}`}
                    onChange={edit.change}
                    placeholder="What would you like to change?"
                    value={edit.prompt}
                />
                <div className="flex items-center justify-between gap-2">
                    <output className="text-xs text-muted">
                        {edit.running ? 'Rendering your edit…' : price}
                    </output>
                    <Button
                        aria-label="Generate edit"
                        disabled={edit.disabled}
                        size="icon-sm"
                        type="submit"
                    >
                        <ArrowUp aria-hidden />
                    </Button>
                </div>
            </div>
            {edit.connected ? null : (
                <p className="mt-2 text-xs text-muted">
                    Connect this provider in Settings to edit.
                </p>
            )}
            {edit.error === null ? null : (
                <p className="mt-2 text-xs text-rose-600" role="alert">
                    {edit.error}
                </p>
            )}
        </form>
    )
}
