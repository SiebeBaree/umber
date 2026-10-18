import Image from 'next/image'

import { LAB_IDS, LABS, type LabId } from '../../lib/catalog'
import { media } from './media'
import { ProviderMark } from './provider-mark'

/*
 * One sentence about what Umber is, set over the hero's final image. The
 * hero lights its words up one by one (every `[data-word]`) as the visitor
 * scrolls. `{key}` inside a word drops in a lab's logo or a small
 * generation, set inline with the type.
 */
const NAMED_LABS = 3
const TEXT = `Make images {koiAbove}, video {whaleTail} and photos of yourself {tplLinkedin} with models from {google}Google, {openai}OpenAI, {blackForestLabs}Black Forest Labs and ${LAB_IDS.length - NAMED_LABS} other labs. Bring your own API keys and pay the labs directly. Umber takes nothing.`

const WORDS = TEXT.split(' ')

function isLab(key: string): key is LabId {
    return key in LABS
}

function isMedia(key: string): key is keyof typeof media {
    return key in media
}

function Word({ word }: { word: string }) {
    return word.split(/(\{\w+\})/u).map((part) => {
        const key = part.match(/^\{(\w+)\}$/u)?.[1]
        if (key && isLab(key)) {
            return (
                <ProviderMark
                    className="mr-[0.14em] size-[0.62em] align-[0.02em]"
                    key={part}
                    provider={key}
                />
            )
        }
        if (key && isMedia(key)) {
            return (
                <span
                    className="mx-[0.06em] inline-block h-[0.8em] w-[1.55em] overflow-hidden rounded-full align-[-0.08em] ring-1 ring-white/40"
                    key={part}
                >
                    <Image
                        alt=""
                        className="size-full object-cover"
                        sizes="120px"
                        src={media[key]}
                    />
                </span>
            )
        }
        return part
    })
}

export function Manifesto() {
    return (
        <p className="max-w-[min(1180px,92vw)] text-[clamp(2.1rem,5vw,5.4rem)] leading-[1.06] font-semibold tracking-[-0.025em]">
            {WORDS.map((word, i) => (
                // Words repeat, so only their position tells them apart.
                // oxlint-disable-next-line react/no-array-index-key
                <span key={`${i}-${word}`}>
                    <span className="whitespace-nowrap" data-word style={{ opacity: 0.2 }}>
                        <Word word={word} />
                    </span>{' '}
                </span>
            ))}
        </p>
    )
}
