"use client";

import { useEffect, useState } from "react";

// Count-up duration from the motion tokens (docs/UI_DESIGN_SYSTEM.md): the
// tally counts ease over 520ms, decelerating into the final number. Kept
// under the hero-move ceiling so the reveal reads quick, not slow.
const COUNT_UP_DURATION_MS = 520;

/// Animates 0 to `target` on a decelerating curve after `delayMs`, matching
/// the tally reveal choreography. Under prefers-reduced-motion the value
/// lands on the first frame instead of animating.
export function useCountUp(target: number, delayMs: number): number {
  const [displayValue, setDisplayValue] = useState(0);

  // External system sync: the browser animation clock (setTimeout + rAF).
  // State updates happen only inside rAF callbacks; cleanup cancels both
  // timers so a mid-flight count never touches a dead component.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const durationMs = prefersReducedMotion ? 0 : COUNT_UP_DURATION_MS;
    const startDelayMs = prefersReducedMotion ? 0 : delayMs;
    let frameId = 0;
    const timerId = setTimeout(() => {
      const startedAt = performance.now();
      const stepFrame = (nowMs: number) => {
        const progress = durationMs === 0 ? 1 : Math.min(1, (nowMs - startedAt) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(target * eased));
        if (progress < 1) frameId = requestAnimationFrame(stepFrame);
      };
      frameId = requestAnimationFrame(stepFrame);
    }, startDelayMs);
    return () => {
      clearTimeout(timerId);
      cancelAnimationFrame(frameId);
    };
  }, [target, delayMs]);

  return displayValue;
}
