# Finanzas

Aplicación web personal de finanzas para registrar ingresos y gastos, organizarlos por categorías y visualizar estadísticas. Construida con **Next.js 16 (App Router)**, **TypeScript** y **Tailwind CSS v4**.

Esta es la **v1**: todos los datos se guardan localmente en el navegador (`localStorage`), sin backend ni base de datos. El modelo de datos está pensado para migrar más adelante a una base de datos real sin reescribir la lógica de negocio.

## Funcionalidades

- **Inicio**: balance disponible del mes, resumen de ingresos/gastos, accesos rápidos para registrar movimientos y últimos movimientos.
- **Movimientos**: historial completo con búsqueda por nombre/categoría y filtro por tipo (ingreso/gasto).
- **Estadísticas**: tendencia de gastos, proyección de balance futuro a 90 días, gastos por categoría (gráfica circular) e ingresos vs. gastos por mes (gráfica de barras).
- **Ajustes**: gestión de categorías (crear, editar, eliminar, ícono y color personalizados), selección de moneda, exportar/importar respaldo en JSON y borrado de datos.
- **Selector de mes** en la parte superior para navegar el histórico.

## Stack técnico

- [Next.js](https://nextjs.org) (App Router, Turbopack)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) para las gráficas
- [lucide-react](https://lucide.dev/) para los íconos
- Persistencia en `localStorage` a través de un `FinanceContext` (React Context + hooks)

## Primeros pasos

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

Otros scripts disponibles:

```bash
npm run build   # build de producción
npm run start   # sirve el build de producción
npm run lint    # ESLint
```

## Estructura del proyecto

```
src/
  app/                  # rutas (App Router): inicio, movimientos, estadísticas, ajustes
  components/           # componentes de UI (tarjetas, formularios, navegación, gráficas)
  context/               # FinanceContext (datos) y UIContext (modales)
  lib/                   # storage (localStorage), selectors (agregaciones), format, íconos
  types/                  # tipos de dominio (Transaction, Category, Settings)
```

## Roadmap

- **Fase 2**: Asistente con inteligencia artificial que permita registrar movimientos por texto, voz o foto (ya hay un aviso "Próximamente" en Ajustes).
- **Fase 3**: Migración de `localStorage` a una base de datos (p. ej. Supabase/Postgres) con autenticación y sincronización entre dispositivos, reutilizando el mismo modelo de datos (`Transaction`, `Category`, `Settings`).

## Licencia

Proyecto personal — sin licencia pública definida.
