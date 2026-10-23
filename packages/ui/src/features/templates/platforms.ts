import type { AspectRatio } from '../create/catalog'

/**
 * The profiles Templates makes photos for, and what a believable set looks
 * like on each. The scene picker reads these; nothing else needs to know a
 * platform exists.
 */

export const PLATFORMS = ['linkedin', 'instagram', 'tinder'] as const

export type Platform = (typeof PLATFORMS)[number]

/** What a photo is for within a set, which is what recipes count. */
export type Slot = 'face' | 'full-body' | 'hobby' | 'social' | 'travel' | 'everyday'

export interface PlatformRecipe {
    readonly id: Platform
    readonly name: string
    readonly ratio: AspectRatio
    readonly defaultCount: number
    /**
     * The slots the first photos of a set fill, in order. Tinder's first photo
     * has to be a clear face; past the opening, the picker chooses freely.
     */
    readonly opening: readonly Slot[]
    /** Most photos of one slot a set may hold, where a platform cares. */
    readonly limits: Partial<Readonly<Record<Slot, number>>>
}

export const RECIPES: Readonly<Record<Platform, PlatformRecipe>> = {
    linkedin: {
        id: 'linkedin',
        name: 'LinkedIn',
        // Square: it is the profile picture itself.
        ratio: '1:1',
        defaultCount: 4,
        opening: ['face'],
        limits: {},
    },
    instagram: {
        id: 'instagram',
        name: 'Instagram',
        ratio: '3:4',
        defaultCount: 8,
        opening: ['everyday', 'travel', 'hobby'],
        // The place carries an Instagram photo, not the face.
        limits: { face: 2 },
    },
    tinder: {
        id: 'tinder',
        name: 'Tinder',
        ratio: '3:4',
        defaultCount: 6,
        opening: ['face', 'full-body', 'hobby', 'social', 'hobby', 'travel'],
        // Friends in these are strangers the model made up; two is plenty.
        limits: { social: 2 },
    },
}

/** The most photos one set can hold. */
export const MAX_SET_SIZE = 12
