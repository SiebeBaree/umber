"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef } from "react";
import { DownloadButton, GitHubButton } from "./buttons";
import { Headline } from "./headline";
import { Manifesto } from "./manifesto";
import { media } from "./media";
import { clamp01, setOpacity, setStyle, watch } from "./scroll";

/*
 * The opening: the headline in a pale sky, over a sea of clouds at dawn.
 *
 * Scrolling flies the camera forward: the clouds fall away, a set of
 * generations waiting in the haze beyond the headline flies past, and the
 * night desert hidden furthest back grows until it fills the screen. It
 * holds while the manifesto plays over it, word by word, and the page turns
 * to night around it. The pointer adds a little parallax on top.
 */

const PERSPECTIVE = 1000;

// Every card's width in 3D space, in vmax.
const SIZE = 20;

type Spot = readonly [x: number, y: number];

/* ----------------------------------------------------------- The flight */

type Card = {
  readonly img: StaticImageData;
  /** Where it would appear at its resting depth, in viewport percent. */
  readonly at: Spot;
  /** Resting depth in px, out in the haze beyond `FAR`. */
  readonly z: number;
  /** The scroll progress at which the card reaches the camera. */
  readonly pass: number;
};

// Ordered by depth: the nearest emerges as soon as scrolling starts.
const CARDS: readonly Card[] = [
  { img: media.whaleTail, at: [42, 40], z: -3500, pass: 0.3 },
  { img: media.sailboat, at: [58, 57], z: -3800, pass: 0.36 },
  { img: media.origamiCrane, at: [45, 61], z: -4100, pass: 0.42 },
  { img: media.glassSphere, at: [57, 42], z: -4400, pass: 0.48 },
  { img: media.moonAstronaut, at: [39, 52], z: -4700, pass: 0.54 },
  { img: media.whiteTulips, at: [61, 50], z: -5000, pass: 0.6 },
  { img: media.iceCave, at: [48, 37], z: -5300, pass: 0.66 },
  { img: media.foggyPier, at: [53, 63], z: -5600, pass: 0.71 },
  { img: media.cloudSea, at: [41, 45], z: -5900, pass: 0.76 },
  { img: media.snowForest, at: [60, 44], z: -6200, pass: 0.81 },
  { img: media.whiteStairs, at: [46, 58], z: -6500, pass: 0.85 },
  { img: media.dewPetal, at: [56, 55], z: -6800, pass: 0.89 },
  { img: media.arcticFox, at: [43, 56], z: -7100, pass: 0.92 },
  { img: media.redUmbrella, at: [54, 40], z: -7400, pass: 0.95 },
];

// The depth at which a card has faded out, in front of the camera, and the
// depth at which it first emerges from the haze far away.
const NEAR = 820;
const FAR = -3400;
// How far the pointer moves a card, in px at its own depth.
const PARALLAX = 30;

// The finale is laid out at full viewport size and pushed far back, so it
// starts small and ends at native sharpness, a touch larger than the screen
// so its rounded corners are out of view.
const FINALE_SCALE = 0.15;
const FINALE_Z = PERSPECTIVE - PERSPECTIVE / FINALE_SCALE;
const FINALE_TRAVEL = -FINALE_Z + 60;

// The scroll splits in two: the flight through the field, then the
// manifesto read over the final image.
const FLY_END = 0.44;
const READ_FROM = 0.5;
const READ_LENGTH = 0.42;
// Where the page turns to night: two thirds into the flight, just as the
// final image starts to appear, so the canvas darkens around it.
const NIGHT_FROM = 0.26;

/** Where a card has to sit in 3D for perspective to show it at `spot`. */
function project(spot: Spot, z: number) {
  const scale = PERSPECTIVE / (PERSPECTIVE - z);
  return {
    left: `${50 + (spot[0] - 50) / scale}%`,
    top: `${50 + (spot[1] - 50) / scale}%`,
  };
}

const PLACED = CARDS.map((card) => ({
  ...card,
  ...project(card.at, card.z),
  // Every card covers its own distance by its own `pass` point.
  travel: (NEAR - card.z) / card.pass,
}));

/** A card's transform and opacity at a point in the flight. */
function cardStyle(
  card: (typeof PLACED)[number],
  fly: number,
  mx: number,
  my: number,
) {
  const depth = card.z + fly * card.travel;
  return {
    transform: `translate(-50%, -50%) translate3d(${(mx * PARALLAX).toFixed(1)}px, ${(my * PARALLAX).toFixed(1)}px, ${depth.toFixed(1)}px)`,
    opacity: clamp01(Math.min((NEAR - depth) / 320, (depth - FAR) / 900)),
  };
}

