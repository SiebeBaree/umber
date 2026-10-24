import { describe, expect, test } from 'vitest'

import { composePrompt, REALISM_RULES } from '../packages/ui/src/features/templates/compose-prompt'
import { pickScenes } from '../packages/ui/src/features/templates/pick-scenes'
import {
    MAX_SET_SIZE,
    PLATFORMS,
    RECIPES,
    type Platform,
} from '../packages/ui/src/features/templates/platforms'
import { SCENES, type SceneCard } from '../packages/ui/src/features/templates/scenes'
import {
    freshShot,
    resized,
    shuffled,
    type TemplateSet,
} from '../packages/ui/src/features/templates/template-set'

/**
 * Templates stands or falls on photos that don't look generated, and most of
 * that is decided before a render: which scenes a set holds and what every
 * prompt says. These pin those decisions down.
 */

const SEEDS = Array.from({ length: 200 }, (_, seed) => seed)

/** Words that pull a model toward the glossy look the deck exists to avoid. */
const GLOSSY = [
    'cinematic',
    'bokeh',
    '85mm',
    '50mm',
    'professional',
    '8k',
    '4k',
    'masterpiece',
    'stunning',
    'beautiful',
    'gorgeous',
    'golden hour',
    'depth of field',
    'shallow focus',
    'studio',
    'portrait mode',
    'dslr',
    'hdr',
    'flawless',
    'perfect',
    'background blur',
    'blurred background',
]

function count(cards: readonly SceneCard[], matches: (card: SceneCard) => boolean): number {
    return cards.filter((card) => matches(card)).length
}

function mostRepeated(cards: readonly SceneCard[], key: (card: SceneCard) => string): number {
    const tally = new Map<string, number>()

    for (const card of cards) {
        tally.set(key(card), (tally.get(key(card)) ?? 0) + 1)
    }

    return Math.max(...tally.values())
}

describe('the scene deck', () => {
    test('ids are unique, since recent sets are remembered by them', () => {
        expect(new Set(SCENES.map((card) => card.id)).size).toBe(SCENES.length)
    })

    test('no prompt asks for the glossy look', () => {
        for (const card of SCENES) {
            const prompt = card.prompt.toLowerCase()

            for (const word of GLOSSY) {
                expect(prompt, `${card.id} says "${word}"`).not.toContain(word)
            }
        }
    })

    test('every platform can fill its largest set', () => {
        for (const platform of PLATFORMS) {
            expect(
                count(SCENES, (card) => card.platforms.includes(platform)),
            ).toBeGreaterThanOrEqual(MAX_SET_SIZE)
        }
    })
})

describe('picking a set', () => {
    test('a set is the size asked for, with no card twice and none from another platform', () => {
        for (const platform of PLATFORMS) {
            for (const seed of SEEDS) {
                const set = pickScenes({ platform, count: MAX_SET_SIZE, seed })

                expect(set).toHaveLength(MAX_SET_SIZE)
                expect(new Set(set.map((card) => card.id)).size).toBe(MAX_SET_SIZE)
                expect(set.every((card) => card.platforms.includes(platform))).toBe(true)
            }
        }
    })

    test('the same seed plans the same set', () => {
        expect(pickScenes({ platform: 'tinder', count: 6, seed: 42 })).toEqual(
            pickScenes({ platform: 'tinder', count: 6, seed: 42 }),
        )
    })

    test('a Tinder set follows its recipe: face first, then the rest of the profile', () => {
        for (const seed of SEEDS) {
            const set = pickScenes({ platform: 'tinder', count: 6, seed })

            expect(set.map((card) => card.slot)).toEqual(RECIPES.tinder.opening)
        }
    })
})

describe('spreading a set', () => {
    test('limits hold even in the largest sets', () => {
        for (const seed of SEEDS) {
            const tinder = pickScenes({ platform: 'tinder', count: MAX_SET_SIZE, seed })
            const instagram = pickScenes({ platform: 'instagram', count: MAX_SET_SIZE, seed })

            expect(count(tinder, (card) => card.slot === 'social')).toBeLessThanOrEqual(2)
            expect(count(instagram, (card) => card.slot === 'face')).toBeLessThanOrEqual(2)

            for (const set of [tinder, instagram]) {
                expect(count(set, (card) => card.shotBy === 'selfie')).toBeLessThanOrEqual(1)
            }
        }
    })

    test('a default-sized set spreads its places and light', () => {
        const platforms: readonly Platform[] = ['instagram', 'tinder']

        for (const platform of platforms) {
            for (const seed of SEEDS) {
                const set = pickScenes({ platform, count: RECIPES[platform].defaultCount, seed })

                expect(mostRepeated(set, (card) => card.place)).toBeLessThanOrEqual(2)
                expect(mostRepeated(set, (card) => card.light)).toBeLessThanOrEqual(3)
            }
        }
    })

    test('recent scenes come back only once the fresh ones run out', () => {
        const first = pickScenes({ platform: 'linkedin', count: 4, seed: 1 })
        const recent = first.map((card) => card.id)
        const second = pickScenes({ platform: 'linkedin', count: 4, seed: 2, recent })

        expect(second.some((card) => recent.includes(card.id))).toBe(false)
    })
})

describe('changing a planned set', () => {
    const set: TemplateSet = {
        platform: 'instagram',
        shots: pickScenes({ platform: 'instagram', count: 4, seed: 7 }).map((card) =>
            freshShot(card),
        ),
    }
    const [first, second, third, fourth] = set.shots

    if (
        first === undefined ||
        second === undefined ||
        third === undefined ||
        fourth === undefined
    ) {
        throw new Error('the fixture needs four shots')
    }

    const touched: TemplateSet = {
        ...set,
        shots: [
            { ...first, scene: 'Edited by hand.' },
            { ...second, status: 'rendering' },
            third,
            fourth,
        ],
    }

    test('shuffle replaces only untouched cards', () => {
        const next = shuffled(touched, [])

        expect(next.shots[0]).toEqual(touched.shots[0])
        expect(next.shots[1]).toEqual(touched.shots[1])
        expect(next.shots.slice(2).map((shot) => shot.card.id)).not.toEqual(
            touched.shots.slice(2).map((shot) => shot.card.id),
        )
    })

    test('shrinking drops untouched cards from the end and keeps edits and renders', () => {
        const next = resized(touched, 1, [])

        expect(next.shots.map((shot) => shot.id)).toEqual([first.id, second.id])
    })
})

describe('prompts', () => {
    test('every prompt carries the identity and realism rules around the scene', () => {
        const prompt = composePrompt('  Sitting on a bench.  ', 3)

        expect(prompt.split('\n\n')).toEqual([
            expect.stringContaining(
                'Images 1 to 3 are reference photos of the person in this photo.',
            ),
            'Sitting on a bench.',
            REALISM_RULES,
        ])
    })

    test('one photo is described as one', () => {
        expect(composePrompt('A scene.', 1)).toMatch(/^Image 1 is a reference photo of the person/u)
    })
})
