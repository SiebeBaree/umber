import { Download, Pencil, RotateCw, Shuffle, Undo2, X, type LucideIcon } from 'lucide-react'
import { useCallback, useMemo, type ChangeEvent, type CSSProperties } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { mediaExtension } from '../../lib/media'
import { ratioToCss, type AspectRatio } from '../create/catalog'
import { RenderingTile } from '../generate/rendering-tile'
import { showsPrompt, type Shot } from './template-set'
import { useTemplates } from './templates-context'

/**
 * One planned photo, in the spot where it will land: its prompt to read and
 * edit, then the render in progress, then the photo. The title and the actions
 * sit in a row underneath in every state, so nothing ever covers the picture
 * and the grid keeps one rhythm while cards turn into photos.
 */

interface ShotActionProps {
    readonly label: string
    readonly icon: LucideIcon
    readonly onAct: (id: string) => void
    readonly shotId: string
}

function ShotAction({ icon: Icon, label, onAct, shotId }: ShotActionProps) {
    const act = useCallback(() => {
        onAct(shotId)
    }, [onAct, shotId])

    return (
        <Tooltip label={label}>
            <Button aria-label={label} onClick={act} size="icon-sm" variant="ghost">
                <Icon aria-hidden />
            </Button>
        </Tooltip>
    )
}

function DownloadAction({ shot }: { readonly shot: Shot }) {
    if (shot.photo === null) {
        return null
    }

    const { image } = shot.photo

    return (
        <Tooltip label="Download">
            <Button aria-label="Download" asChild size="icon-sm" variant="ghost">
                <a
                    download={`umber-${image.id.slice(0, 8)}.${mediaExtension(image.mediaType, 'image')}`}
                    href={image.url}
                >
                    <Download aria-hidden />
                </a>
            </Button>
        </Tooltip>
    )
}

/**
 * What a shot offers in its current state. Make again needs the user's photos,
 * so it hides while there are none and the bar asks for them instead.
 */
function ShotActions({ shot }: { readonly shot: Shot }) {
    const templates = useTemplates()

    if (shot.status !== 'idle') {
        return null
    }

    if (!showsPrompt(shot)) {
        return (
            <>
                {templates.you.photos.length === 0 ? null : (
                    <ShotAction
                        icon={RotateCw}
                        label="Make again"
                        onAct={templates.redo}
                        shotId={shot.id}
                    />
                )}
                <ShotAction
                    icon={Pencil}
                    label="Edit prompt"
                    onAct={templates.startEditing}
                    shotId={shot.id}
                />
                <DownloadAction shot={shot} />
            </>
        )
    }

    return (
        <>
            <ShotAction
                icon={Shuffle}
                label="Different scene"
                onAct={templates.swap}
                shotId={shot.id}
            />
            {shot.photo === null ? (
                <ShotAction icon={X} label="Remove" onAct={templates.remove} shotId={shot.id} />
            ) : (
                <ShotAction
                    icon={Undo2}
                    label="Back to the photo"
                    onAct={templates.cancelEditing}
                    shotId={shot.id}
                />
            )}
        </>
    )
}

function PromptCard({ shot, style }: { readonly shot: Shot; readonly style: CSSProperties }) {
    const { editScene } = useTemplates()

    const edit = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            editScene(shot.id, event.target.value)
        },
        [editScene, shot.id],
    )

    return (
        <div
            className="glass flex rounded-2xl p-3.5 transition-shadow duration-200 ease-out focus-within:ring-2 focus-within:ring-accent"
            style={style}
        >
            <textarea
                aria-label={`Prompt for ${shot.card.title}`}
                className="size-full resize-none bg-transparent text-[13px] leading-relaxed text-ink outline-none"
                onChange={edit}
                spellCheck={false}
                value={shot.scene}
            />
        </div>
    )
}

function ShotBody({ ratio, shot }: { readonly shot: Shot; readonly ratio: AspectRatio }) {
    const style = useMemo(() => ({ aspectRatio: ratioToCss(ratio) }), [ratio])

    if (shot.status === 'rendering') {
        return <RenderingTile providerId="google" ratio={ratio} />
    }

    if (shot.status === 'queued') {
        return (
            <div
                className="glass flex items-center justify-center rounded-2xl text-[13px] font-medium text-muted"
                style={style}
            >
                Waiting
            </div>
        )
    }

    if (shot.photo === null || shot.editing) {
        return <PromptCard shot={shot} style={style} />
    }

    return (
        <img
            alt={shot.card.title}
            className="block w-full rounded-2xl object-cover shadow-[0_16px_40px_-18px_var(--umber-glass-shadow)] inset-ring inset-ring-ink/10"
            draggable={false}
            src={shot.photo.image.url}
            style={style}
        />
    )
}

export function ShotTile({ ratio, shot }: { readonly shot: Shot; readonly ratio: AspectRatio }) {
    return (
        <li className="flex min-w-0 flex-col gap-1.5">
            <ShotBody ratio={ratio} shot={shot} />
            <div className="flex h-8 items-center justify-between gap-2 ps-1">
                <span className="truncate text-[13px] font-medium">{shot.card.title}</span>
                <span className="flex shrink-0 items-center">
                    <ShotActions shot={shot} />
                </span>
            </div>
        </li>
    )
}
