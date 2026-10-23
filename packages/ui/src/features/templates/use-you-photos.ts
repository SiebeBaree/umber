import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
    clearYouPhotos,
    deleteYouPhoto,
    fitPhoto,
    listYouPhotos,
    MAX_YOU_PHOTOS,
    saveYouPhoto,
    type YouPhoto,
} from './you-photos'

/** One of the user's photos, as the dialog shows it and a render sends it. */
export interface YouPhotoView {
    readonly id: string
    /** An object URL over the stored blob; owned and revoked by this hook. */
    readonly url: string
    /** What goes to the provider as a reference image. */
    readonly file: File
}

export interface YouPhotosApi {
    /** False until storage has answered, so nothing claims there are no photos yet. */
    readonly ready: boolean
    readonly photos: readonly YouPhotoView[]
    /** Why the last add left something out, if it did. */
    readonly error: string | null
    readonly add: (files: readonly File[]) => Promise<void>
    readonly remove: (id: string) => void
    readonly clear: () => Promise<void>
}

function toView(photo: YouPhoto): YouPhotoView {
    return {
        id: photo.id,
        url: URL.createObjectURL(photo.image),
        file: new File([photo.image], `you-${photo.id.slice(0, 8)}.jpg`, {
            type: photo.image.type,
        }),
    }
}

/**
 * The stored photos plus the URLs they are shown through. `commit` keeps a ref
 * in step with state, so adds that land one after another each see the last,
 * and revokes the URL of whatever just left.
 */
function usePhotoList() {
    const [photos, setPhotos] = useState<readonly YouPhotoView[]>([])
    const photosRef = useRef<readonly YouPhotoView[]>(photos)

    const commit = useCallback((next: readonly YouPhotoView[]) => {
        for (const photo of photosRef.current) {
            if (!next.includes(photo)) {
                URL.revokeObjectURL(photo.url)
            }
        }

        photosRef.current = next
        setPhotos(next)
    }, [])

    useEffect(
        () => () => {
            commit([])
        },
        [commit],
    )

    return { photos, photosRef, commit }
}

type PhotoList = ReturnType<typeof usePhotoList>

/** Reads the stored photos once, and says when that has happened. */
function useStoredPhotos(commit: PhotoList['commit']): boolean {
    const [ready, setReady] = useState(false)

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            try {
                const stored = await listYouPhotos()

                if (!cancelled) {
                    commit(stored.map((photo) => toView(photo)))
                }
            } finally {
                if (!cancelled) {
                    setReady(true)
                }
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [commit])

    return ready
}

/** Adding one picked file: shrunk, stored, then shown. */
function useAddOne({ commit, photosRef }: PhotoList, setError: (error: string | null) => void) {
    return useCallback(
        async (file: File) => {
            if (photosRef.current.length >= MAX_YOU_PHOTOS) {
                setError(`Umber keeps up to ${MAX_YOU_PHOTOS} photos of you.`)

                return
            }

            try {
                const photo: YouPhoto = {
                    id: crypto.randomUUID(),
                    image: await fitPhoto(file),
                    addedAt: Date.now(),
                }

                await saveYouPhoto(photo)
                commit([...photosRef.current, toView(photo)])
            } catch (reason: unknown) {
                setError(
                    reason instanceof Error ? reason.message : 'Umber couldn’t add this photo.',
                )
            }
        },
        [commit, photosRef, setError],
    )
}

export function useYouPhotos(): YouPhotosApi {
    const list = usePhotoList()
    const { commit, photos, photosRef } = list
    const ready = useStoredPhotos(commit)
    const [error, setError] = useState<string | null>(null)
    const addOne = useAddOne(list, setError)

    // One file at a time, so the cap counts each photo that actually landed.
    const add = useCallback(
        async (files: readonly File[]) => {
            setError(null)
            await files.reduce(
                (previous, file) => previous.then(() => addOne(file)),
                Promise.resolve(),
            )
        },
        [addOne],
    )

    const remove = useCallback(
        (id: string) => {
            setError(null)
            commit(photosRef.current.filter((photo) => photo.id !== id))
            void deleteYouPhoto(id)
        },
        [commit, photosRef],
    )

    const clear = useCallback(async () => {
        await clearYouPhotos()
        commit([])
        setError(null)
    }, [commit])

    return useMemo(
        () => ({ ready, photos, error, add, remove, clear }),
        [ready, photos, error, add, remove, clear],
    )
}
