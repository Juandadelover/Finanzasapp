import {
  BarChart3,
  FileText,
  HandCoins,
  Home,
  Landmark,
  Receipt,
  Repeat,
  Settings,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Sidebar (lg+) primary group. The mobile BottomNav keeps its own 5-item list. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/movimientos", label: "Movimientos", icon: Wallet },
  { href: "/cartera", label: "Cartera", icon: HandCoins },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/reportes", label: "Reportes", icon: FileText },
];

/** Sidebar (lg+) secondary group. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/contactos", label: "Contactos", icon: Users },
  { href: "/cobros", label: "Cobros", icon: Receipt },
  { href: "/recurrentes", label: "Recurrentes", icon: Repeat },
  { href: "/equipo", label: "Equipo", icon: Users },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export const ADMIN_NAV: NavItem = { href: "/admin", label: "Admin", icon: Shield };

/** Segment-aware: "/cuenta" must not match "/cuentas". */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
