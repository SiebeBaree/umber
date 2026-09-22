import { ArrowLeft } from 'lucide-react'
import { useCallback, useId, useState } from 'react'

import { Button } from '../../components/ui/button'
import { DetailActions } from './detail-actions'
import { DetailRows } from './detail-rows'
import { EditImage } from './edit-image'
import type { DeleteRequest } from './gallery-tile'
import type { ImageDetails } from './image-detail-dialog'
import { PromptDetails, PromptReader } from './prompt-details'
import { VersionStrip, type VersionNavigation } from './version-strip'

interface DetailPanelProps extends VersionNavigation {
    readonly image: ImageDetails
    readonly onClose: () => void
    readonly onDelete?: DeleteRequest | undefined
}

/** The record beside the picture, and what one can do with it. */
export function DetailPanel({
    image,
    onClose,
    onDelete,
    versions,
    onSelectVersion,
}: DetailPanelProps) {
    const triggerId = useId()
    const [reading, setReading] = useState(false)
    const openPrompt = useCallback(() => setReading(true), [])
    const closePrompt = useCallback(() => setReading(false), [])

    return (
        <div className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden p-5 sm:w-[21rem] sm:p-6">
            {reading ? (
                <PromptReader triggerId={triggerId} prompt={image.prompt} onClose={closePrompt} />
            ) : null}
            <div className={reading ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
                <div className="shrink-0">
                    <Button aria-label="Close" onClick={onClose} size="icon-sm" variant="ghost">
                        <ArrowLeft aria-hidden />
                    </Button>
                </div>

                <PromptDetails triggerId={triggerId} prompt={image.prompt} onRead={openPrompt} />
                <DetailActions image={image} onDelete={onDelete} />
                <VersionStrip image={image} versions={versions} onSelectVersion={onSelectVersion} />

                <div className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]">
                    <EditImage key={image.id} image={image} />

                    <h3 className="mt-7 shrink-0 text-[11px] font-semibold tracking-wide text-muted uppercase">
                        Details
                    </h3>
                    <DetailRows image={image} />
                </div>
            </div>
        </div>
    )
}
