# Plan para dejar Finanzas listo para producción

Estado de partida: Fases 0, 1 y 2 construidas (negocios con roles, cuentas, cartera, cuentas de cobro, suscripciones con pago manual, panel admin, recordatorios por email). Ver `docs/REQUISITOS-SAAS.md`.

Leyenda: 🤖 lo hace el equipo de desarrollo (Claude + agentes) · 👤 lo hace el dueño del producto.

## Ola 1 — Funcionalidad que falta para vender

| # | Entregable | Detalle | Quién |
|---|---|---|---|
| 1.1 | Equipo e invitaciones | Pantalla "Equipo": invitar por email con rol, enlace de invitación con vencimiento (7 días), aceptar, cambiar rol, quitar miembro, salir del negocio. Respeta el límite de miembros del plan. Email de invitación por la cola de correos. | 🤖 |
| 1.2 | Varios negocios | "Crear negocio" desde el selector; "Datos del negocio" (nombre, NIT/CC, régimen) para dueño/admin. | 🤖 |
| 1.3 | Cuenta y acceso | "¿Olvidaste tu contraseña?" + página para definir la nueva; cambiar contraseña en Ajustes; solicitud de eliminación de cuenta (30 días de gracia, Ley 1581). | 🤖 |
| 1.4 | Legal | Términos y condiciones, Política de tratamiento de datos (Ley 1581/2012), Política de cancelación y reembolso; casilla de aceptación obligatoria al crear cuenta, con fecha registrada. Borradores para revisión de abogado. | 🤖 borrador · 👤 revisión |
| 1.5 | Movimientos recurrentes | "Repetir" (semanal, mensual, anual) al registrar; se generan solos cada día (pendientes o pagados) y se gestionan en una lista. | 🤖 |
| 1.6 | Reportes | Estado de resultados (P&G) y flujo de caja por mes/trimestre/año, comparativo con el periodo anterior, exportar a Excel (CSV) y PDF. | 🤖 |
| 1.7 | Página de precios pública | `/precios`, enlazada desde el login. | 🤖 |

## Ola 2 — Calidad, UX y endurecimiento

| # | Entregable | Detalle | Quién |
|---|---|---|---|
| 2.1 | Corrección de errores | Al borrar una categoría la app ocultaba sus movimientos (en la base quedan sin categoría). | 🤖 |
| 2.2 | Rendimiento | Cargar movimientos por rango de fechas en vez de todo el historial. | 🤖 |
| 2.3 | Primeros pasos | Lista de bienvenida en Inicio (crear cuenta bancaria, registrar 3 movimientos, agregar un cliente, invitar a tu contador) que desaparece al completarse. | 🤖 |
| 2.4 | UX y accesibilidad (WCAG 2.1 AA) | Diálogo de confirmación propio (en vez de `window.confirm`), estados de carga (skeletons), estados vacíos útiles, objetivos táctiles ≥ 44 px, etiquetas y foco visibles, contraste, mensajes de error accionables. | 🤖 |
| 2.5 | Seguridad web | Cabeceras de seguridad (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy), `noindex` en la app, páginas de error (`error`, `not-found`, `global-error`). | 🤖 |
| 2.6 | Observabilidad | Registro de errores del cliente (preparado para Sentry con `NEXT_PUBLIC_SENTRY_DSN`); alerta de correos fallidos en `/admin`. | 🤖 · 👤 crear cuenta Sentry |

## Ola 3 — Pruebas y entrega continua

| # | Entregable | Detalle | Quién |
|---|---|---|---|
| 3.1 | Pruebas unitarias (Vitest) | Saldos, totales, cartera (antigüedad, WhatsApp), numeración y totales de documentos, mensajes de límites. | 🤖 |
| 3.2 | Pruebas de base de datos | Permisos por rol (RLS), límites de plan, flujo de pago y aprobación, recurrentes, invitaciones — en `supabase/tests`, sobre Supabase local. | 🤖 |
| 3.3 | Pruebas de punta a punta (Playwright) | Login, registrar movimiento, cuenta de cobro, cartera, permisos del contador, pago manual y aprobación en `/admin`. | 🤖 |
| 3.4 | CI en GitHub Actions | Lint, tipos, unitarias, build y pruebas de base de datos en cada PR. | 🤖 |
| 3.5 | Entorno local reproducible | `supabase/config.toml` para levantar todo con `supabase start`. | 🤖 |

## Lanzamiento (fuera del código)

| # | Tarea | Quién |
|---|---|---|
| L.1 | Crear proyecto de Supabase de **producción** (plan Pro: respaldos PITR, sin pausas), aplicar migraciones, **sin** seed ni modo invitado. El proyecto actual queda como staging. | 👤 (con ayuda 🤖) |
| L.2 | Dominio de correo en Resend, SMTP de Supabase Auth con Resend, secretos `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`. | 👤 |
| L.3 | Vercel: variables de entorno de producción y dominio propio. | 👤 |
| L.4 | `/admin` → Configuración: datos reales de Nequi, Bancolombia y Bre-B. | 👤 |
| L.5 | Revisión legal de los textos. Activar "Leaked password protection" en Supabase Auth. | 👤 |
| L.6 | Merge de la rama a `main` tras revisión. | 👤 |

## Criterios de "listo para producción"

- CI en verde: lint, tipos, unitarias, build, pruebas de base de datos y de punta a punta.
- Cada rol probado: dueño, admin, editor, contador, solo registro, plan Gratis y admin de plataforma.
- Ningún dato de un negocio visible desde otro (pruebas de RLS).
- Páginas legales publicadas y consentimiento registrado.
- Correos transaccionales enviándose desde un dominio verificado.
- Respaldos automáticos activos en el proyecto de producción.
