/**
 * Reading GitHub's "latest release" payload, kept free of Electron imports so
 * the parsing and the asset choice can be asserted in plain unit tests.
 *
 * Nothing here trusts the payload: it arrives over the network, so every field
 * is checked before it is used and anything unexpected collapses to "no news".
 */

import type { UmberOperatingSystem, UpdateStatusDto } from './bridge'
import { isNewerVersion, normalizeVersion } from './version'

/** The installer extension each platform's release carries. */
const INSTALLER_EXTENSION: Readonly<Record<UmberOperatingSystem, string>> = {
    macos: '.dmg',
    windows: '.exe',
    linux: '.appimage',
}

export interface ReleaseLookup {
    readonly status: UpdateStatusDto
    /**
     * Where the Update button should send the browser: the installer for this
     * machine when one can be identified beyond doubt, and the release page
     * itself otherwise. `null` when there is nothing to download.
     */
    readonly downloadUrl: string | null
}

/** What the app reports when it has no news: not an update, not an error. */
export const NO_UPDATE: ReleaseLookup = {
    status: { latestVersion: null, available: false },
    downloadUrl: null,
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
}

interface ReleaseAsset {
    readonly name: string
    readonly url: string
}

function readAssets(value: unknown): readonly ReleaseAsset[] {
    if (!Array.isArray(value)) {
        return []
    }

    const assets: ReleaseAsset[] = []

    for (const entry of value) {
        const record = asRecord(entry)
        if (record === null) {
            continue
        }

        const name = asString(record['name'])
        const url = asString(record['browser_download_url'])

        if (name !== null && url !== null) {
            assets.push({ name, url })
        }
    }

    return assets
}

/**
 * The installer for this machine, or `null` if the release does not name one
 * unambiguously — two candidates with nothing to tell them apart means the
 * caller should hand over the release page and let a human choose.
 *
 * The update metadata electron-builder publishes alongside the installers
 * (`latest*.yml`, `*.blockmap`) is filtered out by the extension match.
 */
export function pickInstaller(
    assets: readonly ReleaseAsset[],
    os: UmberOperatingSystem,
    arch: string,
): string | null {
    const extension = INSTALLER_EXTENSION[os]
    const candidates = assets.filter((asset) => asset.name.toLowerCase().endsWith(extension))

    if (candidates.length === 1) {
        return candidates[0]?.url ?? null
    }

    // Several installers means the release ships per-architecture builds, and
    // handing an x64 build to an arm64 machine is worse than showing the page.
    const forArch = candidates.filter((asset) => asset.name.toLowerCase().includes(arch))

    return forArch.length === 1 ? (forArch[0]?.url ?? null) : null
}

/**
 * Turns a decoded `/releases/latest` body into what the app should show.
 * Drafts and prereleases never count as an update: the release feed is the
 * public one, and anything marked unfinished is not for general machines.
 */
export function readLatestRelease(
    payload: unknown,
    currentVersion: string,
    os: UmberOperatingSystem,
    arch: string,
): ReleaseLookup {
    const release = asRecord(payload)

    if (release === null || release['draft'] === true || release['prerelease'] === true) {
        return NO_UPDATE
    }

    const tag = asString(release['tag_name'])

    if (tag === null) {
        return NO_UPDATE
    }

    const latestVersion = normalizeVersion(tag)

    if (!isNewerVersion(latestVersion, currentVersion)) {
        return { status: { latestVersion, available: false }, downloadUrl: null }
    }

    const installer = pickInstaller(readAssets(release['assets']), os, arch)

    return {
        status: { latestVersion, available: true },
        downloadUrl: installer ?? asString(release['html_url']),
    }
}
