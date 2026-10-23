import type { GalleryImage } from '../gallery/gallery-tile'
import { pickScenes } from './pick-scenes'
import type { Platform } from './platforms'
import type { SceneCard } from './scenes'

/**
 * A set of planned photos and the pure changes made to one. The hook in
 * `use-template-set` owns the state and the renders; everything here just
 * returns the next set.
 */

export interface ShotPhoto {
    /** The landed photo, with an object URL owned by the set's hook. */
    readonly image: GalleryImage
    /** The scene it was rendered from, which cancelling an edit goes back to. */
    readonly card: SceneCard
    readonly scene: string
}

export interface Shot {
    readonly id: string
    readonly card: SceneCard
    /** The scene text as it stands, edits included. */
    readonly scene: string
    readonly status: 'idle' | 'queued' | 'rendering'
    readonly photo: ShotPhoto | null
    /** A rendered shot reopened as a prompt. Its photo stays until it is replaced. */
    readonly editing: boolean
}

export interface TemplateSet {
    readonly platform: Platform
    readonly shots: readonly Shot[]
}

/** A seed for each new pick, so shuffling twice gives two different sets. */
export function randomSeed(): number {
    return Math.floor(Math.random() * 2 ** 32)
}

export function freshShot(card: SceneCard): Shot {
    return {
        id: crypto.randomUUID(),
        card,
        scene: card.prompt,
        status: 'idle',
        photo: null,
        editing: false,
    }
}

/** Whether the shot shows its prompt card, which is also what Make renders. */
export function showsPrompt(shot: Shot): boolean {
    return shot.status === 'idle' && (shot.photo === null || shot.editing)
}

/** A planned card nobody has touched: the only kind Shuffle and shrinking replace. */
export function untouched(shot: Shot): boolean {
    return shot.status === 'idle' && shot.photo === null && shot.scene === shot.card.prompt
}

/** What the remove button may take: any card that isn't a photo or on its way to one. */
export function removable(shot: Shot): boolean {
    return shot.status === 'idle' && shot.photo === null
}

export function planned(platform: Platform, count: number, recent: readonly string[]): TemplateSet {
    const cards = pickScenes({ platform, count, recent, seed: randomSeed() })

    return { platform, shots: cards.map((card) => freshShot(card)) }
}

/**
 * Grows the set with new picks at the end, or drops untouched cards from the
 * end. Edits, photos and renders in progress are never given up to a stepper.
 */
export function resized(set: TemplateSet, count: number, recent: readonly string[]): TemplateSet {
    const { shots } = set

    if (count > shots.length) {
        const cards = pickScenes({
            platform: set.platform,
            count: count - shots.length,
            kept: shots.map((shot) => shot.card),
            recent,
            seed: randomSeed(),
        })

        return { ...set, shots: [...shots, ...cards.map((card) => freshShot(card))] }
    }

    let surplus = shots.length - count
    const kept = shots
        .toReversed()
        .filter((shot) => {
            if (surplus > 0 && untouched(shot)) {
                surplus -= 1

                return false
            }

            return true
        })
        .toReversed()

    return { ...set, shots: kept }
}

/** Puts a different scene in one shot's place. Its edits go with the old scene. */
export function swapped(set: TemplateSet, id: string, recent: readonly string[]): TemplateSet {
    const position = set.shots.findIndex((shot) => shot.id === id)
    const [card] = pickScenes({
        platform: set.platform,
        count: 1,
        kept: set.shots.map((shot) => shot.card),
        position,
        recent,
        seed: randomSeed(),
    })

    if (card === undefined) {
        return set
    }

    return {
        ...set,
        shots: set.shots.map((shot) =>
            shot.id === id ? { ...shot, card, scene: card.prompt } : shot,
        ),
    }
}

/**
 * New scenes for every untouched card. Edited, rendered and rendering ones keep
 * theirs, and the cards on screen count as recent so the shuffle shows
 * something new.
 */
export function shuffled(set: TemplateSet, recent: readonly string[]): TemplateSet {
    const avoid = [...recent, ...set.shots.map((shot) => shot.card.id)]
    const kept = set.shots.filter((shot) => !untouched(shot)).map((shot) => shot.card)

    return {
        ...set,
        shots: set.shots.map((shot, position) => {
            if (!untouched(shot)) {
                return shot
            }

            const [card] = pickScenes({
                platform: set.platform,
                count: 1,
                kept,
                position,
                recent: avoid,
                seed: randomSeed(),
            })

            if (card === undefined) {
                return shot
            }

            kept.push(card)

            return { ...shot, card, scene: card.prompt }
        }),
    }
}

export function withShot(set: TemplateSet, id: string, change: (shot: Shot) => Shot): TemplateSet {
    return { ...set, shots: set.shots.map((shot) => (shot.id === id ? change(shot) : shot)) }
}

/** The object URLs a set's photos are shown through. */
export function photoUrls(set: TemplateSet | null): ReadonlySet<string> {
    return new Set(
        set?.shots.flatMap((shot) => (shot.photo === null ? [] : [shot.photo.image.url])),
    )
}
