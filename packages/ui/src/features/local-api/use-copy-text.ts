import { useCallback, useState } from 'react'

export function useCopyText(value: string) {
    const [copied, setCopied] = useState(false)
    const [failed, setFailed] = useState(false)
    const copy = useCallback(() => {
        const write = async () => {
            try {
                await navigator.clipboard.writeText(value)
                setCopied(true)
                setFailed(false)
            } catch {
                setFailed(true)
            }
        }
        void write()
    }, [value])
    const reset = useCallback(() => setCopied(false), [])
    return { copied, failed, copy, reset }
}
