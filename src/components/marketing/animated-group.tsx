import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A group whose children arrive one after another.
 *
 * Deliberately CSS rather than a motion library. The obvious implementation
 * server-renders every child at `opacity: 0` and waits for JavaScript to reveal
 * it — which means a slow bundle, a hydration error, or a blocked script leaves
 * the visitor looking at a blank page. That is precisely what happened here.
 *
 * A CSS keyframe with `both` fill runs without JavaScript and cannot strand
 * content: worst case the animation is skipped and the text is simply there.
 * The blur is kept, because text resolving out of focus is the part that makes
 * the entrance feel considered rather than merely animated.
 */
export function AnimatedGroup({
  children,
  className,
  delay = 0,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds before this group begins, for sequencing one after another. */
  delay?: number;
  /** Seconds between children. */
  stagger?: number;
}) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <div className={cn(className)}>
      {items.map((child, index) => (
        <div
          key={index}
          className="appear-blur"
          style={{ animationDelay: `${delay + index * stagger}s` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
