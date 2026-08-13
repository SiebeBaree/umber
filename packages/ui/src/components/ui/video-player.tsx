import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { Slider } from 'radix-ui'
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
    type SyntheticEvent,
} from 'react'

import { cn } from '../../lib/cn'
import { Button } from './button'

/**
 * The video player for finished clips: the picture fills the frame, a glass
 * control bar floats over its bottom edge, and everything fades away while
 * the clip plays undisturbed. Controls return on hover, focus, or pause.
 */

/** A refused `play()` (no user activation yet) just stays paused. */
const stayPaused = () => {
    // Nothing to do; the paused state is already showing.
}

/** `73` → `1:13`; durations here are seconds-scale, never hours. */
function formatTime(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds))
    const remainder = whole % 60

    return `${Math.floor(whole / 60)}:${remainder < 10 ? '0' : ''}${remainder}`
}

interface ScrubberProps {
    readonly duration: number
    readonly time: number
    readonly onSeek: (seconds: number) => void
}

function Scrubber({ duration, onSeek, time }: ScrubberProps) {
    const value = useMemo(() => [time], [time])

    const handleChange = useCallback(
        (next: number[]) => {
            onSeek(next[0] ?? 0)
        },
        [onSeek],
    )

    return (
        <Slider.Root
            aria-label="Seek"
            className="relative flex h-5 grow touch-none items-center select-none"
            max={Math.max(duration, 0.1)}
            min={0}
            onValueChange={handleChange}
            step={0.05}
            value={value}
        >
            <Slider.Track className="relative h-1 grow rounded-full bg-ink/[0.14]">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
            </Slider.Track>
            <Slider.Thumb className="block size-3 cursor-grab rounded-full bg-surface shadow-[0_1px_3px_rgb(28_35_51/0.28)] opacity-0 outline-none transition-opacity duration-150 group-hover/player:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing" />
        </Slider.Root>
    )
}

interface PlayerState {
    readonly videoRef: RefObject<HTMLVideoElement | null>
    readonly playing: boolean
    readonly muted: boolean
    readonly time: number
    readonly duration: number
    readonly togglePlay: () => void
    readonly toggleMute: () => void
    readonly seek: (seconds: number) => void
    readonly handleTime: (event: SyntheticEvent<HTMLVideoElement>) => void
    readonly handleMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void
    readonly handlePlay: () => void
    readonly handlePause: () => void
}

/** The clock and play state, read back from the media element's own events. */
function useMediaEvents(setTime: (seconds: number) => void) {
    const [playing, setPlaying] = useState(false)
    const [duration, setDuration] = useState(0)

    const handleTime = useCallback(
        (event: SyntheticEvent<HTMLVideoElement>) => {
            setTime(event.currentTarget.currentTime)
        },
        [setTime],
    )

    const handleMetadata = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
        setDuration(event.currentTarget.duration)
    }, [])

    const handlePlay = useCallback(() => {
        setPlaying(true)
    }, [])

    const handlePause = useCallback(() => {
        setPlaying(false)
    }, [])

    return { playing, duration, handleTime, handleMetadata, handlePlay, handlePause }
}

/** Everything the player knows, read back from the media element itself. */
function usePlayer(autoPlay: boolean): PlayerState {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const [muted, setMuted] = useState(false)
    const [time, setTime] = useState(0)
    const events = useMediaEvents(setTime)

    useEffect(() => {
        if (autoPlay) {
            videoRef.current?.play().catch(stayPaused)
        }
    }, [autoPlay])

    const togglePlay = useCallback(() => {
        const video = videoRef.current

        if (video === null) {
            return
        }

        if (video.paused) {
            video.play().catch(stayPaused)
        } else {
            video.pause()
        }
    }, [])

    const toggleMute = useCallback(() => {
        setMuted((current) => !current)
    }, [])

    const seek = useCallback((seconds: number) => {
        const video = videoRef.current

        if (video !== null) {
            video.currentTime = seconds
        }
        setTime(seconds)
    }, [])

    return { videoRef, muted, time, togglePlay, toggleMute, seek, ...events }
}

/**
 * The control bar, in the same bright overlay finish as every control that
 * floats above imagery here: hidden while playing unhovered, so the clip is
 * the whole frame; always present while paused.
 */
function ControlBar({ player }: { readonly player: PlayerState }) {
    return (
        <div
            className={cn(
                'absolute inset-x-2.5 bottom-2.5 flex items-center gap-2 rounded-full bg-surface/90 py-1 ps-1 pe-2.5 shadow-[0_4px_12px_-4px_var(--umber-glass-shadow)] backdrop-blur-md transition-opacity duration-200',
                player.playing
                    ? 'opacity-0 group-hover/player:opacity-100 has-[:focus-visible]:opacity-100'
                    : 'opacity-100',
            )}
        >
            <Button
                aria-label={player.playing ? 'Pause' : 'Play'}
                className="shadow-none"
                onClick={player.togglePlay}
                size="icon-sm"
                variant="overlay"
            >
                {player.playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </Button>

            <span className="text-[11px] font-medium text-ink/80 tabular-nums">
                {formatTime(player.time)}
            </span>

            <Scrubber duration={player.duration} onSeek={player.seek} time={player.time} />

            <span className="text-[11px] font-medium text-muted tabular-nums">
                {formatTime(player.duration)}
            </span>

            <Button
                aria-label={player.muted ? 'Unmute' : 'Mute'}
                className="shadow-none"
                onClick={player.toggleMute}
                size="icon-sm"
                variant="overlay"
            >
                {player.muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
            </Button>
        </div>
    )
}

export interface VideoPlayerProps {
    /** An object URL over the stored clip; owned by whoever opened this. */
    readonly src: string
    /** The clip's accessible name — in Umber, its prompt. */
    readonly label: string
    /** Begin playing on mount. Falls back to paused if the host refuses. */
    readonly autoPlay?: boolean
    readonly className?: string
    /** For sizing the frame, typically an `aspectRatio` from the clip's ratio. */
    readonly style?: CSSProperties
}

export function VideoPlayer({ autoPlay = false, className, label, src, style }: VideoPlayerProps) {
    const player = usePlayer(autoPlay)

    return (
        <div
            className={cn(
                'group/player relative overflow-hidden rounded-2xl bg-ink/[0.04]',
                className,
            )}
            style={style}
        >
            {/* The surface itself toggles playback, like every player does;
                the control bar carries the same action for keyboards. */}
            <video
                aria-label={label}
                className="block size-full object-contain"
                loop
                muted={player.muted}
                onClick={player.togglePlay}
                onLoadedMetadata={player.handleMetadata}
                onPause={player.handlePause}
                onPlay={player.handlePlay}
                onTimeUpdate={player.handleTime}
                playsInline
                ref={player.videoRef}
                src={src}
            />

            <ControlBar player={player} />
        </div>
    )
}
