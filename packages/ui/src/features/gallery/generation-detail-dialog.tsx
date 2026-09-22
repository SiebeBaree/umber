import { useState } from 'react'

import { ImageDetailDialog, type ImageDetails } from './image-detail-dialog'
import { useGalleryEntries } from './use-gallery-entries'

/** The create-stage detail gets the same live version history as the gallery. */
export function GenerationDetailDialog({
    image,
    onClose,
}: {
    readonly image: ImageDetails
    readonly onClose: () => void
}) {
    const { entries } = useGalleryEntries()
    const [selectedId, select] = useState(image.id)
    const versions = entries.flatMap((entry) => (entry.kind === 'creation' ? [entry.image] : []))
    const selected = versions.find((version) => version.id === selectedId) ?? image
    return (
        <ImageDetailDialog
            image={selected}
            onOpenChange={onClose}
            onSelectVersion={select}
            versions={versions}
        />
    )
}
