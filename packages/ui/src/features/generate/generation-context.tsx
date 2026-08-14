import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'

import { useKeys } from '../keys/keys-context'
import { newJob, pruned, type GenerationJob, type StartInput } from './job'
import { launchRun } from './run'

/**
 * Every generation of this session and its outcome, shared app-wide: the
 * create page stacks them oldest to newest above the composer, and the gallery
 * mirrors the ones still working as pending tiles. Runs are independent —
 * sending a prompt never waits on the run before it.
 */

export type { GeneratedOutput, GenerationJob, StartInput } from './job'

export interface GenerationApi {
    /** Every run of this session still on the stage, oldest first. */
    readonly jobs: readonly GenerationJob[]
    /** How many runs are in flight right now. */
    readonly running: number
    /** Bumped when a run lands in the gallery, so galleries can re-query. */
    readonly completions: number
    readonly start: (input: StartInput) => void
    /** Takes one finished or failed run off the stage. */
    readonly dismiss: (jobId: string) => void
    /** Clears every run that has landed, leaving the ones still working. */
    readonly clearFinished: () => void
    /** Clears the whole stage, in flight or not. */
    readonly clear: () => void
}

const GenerationContext = createContext<GenerationApi | null>(null)

type HeldUrls = Map<string, readonly string[]>

/** Releases the files of every run that is no longer on the stage. */
function releaseGone(held: HeldUrls, kept: ReadonlySet<string>) {
    for (const [jobId, urls] of held) {
        if (kept.has(jobId)) {
            continue
        }

        for (const url of urls) {
            URL.revokeObjectURL(url)
        }

        held.delete(jobId)
    }
}

/** Leaving the app is the one moment every run is over at once. */
function useReleaseOnUnmount(held: HeldUrls) {
    useEffect(
        () => () => {
            releaseGone(held, new Set())
        },
        [held],
    )
}

/**
 * The stage, and the object URLs its runs hold.
 *
 * The list lives in a ref as well as in state, because runs land out of order
 * and each has to see what the others have already done — and because a run's
 * files are released the moment it leaves the stage, which is a decision only
 * the up-to-date list can make.
 */
function useJobs() {
    const [jobs, setJobs] = useState<readonly GenerationJob[]>([])
    const jobsRef = useRef<readonly GenerationJob[]>([])
    const urlsRef = useRef<HeldUrls>(new Map())

    const commit = useCallback((next: readonly GenerationJob[]) => {
        releaseGone(urlsRef.current, new Set(next.map((job) => job.id)))
        jobsRef.current = next
        setJobs(next)
    }, [])

    const adopt = useCallback((jobId: string, urls: readonly string[]) => {
        urlsRef.current.set(jobId, urls)

        // The run was cleared while it worked; nothing will ever show these.
        releaseGone(urlsRef.current, new Set(jobsRef.current.map((job) => job.id)))
    }, [])

    useReleaseOnUnmount(urlsRef.current)

    return { jobs, jobsRef, commit, adopt }
}

/** Putting a run in flight, and the tally of runs that reached the gallery. */
function useStart({ adopt, commit, jobsRef }: Omit<ReturnType<typeof useJobs>, 'jobs'>) {
    const keys = useKeys()
    const [completions, setCompletions] = useState(0)

    const start = useCallback(
        (input: StartInput) => {
            const job = newJob(input)

            commit(pruned([...jobsRef.current, job]))

            void launchRun(job, input, keys.credentials, {
                adopt,
                // The run may have been dismissed or cleared while it worked;
                // a result with no place on the stage is simply dropped.
                settle: (outcome) => {
                    commit(
                        jobsRef.current.map((current) =>
                            current.id === outcome.id ? outcome : current,
                        ),
                    )
                },
                onPersisted: () => {
                    setCompletions((current) => current + 1)
                },
            })
        },
        [adopt, commit, jobsRef, keys],
    )

    return { start, completions }
}

export function GenerationProvider({ children }: { readonly children: ReactNode }) {
    const { adopt, commit, jobs, jobsRef } = useJobs()
    const { completions, start } = useStart({ adopt, commit, jobsRef })

    const dismiss = useCallback(
        (jobId: string) => {
            commit(jobsRef.current.filter((job) => job.id !== jobId))
        },
        [commit, jobsRef],
    )

    // A run still working keeps its place: its skeletons are the only sign it
    // is happening, and clearing the clutter should not take that with it.
    const clearFinished = useCallback(() => {
        commit(jobsRef.current.filter((job) => job.status === 'running'))
    }, [commit, jobsRef])

    const clear = useCallback(() => {
        commit([])
    }, [commit])

    const running = jobs.filter((job) => job.status === 'running').length

    const value = useMemo<GenerationApi>(
        () => ({ jobs, running, completions, start, dismiss, clearFinished, clear }),
        [jobs, running, completions, start, dismiss, clearFinished, clear],
    )

    return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>
}

export function useGeneration(): GenerationApi {
    const api = useContext(GenerationContext)

    if (api === null) {
        throw new Error('useGeneration must be used inside a GenerationProvider')
    }

    return api
}
