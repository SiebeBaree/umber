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
    /** Why loading, the last add or the last removal went wrong, if one did. */
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

/**
 * Reads the stored photos once, and says when that has happened. A failed read
 * never turns ready, so an empty list can't pass for "no photos yet".
 */
function useStoredPhotos(
    commit: PhotoList['commit'],
    setError: (error: string | null) => void,
): boolean {
    const [ready, setReady] = useState(false)

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            try {
                const stored = await listYouPhotos()

                if (!cancelled) {
                    commit(stored.map((photo) => toView(photo)))
                    setReady(true)
                }
            } catch {
                if (!cancelled) {
                    setError('Umber couldn’t read your photos. Restart Umber and try again.')
                }
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [commit, setError])

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
    const [error, setError] = useState<string | null>(null)
    const ready = useStoredPhotos(commit, setError)
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

    // Off the screen only once it's out of storage, or it would come back on
    // the next launch.
    const remove = useCallback(
        (id: string) => {
            const run = async () => {
                try {
                    await deleteYouPhoto(id)
                    commit(photosRef.current.filter((photo) => photo.id !== id))
                } catch {
                    setError('Umber couldn’t remove this photo. Try again.')
                }
            }

            setError(null)
            void run()
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