export function Hero({ releaseLine }: { releaseLine: React.ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const horizonRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll and pointer both feed one render, which writes transform and
  // opacity on exactly the elements that move. The pointer loop eases
  // toward the pointer and stops once it has caught up.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const words = [
      ...(readRef.current?.querySelectorAll<HTMLElement>("[data-word]") ?? []),
    ];
    const state = { p: 0, mx: 0, my: 0 };
    let night = false;

    const render = () => {
      const fly = clamp01(state.p / FLY_END);
      // Under reduced motion nothing travels; things only fade.
      const travel = reduced ? 0 : fly;
      PLACED.forEach((card, i) => {
        const style = cardStyle(card, travel, state.mx, state.my);
        setStyle(cardRefs.current[i], "transform", style.transform);
        setOpacity(cardRefs.current[i], style.opacity);
      });

      // The sea of clouds drops away as the camera leaves it behind.
      setStyle(
        horizonRef.current,
        "transform",
        `translate3d(0, 0, ${(travel * 500).toFixed(1)}px)`,
      );
      setOpacity(horizonRef.current, clamp01(1 - fly * 2.4));

      const finaleDepth = reduced ? 0 : FINALE_Z + fly * FINALE_TRAVEL;
      setStyle(
        finaleRef.current,
        "transform",
        `translate3d(0, 0, ${finaleDepth.toFixed(1)}px)`,
      );
      setOpacity(finaleRef.current, clamp01((fly - 0.6) * 4));

      setStyle(
        copyRef.current,
        "transform",
        `translate3d(0, 0, ${(travel * 700).toFixed(1)}px)`,
      );
      setOpacity(copyRef.current, clamp01(1 - fly * 2.6));
      // Once the copy has faded out it should not catch clicks or focus.
      const hidden = fly > 0.35;
      if (copyRef.current && copyRef.current.inert !== hidden) {
        copyRef.current.inert = hidden;
      }

      setOpacity(readRef.current, clamp01((state.p - FLY_END) * 18));
      const read = clamp01((state.p - READ_FROM) / READ_LENGTH);
      words.forEach((word, i) => {
        const lit = (read * (words.length + 10) - i - 2) / 8;
        setStyle(word, "opacity", Math.min(Math.max(lit, 0.2), 1).toFixed(2));
      });

      // The scroll loop reads this right after, so the page goes dark with
      // the image.
      if (night !== state.p >= NIGHT_FROM) {
        night = state.p >= NIGHT_FROM;
        section.setAttribute("data-theme", night ? "night" : "canvas");
      }
    };

    const unwatch = watch(section, (p) => {
      state.p = p;
      render();
    });

    if (reduced || !window.matchMedia("(pointer: fine)").matches) {
      return unwatch;
    }
    const target = { x: 0, y: 0 };
    let raf = 0;
    const tick = () => {
      state.mx += (target.x - state.mx) * 0.08;
      state.my += (target.y - state.my) * 0.08;
      render();
      const settled =
        Math.abs(target.x - state.mx) < 0.001 &&
        Math.abs(target.y - state.my) < 0.001;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      // Past the flight there is nothing left to tilt.
      if (state.p > FLY_END) return;
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      unwatch();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      className="relative h-[440svh]"
      data-theme="canvas"
      ref={sectionRef}
    >
      <div
        // `clip`, not `hidden`: a hidden box can still be scrolled by focus
        // or scrollIntoView, which would slide the stage's contents around.
        className="sticky top-0 h-svh overflow-clip"
        style={{ perspective: `${PERSPECTIVE}px` }}
      >
        {/* The floor of the sky: a sea of clouds at dawn, fading into the
            page's blue above it. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[60svh] will-change-[transform,opacity]"
          ref={horizonRef}
        >
          <Image
            alt=""
            className="reveal size-full object-cover object-[center_62%] [mask-image:linear-gradient(transparent,black_42%)]"
            fetchPriority="high"
            loading="eager"
            placeholder="empty"
            sizes="100vw"
            // `data-loaded` is set by the layout script before hydration.
            suppressHydrationWarning
            src={media.horizon}
          />
        </div>

        {/* The finale, far behind everything else. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] will-change-[transform,opacity]"
          ref={finaleRef}
          style={{
            transform: `translate3d(0, 0, ${FINALE_Z}px)`,
            opacity: 0,
            visibility: "hidden",
          }}
        >
          <Image
            alt=""
            className="reveal size-full rounded-[2vmax] object-cover"
            fetchPriority="low"
            // Not lazy: Safari's lazy loading fetches images inside the 3D
            // stage late, and some never.
            loading="eager"
            placeholder="empty"
            sizes="100vw"
            // `data-loaded` is set by the layout script before hydration.
            suppressHydrationWarning
            src={media.nightDesert}
          />
        </div>

        {PLACED.map((card, i) => {
          const rest = cardStyle(card, 0, 0, 0);
          return (
            <div
              aria-hidden="true"
              className="absolute will-change-[transform,opacity]"
              key={card.img.src}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              style={{
                left: card.left,
                top: card.top,
                width: `${SIZE}vmax`,
                zIndex: Math.round(card.z + 10000),
                ...rest,
                visibility: rest.opacity > 0 ? undefined : "hidden",
              }}
            >
              <Image
                alt=""
                className="reveal w-full rounded-[0.7vmax] shadow-[0_16px_40px_-18px_rgb(28_41_90/0.35)]"
                // Out of sight until scrolling starts, so they load last. Not
                // lazy, for the same reason as the finale.
                fetchPriority="low"
                loading="eager"
                placeholder="empty"
                sizes={`${SIZE * 2}vmax`}
                // `data-loaded` is set by the layout script before hydration.
                suppressHydrationWarning
                src={card.img}
              />
            </div>
          );
        })}

        <div
          className="absolute inset-0 z-[20000] flex flex-col items-center justify-center px-6 pb-[8svh] text-center"
          ref={copyRef}
        >
          <Headline />
          <p className="mt-6 max-w-lg text-pretty text-dim sm:text-lg">
            Umber is a free, open source desktop app for AI image and video
            generation. Add your own API keys and pay each lab only for what you
            make. No subscription.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <DownloadButton size="lg" />
            <GitHubButton size="lg" />
          </div>
          <div className="mt-2">{releaseLine}</div>
        </div>

        {/* The manifesto, over the final image once it fills the screen. */}
        <div
          className="pointer-events-none absolute inset-0 z-[30000] flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgb(11_17_32/0.6),rgb(11_17_32/0.15)_75%)] px-6 text-accent-ink will-change-[opacity]"
          ref={readRef}
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <Manifesto />
        </div>
      </div>

      {/* Without JavaScript nothing marks the images as loaded. */}
      <noscript>
        <style>
          {".reveal { opacity: 1 !important; scale: 1 !important; }"}
        </style>
      </noscript>
    </section>
  );
}
