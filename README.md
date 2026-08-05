# Finanzas

Aplicación web personal de finanzas para registrar ingresos y gastos, organizarlos por categorías y visualizar estadísticas. Construida con **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4** y **Supabase** (base de datos + autenticación).

Identidad visual propia en morado, tema oscuro.

## Funcionalidades

- **Inicio**: balance disponible del mes, resumen de ingresos/gastos, accesos rápidos para registrar movimientos y últimos movimientos.
- **Movimientos**: historial completo con búsqueda por nombre/categoría y filtro por tipo (ingreso/gasto).
- **Estadísticas**: tendencia de gastos, proyección de balance futuro a 90 días, gastos por categoría (gráfica circular) e ingresos vs. gastos por mes (gráfica de barras).
- **Ajustes**: cuenta y cierre de sesión, bloqueo con huella/Face ID, gestión de categorías, moneda, exportar/importar respaldo en JSON y borrado de datos.
- **Autenticación con Google** — cada usuario solo ve sus propios datos (Row Level Security en Postgres).
- **Bloqueo biométrico local**: una vez con sesión iniciada, puedes exigir huella/Face ID para reabrir la app en ese dispositivo (WebAuthn).

## Stack técnico

- [Next.js](https://nextjs.org) (App Router, Turbopack)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) para las gráficas
- [lucide-react](https://lucide.dev/) para los íconos
- [Supabase](https://supabase.com) — Postgres + Auth (Google OAuth) + `@supabase/ssr` para Next.js
- WebAuthn nativo del navegador para el bloqueo con huella/Face ID (no depende de Supabase)

## Primeros pasos (desarrollo local)

```bash
npm install
cp .env.example .env.local   # completa NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

Otros scripts disponibles:

```bash
npm run build   # build de producción
npm run start   # sirve el build de producción
npm run lint    # ESLint
```

## Base de datos (Supabase)

El proyecto de Supabase usado es **Finanzasapp** (región `sa-east-1`). El esquema ya está aplicado (tablas `profiles`, `user_settings`, `categories`, `transactions`, todas con Row Level Security: cada usuario solo puede leer/escribir sus propias filas). Al crearse un usuario nuevo, un trigger le genera automáticamente sus categorías por defecto.

### Pasos manuales pendientes (no se pueden hacer desde aquí)

Para que el botón **"Continuar con Google"** funcione, hay que habilitar el proveedor de Google en Supabase Auth. Esto requiere credenciales OAuth que solo tú puedes crear:

1. **Google Cloud Console** → [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
   - Crea un **OAuth client ID** de tipo "Web application".
   - En *Authorized redirect URIs* agrega:
     `https://mguwvxwqpqhgspdbjrnw.supabase.co/auth/v1/callback`
   - Copia el **Client ID** y el **Client Secret**.
2. **Supabase Dashboard** → tu proyecto **Finanzasapp** → *Authentication → Providers → Google*
   - Actívalo y pega el Client ID / Client Secret del paso anterior.
3. **Supabase Dashboard** → *Authentication → URL Configuration*
   - En *Redirect URLs* agrega la URL de producción, por ejemplo:
     `https://tu-dominio.vercel.app/auth/callback` (y `http://localhost:3000/auth/callback` para probar en local).

Sin este paso, el botón de Google mostrará un error al iniciar sesión — el resto de la app (esquema, RLS, rutas protegidas) ya está listo.

## Deployment (Vercel)

En el proyecto de Vercel conectado a este repositorio, agrega estas variables de entorno (mismas que `.env.example`, con el valor real de la anon key):

```
NEXT_PUBLIC_SUPABASE_URL=https://mguwvxwqpqhgspdbjrnw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del proyecto Finanzasapp en Supabase>
```

La anon key es pública por diseño (va al navegador), pero no la subimos al repo por buena práctica; tómala del dashboard de Supabase (*Project Settings → API*).

## Estructura del proyecto

```
src/
  app/
    (app)/               # rutas protegidas: inicio, movimientos, estadísticas, ajustes
    login/                # pantalla de login con Google
    auth/callback/        # intercambia el código de OAuth por una sesión
  components/            # UI: tarjetas, formularios, navegación, gráficas, AppLockGate
  context/               # FinanceContext (datos vía Supabase) y UIContext (modales)
  lib/
    supabase/             # clientes browser/server/middleware + mapeo de filas
    webauthn.ts           # registro/verificación del bloqueo biométrico local
    selectors.ts, format.ts, icons.ts, defaults.ts
  types/                  # tipos de dominio (Transaction, Category, Settings)
  proxy.ts                # (antes middleware.ts) protege rutas y refresca la sesión
```

## Roadmap

- **Fase 2**: Asistente con inteligencia artificial que permita registrar movimientos por texto, voz o foto (aviso "Próximamente" en Ajustes).
- Sincronización en tiempo real entre dispositivos (Supabase Realtime) y presupuestos mensuales por categoría.

## Licencia

Proyecto personal — sin licencia pública definida.
