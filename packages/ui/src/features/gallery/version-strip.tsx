import { useCallback } from 'react'

import type { ImageDetails } from './image-detail-dialog'

export interface VersionNavigation {
    readonly versions?: readonly ImageDetails[] | undefined
    readonly onSelectVersion?: ((id: string) => void) | undefined
}

export function VersionStrip({
    image,
    versions,
    onSelectVersion,
}: VersionNavigation & { readonly image: ImageDetails }) {
    const family =
        versions
            ?.filter((version) => (version.rootId ?? version.id) === (image.rootId ?? image.id))
            .toSorted((a, b) => a.createdAt - b.createdAt) ?? []
    if (family.length <= 1 || onSelectVersion === undefined) return null
    return (
        <nav aria-label="Image versions" className="mt-5 flex shrink-0 gap-2 overflow-x-auto pb-1">
            {family.map((version) => (
                <VersionThumbnail
                    key={version.id}
                    version={version}
                    selected={version.id === image.id}
                    onSelect={onSelectVersion}
                />
            ))}
        </nav>
    )
}

function VersionThumbnail({
    version,
    selected,
    onSelect,
}: {
    readonly version: ImageDetails
    readonly selected: boolean
    readonly onSelect: (id: string) => void
}) {
    const select = useCallback(() => onSelect(version.id), [onSelect, version.id])
    return (
        <button
            aria-current={selected ? 'true' : undefined}
            aria-label={`Version ${version.version ?? 1}: ${version.prompt}`}
            className="w-14 shrink-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={select}
            type="button"
        >
            <img alt="" className="h-12 w-14 rounded-lg object-cover" src={version.url} />
            <span className={selected ? 'text-xs font-semibold text-accent' : 'text-xs text-muted'}>
                v{version.version ?? 1}
            </span>
        </button>
    )
}
