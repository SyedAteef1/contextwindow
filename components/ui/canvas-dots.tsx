"use client";

// A soft, living starfield. Stars twinkle, drift slowly, and gently parallax toward the
// cursor; nearby stars are linked by faint emerald threads (the "connect the dots" motif).
// Tuned for the dark green theme. Honors prefers-reduced-motion (renders a calm static field).
// pointer-events-none so it never blocks clicks — mouse is tracked at the window level.

import { useEffect, useRef } from "react";

type Star = {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  size: number;
  depth: number; // 0..1, drives parallax + drift speed (closer = larger/faster)
  twPhase: number; // twinkle phase
  twSpeed: number; // twinkle speed
  baseAlpha: number;
  color: [number, number, number];
  glow: boolean;
};

// Palette: mostly soft white, a sprinkle of emerald + mint to tie into the brand.
const PALETTE: [number, number, number][] = [
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [220, 252, 231], // mint white
  [134, 239, 172], // mint
  [74, 222, 128], // emerald
];

export function CanvasDots({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    let start = 0;

    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    };

    const build = () => {
      // Density scales with area but is capped so the O(n^2) link pass stays cheap.
      const count = Math.min(160, Math.floor((w * h) / 11000));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        const size = 0.6 + depth * 1.9 + (Math.random() < 0.08 ? 1.4 : 0); // a few hero stars
        return {
          baseX: Math.random() * w,
          baseY: Math.random() * h,
          x: 0,
          y: 0,
          size,
          depth,
          twPhase: Math.random() * Math.PI * 2,
          twSpeed: 0.6 + Math.random() * 1.6,
          baseAlpha: 0.35 + Math.random() * 0.5,
          color: PALETTE[(Math.random() * PALETTE.length) | 0],
          glow: size > 2.1,
        };
      });
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const frame = (t: number) => {
      if (!start) start = t;
      const time = (t - start) / 1000;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        // Slow autonomous drift (parallax by depth) keeps it alive with no cursor.
        const drift = reduceMotion ? 0 : Math.sin(time * 0.15 + s.twPhase) * (2 + s.depth * 6);
        let x = s.baseX + drift;
        let y = s.baseY + Math.cos(time * 0.12 + s.twPhase) * (1 + s.depth * 4) * (reduceMotion ? 0 : 1);

        // Gentle parallax toward the cursor (closer stars move more).
        const dx = mouse.x - x;
        const dy = mouse.y - y;
        const dist = Math.hypot(dx, dy);
        const R = 170;
        if (dist < R) {
          const f = (R - dist) / R;
          x -= (dx / (dist || 1)) * f * (4 + s.depth * 16);
          y -= (dy / (dist || 1)) * f * (4 + s.depth * 16);
        }
        s.x = x;
        s.y = y;

        // Twinkle.
        const tw = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(time * s.twSpeed + s.twPhase);
        const alpha = s.baseAlpha * tw;
        const [r, g, b] = s.color;

        if (s.glow) {
          ctx.shadowBlur = 8 + s.size * 2;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Faint emerald links between nearby stars.
      const maxDist = Math.min(140, w / 6);
      const maxSq = maxDist * maxDist;
      for (let a = 0; a < stars.length; a++) {
        for (let b = a + 1; b < stars.length; b++) {
          const dx = stars[a].x - stars[b].x;
          const dy = stars[a].y - stars[b].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < maxSq) {
            const o = (1 - d2 / maxSq) * 0.18;
            ctx.strokeStyle = `rgba(74, 222, 128, ${o})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(stars[a].x, stars[a].y);
            ctx.lineTo(stars[b].x, stars[b].y);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
      style={{ zIndex: 0 }}
    />
  );
}
