import { app, ipcMain, net, shell } from 'electron'

import { toOperatingSystem, UPDATE_CHANNELS, type UpdateStatusDto } from '../shared/bridge'
import { NO_UPDATE, readLatestRelease, type ReleaseLookup } from '../shared/release-feed'
import { rendererOnly } from './ipc-guard'
import { isAllowedExternalUrl } from './security'

/**
 * The update check.
 *
 * Umber is distributed as GitHub releases, so "is there a new version?" is one
 * unauthenticated GET against the release feed, compared with the version
 * `electron-builder` stamped into this build. There is no in-app installer yet:
 * an auto-updating macOS build has to be signed and notarised, and until there
 * is a signing identity the honest thing is to hand the download to the
 * browser. The renderer only ever learns *whether* there is an update, so
 * swapping in `electron-updater` later touches nothing but this file.
 *
 * The check runs in the main process rather than through the renderer's net
 * proxy on purpose: the proxy's allowlist is for provider APIs, and the UI has
 * no business being able to reach github.com.
 */

const RELEASE_FEED_URL = 'https://api.github.com/repos/SiebeBaree/umber/releases/latest'

/** Hosts `download` is willing to send the browser to. */
const DOWNLOAD_HOSTS: ReadonlySet<string> = new Set(['github.com', 'objects.githubusercontent.com'])

/** How long a look at the feed stays good for. Keeps a re-render off the wire. */
const CACHE_MS = 15 * 60 * 1000

const REQUEST_TIMEOUT_MS = 10_000

interface CachedLookup {
    readonly lookup: ReleaseLookup
    readonly at: number
}

let cached: CachedLookup | null = null

async function fetchLatestRelease(): Promise<ReleaseLookup> {
    const response = await net.fetch(RELEASE_FEED_URL, {
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': `Umber/${app.getVersion()}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    // 404 is the ordinary answer before the first release is published.
    if (!response.ok) {
        return NO_UPDATE
    }

    return readLatestRelease(
        await response.json(),
        app.getVersion(),
        toOperatingSystem(process.platform),
        process.arch,
    )
}

async function lookup(): Promise<ReleaseLookup> {
    const now = Date.now()

    if (cached !== null && now - cached.at < CACHE_MS) {
        return cached.lookup
    }

    try {
        const fresh = await fetchLatestRelease()
        cached = { lookup: fresh, at: now }
        return fresh
    } catch (error: unknown) {
        // Being offline is not a fault worth surfacing; the app simply has no
        // news. Cached so a flapping connection cannot spin the check.
        console.warn('Umber could not reach the release feed', error)
        cached = { lookup: NO_UPDATE, at: now }
        return NO_UPDATE
    }
}

async function check(): Promise<UpdateStatusDto> {
    return (await lookup()).status
}

/**
 * Opens the download for this machine in the browser. Re-checks first, because
 * the button may be pressed long after the status that revealed it was read.
 */
async function download(): Promise<void> {
    const { downloadUrl } = await lookup()

    if (downloadUrl === null) {
        return
    }

    let host: string

    try {
        host = new URL(downloadUrl).hostname
    } catch {
        return
    }

    // The URL came off the network, so it is checked against the same rules as
    // any other link the app is asked to open, plus the release hosts.
    if (!isAllowedExternalUrl(downloadUrl) || !DOWNLOAD_HOSTS.has(host)) {
        console.warn('Refused to open release download', downloadUrl)
        return
    }

    await shell.openExternal(downloadUrl)
}

export function registerUpdatesIpc(): void {
    ipcMain.handle(
        UPDATE_CHANNELS.check,
        rendererOnly(() => check()),
    )
    ipcMain.handle(
        UPDATE_CHANNELS.download,
        rendererOnly(() => download()),
    )
}
