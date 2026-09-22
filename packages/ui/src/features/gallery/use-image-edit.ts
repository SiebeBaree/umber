import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { useGeneration } from '../generate/generation-context'
import { useKeys } from '../keys/keys-context'
import { editConfiguration, editInput } from './edit-input'
import type { ImageDetails } from './image-detail-dialog'

export function useImageEdit(image: ImageDetails) {
    const [prompt, setPrompt] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [preparing, setPreparing] = useState(false)
    const submitting = useRef(false)
    const { jobs, start, running: runningCount } = useGeneration()
    const keys = useKeys()
    const config = editConfiguration(image)
    const running = jobs.some((job) => job.parentId === image.id && job.status === 'running')
    const connected =
        typeof config !== 'string' && keys.connectedProviders.has(config.model.provider)
    const disabled =
        preparing || running || runningCount >= 10 || !connected || prompt.trim() === ''
    const change = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value),
        [],
    )
    const submit = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (submitting.current || disabled) return
            submitting.current = true
            setPreparing(true)
            setError(null)
            try {
                start(await editInput(image, prompt))
            } catch (reason: unknown) {
                setError(
                    reason instanceof Error
                        ? reason.message
                        : 'Could not open this image for editing.',
                )
            } finally {
                submitting.current = false
                setPreparing(false)
            }
        },
        [disabled, image, prompt, start],
    )
    return { prompt, error, running, connected, disabled, change, submit, config }
}
