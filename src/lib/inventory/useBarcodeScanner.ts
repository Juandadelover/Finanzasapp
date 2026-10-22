"use client";

import { useEffect, useRef } from "react";
import { createBurstDetector } from "./scanner";

/**
 * Escucha el teclado globalmente y avisa cuando detecta un código de lector (ráfaga + Enter).
 * Si el foco estaba en un campo de texto, deja el campo como estaba antes de la ráfaga.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true): void {
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;
    const detector = createBurstDetector();
    // Valor del campo antes de que empezara la ráfaga actual.
    let field: HTMLInputElement | HTMLTextAreaElement | null = null;
    let before = "";
    let burstLen = 0;
    let lastT = -Infinity;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const isField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (e.key.length === 1) {
        if (e.timeStamp - lastT > 50) burstLen = 0;
        lastT = e.timeStamp;
        if (isField) {
          if (field !== target || burstLen === 0) {
            field = target as HTMLInputElement | HTMLTextAreaElement;
            before = field.value;
          }
        } else {
          field = null;
        }
        burstLen += 1;
      }
      const code = detector.push(e.key, e.timeStamp);
      if (e.key !== "Enter" && e.key.length !== 1 && !["Shift", "CapsLock", "AltGraph", "Alt", "Control", "Meta"].includes(e.key)) {
        burstLen = 0;
        field = null;
      }
      if (code) {
        e.preventDefault();
        if (field) {
          // React controla el valor: se usa el setter nativo para que onChange se entere.
          const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, before);
          field.dispatchEvent(new Event("input", { bubbles: true }));
        }
        burstLen = 0;
        field = null;
        cb.current(code);
      } else if (e.key === "Enter") {
        burstLen = 0;
        field = null;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);
}
