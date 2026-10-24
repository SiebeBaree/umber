import { useCallback, useEffect, useRef, useState } from 'react'

import { photoUrls, withShot, type Shot, type TemplateSet } from './template-set'

/**
 * The set and the one door into changing it. `commit` keeps a ref in step, so
 * renders landing out of order each see the others, and revokes the URL of any
 * photo that just left the set.
 */
export function useSetState() {
    const [set, setSet] = useState<TemplateSet | null>(null)
    const setRef = useRef<TemplateSet | null>(null)

    const commit = useCallback((next: TemplateSet | null) => {
        const kept = photoUrls(next)

        for (const url of photoUrls(setRef.current)) {
            if (!kept.has(url)) {
                URL.revokeObjectURL(url)
            }
        }

        setRef.current = next
        setSet(next)
    }, [])

    /** Changes the current set, if there is one. Returning null ends the set. */
    const change = useCallback(
        (update: (current: TemplateSet) => TemplateSet | null) => {
            if (setRef.current !== null) {
                commit(update(setRef.current))
            }
        },
        [commit],
    )

    const changeShot = useCallback(
        (id: string, update: (shot: Shot) => Shot) => {
            change((current) => withShot(current, id, update))
        },
        [change],
    )

    // Leaving the app is the one moment every photo URL goes at once.
    useEffect(
        () => () => {
            commit(null)
        },
        [commit],
    )

    return { set, setRef, commit, change, changeShot }
}

export type SetState = ReturnType<typeof useSetState>
