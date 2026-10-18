"use client";

import Image, { type StaticImageData } from "next/image";
import { useRef } from "react";
import { media } from "./media";
import { clamp01, setStyle, useScrollFrame } from "./scroll";

/*
 * Templates: two casual selfies go in, and photos made for LinkedIn, Tinder
 * and Instagram come out, fanning out of a stack as the visitor scrolls.
 * Every photo here was made that way, from the two selfies shown, with
 * Nano Banana Pro.
 *
 * The fan reaches its full spread well before the section unpins, so it
 * holds for a moment.
 */

type Result = {
  readonly image: StaticImageData;
  readonly alt: string;
  readonly platform: string;
  readonly aspect: string;
  readonly offset: -1 | 0 | 1;
};

// Drawn in this order, so the middle card sits on top.
const RESULTS: readonly Result[] = [
  {
    image: media.tplLinkedin,
    alt: "A studio headshot of the woman from the selfies, in a navy blazer against a grey backdrop.",
    platform: "LinkedIn",
    aspect: "aspect-square",
    offset: -1,
  },
  {
    image: media.tplInstagram,
    alt: "The same woman in a beige trench coat, cycling along an Amsterdam canal.",
    platform: "Instagram",
    aspect: "aspect-[3/4]",
    offset: 1,
  },
  {
    image: media.tplDating,
    alt: "The same woman laughing with an iced coffee on a sunny seaside terrace.",
    platform: "Tinder",
    aspect: "aspect-[2/3]",
    offset: 0,
  },
];

const SELFIES = [
  {
    image: media.selfie1,
    alt: "A casual evening selfie of a woman with wavy dark hair, on her couch.",
  },
  {
    image: media.selfie2,
    alt: "A second selfie of her, outside on an overcast street.",
  },
];

/** A card's place in the fan, from stacked (`e` 0) to spread (`e` 1). */
function fanTransform(offset: number, e: number, spread: number) {
  const x = offset * e * spread;
  const y = Math.abs(offset) * (1 - e) * 18;
  const turn = offset * (9 - e * 6);
  return `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${turn.toFixed(2)}deg)`;
}

export function Templates() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  useScrollFrame(sectionRef, (p) => {
    // Cards spread further apart on wide screens, up to 290px each way.
    const spread =
      window.innerWidth >= 1024
        ? Math.min(window.innerWidth * 0.19, 290)
        : window.innerWidth * 0.4;
    const e = clamp01(p * 1.7);
    RESULTS.forEach((result, i) => {
      setStyle(
        cardRefs.current[i],
        "transform",
        fanTransform(result.offset, e, spread),
      );
    });
  });

  return (
    <section
      className="relative h-[240svh]"
      data-theme="mist"
      id="templates"
      ref={sectionRef}
    >
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1400px] items-center px-5 pt-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6 lg:pt-10">
          <div>
            <h2 className="display text-[clamp(3.6rem,7.6vw,8.25rem)]">
              Templates
            </h2>
            <p className="mt-4 max-w-md text-pretty text-dim max-lg:text-sm lg:mt-8 lg:text-lg">
              Add a few selfies and pick a template. You get a LinkedIn
              headshot, dating photos or Instagram posts that still look like
              you.
            </p>

            {/* What went in. */}
            <div className="mt-6 flex items-center gap-5 lg:mt-12">
              <div className="flex">
                {SELFIES.map((selfie, i) => (
                  <div
                    className={`glass-raised w-14 rounded-xl p-1 sm:w-20 ${
                      i ? "-ml-4 rotate-6" : "-rotate-6"
                    }`}
                    key={selfie.image.src}
                  >
                    <Image
                      alt={selfie.alt}
                      className="aspect-[3/4] rounded-lg object-cover"
                      sizes="80px"
                      src={selfie.image}
                    />
                  </div>
                ))}
              </div>
              <p className="max-w-48 text-sm text-muted">
                Every photo here was made from these two selfies.
              </p>
            </div>
          </div>

          <div className="relative mt-6 h-[min(46svh,520px)] lg:mt-0 lg:h-[600px]">
            {RESULTS.map((result, i) => (
              <figure
                className="glass-raised absolute top-1/2 left-1/2 w-[min(46vw,280px)] rounded-[1.4rem] p-1.5 will-change-transform lg:left-[46%] lg:w-[min(18vw,270px)]"
                key={result.platform}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                style={{ transform: fanTransform(result.offset, 0, 0) }}
              >
                <div
                  className={`relative overflow-hidden rounded-[1.05rem] ${result.aspect}`}
                >
                  <Image
                    alt={result.alt}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 270px, 46vw"
                    src={result.image}
                  />
                </div>
                <figcaption className="absolute top-4 left-4 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-[0_4px_12px_-4px_rgb(28_41_90/0.1)]">
                  {result.platform}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
