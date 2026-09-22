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
    readonly parentId?: string | undefined
    readonly rootId?: string | undefined
    readonly version?: number | undefined
    /** Estimate captured at generation time, in USD. Null means unknown. */
    readonly estimatedCost?: number | null | undefined
    /** Absent on rows stored before video existed, which are all images. */
    readonly kind?: 'image' | 'video'
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
    /** Clip length in seconds; only video rows carry one. */
    readonly durationSeconds?: number
    /**
     * How long the run took, in milliseconds, from pressing send to the file
     * arriving. Absent on rows stored before it was recorded.
     */
    readonly generationMs?: number | undefined
    /** Epoch milliseconds; the gallery sorts newest first on this. */
    readonly createdAt: number
    /** The file itself. Named for the store's image-only beginnings; video
     * rows keep their clip here too. */
    readonly image: Blob
}

const DB_NAME = 'umber'
const DB_VERSION = 2
const STORE = 'creations'
const USAGE_STORE = 'usage'

export type UsageRecord = Pick<
    CreationRecord,
    | 'id'
    | 'modelId'
    | 'modelName'
    | 'createdAt'
    | 'generationMs'
    | 'estimatedCost'
    | 'rootId'
    | 'version'
>
const usageMemory = new Map<string, UsageRecord>()

function usageOf(record: CreationRecord): UsageRecord {
    const { id, modelId, modelName, createdAt, generationMs, estimatedCost } = record
    return {
        id,
        modelId,
        modelName,
        createdAt,
        generationMs,
        estimatedCost,
        rootId: record.rootId ?? id,
        version: record.version ?? 1,
    }
}

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
        request.addEventListener('upgradeneeded', () => {
            if (!request.result.objectStoreNames.contains(USAGE_STORE)) {
                const usage = request.result.createObjectStore(USAGE_STORE, { keyPath: 'id' })
                const cursor = request.transaction?.objectStore(STORE).openCursor()
                cursor?.addEventListener('success', () => {
                    const row = cursor.result
                    if (row !== null) {
                        usage.put(usageOf(row.value as CreationRecord))
                        row.continue()
                    }
                })
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
    run: (store: IDBObjectStore, usage: IDBObjectStore) => IDBRequest<T> | null,
): Promise<T | null> {
    const db = await openDb()

    if (db === null) {
        return null
    }

    try {
        return await new Promise<T | null>((resolve, reject) => {
            const transaction = db.transaction([STORE, USAGE_STORE], mode)
            const request = run(
                transaction.objectStore(STORE),
                transaction.objectStore(USAGE_STORE),
            )

            transaction.addEventListener('complete', () => {
                resolve(request === null ? null : request.result)
            })
            transaction.addEventListener('abort', () => {
                reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
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

/** Number versions at commit time, including concurrent edits of an older version. */
function versioned(record: CreationRecord, history: readonly UsageRecord[]): CreationRecord {
    if (record.parentId === undefined) return record
    const existing = history.find((entry) => entry.id === record.id)
    const latest = history
        .filter((entry) => entry.rootId === record.rootId)
        .reduce((maximum, entry) => Math.max(maximum, entry.version ?? 1), 1)
    return { ...record, version: existing?.version ?? latest + 1 }
}

export async function saveCreations(
    records: readonly CreationRecord[],
): Promise<readonly CreationRecord[]> {
    const saved: CreationRecord[] = []
    if (typeof indexedDB === 'undefined') {
        for (const record of records) {
            const next = versioned(record, [...usageMemory.values()])
            memoryStore().set(next.id, next)
            usageMemory.set(next.id, usageOf(next))
            saved.push(next)
        }

        return saved
    }

    await withStore('readwrite', (store, usage) => {
        const request = usage.getAll()
        request.addEventListener('success', () => {
            const history = request.result as UsageRecord[]
            for (const record of records) {
                const next = versioned(record, history)
                const metadata = usageOf(next)
                store.put(next)
                usage.put(metadata)
                history.push(metadata)
                saved.push(next)
            }
        })

        return null
    })
    return saved
}

export async function deleteCreations(ids: readonly string[]): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        for (const id of ids) {
            memoryStore().delete(id)
        }

        return
    }

    // One transaction for the lot: a multi-delete either lands or doesn't,
    // rather than erasing half a selection on the way to a failure.
    await withStore('readwrite', (store) => {
        for (const id of ids) {
            store.delete(id)
        }

        return null
    })
}

/** How many creations are stored, without reading a single blob back out. */
export async function countCreations(): Promise<number> {
    if (typeof indexedDB === 'undefined') {
        return memoryStore().size
    }

    return (await withStore<number>('readonly', (store) => store.count())) ?? 0
}

/** Empties the store. Only the settings page's erase reaches for this. */
export async function clearCreations(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
        memoryStore().clear()
        usageMemory.clear()

        return
    }

    await withStore('readwrite', (store, usage) => {
        store.clear()
        return usage.clear()
    })
}

/** Usage survives gallery deletion and is cleared by Erase all data. */
export async function listUsage(): Promise<readonly UsageRecord[]> {
    if (typeof indexedDB === 'undefined') return [...usageMemory.values()]
    return (await withStore<UsageRecord[]>('readonly', (_store, usage) => usage.getAll())) ?? []
}

export async function getCreation(id: string): Promise<CreationRecord | undefined> {
    if (typeof indexedDB === 'undefined') return memoryStore().get(id)
    return (
        (await withStore<CreationRecord | undefined>('readonly', (store) => store.get(id))) ??
        undefined
    )
}
