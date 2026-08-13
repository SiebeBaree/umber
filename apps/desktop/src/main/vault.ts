import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { app, ipcMain, safeStorage } from 'electron'

import { VAULT_CHANNELS, type VaultConnectionDto, type VaultSaveDto } from '../shared/bridge'

/**
 * Credential storage for the desktop shell.
 *
 * Secrets are encrypted with `safeStorage` — the OS keychain's key, so the
 * file on disk is useless off this machine — and kept in one JSON file in
 * `userData`. Only the display metadata (provider, key tail, date) is stored
 * in the clear. Where the OS offers no keystore (some Linux setups) the
 * payload falls back to plain base64, marked as such, which is still no worse
 * than what those setups' browsers do.
 */

interface VaultRecord {
    readonly keyTail: string
    readonly addedAt: string
    readonly scheme: 'safeStorage' | 'plain'
    /** The credentials JSON: encrypted or not per `scheme`, then base64. */
    readonly payload: string
}

interface VaultFile {
    readonly version: 1
    readonly entries: Record<string, VaultRecord>
}

const EMPTY: VaultFile = { version: 1, entries: {} }

function vaultPath(): string {
    return join(app.getPath('userData'), 'vault.json')
}

async function readVault(): Promise<VaultFile> {
    try {
        const raw = await readFile(vaultPath(), 'utf8')
        const parsed = JSON.parse(raw) as VaultFile

        return parsed.version === 1 && typeof parsed.entries === 'object' ? parsed : EMPTY
    } catch {
        // Missing file on first run; anything unreadable starts fresh too.
        return EMPTY
    }
}

async function writeVault(file: VaultFile): Promise<void> {
    const path = vaultPath()
    await mkdir(dirname(path), { recursive: true })

    // Write-then-rename, so a crash mid-write can't torch every stored key.
    const temporary = `${path}.tmp`
    await writeFile(temporary, JSON.stringify(file, null, 2), 'utf8')
    await rename(temporary, path)
}

function encrypt(
    credentials: Readonly<Record<string, string>>,
): Pick<VaultRecord, 'scheme' | 'payload'> {
    const json = JSON.stringify(credentials)

    if (safeStorage.isEncryptionAvailable()) {
        return {
            scheme: 'safeStorage',
            payload: safeStorage.encryptString(json).toString('base64'),
        }
    }

    return { scheme: 'plain', payload: Buffer.from(json, 'utf8').toString('base64') }
}

function decrypt(record: VaultRecord): Record<string, string> | null {
    try {
        const buffer = Buffer.from(record.payload, 'base64')
        const json =
            record.scheme === 'safeStorage'
                ? safeStorage.decryptString(buffer)
                : buffer.toString('utf8')

        const parsed = JSON.parse(json) as unknown

        return typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, string>)
            : null
    } catch {
        // A key encrypted under another OS user or a wiped keychain entry;
        // reporting it missing lets the UI ask for it again.
        return null
    }
}

function toConnection(providerId: string, record: VaultRecord): VaultConnectionDto {
    return { providerId, keyTail: record.keyTail, addedAt: record.addedAt }
}

/** A short printable string, or empty — nothing else crosses into the file. */
function cleanId(value: unknown): string {
    return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : ''
}

async function handleList(): Promise<readonly VaultConnectionDto[]> {
    const vault = await readVault()

    return Object.entries(vault.entries)
        .map(([providerId, record]) => toConnection(providerId, record))
        .toSorted((a, b) => a.addedAt.localeCompare(b.addedAt))
}

async function handleSave(entry: VaultSaveDto): Promise<VaultConnectionDto> {
    const providerId = cleanId(entry?.providerId)

    if (providerId === '' || typeof entry.credentials !== 'object') {
        throw new Error('Malformed vault entry')
    }

    const record: VaultRecord = {
        keyTail: typeof entry.keyTail === 'string' ? entry.keyTail.slice(-8) : '',
        addedAt: new Date().toISOString(),
        ...encrypt(entry.credentials),
    }

    const vault = await readVault()
    await writeVault({ ...vault, entries: { ...vault.entries, [providerId]: record } })

    return toConnection(providerId, record)
}

async function handleRemove(rawId: unknown): Promise<void> {
    const providerId = cleanId(rawId)
    const vault = await readVault()

    if (providerId === '' || !(providerId in vault.entries)) {
        return
    }

    const entries = { ...vault.entries }
    delete entries[providerId]
    await writeVault({ ...vault, entries })
}

async function handleCredentials(rawId: unknown): Promise<Record<string, string> | null> {
    const providerId = cleanId(rawId)
    const vault = await readVault()
    const record = providerId === '' ? undefined : vault.entries[providerId]

    return record === undefined ? null : decrypt(record)
}

export function registerVaultIpc(): void {
    ipcMain.handle(VAULT_CHANNELS.list, () => handleList())
    ipcMain.handle(VAULT_CHANNELS.save, (_event, entry: VaultSaveDto) => handleSave(entry))
    ipcMain.handle(VAULT_CHANNELS.remove, (_event, rawId: unknown) => handleRemove(rawId))
    ipcMain.handle(VAULT_CHANNELS.credentials, (_event, rawId: unknown) => handleCredentials(rawId))
}
