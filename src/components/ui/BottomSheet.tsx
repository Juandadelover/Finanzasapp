"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  SPRINGS,
  clamp,
  createSpring,
  project,
  rubberband,
  useMediaQuery,
  useReducedMotion,
  type Spring,
} from "@/components/ui/motion";

/**
 * Bottom sheet (centered dialog from `sm`).
 * - Drag the header down to dismiss: 1:1 tracking, rubber-band when pulled up,
 *   release velocity is handed to the spring and projected to choose close vs snap back.
 * - Open, close and snap-back are springs that can be grabbed mid-flight.
 * - The scrim opacity follows the sheet position.
 * - Reduced motion (and the centered layout) crossfades instead of sliding.
 * - Esc, scrim click, focus trap/restore and body scroll lock are kept.
 * Close flows: X / Esc / scrim / drag animate out first and call `onClose` when the exit
 * settles. A parent that unmounts the sheet itself still gets an exit via a visual ghost.
 */
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Only the top-most sheet reacts to Esc / Tab.
const sheetStack: object[] = [];

interface Layout {
  flat: boolean;
  centered: boolean;
}

function render(backdrop: HTMLElement | null, panel: HTMLElement | null, y: number, h: number, mode: Layout) {
  const t = clamp(y / (h || 1), 0, 1);
  if (backdrop) backdrop.style.opacity = String(1 - t);
  if (!panel) return;
  if (mode.flat) {
    panel.style.opacity = String(1 - t);
    panel.style.transform = mode.centered ? `scale(${1 - 0.04 * t})` : "none";
  } else {
    panel.style.transform = `translate3d(0,${y}px,0)`;
  }
}

