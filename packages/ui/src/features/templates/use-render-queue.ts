import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'

import { toGalleryImage } from '../gallery/use-gallery-entries'
import { useGeneration } from '../generate/generation-context'
import { composePrompt } from './compose-prompt'
import type { Platform } from './platforms'
import { TEMPLATE_MODEL, templateSettings } from './template-model'
import type { Shot } from './template-set'
import type { SetState } from './use-set-state'
import type { YouPhotoView } from './use-you-photos'

/**
 * Rendering a set. Each photo is one run through the generation store like
 * any other, so it lands in the gallery and in usage, and a failure gets the
 * usual notification; here the shot just goes back to its prompt.
 */

/** Renders at once. Four parallel calls is what a 4-image run already makes. */
const MAX_RENDERS = 4

/** One shot, start to finish, landing in whatever the set looks like by then. */
function useRenderShot(
    photos: readonly YouPhotoView[],
    { changeShot, setRef }: SetState,
    remember: (sceneId: string) => void,
) {
    const { start } = useGeneration()
    const photosRef = useRef(photos)

    useEffect(() => {
        photosRef.current = photos
    }, [photos])

    return useCallback(
        async (shot: Shot, platform: Platform) => {
            const references = photosRef.current.map((photo) => photo.file)
            const result = await start({
                origin: 'templates',
                prompt: composePrompt(shot.scene, references.length),
                model: TEMPLATE_MODEL,
                settings: templateSettings(platform),
                references,
            })
            const record = 'error' in result ? undefined : result.records[0]

            // A new set replaced this one while it rendered; the photo is in the gallery.
            if (setRef.current?.shots.some((current) => current.id === shot.id) !== true) {
                return
            }

            if (record === undefined) {
                changeShot(shot.id, (current) => ({ ...current, status: 'idle' }))

                return
            }

            const photo = { image: toGalleryImage(record), card: shot.card, scene: shot.scene }

            changeShot(shot.id, (current) => ({
                ...current,
                status: 'idle',
                editing: false,
                photo,
            }))
            remember(shot.card.id)
        },
        [changeShot, remember, setRef, start],
    )
}

/** Starts queued shots while fewer than `MAX_RENDERS` are in flight. */
function usePump(
    { changeShot, setRef }: SetState,
    renderShot: ReturnType<typeof useRenderShot>,
    queue: MutableRefObject<string[]>,
) {
    const active = useRef(0)

    const pump = useCallback(() => {
        while (active.current < MAX_RENDERS) {
            const id = queue.current.shift()

            if (id === undefined) {
                return
            }

            const current = setRef.current
            const shot = current?.shots.find((candidate) => candidate.id === id)

            if (current != null && shot?.status === 'queued') {
                active.current += 1
                changeShot(id, (queued) => ({ ...queued, status: 'rendering' }))
                void renderShot(shot, current.platform).finally(() => {
                    active.current -= 1
                    pump()
                })
            }
        }
    }, [changeShot, queue, renderShot, setRef])

    return pump
}

/** A queue of shot ids, rendered a few at a time in the order they were asked for. */
export function useRenderQueue(
    photos: readonly YouPhotoView[],
    state: SetState,
    remember: (sceneId: string) => void,
) {
    const { change } = state
    const queue = useRef<string[]>([])
    const pump = usePump(state, useRenderShot(photos, state, remember), queue)

    const enqueue = useCallback(
        (ids: readonly string[]) => {
            change((current) => ({
                ...current,
                shots: current.shots.map((shot) =>
                    ids.includes(shot.id) ? { ...shot, status: 'queued' } : shot,
                ),
            }))
            queue.current.push(...ids)
            pump()
        },
        [change, pump],
    )

    /** Forgets what hasn't started. What is rendering finishes into the gallery. */
    const drop = useCallback(() => {
        queue.current = []
    }, [])

    return { enqueue, drop }
}
