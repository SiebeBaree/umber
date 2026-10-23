import { useCallback, useState } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { batchPrice, primaryAction } from './bar-action'
import { ConnectGoogleDialog, useConnectGoogle } from './connect-google'
import { SetControls } from './set-controls'
import { useTemplates } from './templates-context'
import { YouButton } from './you-button'
import { YouDialog } from './you-dialog'

/**
 * The composer of the Templates page: whose face, which profile, how many,
 * and the one button that moves the set along.
 */

export function TemplateBar() {
    const templates = useTemplates()
    const google = useConnectGoogle()
    const [youOpen, setYouOpen] = useState(false)

    const addPhotos = useCallback(() => {
        setYouOpen(true)
    }, [])

    const action = primaryAction(templates, google.connected, {
        connect: google.openDialog,
        addPhotos,
    })
    const price = batchPrice(templates)

    return (
        <div className="glass flex w-full flex-wrap items-center gap-2 rounded-[1.75rem] p-3">
            <YouButton onOpen={addPhotos} />
            <SetControls />

            <div className="flex flex-1 items-center justify-end gap-2.5">
                {price === null ? null : (
                    <Tooltip label="Estimated cost on Nano Banana Pro. Actual billing comes from Google.">
                        <span className="cursor-default text-[13px] font-medium text-muted tabular-nums">
                            {price}
                        </span>
                    </Tooltip>
                )}
                <Button disabled={action.disabled} onClick={action.run}>
                    {action.label}
                </Button>
            </div>

            <YouDialog onOpenChange={setYouOpen} open={youOpen} you={templates.you} />
            <ConnectGoogleDialog onOpenChange={google.setOpen} open={google.open} />
        </div>
    )
}
