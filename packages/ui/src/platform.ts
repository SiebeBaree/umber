/**
 * The shells Umber can run inside. The UI itself is identical everywhere; the
 * platform is only used for labelling and for platform-specific styling hooks.
 */
export const PLATFORMS = ['web', 'desktop'] as const

export type Platform = (typeof PLATFORMS)[number]

const PLATFORM_LABELS: Readonly<Record<Platform, string>> = {
    web: 'the web',
    desktop: 'the desktop',
}

/** Human-readable name for a platform, used in prose. */
export function platformLabel(platform: Platform): string {
    return PLATFORM_LABELS[platform]
}

/** Narrowing type guard, useful when a platform arrives from an untyped bridge. */
export function isPlatform(value: unknown): value is Platform {
    return typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value)
}
