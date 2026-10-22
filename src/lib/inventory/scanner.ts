/**
 * Distingue un lector de códigos (ráfaga rápida terminada en Enter) del tecleo humano.
 * `push` recibe `event.key` y un tiempo en ms; devuelve el código solo al llegar Enter tras una ráfaga.
 */
export function createBurstDetector(opts: { minLength?: number; maxGapMs?: number } = {}) {
  const minLength = opts.minLength ?? 6;
  const maxGapMs = opts.maxGapMs ?? 50;
  let buffer = "";
  let last = -Infinity;

  return {
    push(key: string, t: number): string | null {
      if (key === "Enter") {
        const fast = t - last <= maxGapMs;
        const code = buffer;
        buffer = "";
        last = -Infinity;
        return fast && code.length >= minLength ? code : null;
      }
      if (key.length !== 1) {
        // Modificadores (Shift, etc.) no cuentan; cualquier otra tecla especial (Tab, flechas) corta la ráfaga.
        if (["Shift", "CapsLock", "AltGraph", "Alt", "Control", "Meta"].includes(key)) return null;
        buffer = "";
        last = -Infinity;
        return null;
      }
      if (t - last > maxGapMs) buffer = "";
      buffer += key;
      last = t;
      return null;
    },
    reset() {
      buffer = "";
      last = -Infinity;
    },
  };
}
