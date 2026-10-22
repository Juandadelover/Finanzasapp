/** Dígito de control GS1 (módulo 10) para el cuerpo de un GTIN (sin el último dígito). */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    // Desde la derecha del cuerpo: el primero pesa 3, el siguiente 1, etc.
    const weight = (body.length - i) % 2 === 1 ? 3 : 1;
    sum += Number(body[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/** EAN-8, UPC-A y EAN-13 se verifican con GS1 módulo 10; otros formatos pasan sin validar. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return true;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.slice(-1));
}

/** Código interno de tienda: prefijo GS1 "20" + consecutivo de 10 dígitos + dígito de control. */
export function internalEan13(seq: number): string {
  if (!Number.isInteger(seq) || seq < 0 || seq > 9_999_999_999) throw new RangeError("Consecutivo fuera de rango");
  const body = `20${String(seq).padStart(10, "0")}`;
  return `${body}${gtinCheckDigit(body)}`;
}
