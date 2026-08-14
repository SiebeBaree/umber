/**
 * Version comparison for the update check, kept free of Electron imports so the
 * one piece of real logic behind "is there a new Umber?" can be asserted in
 * plain unit tests.
 *
 * Only the subset of semver the app actually publishes is understood:
 * `major.minor.patch` with an optional prerelease tag. Build metadata is
 * ignored, because it does not affect precedence.
 */

interface ParsedVersion {
    readonly major: number
    readonly minor: number
    readonly patch: number
    /** `null` for a plain release, which always outranks its prereleases. */
    readonly prerelease: string | null
}

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\da-z.-]+))?/iu

/** Strips the `v` a git tag conventionally carries. */
export function normalizeVersion(version: string): string {
    return version.trim().replace(/^v/iu, '')
}

function parseVersion(version: string): ParsedVersion | null {
    const match = VERSION_PATTERN.exec(version.trim())

    if (match === null) {
        return null
    }

    const [, major, minor, patch, prerelease] = match

    if (major === undefined || minor === undefined || patch === undefined) {
        return null
    }

    return {
        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        prerelease: prerelease ?? null,
    }
}

function sign(difference: number): number {
    if (difference === 0) {
        return 0
    }

    return difference < 0 ? -1 : 1
}

const NUMERIC_IDENTIFIER = /^\d+$/u

/**
 * One pair of dot-separated prerelease identifiers. Numeric ones compare
 * numerically and always rank below alphanumeric ones, which compare as text.
 */
function compareIdentifier(left: string, right: string): number {
    const leftIsNumeric = NUMERIC_IDENTIFIER.test(left)
    const rightIsNumeric = NUMERIC_IDENTIFIER.test(right)

    if (leftIsNumeric && rightIsNumeric) {
        return sign(Number(left) - Number(right))
    }

    if (leftIsNumeric !== rightIsNumeric) {
        return leftIsNumeric ? -1 : 1
    }

    if (left === right) {
        return 0
    }

    return left < right ? -1 : 1
}

/**
 * Semver's prerelease precedence: identifiers compared one by one, and a
 * shorter run of them losing to a longer one that matches it so far.
 */
function comparePrerelease(left: string | null, right: string | null): number {
    if (left === right) {
        return 0
    }

    // A version without a prerelease tag is the finished one, so it wins.
    if (left === null) {
        return 1
    }

    if (right === null) {
        return -1
    }

    const leftParts = left.split('.')
    const rightParts = right.split('.')

    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
        const leftPart = leftParts[index]
        const rightPart = rightParts[index]

        if (leftPart === undefined) {
            return -1
        }

        if (rightPart === undefined) {
            return 1
        }

        const difference = compareIdentifier(leftPart, rightPart)

        if (difference !== 0) {
            return difference
        }
    }

    return 0
}

/**
 * `-1`, `0` or `1`, the way a sort comparator reports it. Anything that does
 * not parse compares as equal, so an unreadable tag can never be mistaken for
 * an update.
 */
export function compareVersions(left: string, right: string): number {
    const a = parseVersion(left)
    const b = parseVersion(right)

    if (a === null || b === null) {
        return 0
    }

    const release = sign(a.major - b.major) || sign(a.minor - b.minor) || sign(a.patch - b.patch)

    return release === 0 ? comparePrerelease(a.prerelease, b.prerelease) : release
}

/** Whether `candidate` is a version the machine running `current` should move to. */
export function isNewerVersion(candidate: string, current: string): boolean {
    return compareVersions(candidate, current) > 0
}
