// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

import ChromaticWaves from "@/components/originkit/ui/hero-31/chromatic-waves";

/**
 * The hero backdrop — a live Chromatic Waves field standing in for Figma's
 * `image 3083621`, which is a flattened 1073x697 render of this same component.
 *
 * Every value below was read back off that render rather than guessed. Sampling
 * it gives exactly two colours: the gaps between dots are a flat `#00bcff`, and
 * the dots themselves are `#002fff` — the same blue the overlay gradient resolves
 * to, which is why the field and the fade read as one surface. A single-entry
 * palette is therefore correct: the shader interpolates colour across the palette
 * by luminance, so a second entry would introduce a hue the design does not have,
 * and all of the visible variation comes from dot *radius* instead.
 *
 * `frequency` is the one that has to be read as texture rather than measured.
 * The shader turns noise into a rainbow and then reads its *luminance*, so a
 * single noise ramp crosses red, yellow, green and cyan and comes out as three
 * or four ribbons rather than one. Figma's field has almost none of that — a
 * broad soft swing across the whole frame — which only happens at the bottom of
 * the range, where under half a noise unit spans the width.
 *
 * `gamma` and `paletteBias` shape the radius ramp, and the render pins both ends
 * of it: the bluest patches average `#0050ff`, which is 79% dot coverage — the
 * shader's 0.5-cell ceiling — and the cyan patches sit near 10%, a 0.19 cell.
 * Those are the `clamp(gray + bias)` values 1.0 and 0.38, which 4 and 5 produce.
 *
 * `speed` has no Figma answer — a still cannot carry one. 3 maps to 0.15 noise
 * units a second, slow enough to read as drift rather than motion.
 */

/**
 * Dot pitch of the Figma render in CSS px: 5.33px measured on the 1073px-wide
 * export, which the frame displays at 1280.
 */
const DOT_PITCH = (5.33 * 1280) / 1073;

/**
 * The shader works in device pixels — `cellSize` 1..100 maps linearly onto 6..60
 * of them, and the renderer clamps dpr to 2 — so a fixed number would draw a
 * retina field at half the pitch of a non-retina one. Solving the map for
 * DOT_PITCH at the display's own dpr keeps the pitch constant in CSS px, which
 * is the thing the design actually specifies.
 */
const cellSizeFor = (dpr: number) =>
  Math.min(100, Math.max(1, 1 + ((DOT_PITCH * dpr - 6) * 99) / 54));

/**
 * The dot field, as texture rather than as the subject.
 *
 * Delivered as a full-strength cyan wash, which reads as a 2015 hero banner and
 * overpowers anything set on top of it. Held at low opacity over a near-black
 * ground it does the job the Linear-style look actually wants from it: a surface
 * that is doing something, noticed only if you look for it.
 */
export const WaveField = ({
  className = "",
  bgColor = "#0b0f1a",
  color = "#1d4ed8",
}: {
  className?: string;
  bgColor?: string;
  color?: string;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  /*
   * Device pixel ratio, read without a setState in an effect.
   *
   * It never changes in practice — only dragging a window between displays of
   * different densities would move it, and re-pitching the whole field mid-drag
   * would be more noticeable than the half-step it corrects — so there is
   * nothing to subscribe to. The server snapshot is 1, which is the right
   * assumption for a decorative, aria-hidden field.
   */
  const dpr = useSyncExternalStore(
    () => () => {},
    () => Math.min(window.devicePixelRatio || 1, 2),
    () => 1,
  );
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry.isIntersecting),
    );
    observer.observe(host);
    const sync = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* Pitch solved for this display's dpr, per `cellSizeFor`. The delivered
          version computed it, gated the mount on it, then passed a literal 1 —
          which is exactly the half-pitch retina bug that helper exists to
          prevent. */}
      <ChromaticWaves
        play={!reduceMotion && onScreen && tabVisible}
        bgColor={bgColor}
        colors={[color]}
        cellSize={cellSizeFor(dpr)}
        frequency={1}
        gamma={6}
        paletteBias={10}
        speed={4}
      />
    </div>
  );
};
