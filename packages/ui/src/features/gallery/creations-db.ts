import type { AspectRatio } from '../create/catalog'

/**
 * Finished creations, persisted in IndexedDB so the gallery survives a
 * restart. IndexedDB rather than the shell: it stores blobs natively, works in
 * every shell the UI runs in, and Electron persists it in the profile
 * directory like any other site data.
 *
 * Environments without IndexedDB (tests) fall back to an in-memory map, which
 * keeps callers oblivious at the cost of persistence they don't need.
 */

export interface CreationRecord {
    readonly id: string
    readonly prompt: string
    readonly providerId: string
    readonly modelId: string
    readonly modelName: string
    readonly ratio: AspectRatio
    /**
     * The settings the run was made with. Optional because rows written before
     * the detail view existed carry neither, and a stored creation is never
     * rewritten — the detail view leaves out what a row cannot answer.
     */
    readonly resolution?: string
    readonly quality?: string
    /** Epoch milliseconds; the gallery sorts newest first on this. */
    readonly createdAt: number
    readonly image: Blob
}

const DB_NAME = 'umber'
const DB_VERSION = 1
const STORE = 'creations'

let memory: Map<string, CreationRecord> | null = null

function memoryStore(): Map<string, CreationRecord> {
    memory ??= new Map()

    return memory
}

function openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(null)
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.addEventListener('upgradeneeded', () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
                request.result.createObjectStore(STORE, { keyPath: 'id' })
            }
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
    run: (store: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | null> {
    const db = await openDb()

    if (db === null) {
        return null
    }

    try {
        return await new Promise<T | null>((resolve, reject) => {
            const transaction = db.transaction(STORE, mode)
            const request = run(transaction.objectStore(STORE))

            transaction.addEventListener('complete', () => {
                resolve(request === null ? null : request.result)
            })
            transaction.addEventListener('error', () => {
                reject(transaction.error ?? new Error('IndexedDB transaction failed'))
            })
        })
    } finally {
        db.close()
    }
}

export async function listCreations(): Promise<readonly CreationRecord[]> {
    if (typeof indexedDB === 'undefined') {
        return [...memoryStore().values()].toSorted((a, b) => b.createdAt - a.createdAt)
    }

    const records = (await withStore<CreationRecord[]>('readonly', (store) => store.getAll())) ?? []

    return records.toSorted((a, b) => b.createdAt - a.createdAt)
}

export async function saveCreations(records: readonly CreationRecord[]): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        for (const record of records) {
            memoryStore().set(record.id, record)
        }

        return
    }

    await withStore('readwrite', (store) => {
        for (const record of records) {
            store.put(record)
        }

        return null
    })
}

export async function deleteCreation(id: string): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        memoryStore().delete(id)

        return
    }

    await withStore('readwrite', (store) => store.delete(id))
}
