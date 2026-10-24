/**
 * The user's own photos, which go along with every Templates render so the
 * model keeps their face. Kept in IndexedDB like the gallery, in a database of
 * their own so the gallery's schema never has to know about them.
 *
 * Environments without IndexedDB (tests) fall back to an in-memory map.
 */

export interface YouPhoto {
    readonly id: string
    readonly image: Blob
    readonly addedAt: number
}

/** Nano Banana Pro keeps at most five people consistent across references. */
export const MAX_YOU_PHOTOS = 5

const DB_NAME = 'umber-templates'
const DB_VERSION = 1
const STORE = 'you'

let memory: Map<string, YouPhoto> | null = null

function memoryStore(): Map<string, YouPhoto> {
    memory ??= new Map()

    return memory
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.addEventListener('upgradeneeded', () => {
            request.result.createObjectStore(STORE, { keyPath: 'id' })
        })
        request.addEventListener('success', () => {
            resolve(request.result)
        })
        request.addEventListener('error', () => {
            reject(request.error ?? new Error('IndexedDB open failed'))
        })
    })
}

/** Runs one transaction and settles when it commits, closing the db after. */
async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await openDb()

    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(STORE, mode)
            const request = run(transaction.objectStore(STORE))

            transaction.addEventListener('complete', () => {
                resolve(request.result)
            })
            transaction.addEventListener('abort', () => {
                reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
            })
        })
    } finally {
        db.close()
    }
}

export async function listYouPhotos(): Promise<readonly YouPhoto[]> {
    const photos =
        typeof indexedDB === 'undefined'
            ? [...memoryStore().values()]
            : await withStore<YouPhoto[]>('readonly', (store) => store.getAll())

    return photos.toSorted((a, b) => a.addedAt - b.addedAt)
}

export async function saveYouPhoto(photo: YouPhoto): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        memoryStore().set(photo.id, photo)

        return
    }

    await withStore('readwrite', (store) => store.put(photo))
}

export async function deleteYouPhoto(id: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        memoryStore().delete(id)

        return
    }

    await withStore('readwrite', (store) => store.delete(id))
}

/** Only Erase all data reaches for this. */
export async function clearYouPhotos(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        memoryStore().clear()

        return
    }

    await withStore('readwrite', (store) => store.clear())
}

/**
 * Longest edge a stored photo keeps. Plenty for a face, and five of them stay
 * well under Gemini's request size where five phone originals would not.
 */
const MAX_EDGE = 1536

/** Shrinks a picked file to `MAX_EDGE` as a JPEG, upright as the camera meant it. */
export async function fitPhoto(file: File): Promise<Blob> {
    const unreadable = new Error(`Umber couldn’t read ${file.name}. Try a JPEG or PNG.`)
    const bitmap = await createImageBitmap(file).catch(() => {
        throw unreadable
    })

    try {
        const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        const context = canvas.getContext('2d')

        if (context === null) {
            throw unreadable
        }

        // JPEG has no alpha, so transparent areas would otherwise turn black.
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob === null) {
                        reject(unreadable)
                    } else {
                        resolve(blob)
                    }
                },
                'image/jpeg',
                0.9,
            )
        })
    } finally {
        bitmap.close()
    }
}
