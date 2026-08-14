import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction,
} from 'react'

import { useGeneration } from '../generate/generation-context'
import { deleteCreations, listCreations, type CreationRecord } from './creations-db'
import type { GalleryImage } from './gallery-tile'
import type { MasonryItem } from './masonry'

/** Everything the masonry can hold: a stored creation, or a run in flight. */
export type GalleryEntry =
    | (MasonryItem & { readonly kind: 'creation'; readonly image: GalleryImage })
    | (MasonryItem & { readonly kind: 'pending'; readonly providerId: string })

export type CreationEntry = Extract<GalleryEntry, { kind: 'creation' }>

/** The narrowing the page's helpers all need: is this a stored creation? */
export function isCreation(entry: GalleryEntry): entry is CreationEntry {
    return entry.kind === 'creation'
}

function toGalleryImage(record: CreationRecord): GalleryImage {
    return {
        id: record.id,
        // Rows from before video existed carry no kind, and are all images.
        kind: record.kind ?? 'image',
        prompt: record.prompt,
        ratio: record.ratio,
        providerId: record.providerId,
        modelName: record.modelName,
        resolution: record.resolution,
        quality: record.quality,
        durationSeconds: record.durationSeconds,
        generationMs: record.generationMs,
        createdAt: record.createdAt,
        url: URL.createObjectURL(record.image),
        mediaType: record.image.type,
    }
}

/** Everything stored, as renderable images; an unreadable store reads empty. */
async function loadImages(): Promise<readonly GalleryImage[]> {
    try {
        const records = await listCreations()

        return records.map((record) => toGalleryImage(record))
    } catch {
        return []
    }
}

type ImagesState = readonly GalleryImage[] | null
type SetImages = Dispatch<SetStateAction<ImagesState>>

/**
 * Reloads the list whenever a run completes, and owns the object URLs while it
 * does: fresh ones are minted per load and the previous batch revoked only
 * after the new list has rendered, so no tile ever points at a dead URL.
 */
function useReload(
    completions: number,
    setImages: SetImages,
    urlsRef: MutableRefObject<readonly string[]>,
) {
    useEffect(() => {
        let cancelled = false

        const load = async () => {
            const next = await loadImages()

            if (cancelled) {
                // This load lost the race; nothing will ever render its URLs.
                for (const image of next) {
                    URL.revokeObjectURL(image.url)
                }

                return
            }

            const previous = urlsRef.current
            urlsRef.current = next.map((image) => image.url)
            setImages(next)

            for (const url of previous) {
                URL.revokeObjectURL(url)
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [completions, setImages, urlsRef])

    // The whole page's URLs are released only when the page goes away.
    useEffect(
        () => () => {
            for (const url of urlsRef.current) {
                URL.revokeObjectURL(url)
            }
            urlsRef.current = []
        },
        [urlsRef],
    )
}

/** The stored creations, plus the one mutation the gallery offers. */
function useCreationImages(completions: number) {
    const [images, setImages] = useState<ImagesState>(null)
    const urlsRef = useRef<readonly string[]>([])

    useReload(completions, setImages, urlsRef)

    /**
     * Drops creations — one, or a whole selection. The tiles go immediately —
     * waiting on the store would leave deleted pictures on screen — and the
     * rows are erased behind them; a failed erase leaves the files to reappear
     * on the next load, which is the honest outcome of a delete that did not
     * happen.
     */
    const remove = useCallback((ids: readonly string[]) => {
        const doomed = new Set(ids)

        setImages((current) => {
            const removed = current?.filter((image) => doomed.has(image.id)) ?? []

            if (removed.length === 0) {
                return current
            }

            const freedUrls = new Set(removed.map((image) => image.url))

            for (const url of freedUrls) {
                URL.revokeObjectURL(url)
            }

            urlsRef.current = urlsRef.current.filter((url) => !freedUrls.has(url))

            return current?.filter((image) => !doomed.has(image.id)) ?? null
        })

        void deleteCreations(ids)
    }, [])

    return { images, remove }
}

export interface GalleryEntries {
    /** False while the first load is still in flight. */
    readonly loaded: boolean
    readonly entries: readonly GalleryEntry[]
    readonly remove: (ids: readonly string[]) => void
}

/**
 * What the gallery shows, newest first: a run in flight leads the masonry as
 * skeletons — one per expected image, exactly where the results will land —
 * followed by everything stored.
 */
export function useGalleryEntries(): GalleryEntries {
    const generation = useGeneration()
    const { images, remove } = useCreationImages(generation.completions)
    const job = generation.activeJob

    const entries = useMemo<readonly GalleryEntry[]>(() => {
        const pending: readonly GalleryEntry[] =
            job?.status === 'running'
                ? Array.from({ length: job.count }, (_, index) => ({
                      kind: 'pending',
                      id: `${job.id}-pending-${index + 1}`,
                      ratio: job.ratio,
                      providerId: job.providerId,
                  }))
                : []

        return [
            ...pending,
            ...(images ?? []).map((image) => ({
                kind: 'creation' as const,
                id: image.id,
                ratio: image.ratio,
                image,
            })),
        ]
    }, [job, images])

    return { loaded: images !== null, entries, remove }
}
