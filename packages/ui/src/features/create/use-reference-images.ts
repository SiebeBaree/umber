import { useCallback, useEffect, useRef, useState } from 'react'

export interface ReferenceImage {
    readonly id: string
    readonly name: string
    /** An object URL; owned by this hook, which revokes it when the image goes away. */
    readonly previewUrl: string
    readonly file: File
}

export interface ReferenceImages {
    readonly images: readonly ReferenceImage[]
    readonly add: (files: FileList) => void
    readonly remove: (id: string) => void
}

/**
 * Holds the reference images attached to a prompt, together with the object URLs
 * used to preview them. Object URLs pin their blob in memory until revoked, so
 * every removal — and unmounting the composer — releases them.
 */
export function useReferenceImages(): ReferenceImages {
    const [images, setImages] = useState<readonly ReferenceImage[]>([])

    // Mirrors `images` so the unmount cleanup below can read the current list
    // without re-running (and revoking live URLs) on every change.
    const imagesRef = useRef<readonly ReferenceImage[]>(images)

    useEffect(() => {
        imagesRef.current = images
    }, [images])

    useEffect(
        () => () => {
            for (const image of imagesRef.current) {
                URL.revokeObjectURL(image.previewUrl)
            }
        },
        [],
    )

    const add = useCallback((files: FileList) => {
        const added = [...files]
            .filter((file) => file.type.startsWith('image/'))
            .map((file) => ({
                id: crypto.randomUUID(),
                name: file.name,
                previewUrl: URL.createObjectURL(file),
                file,
            }))

        if (added.length > 0) {
            setImages((current) => [...current, ...added])
        }
    }, [])

    const remove = useCallback((id: string) => {
        setImages((current) => {
            const removed = current.find((image) => image.id === id)

            if (removed === undefined) {
                return current
            }

            URL.revokeObjectURL(removed.previewUrl)
            return current.filter((image) => image.id !== id)
        })
    }, [])

    return { images, add, remove }
}
