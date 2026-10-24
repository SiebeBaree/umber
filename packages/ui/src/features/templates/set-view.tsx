import { Download, Shuffle } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '../../components/ui/button'
import { cn } from '../../lib/cn'
import { downloadImages } from '../gallery/download'
import { identityRules, REALISM_RULES } from './compose-prompt'
import { RECIPES } from './platforms'
import { ShotTile } from './shot-tile'
import { untouched, type TemplateSet } from './template-set'
import { useTemplates } from './templates-context'

/**
 * A planned set on the stage: one card per photo, a note on what Umber adds to
 * every prompt, and the actions that work on the whole set.
 */

const TOGGLE_CLASSES =
    'cursor-pointer font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** What Umber adds to every prompt: out of the editable text, one click away. */
function RulesPanel({ photos }: { readonly photos: number }) {
    return (
        <div className="glass space-y-2 rounded-2xl p-4 text-[13px] leading-relaxed">
            <p>{identityRules(Math.max(1, photos))}</p>
            <p>{REALISM_RULES}</p>
        </div>
    )
}

function SetActions({ set }: { readonly set: TemplateSet }) {
    const { shuffle } = useTemplates()
    const images = set.shots.flatMap((shot) => (shot.photo === null ? [] : [shot.photo.image]))

    const downloadAll = useCallback(() => {
        void downloadImages(images)
    }, [images])

    return (
        <div className="flex shrink-0 items-center gap-1">
            {set.shots.some((shot) => untouched(shot)) ? (
                <Button onClick={shuffle} size="sm" variant="ghost">
                    <Shuffle aria-hidden />
                    Shuffle
                </Button>
            ) : null}
            {images.length > 1 ? (
                <Button onClick={downloadAll} size="sm" variant="ghost">
                    <Download aria-hidden />
                    Download all
                </Button>
            ) : null}
        </div>
    )
}

export function SetView({ set }: { readonly set: TemplateSet }) {
    const { you } = useTemplates()
    const { ratio } = RECIPES[set.platform]
    const [rulesOpen, setRulesOpen] = useState(false)

    const toggleRules = useCallback(() => {
        setRulesOpen((current) => !current)
    }, [])

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-[13px] text-muted">
                    Umber adds your photos and a few realism rules to every prompt.{' '}
                    <button
                        aria-expanded={rulesOpen}
                        className={TOGGLE_CLASSES}
                        onClick={toggleRules}
                        type="button"
                    >
                        {rulesOpen ? 'Hide' : 'Show'}
                    </button>
                </p>
                <SetActions set={set} />
            </div>

            {rulesOpen ? <RulesPanel photos={you.photos.length} /> : null}

            {/* Portrait sets fit four across on a wide window; square cards need
                the width of three to hold their prompt without scrolling. */}
            <ul
                className={cn(
                    'grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3',
                    ratio !== '1:1' && 'lg:grid-cols-4',
                )}
            >
                {set.shots.map((shot) => (
                    <ShotTile key={shot.id} ratio={ratio} shot={shot} />
                ))}
            </ul>
        </div>
    )
}
