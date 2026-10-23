import { useCallback, useMemo } from 'react'

import { RECIPES, type Platform } from './platforms'
import { DEFAULT_PREFS, useTemplatePrefs, withRecent } from './template-prefs'
import {
    planned,
    removable,
    resized,
    showsPrompt,
    shuffled,
    swapped,
    type TemplateSet,
} from './template-set'
import { useRenderQueue } from './use-render-queue'
import { useSetState, type SetState } from './use-set-state'
import type { YouPhotoView } from './use-you-photos'

/**
 * The Templates set from planning to photos: which scenes it holds, the edits
 * made to them, and the renders that turn them into photos.
 */
export interface TemplateSetApi {
    readonly platform: Platform
    readonly count: number
    readonly set: TemplateSet | null
    /** True while anything in the set is queued or rendering. */
    readonly busy: boolean
    readonly plan: () => void
    readonly choosePlatform: (platform: Platform) => void
    readonly resize: (count: number) => void
    readonly remove: (id: string) => void
    readonly swap: (id: string) => void
    readonly shuffle: () => void
    readonly editScene: (id: string, scene: string) => void
    readonly startEditing: (id: string) => void
    readonly cancelEditing: (id: string) => void
    /** Renders every shot showing its prompt. */
    readonly make: () => void
    readonly redo: (id: string) => void
    readonly reset: () => void
}

type Prefs = ReturnType<typeof useTemplatePrefs>

/** Starting a set, and reshaping it by platform or size. */
function usePlanning(
    { change, commit, setRef }: SetState,
    { prefsRef, updatePrefs }: Prefs,
    drop: () => void,
) {
    const replan = useCallback(
        (platform: Platform, count: number) => {
            drop()
            commit(planned(platform, count, prefsRef.current.recent))
        },
        [commit, drop, prefsRef],
    )

    const plan = useCallback(() => {
        replan(prefsRef.current.platform, prefsRef.current.count)
    }, [prefsRef, replan])

    const choosePlatform = useCallback(
        (platform: Platform) => {
            const count = RECIPES[platform].defaultCount

            updatePrefs((current) => ({ ...current, platform, count }))

            if (setRef.current !== null) {
                replan(platform, count)
            }
        },
        [replan, setRef, updatePrefs],
    )

    const resize = useCallback(
        (count: number) => {
            updatePrefs((current) => ({ ...current, count }))
            change((current) => resized(current, count, prefsRef.current.recent))
        },
        [change, prefsRef, updatePrefs],
    )

    return useMemo(() => ({ plan, choosePlatform, resize }), [plan, choosePlatform, resize])
}

/** Changing which scenes the set holds, card by card or all at once. */
function useCardChanges({ change, setRef }: SetState, { prefsRef, updatePrefs }: Prefs) {
    const remove = useCallback(
        (id: string) => {
            change((current) => {
                const shots = current.shots.filter((shot) => shot.id !== id || !removable(shot))

                return shots.length === 0 ? null : { ...current, shots }
            })
            updatePrefs((current) => ({
                ...current,
                count: setRef.current?.shots.length ?? current.count,
            }))
        },
        [change, setRef, updatePrefs],
    )

    const swap = useCallback(
        (id: string) => {
            change((current) => swapped(current, id, prefsRef.current.recent))
        },
        [change, prefsRef],
    )

    const shuffle = useCallback(() => {
        change((current) => shuffled(current, prefsRef.current.recent))
    }, [change, prefsRef])

    return useMemo(() => ({ remove, swap, shuffle }), [remove, swap, shuffle])
}

/** Everything that touches one shot's prompt or sends it off to render. */
function useShotEditing(
    { changeShot, setRef }: SetState,
    enqueue: (ids: readonly string[]) => void,
) {
    const editScene = useCallback(
        (id: string, scene: string) => {
            changeShot(id, (shot) => ({ ...shot, scene }))
        },
        [changeShot],
    )

    const startEditing = useCallback(
        (id: string) => {
            changeShot(id, (shot) => ({ ...shot, editing: true }))
        },
        [changeShot],
    )

    // Back to the photo, and to the scene it was made from.
    const cancelEditing = useCallback(
        (id: string) => {
            changeShot(id, (shot) =>
                shot.photo === null
                    ? shot
                    : { ...shot, editing: false, card: shot.photo.card, scene: shot.photo.scene },
            )
        },
        [changeShot],
    )

    const make = useCallback(() => {
        enqueue(
            setRef.current?.shots.filter((shot) => showsPrompt(shot)).map((shot) => shot.id) ?? [],
        )
    }, [enqueue, setRef])

    const redo = useCallback(
        (id: string) => {
            enqueue([id])
        },
        [enqueue],
    )

    return useMemo(
        () => ({ editScene, startEditing, cancelEditing, make, redo }),
        [editScene, startEditing, cancelEditing, make, redo],
    )
}

export function useTemplateSet(photos: readonly YouPhotoView[]): TemplateSetApi {
    const prefs = useTemplatePrefs()
    const state = useSetState()
    const { updatePrefs } = prefs
    const { commit, set } = state

    const remember = useCallback(
        (sceneId: string) => {
            updatePrefs((current) => withRecent(current, sceneId))
        },
        [updatePrefs],
    )

    const { drop, enqueue } = useRenderQueue(photos, state, remember)
    const planning = usePlanning(state, prefs, drop)
    const cards = useCardChanges(state, prefs)
    const editing = useShotEditing(state, enqueue)

    const reset = useCallback(() => {
        drop()
        commit(null)
        updatePrefs(() => DEFAULT_PREFS)
    }, [commit, drop, updatePrefs])

    const { count, platform } = prefs.prefs
    const busy = set?.shots.some((shot) => shot.status !== 'idle') ?? false

    return useMemo(
        () => ({
            platform: set?.platform ?? platform,
            count: set?.shots.length ?? count,
            set,
            busy,
            reset,
            ...planning,
            ...cards,
            ...editing,
        }),
        [busy, cards, count, editing, planning, platform, reset, set],
    )
}
