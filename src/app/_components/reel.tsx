"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { setStyle, useScrollFrame } from "./scroll";

/*
 * Video, laid out like an edit: scrolling down pans along a row of wide
 * clips while a playhead runs over the timeline underneath and the timecode
 * counts up. The section's height comes from the `reel` utility; the track
 * travels its own overflow, measured whenever it resizes.
 *
 * The clips are stock footage standing in for generations, trimmed and
 * re-encoded into public/video. Each one only loads and plays while it is
 * on screen.
 */

type Shot = {
  /** File name in public/video, without extension: `.mp4` plus `.jpg` poster. */
  readonly name: string;
  readonly prompt: string;
};

// All from Pexels, under the Pexels License (free to use, no attribution
// required): videos 5136530, 6693764, 39873449, 856019, 7075989, 5700940
// and 18359865, in order.
const SHOTS: readonly Shot[] = [
  {
    name: "jellyfish",
    prompt: "A jellyfish drifting through deep blue water, slow tracking shot",
  },
  {
    name: "mountain-clouds",
    prompt: "Clouds rolling over snowy peaks, time-lapse",
  },
  {
    name: "aerial-beach",
    prompt: "Slow drone shot over turquoise water and white sand",
  },
  {
    name: "flower-bloom",
    prompt: "A white flower opening against a clear blue sky, time-lapse",
  },
  {
    name: "blue-ink",
    prompt: "Blue ink blooming in water, macro, black background",
  },
  {
    name: "aurora",
    prompt: "Northern lights over a harbour village at night",
  },
  {
    name: "horses",
    prompt: "A horse walking through shallow water at golden hour",
  },
];

const SECONDS_PER_SHOT = 5;
const FPS = 24;

function timecode(seconds: number) {
  const frames = Math.floor((seconds % 1) * FPS);
  const whole = Math.floor(seconds);
  return [0, Math.floor(whole / 60), whole % 60, frames]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export function Reel() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  // How far the track has to travel to show its last clip, in px.
  const distance = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = new ResizeObserver(() => {
      distance.current = Math.max(track.scrollWidth - window.innerWidth, 0);
    });
    measure.observe(track);
    return () => measure.disconnect();
  }, []);

  useScrollFrame(sectionRef, (p) => {
    setStyle(
      trackRef.current,
      "transform",
      `translate3d(${(-p * distance.current).toFixed(1)}px, 0, 0)`,
    );
    setStyle(
      playheadRef.current,
      "transform",
      `translateX(${(p * 100).toFixed(2)}%)`,
    );
    if (timecodeRef.current) {
      timecodeRef.current.textContent = timecode(
        p * SHOTS.length * SECONDS_PER_SHOT,
      );
    }
  });

  return (
    <section
      className="reel relative"
      data-theme="night"
      id="video"
      ref={sectionRef}
      style={{ "--n": SHOTS.length }}
    >
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div
          className="flex items-center gap-(--gap) pt-10 will-change-transform"
          ref={trackRef}
        >
          <div className="w-(--lead) shrink-0 px-5 sm:px-8 lg:pr-[6vw]">
            <h2 className="display text-[clamp(3.6rem,7.6vw,8.25rem)]">
              Video
            </h2>
            <p className="mt-4 max-w-sm text-pretty text-dim max-lg:text-sm lg:mt-8 lg:text-lg">
              Veo, Sora, Kling and Seedance, in the same composer as your
              images. A 4 second Sora 2 clip costs $0.40.
            </p>
          </div>

          {SHOTS.map((shot) => (
            <figure className="w-(--fw) shrink-0" key={shot.name}>
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 ring-inset lg:aspect-[2.2/1]">
                <Clip shot={shot} />
              </div>
              <figcaption className="mt-4 text-[13px] text-dim">
                {shot.prompt}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* The timeline: one clip per shot, and the playhead crossing them. */}
        <div className="absolute inset-x-5 bottom-6 sm:inset-x-8 sm:bottom-8">
          <div className="flex justify-between text-xs text-dim tabular-nums">
            <span className="text-current" ref={timecodeRef}>
              00:00:00:00
            </span>
            <span>{SHOTS.length * SECONDS_PER_SHOT}s</span>
          </div>
          <div className="relative mt-3 overflow-hidden rounded-md">
            <div className="flex h-7 gap-1 sm:h-9">
              {SHOTS.map((shot) => (
                <Image
                  alt=""
                  className="min-w-0 flex-1 rounded-[3px] object-cover"
                  height={36}
                  key={shot.name}
                  sizes="14vw"
                  src={`/video/${shot.name}.jpg`}
                  width={64}
                />
              ))}
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-0 will-change-transform"
              ref={playheadRef}
            >
              <div className="absolute inset-0 bg-night/65" />
              <div className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One clip: a still until it scrolls into view, then a muted loop over it.
 * It pauses again once it leaves, so only the clips on screen ever decode.
 * The still is a lazy, resized image instead of the video's `poster`, which
 * browsers fetch at full size as soon as the page loads.
 */
function Clip({ shot }: { shot: Shot }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { rootMargin: "0px 10%" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Image
        alt=""
        className="object-cover"
        fill
        sizes="(min-width: 64rem) 56vw, 84vw"
        src={`/video/${shot.name}.jpg`}
      />
      <video
        aria-label={shot.prompt}
        className="absolute inset-0 size-full object-cover"
        loop
        muted
        playsInline
        preload="none"
        ref={ref}
        src={`/video/${shot.name}.mp4`}
      />
    </>
  );
}
