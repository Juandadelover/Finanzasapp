export default function AppTemplate({ children }: { children: React.ReactNode }) {
  // Se vuelve a montar en cada navegación: fundido de solo opacidad, sin desplazar el layout.
  return <div className="page-enter">{children}</div>;
}
