import { readFile, rename, writeFile } from 'node:fs/promises'

import type {
    LimitPeriod,
    LocalApiAccess,
    LocalApiKind,
    LocalApiSettings,
    SpendingLimit,
} from '@umber/ui/local-api'

export const DEFAULT_SETTINGS: LocalApiSettings = { enabled: false, access: 'images', limits: [] }

const ACCESS: readonly LocalApiAccess[] = ['images', 'videos', 'both']
/** Display order too: shortest window first, all time last. */
const PERIODS: readonly LimitPeriod[] = [1, 7, 30, null]

export function kindsOf(access: LocalApiAccess): readonly LocalApiKind[] {
    if (access === 'both') return ['image', 'video']
    return access === 'images' ? ['image'] : ['video']
}

function parseLimit(value: unknown): SpendingLimit {
    if (typeof value !== 'object' || value === null || !('usd' in value) || !('days' in value))
        throw new Error('A limit needs usd and days')
    const { days, usd } = value
    const period = PERIODS.find((candidate) => candidate === days)
    if (period === undefined) throw new Error('A limit period must be 1, 7, 30 or null')
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0 || usd > 1_000_000)
        throw new Error('A limit must be a positive amount in USD')
    return { usd, days: period }
}

/** Validates a partial settings update. Throws on any malformed field so nothing half-applies. */
export function parseSettingsPatch(value: unknown): Partial<LocalApiSettings> {
    if (typeof value !== 'object' || value === null) throw new Error('Settings must be an object')
    const patch: { -readonly [Key in keyof LocalApiSettings]?: LocalApiSettings[Key] } = {}
    if ('enabled' in value) {
        if (typeof value.enabled !== 'boolean') throw new Error('Enabled must be a boolean')
        patch.enabled = value.enabled
    }
    if ('access' in value) {
        const access = ACCESS.find((candidate) => candidate === value.access)
        if (access === undefined) throw new Error('Access must be images, videos or both')
        patch.access = access
    }
    if ('limits' in value) {
        if (!Array.isArray(value.limits)) throw new Error('Limits must be a list')
        // One limit per period; a later entry replaces an earlier one.
        const byPeriod = new Map(value.limits.map(parseLimit).map((limit) => [limit.days, limit]))
        patch.limits = PERIODS.flatMap((period) => byPeriod.get(period) ?? [])
    }
    return patch
}

export async function readSettings(path: string): Promise<LocalApiSettings> {
    try {
        return {
            ...DEFAULT_SETTINGS,
            ...parseSettingsPatch(JSON.parse(await readFile(path, 'utf8'))),
        }
    } catch {
        // Missing or unreadable settings never open a listener.
        return DEFAULT_SETTINGS
    }
}

/** Atomic and owner-only, for every file the local API keeps. */
export async function writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(`${path}.tmp`, JSON.stringify(value), { mode: 0o600 })
    await rename(`${path}.tmp`, path)
}
