"use client";

/**
 * Motion primitives (springs, gesture math, haptics, reduced-motion hooks).
 *
 * Springs are described the way Apple does: `response` (seconds to reach the
 * target, not a duration) and `damping` ratio (1 = critically damped, no
 * overshoot). They always start from the live value and velocity, so a new
 * `to()` call re-targets mid-flight without a visible seam.
 */
import { useCallback, useSyncExternalStore } from "react";

export interface SpringConfig {
  response: number;
  damping: number;
}

/** Critically damped by default: overshoot only where a flick carried momentum. */
export const SPRINGS = {
  /** Sheet open / close / snap back. */
  sheet: { response: 0.34, damping: 1 },
  /** Small UI state: menus, tab indicators. */
  ui: { response: 0.3, damping: 1 },
} as const satisfies Record<string, SpringConfig>;

export interface SpringOptions {
  /** Initial velocity in value-units per second (e.g. pointer release velocity). */
  velocity?: number;
  onDone?: () => void;
}

export interface Spring {
  readonly value: number;
  readonly velocity: number;
  /** Animate to `target` from the current value and (unless given) the current velocity. */
  to(target: number, config: SpringConfig, options?: SpringOptions): void;
  /** Jump to a value (direct manipulation) and cancel any running animation. */
  set(value: number): void;
  /** Freeze at the current on-screen value so the user can take over. */
  stop(): void;
}

export function createSpring(
  initial: number,
  onUpdate: (value: number) => void,
  { restDelta = 0.4, restSpeed = 4 }: { restDelta?: number; restSpeed?: number } = {}
): Spring {
  let x = initial;
  let v = 0;
  let target = initial;
  let raf = 0;
  let last = 0;
  let cfg: SpringConfig = SPRINGS.ui;
  let done: (() => void) | undefined;

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const k = (2 * Math.PI / cfg.response) ** 2;
    const c = (4 * Math.PI * cfg.damping) / cfg.response;
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      v += (-k * (x - target) - c * v) * h;
      x += v * h;
    }
    if (Math.abs(x - target) < restDelta && Math.abs(v) < restSpeed) {
      x = target;
      v = 0;
      raf = 0;
      onUpdate(x);
      const cb = done;
      done = undefined;
      cb?.();
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(frame);
  }

  function cancel() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    done = undefined;
  }

  return {
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
    to(t, config, options = {}) {
      cancel();
      target = t;
      cfg = config;
      if (options.velocity !== undefined) v = options.velocity;
      done = options.onDone;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    set(value) {
      cancel();
      x = value;
      v = 0;
      target = value;
      onUpdate(x);
    },
    stop() {
      cancel();
      target = x;
    },
  };
}

/** Where a flick at `velocity` (px/s) would come to rest, relative to the release point. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further you pull, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Short confirmation tick where the Vibration API exists; a no-op everywhere else. */
export function haptic(ms = 10) {
  try {
    if (typeof navigator !== "undefined") navigator.vibrate?.(ms);
  } catch {
    // Vibration can be blocked by policy; feedback is optional.
  }
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
