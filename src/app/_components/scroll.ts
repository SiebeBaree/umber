"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";

/*
 * One scroll loop for the whole page. Each frame it first reads all the
 * geometry it needs, in one go, then lets every section near the viewport
 * write its styles, then picks the page theme. Reading everything before
 * writing anything means a frame never lays the page out twice, and sections
 * write `transform` and `opacity` on the few elements that move instead of
 * a variable that would restyle their whole subtree.
 *
 * Progress runs from 0 to 1:
 * - "sticky": for a tall section with a sticky stage inside. 0 when the
 *   section's top reaches the top of the viewport, 1 when its bottom reaches
 *   the bottom, so it covers exactly the time the stage is pinned.
 * - "pass": for anything that simply scrolls by. 0 when its top enters at
 *   the bottom of the viewport, 1 when its bottom leaves at the top.
 */

type Mode = "sticky" | "pass";

/** `span` is how far the section scrolls while pinned, in px. */
export type OnFrame = (p: number, span: number) => void;

type Watcher = {
  el: HTMLElement;
  mode: Mode;
  onFrame: OnFrame;
  near: boolean;
  /** Measure once more after leaving, so it settles at exactly 0 or 1. */
  settle: boolean;
  last: number;
};

const watchers = new Set<Watcher>();
let themed: readonly Element[] = [];
let raf = 0;
let listening = false;

export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

function frame() {
  raf = 0;
  const vh = window.innerHeight;

  // Reads.
  const measured: [Watcher, DOMRect][] = [];
  for (const w of watchers) {
    if (w.near || w.settle) measured.push([w, w.el.getBoundingClientRect()]);
    w.settle = false;
  }
  const middle = themed.find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top <= vh / 2 && rect.bottom > vh / 2;
  });

  // Writes.
  for (const [w, rect] of measured) {
    const p = clamp01(
      w.mode === "sticky"
        ? -rect.top / Math.max(rect.height - vh, 1)
        : (vh - rect.top) / (rect.height + vh),
    );
    if (p === w.last) continue;
    w.last = p;
    w.onFrame(p, rect.height - vh);
  }

  // The theme last: a section may have just changed its own.
  const theme = middle?.getAttribute("data-theme");
  const root = document.documentElement;
  const next = theme === "canvas" ? undefined : theme;
  if (theme && root.dataset.theme !== next) {
    if (next) root.dataset.theme = next;
    else delete root.dataset.theme;
  }
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(frame);
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => {
    for (const w of watchers) w.last = Number.NaN;
    schedule();
  });
}

/** Calls `onFrame` with the element's scroll progress whenever it changes. */
export function watch(
  el: HTMLElement,
  onFrame: OnFrame,
  mode: Mode = "sticky",
) {
  const w: Watcher = {
    el,
    mode,
    onFrame,
    near: false,
    settle: true,
    last: Number.NaN,
  };
  watchers.add(w);
  listen();
  schedule();

  // Off screen there is nothing to animate, so only nearby sections are
  // measured at all.
  const observer = new IntersectionObserver(
    ([entry]) => {
      w.near = entry.isIntersecting;
      w.settle = true;
      schedule();
    },
    { rootMargin: "25% 0px" },
  );
  observer.observe(el);

  return () => {
    observer.disconnect();
    watchers.delete(w);
  };
}

/** `watch` as a hook, for components whose callback changes per render. */
export function useScrollFrame(
  ref: RefObject<HTMLElement | null>,
  onFrame: OnFrame,
  mode: Mode = "sticky",
) {
  const handle = useEffectEvent(onFrame);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watch(el, (p, span) => handle(p, span), mode);
  }, [ref, mode]);
}

/** Makes the page theme follow the top-level section in the viewport. */
export function watchThemes() {
  themed = [...document.querySelectorAll("main > [data-theme]")];
  listen();
  schedule();
  return () => {
    themed = [];
  };
}

const written = new WeakMap<HTMLElement, Partial<Record<StyleProp, string>>>();

type StyleProp = "transform" | "opacity" | "visibility";

/** Sets an inline style, skipping the write when nothing changed. */
export function setStyle(
  el: HTMLElement | null | undefined,
  prop: StyleProp,
  value: string,
) {
  if (!el) return;
  const cache = written.get(el) ?? {};
  if (cache[prop] === value) return;
  cache[prop] = value;
  written.set(el, cache);
  el.style[prop] = value;
}

/**
 * Sets opacity, and hides the element outright at zero, so the browser
 * stops painting and compositing a layer that shows nothing anyway.
 */
export function setOpacity(el: HTMLElement | null | undefined, value: number) {
  setStyle(el, "opacity", value.toFixed(3));
  setStyle(el, "visibility", value > 0 ? "" : "hidden");
}