export function BottomSheet({ isOpen, onClose, title, children, className }: BottomSheetProps) {
  const [mounted, setMounted] = useState(isOpen);
  const [returnTo, setReturnTo] = useState<Element | null>(() =>
    isOpen && typeof document !== "undefined" ? document.activeElement : null
  );
  if (isOpen && !mounted) {
    setMounted(true);
    setReturnTo(document.activeElement);
  }

  const reduced = useReducedMotion();
  const centered = useMediaQuery("(min-width: 640px)");
  const flat = reduced || centered;

  const rootRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<Spring | null>(null);
  const heightRef = useRef(0);
  const modeRef = useRef<Layout>({ flat, centered });
  const closingRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const onCloseRef = useRef(onClose);
  const dragRef = useRef<{
    startY: number;
    startPointer: number;
    id: number;
    samples: { y: number; t: number }[];
  } | null>(null);

  useLayoutEffect(() => {
    modeRef.current = { flat, centered };
    isOpenRef.current = isOpen;
    onCloseRef.current = onClose;
  });

  const paint = useCallback((y: number) => {
    render(backdropRef.current, panelRef.current, y, heightRef.current, modeRef.current);
  }, []);

  const clearWillChange = () => {
    if (panelRef.current) panelRef.current.style.willChange = "";
  };

  // Enter / exit driven by `isOpen` (parent keeps the component mounted).
  useLayoutEffect(() => {
    if (!mounted) return;
    const panel = panelRef.current;
    if (!panel) return;
    heightRef.current = panel.offsetHeight;
    if (!springRef.current) {
      springRef.current = createSpring(heightRef.current, paint);
      paint(heightRef.current);
    }
    const s = springRef.current;
    panel.style.willChange = "transform, opacity";
    if (isOpen) {
      closingRef.current = false;
      s.to(0, SPRINGS.sheet, { onDone: clearWillChange });
    } else {
      s.to(heightRef.current, SPRINGS.sheet, {
        onDone: () => {
          springRef.current = null;
          setMounted(false);
        },
      });
    }
  }, [mounted, isOpen, paint]);

  // Parent unmounted us while open: animate a visual ghost out so the exit stays symmetric.
  useLayoutEffect(() => {
    const root = rootRef;
    const springs = springRef;
    const heights = heightRef;
    const modes = modeRef;
    return () => {
      const el = root.current;
      const s = springs.current;
      if (!el || !s || typeof document === "undefined") return;
      const h = heights.current;
      if (s.value >= h - 1) return;
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("role");
      ghost.setAttribute("aria-hidden", "true");
      ghost.setAttribute("inert", "");
      ghost.style.pointerEvents = "none";
      document.body.appendChild(ghost);
      const gb = ghost.querySelector<HTMLElement>("[data-sheet-backdrop]");
      const gp = ghost.querySelector<HTMLElement>("[data-sheet-panel]");
      const mode = modes.current;
      const gs = createSpring(s.value, (y) => render(gb, gp, y, h, mode));
      gs.to(h, SPRINGS.sheet, { velocity: s.velocity, onDone: () => ghost.remove() });
    };
  }, []);

  const requestClose = useCallback(
    (velocity = 0) => {
      const s = springRef.current;
      if (!s || closingRef.current) return;
      closingRef.current = true;
      heightRef.current = panelRef.current?.offsetHeight ?? heightRef.current;
      if (panelRef.current) panelRef.current.style.willChange = "transform, opacity";
      s.to(heightRef.current, SPRINGS.sheet, {
        velocity,
        onDone: () => {
          onCloseRef.current();
          // A parent that keeps us open (refused close) gets the sheet back.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (rootRef.current && isOpenRef.current && springRef.current) {
                closingRef.current = false;
                springRef.current.to(0, SPRINGS.sheet, { onDone: clearWillChange });
              }
            })
          );
        },
      });
    },
    []
  );

  // Esc, focus trap, focus restore, body scroll lock.
  const active = mounted && isOpen;
  useEffect(() => {
    if (!active) return;
    const token = {};
    sheetStack.push(token);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (sheetStack[sheetStack.length - 1] !== token) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if (e.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const current = document.activeElement;
        if (e.shiftKey && (current === first || current === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = sheetStack.indexOf(token);
      if (i >= 0) sheetStack.splice(i, 1);
      document.body.style.overflow = original;
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [active, requestClose, returnTo]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const s = springRef.current;
    if (flat || !s || !isOpenRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest("button")) return;
    // Take over from wherever the sheet is on screen right now.
    s.stop();
    closingRef.current = false;
    heightRef.current = panelRef.current?.offsetHeight ?? heightRef.current;
    if (panelRef.current) panelRef.current.style.willChange = "transform";
    dragRef.current = {
      startY: s.value,
      startPointer: e.clientY,
      id: e.pointerId,
      samples: [{ y: e.clientY, t: e.timeStamp }],
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const s = springRef.current;
    if (!d || !s || d.id !== e.pointerId) return;
    const raw = d.startY + (e.clientY - d.startPointer);
    s.set(raw < 0 ? -rubberband(-raw, heightRef.current) : raw);
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = dragRef.current;
    const s = springRef.current;
    if (!d || !s || d.id !== e.pointerId) return;
    dragRef.current = null;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const fresh = e.timeStamp - last.t < 80;
    const velocity = fresh && last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0;
    const h = heightRef.current;
    const projected = s.value + project(velocity);
    if (!cancelled && projected > h * 0.5) {
      requestClose(velocity);
    } else {
      s.to(0, SPRINGS.sheet, { velocity, onDone: clearWillChange });
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div
        data-sheet-backdrop
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => requestClose()}
      />
      <div
        ref={panelRef}
        data-sheet-panel
        tabIndex={-1}
        className={cn(
          "relative z-10 max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[var(--shadow-sheet)] outline-none sm:max-w-md sm:rounded-3xl",
          className
        )}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          className="material-bar sticky top-0 z-10 flex touch-none items-center justify-between border-b border-[var(--color-border)] px-5 py-2.5 sm:touch-auto"
        >
          <span
            aria-hidden
            className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-full bg-[var(--color-surface-3)] sm:hidden"
          />
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => requestClose()}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] active:scale-[0.92] active:bg-[var(--color-surface-2)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
