import { readFile, rename, writeFile } from 'node:fs/promises'

export interface ApiPreferences {
    readonly enabled: boolean
}

export async function readPreferences(path: string): Promise<ApiPreferences> {
    try {
        const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'enabled' in parsed &&
            typeof parsed.enabled === 'boolean'
        ) {
            return { enabled: parsed.enabled }
        }
    } catch {
        // Missing or unreadable settings never open a listener.
    }
    return { enabled: false }
}

export async function writePreferences(path: string, preferences: ApiPreferences): Promise<void> {
    await writeFile(`${path}.tmp`, JSON.stringify(preferences), { mode: 0o600 })
    await rename(`${path}.tmp`, path)
}
