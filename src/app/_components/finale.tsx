"use client";

import { useRef } from "react";
import { GITHUB_URL, LICENSE_URL } from "../../lib/site";
import { AppWindow } from "./app-window";
import { DownloadButton, GitHubButton } from "./buttons";
import { Wordmark } from "./logo";
import { clamp01, setStyle, useScrollFrame } from "./scroll";

/*
 * The ending: the app window tilting upright as it scrolls in, the
 * last call to download, and the footer under a wordmark set as wide as
 * the page.
 */

const LINKS = [
  { href: GITHUB_URL, label: "GitHub" },
  { href: `${GITHUB_URL}/releases`, label: "Releases" },
  { href: `${GITHUB_URL}/issues`, label: "Issues" },
  { href: LICENSE_URL, label: "MIT License" },
];

/** The app window leans back while it enters, then stands up straight. */
function tilt(p: number) {
  const lean = 1 - clamp01((p - 0.04) / 0.4);
  return `rotateX(${(lean * 26).toFixed(2)}deg) translateY(${(lean * 40).toFixed(1)}px)`;
}

export function Finale({ releaseLine }: { releaseLine: React.ReactNode }) {
  const windowRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  useScrollFrame(
    windowRef,
    (p) => {
      setStyle(appRef.current, "transform", tilt(p));
    },
    "pass",
  );

  return (
    <section
      className="relative overflow-hidden pt-24 sm:pt-36"
      data-theme="accent"
    >
      <div
        className="mx-auto w-[min(94vw,1080px)] perspective-[1600px]"
        ref={windowRef}
      >
        <div
          className="origin-bottom will-change-transform"
          ref={appRef}
          style={{ transform: tilt(0) }}
        >
          <AppWindow />
        </div>
      </div>

      <div className="relative px-5 pt-16 text-center sm:px-8 sm:pt-24">
        <h2 className="display text-[clamp(4rem,12vw,12.5rem)]">
          Make something.
        </h2>
        <p className="mx-auto mt-6 max-w-md text-pretty text-dim sm:text-lg">
          Free on macOS, Windows and Linux.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <DownloadButton size="lg" />
          <GitHubButton size="lg" />
        </div>
        <div className="mt-7">{releaseLine}</div>
      </div>

      <footer className="relative mt-28 sm:mt-40">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 border-t border-hair px-5 pt-6 text-sm sm:flex-row sm:px-8">
          <p className="text-dim">Open source AI image and video studio</p>
          <nav className="flex gap-6">
            {LINKS.map((link) => (
              <a
                className="text-dim transition-colors hover:text-current"
                href={link.href}
                key={link.label}
                rel="noopener noreferrer"
                target="_blank"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <Wordmark className="mx-auto mt-10 -mb-[2.2vw] block w-full max-w-[1600px] px-3" />
      </footer>
    </section>
  );
}
