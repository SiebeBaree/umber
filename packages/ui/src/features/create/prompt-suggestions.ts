import type { GenerationMode } from './catalog'

export interface PromptSuggestions {
    /**
     * The opening words every suggestion shares. The placeholder types itself,
     * and only the part *after* this is erased and rewritten, so the sentence
     * never fully disappears while it cycles.
     */
    readonly prefix: string
    readonly endings: readonly [string, ...string[]]
}

export const PROMPT_SUGGESTIONS: Readonly<Record<GenerationMode, PromptSuggestions>> = {
    image: {
        prefix: 'A cinematic photo of ',
        endings: [
            'a misty forest at dawn',
            'a neon-lit street after rain',
            'an astronaut crossing red dunes',
            'a glass city at golden hour',
        ],
    },
    video: {
        prefix: 'A slow camera move across ',
        endings: [
            'a rooftop at blue hour',
            'a field of tall grass in the wind',
            'a quiet studio full of plants',
            'a coastline under drifting fog',
        ],
    },
}
