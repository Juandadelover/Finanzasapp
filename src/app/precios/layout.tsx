import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Precios · Finanzas",
  description: "Planes de Finanzas para el dueño de un negocio pequeño: empieza gratis y paga por Nequi, Bancolombia o llave Bre-B.",
};

export default function PreciosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
