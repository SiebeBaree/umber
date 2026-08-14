import { useCallback, useState } from 'react'
import type { z } from 'zod'

/**
 * Reads a value that outlives the session. Anything already on disk is parsed
 * through `schema`, so a stale or hand-edited entry from an older build falls
 * back to the default rather than reaching the UI as the wrong shape.
 */
function read<Schema extends z.ZodType>(
    key: string,
    schema: Schema,
    fallback: z.output<Schema>,
): z.output<Schema> {
    try {
        const raw = globalThis.localStorage?.getItem(key)

        if (raw == null) {
            return fallback
        }

        const parsed = schema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data : fallback
    } catch {
        // Private-mode storage, quota errors and malformed JSON all mean the
        // same thing here: there is nothing usable to restore.
        return fallback
    }
}

function write(key: string, value: unknown): void {
    try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value))
    } catch {
        // Losing persistence is not worth breaking the interaction over.
    }
}

/**
 * Forgets a stored value, so the next read falls back to its default. Only the
 * settings page's erase reaches for this; everything else writes.
 */
export function clearPersistedState(key: string): void {
    try {
        globalThis.localStorage?.removeItem(key)
    } catch {
        // Nothing was persisted in the first place, so nothing to forget.
    }
}

/**
 * `useState`, except the value is restored on the next launch and validated on
 * the way in. Writes are synchronous, which is fine at this size — the composer
 * stores one small object.
 */
export function usePersistedState<Schema extends z.ZodType>(
    key: string,
    schema: Schema,
    fallback: z.output<Schema>,
): readonly [z.output<Schema>, (next: z.output<Schema>) => void] {
    const [value, setValue] = useState<z.output<Schema>>(() => read(key, schema, fallback))

    const store = useCallback(
        (next: z.output<Schema>) => {
            setValue(next)
            write(key, next)
        },
        [key],
    )

    return [value, store]
}
