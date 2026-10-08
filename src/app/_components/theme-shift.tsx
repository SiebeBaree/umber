"use client";

import { useEffect } from "react";
import { watchThemes } from "./scroll";

/*
 * Makes <html> carry the theme of the top-level section in the middle of
 * the viewport, which cross-fades the page backdrop (see `theme-layer` in
 * globals.css). The work happens in the shared scroll loop.
 */
export function ThemeShift() {
  useEffect(() => watchThemes(), []);
  return null;
}
