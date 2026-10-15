import { createClient } from "@/lib/supabase/client";

// Cierre de sesión completo: Supabase, datos locales de la app, caché del
// service worker y recarga a /login para no dejar nada en memoria.
//
// Se conserva solo la preferencia de tema (claro/oscuro), que no es de la cuenta.

const APP_KEY_PREFIXES = ["finanzasapp", "finanzas:", "sb-"];

export function clearLocalAppData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (APP_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
    }
  } catch {
    // Almacenamiento no disponible (modo privado): nada que limpiar.
  }
  try {
    sessionStorage.clear();
  } catch {
    // Ídem.
  }
}

// Respaldo por si signOut() falla sin red: las cookies de sesión de Supabase
// (sb-*) no son httpOnly, así que se pueden expirar desde el navegador.
function clearAuthCookies() {
  try {
    for (const part of document.cookie.split(";")) {
      const name = part.split("=")[0]?.trim();
      if (name?.startsWith("sb-")) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  } catch {
    // Sin acceso a cookies: se ignora.
  }
}

async function clearCaches() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache Storage no disponible: se ignora.
  }
}

/**
 * Cierra la sesión y vuelve al login.
 * - scope "local": solo este dispositivo (botón "Cerrar sesión").
 * - scope "global": todos los dispositivos ("Cerrar sesión en todos lados").
 */
export async function signOutAndReset(
  scope: "local" | "global" = "local",
  redirectTo = "/login"
): Promise<void> {
  try {
    await createClient().auth.signOut({ scope });
  } catch {
    // Aunque falle la red, se limpia todo lo local y se sale igual.
  }
  clearAuthCookies();
  clearLocalAppData();
  await clearCaches();
  // replace(): "Atrás" no devuelve a una pantalla privada; recarga completa vacía la memoria de React.
  window.location.replace(redirectTo);
}
