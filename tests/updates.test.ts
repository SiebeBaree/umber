import { expect, test } from 'vitest'

// Reached by path rather than through a package export: these are internals of
// the desktop shell's update check, and unit-testing them should not force
// them into anything's public surface.
import { readAppVersionArgument } from '../apps/desktop/src/shared/bridge'
import { pickInstaller, readLatestRelease } from '../apps/desktop/src/shared/release-feed'
import { compareVersions, isNewerVersion } from '../apps/desktop/src/shared/version'

function release(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        tag_name: 'v0.2.0',
        draft: false,
        prerelease: false,
        html_url: 'https://github.com/SiebeBaree/umber/releases/tag/v0.2.0',
        assets: [
            {
                name: 'Umber-0.2.0-arm64.dmg',
                browser_download_url: 'https://github.com/dl/Umber-0.2.0-arm64.dmg',
            },
            {
                name: 'Umber-0.2.0-x64.dmg',
                browser_download_url: 'https://github.com/dl/Umber-0.2.0-x64.dmg',
            },
            {
                name: 'Umber-0.2.0-x64.exe',
                browser_download_url: 'https://github.com/dl/Umber-0.2.0-x64.exe',
            },
            {
                name: 'latest-mac.yml',
                browser_download_url: 'https://github.com/dl/latest-mac.yml',
            },
        ],
        ...overrides,
    }
}

test('versions order by release number before prerelease tag', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    // A finished release outranks any of its own prereleases.
    expect(compareVersions('1.0.0', '1.0.0-beta.2')).toBe(1)
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
})

test('a tag that cannot be read is never an update', () => {
    expect(isNewerVersion('nightly', '0.1.0')).toBe(false)
    expect(isNewerVersion('', '0.1.0')).toBe(false)
    expect(isNewerVersion('v0.2.0', '0.1.0')).toBe(true)
})

test('a newer release reports the version and the installer for this machine', () => {
    const lookup = readLatestRelease(release(), '0.1.0', 'macos', 'arm64')

    expect(lookup.status).toEqual({ latestVersion: '0.2.0', available: true })
    expect(lookup.downloadUrl).toBe('https://github.com/dl/Umber-0.2.0-arm64.dmg')
})

test('the running version and anything older are not an update', () => {
    expect(readLatestRelease(release(), '0.2.0', 'macos', 'arm64').status).toEqual({
        latestVersion: '0.2.0',
        available: false,
    })
    expect(readLatestRelease(release(), '0.3.0', 'macos', 'arm64').status.available).toBe(false)
})

test('drafts, prereleases and junk payloads are no news at all', () => {
    for (const payload of [
        release({ draft: true }),
        release({ prerelease: true }),
        release({ tag_name: undefined }),
        'not a release',
        null,
    ]) {
        expect(readLatestRelease(payload, '0.1.0', 'linux', 'x64').status).toEqual({
            latestVersion: null,
            available: false,
        })
    }
})

test('an unmatched platform falls back to the release page', () => {
    // No AppImage in the release, so there is nothing to hand a Linux machine
    // but the page listing what there is.
    const lookup = readLatestRelease(release(), '0.1.0', 'linux', 'x64')

    expect(lookup.downloadUrl).toBe('https://github.com/SiebeBaree/umber/releases/tag/v0.2.0')
})

test('the installer choice ignores update metadata and unmatched architectures', () => {
    const assets = [
        { name: 'Umber-0.2.0-arm64.dmg', url: 'arm64-dmg' },
        { name: 'Umber-0.2.0-x64.dmg', url: 'x64-dmg' },
        { name: 'Umber-0.2.0-arm64.dmg.blockmap', url: 'blockmap' },
        { name: 'latest-mac.yml', url: 'manifest' },
    ]

    expect(pickInstaller(assets, 'macos', 'x64')).toBe('x64-dmg')
    // An architecture the release does not build for is not worth guessing at.
    expect(pickInstaller(assets, 'macos', 'ia32')).toBeNull()
    // A single candidate needs no architecture in its name to be the one.
    expect(pickInstaller([{ name: 'Umber.exe', url: 'exe' }], 'windows', 'x64')).toBe('exe')
})

test('the app version rides in on the preload command line', () => {
    expect(readAppVersionArgument(['electron', '--umber-app-version=0.1.0'])).toBe('0.1.0')
    expect(readAppVersionArgument(['electron', '--sandbox'])).toBeNull()
})
