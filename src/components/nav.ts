import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  FileText,
  HandCoins,
  Home,
  Landmark,
  LineChart,
  Package,
  Receipt,
  Repeat,
  Settings,
  ShoppingCart,
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
  { href: "/vender", label: "Vender", icon: ShoppingCart },
  { href: "/ventas", label: "Ventas", icon: Receipt },
  { href: "/movimientos", label: "Movimientos", icon: Wallet },
  { href: "/cartera", label: "Cartera", icon: HandCoins },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/reportes", label: "Reportes", icon: FileText },
];

/** Sidebar (lg+) secondary group. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/cuentas", label: "Cuentas", icon: Landmark },
  { href: "/contactos", label: "Contactos", icon: Users },
  { href: "/cobros", label: "Cobros", icon: Receipt },
  { href: "/recurrentes", label: "Recurrentes", icon: Repeat },
  { href: "/equipo", label: "Equipo", icon: Users },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

/** Consola del operador (admin de la plataforma): reemplaza por completo la navegación de la app de clientes. */
export const ADMIN_CONSOLE_NAV: NavItem[] = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/ingresos", label: "Ingresos", icon: LineChart },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

/** Rutas que un admin de plataforma puede usar: la consola y su cuenta. El resto es la app de clientes. */
export function isTenantPath(pathname: string): boolean {
  return !(/^\/(admin|cuenta)(\/|$)/.test(pathname));
}

/** Segment-aware: "/cuenta" must not match "/cuentas". */
export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
