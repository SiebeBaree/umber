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
import { useNotifications } from '../notifications/notifications-context'
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

/**
 * "1 of 2 images came out". Only image runs ask for more than one output, so
 * there is no video wording to reach here.
 */
function shortfallTitle(job: GenerationJob, made: number): string {
    return `${made} of ${job.count} images came out`
}

/** What to call a run that produced nothing at all. */
function failureTitle(job: GenerationJob): string {
    if (job.kind === 'video') {
        return 'Your video didn’t come out'
    }

    return job.count > 1 ? 'Your images didn’t come out' : 'Your image didn’t come out'
}

/**
 * The reasons, as one paragraph. Four calls failing the same way is one thing
 * that went wrong, not four, so identical sentences collapse.
 */
function reasonsOf(failures: readonly string[]): string {
    return [...new Set(failures)].join(' ')
}

/** Putting a run in flight, and the tally of runs that reached the gallery. */
function useStart({ adopt, commit, jobsRef }: Omit<ReturnType<typeof useJobs>, 'jobs'>) {
    const keys = useKeys()
    const { notify } = useNotifications()
    const [completions, setCompletions] = useState(0)

    const start = useCallback(
        (input: StartInput) => {
            const job = newJob(input)

            commit(pruned([...jobsRef.current, job]))

            void launchRun(job, input, keys.credentials, {
                adopt,
                // The run may have been cleared off the stage while it worked;
                // a result with no place to land is simply dropped.
                settle: (outcome, failures) => {
                    commit(
                        jobsRef.current.map((current) =>
                            current.id === outcome.id ? outcome : current,
                        ),
                    )

                    // Some of what was asked for landed and some did not. The
                    // stage shows what there is — one picture where two were
                    // asked for — and the notice accounts for the difference.
                    if (failures.length > 0 && outcome.status === 'done') {
                        notify(shortfallTitle(job, outcome.outputs.length), reasonsOf(failures))
                    }
                },
                // Nothing came of it, so the run leaves the stage rather than
                // holding a slot open for an apology.
                fail: (reason) => {
                    commit(jobsRef.current.filter((current) => current.id !== job.id))
                    notify(failureTitle(job), reason)
                },
                onPersisted: () => {
                    setCompletions((current) => current + 1)
                },
            })
        },
        [adopt, commit, jobsRef, keys, notify],
    )

    return { start, completions }
}

export function GenerationProvider({ children }: { readonly children: ReactNode }) {
    const { adopt, commit, jobs, jobsRef } = useJobs()
    const { completions, start } = useStart({ adopt, commit, jobsRef })

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
        () => ({ jobs, running, completions, start, clearFinished, clear }),
        [jobs, running, completions, start, clearFinished, clear],
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
