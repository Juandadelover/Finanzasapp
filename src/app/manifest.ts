import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanzas — Controla tus gastos e ingresos",
    short_name: "Finanzas",
    description:
      "Aplicación personal de finanzas para registrar gastos e ingresos, organizarlos por categorías y ver estadísticas.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0e13",
    theme_color: "#8a05be",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
