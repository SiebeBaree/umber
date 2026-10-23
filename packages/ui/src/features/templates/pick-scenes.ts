import { RECIPES, type Platform } from './platforms'
import { SCENES, type SceneCard } from './scenes'

/**
 * Choosing which scenes make up a set. Pure and seeded, so a set can be
 * reproduced in a test and nothing here touches state.
 *
 * Each pick takes the card that overlaps least with what the set already holds,
 * weighing a repeated place over a repeated light over a repeated framing. The
 * deck is small enough that the greedy choice is also a good one, and once the
 * deck runs out of fresh combinations the picker repeats rather than fails.
 */

export interface PickOptions {
    readonly platform: Platform
    /** How many new cards to pick. */
    readonly count: number
    readonly seed: number
    /** Cards already in the set, which new picks avoid and are spread against. */
    readonly kept?: readonly SceneCard[]
    /**
     * The position the first new card takes in the set, which decides which of
     * the recipe's opening slots it fills. Defaults to just after `kept`.
     */
    readonly position?: number
    /** Ids from recent sets. They come back only once nothing fresher fits. */
    readonly recent?: readonly string[]
}

/** A pick from recent sets has to lose to anything else that fits. */
const RECENT_PENALTY = 1000

/** One selfie in a set reads as a person; two read as a feed of selfies. */
const MAX_SELFIES = 1

/** Mulberry32: small, fast and plenty random for shuffling a deck. */
function seeded(seed: number): () => number {
    let state = seed >>> 0

    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed

        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
    }
}

function overlap(card: SceneCard, chosen: readonly SceneCard[]): number {
    return chosen.reduce(
        (total, other) =>
            total +
            (other.place === card.place ? 3 : 0) +
            (other.light === card.light ? 2 : 0) +
            (other.framing === card.framing ? 1 : 0),
        0,
    )
}

/** Whether adding `card` keeps the set inside the recipe's limits. */
function withinLimits(card: SceneCard, chosen: readonly SceneCard[], platform: Platform): boolean {
    const limit = RECIPES[platform].limits[card.slot]
    const sameSlot = chosen.filter((other) => other.slot === card.slot).length
    const selfies = chosen.filter((other) => other.shotBy === 'selfie').length

    return (
        (limit === undefined || sameSlot < limit) &&
        (card.shotBy !== 'selfie' || selfies < MAX_SELFIES)
    )
}

function pickOne(
    platform: Platform,
    position: number,
    chosen: readonly SceneCard[],
    recent: ReadonlySet<string>,
    random: () => number,
): SceneCard | undefined {
    const unused = SCENES.filter(
        (card) =>
            card.platforms.includes(platform) && !chosen.some((other) => other.id === card.id),
    )
    const allowed = unused.filter((card) => withinLimits(card, chosen, platform))
    // Limits give way before the set comes up short.
    const fitting = allowed.length > 0 ? allowed : unused

    const wanted = RECIPES[platform].opening[position]
    const inSlot = fitting.filter((card) => card.slot === wanted)
    const candidates = inSlot.length > 0 ? inSlot : fitting

    const scored = candidates.map((card) => ({
        card,
        score: overlap(card, chosen) + (recent.has(card.id) ? RECENT_PENALTY : 0),
    }))
    const best = Math.min(...scored.map((entry) => entry.score))
    const tied = scored.filter((entry) => entry.score === best)

    return tied[Math.floor(random() * tied.length)]?.card
}

/**
 * Picks `count` new cards for a set, in order. Returns fewer only when the
 * platform's whole deck is already in the set.
 */
export function pickScenes({
    count,
    kept = [],
    platform,
    position = kept.length,
    recent = [],
    seed,
}: PickOptions): readonly SceneCard[] {
    const random = seeded(seed)
    const recentIds = new Set(recent)
    const picked: SceneCard[] = []

    for (let index = 0; index < count; index++) {
        const card = pickOne(platform, position + index, [...kept, ...picked], recentIds, random)

        if (card === undefined) {
            break
        }

        picked.push(card)
    }

    return picked
}
